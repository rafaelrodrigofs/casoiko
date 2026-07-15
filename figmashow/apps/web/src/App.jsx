import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cloneNodeTree,
  duplicateSiblingNodes,
  findNodeById,
  groupSiblingNodes,
  insertNodeInTree,
  moveNodeBy,
  removeNodeFromTree,
  reorderSiblingNode,
  resizeNodeBox,
  shiftNodeTree,
  ungroupNode,
  updateNodeInTree,
} from '@figmashow/core/schema';
import InfiniteCanvas from './InfiniteCanvas.jsx';
import LayersPanel from './LayersPanel.jsx';
import PropertiesPanel from './PropertiesPanel.jsx';
import ToolsBar from './ToolsBar.jsx';

const POLL_MS = 500;
const MAX_HISTORY = 50;
const DIRTY_TIMEOUT_MS = 8000;
const NUDGE = 1;
const NUDGE_SHIFT = 10;
const DUP_OFFSET = 16;

function containsNodeId(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return true;
    if (node.type === 'group' && containsNodeId(node.children, id)) return true;
  }
  return false;
}

function cloneBoard(board) {
  return structuredClone(board);
}

function isTypingTarget(el) {
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
}

export default function App() {
  const [board, setBoard] = useState(null);
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [error, setError] = useState(null);
  const [statusNote, setStatusNote] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [zoom, setZoom] = useState(0.55);
  const [handMode, setHandMode] = useState(false);
  const [activeTool, setActiveTool] = useState('move');
  const canvasRef = useRef(null);
  const panActiveRef = useRef(false);
  const boardRef = useRef(null);
  const dirtyRef = useRef(false);
  const dirtySinceRef = useRef(0);
  const knownRevisionRef = useRef(0);
  const persistGenRef = useRef(0);
  const clipboardRef = useRef([]);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const screenSelectionReadyRef = useRef(false);
  const selectedScreenIdRef = useRef(null);
  const selectedNodeIdsRef = useRef([]);

  boardRef.current = board;
  selectedScreenIdRef.current = selectedScreenId;
  selectedNodeIdsRef.current = selectedNodeIds;

  const selectTool = useCallback((toolId) => {
    setActiveTool(toolId);
    setHandMode(toolId === 'hand');
  }, []);

  const onPanActive = useCallback((active) => {
    panActiveRef.current = active;
  }, []);

  const persistBoard = useCallback(async (next) => {
    if (!next || typeof next !== 'object') return;
    dirtyRef.current = true;
    dirtySinceRef.current = Date.now();
    const gen = ++persistGenRef.current;
    try {
      const res = await fetch('/api/board', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => ({}));
      const revision = data?.revision ?? data?.board?.revision;
      if (typeof revision === 'number') {
        knownRevisionRef.current = Math.max(knownRevisionRef.current, revision);
      }
      if (gen !== persistGenRef.current) return;
      if (typeof revision === 'number' && data?.board) {
        const synced = { ...data.board, revision };
        boardRef.current = synced;
        setBoard(synced);
      }
      dirtyRef.current = false;
      dirtySinceRef.current = 0;
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (gen === persistGenRef.current) {
        dirtyRef.current = false;
        dirtySinceRef.current = 0;
        setError(String(err.message || err));
      }
    }
  }, []);

  const pushHistory = useCallback(() => {
    const cur = boardRef.current;
    if (!cur) return;
    undoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    if (undoStackRef.current.length > MAX_HISTORY) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  const undo = useCallback(() => {
    const cur = boardRef.current;
    if (!cur || undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current.pop();
    const prevBoard = entry?.board ?? entry;
    if (!prevBoard || typeof prevBoard !== 'object') return;
    redoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    boardRef.current = prevBoard;
    setBoard(prevBoard);
    setSelectedScreenId(entry?.selectedScreenId ?? null);
    setSelectedNodeIds(entry?.selectedNodeIds ?? []);
    persistBoard(prevBoard);
  }, [persistBoard]);

  const redo = useCallback(() => {
    const cur = boardRef.current;
    if (!cur || redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current.pop();
    const nextBoard = entry?.board ?? entry;
    if (!nextBoard || typeof nextBoard !== 'object') return;
    undoStackRef.current.push({
      board: cloneBoard(cur),
      selectedScreenId: selectedScreenIdRef.current,
      selectedNodeIds: [...selectedNodeIdsRef.current],
    });
    boardRef.current = nextBoard;
    setBoard(nextBoard);
    setSelectedScreenId(entry?.selectedScreenId ?? null);
    setSelectedNodeIds(entry?.selectedNodeIds ?? []);
    persistBoard(nextBoard);
  }, [persistBoard]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // dirty travado (ex.: PUT pendente): libera após timeout
      if (
        dirtyRef.current &&
        dirtySinceRef.current &&
        Date.now() - dirtySinceRef.current > DIRTY_TIMEOUT_MS
      ) {
        dirtyRef.current = false;
        dirtySinceRef.current = 0;
        setStatusNote('Sync retomado');
      }

      if (panActiveRef.current || dirtyRef.current) return;
      try {
        const res = await fetch('/api/board', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled || panActiveRef.current || dirtyRef.current) return;
        if (!data || typeof data !== 'object' || !Array.isArray(data.screens)) {
          return;
        }

        const remoteRev = Number(data.revision) || 0;
        const isFirst = boardRef.current == null;
        // Só aplica se o token remoto avançou (mtime/revision do disco)
        if (!isFirst && remoteRev <= knownRevisionRef.current) return;

        const wasExternal =
          !isFirst && remoteRev > knownRevisionRef.current;
        knownRevisionRef.current = remoteRev;
        boardRef.current = data;
        setBoard(data);
        setError(null);
        setUpdatedAt(new Date());
        if (wasExternal) {
          setStatusNote('Atualizado do disco');
        }

        setSelectedScreenId((prev) => {
          if (prev && data.screens.some((s) => s.id === prev)) {
            screenSelectionReadyRef.current = true;
            return prev;
          }
          if (prev == null && screenSelectionReadyRef.current) return null;
          screenSelectionReadyRef.current = true;
          return data.screens[0]?.id ?? null;
        });
        setSelectedNodeIds((prev) =>
          prev.filter((id) =>
            data.screens.some((s) => containsNodeId(s.nodes, id)),
          ),
        );
        setHoveredNodeId((prev) => {
          if (!prev) return null;
          const ok = data.screens.some((s) => containsNodeId(s.nodes, prev));
          return ok ? prev : null;
        });
      } catch (err) {
        if (!cancelled) setError(String(err.message || err));
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!statusNote) return;
    const t = setTimeout(() => setStatusNote(null), 2500);
    return () => clearTimeout(t);
  }, [statusNote]);

  const selectScreen = useCallback((id) => {
    setSelectedScreenId(id);
    setSelectedNodeIds([]);
    setHoveredNodeId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedScreenId(null);
    setSelectedNodeIds([]);
    setHoveredNodeId(null);
  }, []);

  const selectNode = useCallback((screenId, nodeId, opts = {}) => {
    setSelectedScreenId(screenId);
    setSelectedNodeIds((prev) => {
      if (opts.preserve) return prev;
      if (opts.additive) {
        if (prev.includes(nodeId)) {
          return prev.filter((id) => id !== nodeId);
        }
        return [...prev, nodeId];
      }
      return [nodeId];
    });
  }, []);

  const hoverNode = useCallback((_screenId, nodeId) => {
    setHoveredNodeId(nodeId ?? null);
  }, []);

  const commitBoard = useCallback(
    (next, nextSelectedIds, nextScreenId) => {
      boardRef.current = next;
      setBoard(next);
      if (nextScreenId !== undefined) setSelectedScreenId(nextScreenId);
      if (nextSelectedIds !== undefined) setSelectedNodeIds(nextSelectedIds);
      persistBoard(next);
    },
    [persistBoard],
  );

  const mutateScreenNodes = useCallback(
    (screenId, nextNodes, nextSelectedIds) => {
      const cur = boardRef.current;
      if (!cur) return;
      pushHistory();
      const next = {
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes: nextNodes } : s,
        ),
      };
      commitBoard(next, nextSelectedIds);
    },
    [commitBoard, pushHistory],
  );

  const groupSelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || ids.length === 0) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    const result = groupSiblingNodes(screen.nodes, ids);
    if (!result.groupId) {
      setStatusNote('Só é possível agrupar irmãos (mesmo pai)');
      return;
    }
    mutateScreenNodes(screenId, result.nodes, [result.groupId]);
  }, [mutateScreenNodes]);

  const ungroupSelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || ids.length !== 1) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    const node = findNodeById(screen.nodes, ids[0]);
    if (!node || node.type !== 'group') return;
    const result = ungroupNode(screen.nodes, ids[0]);
    if (!result.ok) return;
    mutateScreenNodes(screenId, result.nodes, result.childIds);
  }, [mutateScreenNodes]);

  const deleteSelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || ids.length === 0) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    pushHistory();
    let nodes = screen.nodes;
    for (const id of ids) {
      nodes = removeNodeFromTree(nodes, id).nodes;
    }
    commitBoard(
      {
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      },
      [],
    );
  }, [commitBoard, pushHistory]);

  const duplicateSelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || ids.length === 0) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    const result = duplicateSiblingNodes(screen.nodes, ids, DUP_OFFSET);
    if (!result.clonedIds.length) {
      setStatusNote('Não foi possível duplicar (nós em níveis diferentes)');
      return;
    }
    mutateScreenNodes(screenId, result.nodes, result.clonedIds);
  }, [mutateScreenNodes]);

  const copySelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || ids.length === 0) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    const nodes = ids
      .map((id) => findNodeById(screen.nodes, id))
      .filter(Boolean)
      .map((n) => structuredClone(n));
    if (!nodes.length) return;
    clipboardRef.current = nodes;
    setStatusNote(`${nodes.length} copiado(s)`);
  }, []);

  const pasteClipboard = useCallback(() => {
    const cur = boardRef.current;
    const screenId =
      selectedScreenIdRef.current || cur?.screens[0]?.id || null;
    const clip = clipboardRef.current;
    if (!cur || !screenId || !clip.length) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    pushHistory();
    let nodes = screen.nodes;
    const newIds = [];
    for (const raw of clip) {
      const clone = shiftNodeTree(cloneNodeTree(raw), DUP_OFFSET, DUP_OFFSET);
      const inserted = insertNodeInTree(nodes, clone, null);
      nodes = inserted.nodes;
      newIds.push(clone.id);
    }
    commitBoard(
      {
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      },
      newIds,
      screenId,
    );
  }, [commitBoard, pushHistory]);

  const nudgeSelection = useCallback(
    (dx, dy) => {
      const cur = boardRef.current;
      const screenId = selectedScreenIdRef.current;
      const ids = selectedNodeIdsRef.current;
      if (!cur || !screenId || (!dx && !dy) || ids.length === 0) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      pushHistory();
      let nodes = screen.nodes;
      for (const id of ids) {
        const result = moveNodeBy(nodes, id, dx, dy);
        if (result.updated) nodes = result.nodes;
      }
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const createNode = useCallback(
    (screenId, node) => {
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      pushHistory();
      const { nodes, inserted } = insertNodeInTree(screen.nodes, node, null);
      if (!inserted) return;
      commitBoard(
        {
          ...cur,
          screens: cur.screens.map((s) =>
            s.id === screenId ? { ...s, nodes } : s,
          ),
        },
        [inserted.id],
        screenId,
      );
      selectTool('move');
    },
    [commitBoard, pushHistory, selectTool],
  );

  const resizeNode = useCallback(
    (screenId, nodeId, box) => {
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      pushHistory();
      const result = resizeNodeBox(screen.nodes, nodeId, box);
      if (!result.updated) return;
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes: result.nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const patchNode = useCallback(
    (screenId, nodeId, patch) => {
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      pushHistory();
      const { nodes, updated } = updateNodeInTree(screen.nodes, nodeId, (n) => ({
        ...n,
        ...patch,
      }));
      if (!updated) return;
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const renameNode = useCallback(
    (screenId, nodeId, name) => {
      patchNode(screenId, nodeId, { name: name.trim() || undefined });
    },
    [patchNode],
  );

  const reorderNode = useCallback(
    (screenId, nodeId, delta) => {
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      const result = reorderSiblingNode(screen.nodes, nodeId, delta);
      if (!result.ok) return;
      mutateScreenNodes(screenId, result.nodes, selectedNodeIdsRef.current);
    },
    [mutateScreenNodes],
  );

  const moveNodes = useCallback(
    async (screenId, nodeIds, dx, dy) => {
      const ids = (Array.isArray(nodeIds) ? nodeIds : [nodeIds]).filter(
        Boolean,
      );
      if (!dx && !dy) return;
      if (!ids.length) return;
      pushHistory();
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;

      let nodes = screen.nodes;
      for (const id of ids) {
        const result = moveNodeBy(nodes, id, dx, dy);
        if (result.updated) nodes = result.nodes;
      }

      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;

      if (!mod && (key === 'v' || key === 'V')) {
        e.preventDefault();
        selectTool('move');
        return;
      }
      if (!mod && (key === 'h' || key === 'H')) {
        e.preventDefault();
        selectTool('hand');
        return;
      }
      if (!mod && (key === 'r' || key === 'R')) {
        e.preventDefault();
        selectTool('shape');
        return;
      }
      if (!mod && (key === 't' || key === 'T')) {
        e.preventDefault();
        selectTool('text');
        return;
      }

      if (
        !mod &&
        (key === 'Delete' || key === 'Backspace') &&
        selectedNodeIdsRef.current.length
      ) {
        e.preventDefault();
        deleteSelection();
        return;
      }

      if (!mod && key.startsWith('Arrow') && selectedNodeIdsRef.current.length) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_SHIFT : NUDGE;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        nudgeSelection(dx, dy);
        return;
      }

      if (!mod) return;

      if (key === 'z' || key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (key === 'y' || key === 'Y') {
        e.preventDefault();
        redo();
        return;
      }
      if (key === 'g' || key === 'G') {
        e.preventDefault();
        groupSelection();
        return;
      }
      if (key === 'u' || key === 'U') {
        e.preventDefault();
        ungroupSelection();
        return;
      }
      if (key === 'd' || key === 'D') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (key === 'c' || key === 'C') {
        e.preventDefault();
        copySelection();
        return;
      }
      if (key === 'v' || key === 'V') {
        e.preventDefault();
        pasteClipboard();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    copySelection,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    nudgeSelection,
    pasteClipboard,
    redo,
    selectTool,
    undo,
    ungroupSelection,
  ]);

  const screens = board?.screens || [];
  const selected = screens.find((s) => s.id === selectedScreenId);
  const dragEnabled = activeTool === 'move' && !handMode;
  const createTool =
    activeTool === 'shape' ? 'rect' : activeTool === 'text' ? 'text' : null;

  const primaryNode =
    selected && selectedNodeIds.length === 1
      ? findNodeById(selected.nodes, selectedNodeIds[0])
      : null;

  const statusText = error
    ? `Erro: ${error}`
    : statusNote
      ? statusNote
      : updatedAt
        ? `Sync ${updatedAt.toLocaleTimeString()}`
        : 'Carregando…';

  return (
    <div className="app">
      <div className="canvas-wrap">
        {screens.length ? (
          <InfiniteCanvas
            ref={canvasRef}
            screens={screens}
            selectedId={selectedScreenId}
            selectedNodeIds={selectedNodeIds}
            hoveredNodeId={hoveredNodeId}
            onSelect={selectScreen}
            onClearSelection={clearSelection}
            onSelectNode={selectNode}
            onHoverNode={hoverNode}
            handMode={handMode}
            dragEnabled={dragEnabled}
            createTool={createTool}
            onCreateNode={createNode}
            onResizeCommit={resizeNode}
            onMoveCommit={moveNodes}
            onZoomChange={setZoom}
            onPanActive={onPanActive}
          />
        ) : (
          <div className="empty">Selecione ou crie uma tela.</div>
        )}

        <aside className="floating-panel floating-layers">
          <div className="floating-layers-brand">
            Figma<span>Show</span>
          </div>
          <LayersPanel
            screens={screens}
            selectedScreenId={selectedScreenId}
            selectedNodeIds={selectedNodeIds}
            hoveredNodeId={hoveredNodeId}
            onSelectScreen={selectScreen}
            onSelectNode={selectNode}
            onHoverNode={hoverNode}
            onRenameNode={renameNode}
            onReorderNode={reorderNode}
          />
        </aside>

        <aside className="floating-panel floating-props">
          <PropertiesPanel
            node={primaryNode}
            multiCount={selectedNodeIds.length}
            onChange={(patch) => {
              if (!selectedScreenId || !primaryNode) return;
              patchNode(selectedScreenId, primaryNode.id, patch);
            }}
          />
        </aside>

        <header className="floating-panel floating-header">
          <div className="toolbar-left">
            <h1>{selected ? selected.name : 'FigmaShow'}</h1>
            <span className="status">{statusText}</span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="tool-btn"
              title="Desfazer (Ctrl+Z)"
              onClick={undo}
            >
              ↶
            </button>
            <button
              type="button"
              className="tool-btn"
              title="Refazer (Ctrl+Y)"
              onClick={redo}
            >
              ↷
            </button>
            <button
              type="button"
              className={`tool-btn${handMode ? ' active' : ''}`}
              title="Mão (pan)"
              onClick={() => selectTool(handMode ? 'move' : 'hand')}
            >
              ✋
            </button>
            <button
              type="button"
              className="tool-btn"
              title="Zoom out"
              onClick={() => canvasRef.current?.zoomBy(1 / 1.2)}
            >
              −
            </button>
            <span className="zoom-label">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="tool-btn"
              title="Zoom in"
              onClick={() => canvasRef.current?.zoomBy(1.2)}
            >
              +
            </button>
            <button
              type="button"
              className="tool-btn"
              title="Ajustar tudo"
              onClick={() => canvasRef.current?.fitAll()}
            >
              Ajustar
            </button>
          </div>
        </header>

        <ToolsBar activeTool={activeTool} onToolChange={selectTool} />
      </div>
    </div>
  );
}
