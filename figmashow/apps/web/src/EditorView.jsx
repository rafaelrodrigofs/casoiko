import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  alignSelection,
  cloneNodeTree,
  createScreen,
  cryptoRandomId,
  distributeSelection,
  duplicateSiblingNodes,
  findNodeById,
  groupSiblingNodes,
  insertNodeInTree,
  moveNodeBy,
  normalizeConstraints,
  removeNodeFromTree,
  reorderSiblingNode,
  resizeNodeBox,
  resizeScreenWithConstraints,
  scrubBoardRefs,
  shiftNodeTree,
  ungroupNode,
  updateNodeInTree,
} from '@figmashow/core/schema';
import {
  createComponentFromNodes,
  createInstance,
  detachInstance,
  replaceDuplicatedMainsWithInstances,
  cloneOrInstantiate,
  syncAllComponentDefs,
  switchInstanceVariant,
} from '@figmashow/core/components';
import {
  exportScreenCss,
  exportScreenPng,
  exportScreenReact,
} from './exporters.js';
import { captureAndUploadProjectThumb } from './thumbnailCapture.jsx';
import InfiniteCanvas from './InfiniteCanvas.jsx';
import LayersPanel from './LayersPanel.jsx';
import PropertiesPanel from './PropertiesPanel.jsx';
import DesignPanel from './DesignPanel.jsx';
import { applyAutoLayout } from '@figmashow/core/autoLayout';
import PrototypePreview from './PrototypePreview.jsx';
import ToolsBar from './ToolsBar.jsx';
import { useBoardSync } from './useBoardSync.js';
import { useBoardHistory } from './useHistory.js';
import { useBoardSelection } from './useSelection.js';

function colorWithOpacity(color, opacity = 1) {
  const raw = String(color || '').trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  const numericAlpha = Number(opacity);
  const alpha = Number.isFinite(numericAlpha)
    ? Math.min(1, Math.max(0, numericAlpha))
    : 1;
  if (!match || alpha >= 1) return raw;
  const hex =
    match[1].length === 3
      ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
      : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Atualiza somente pintura no DOM; não toca board, histórico ou persistência. */
function applyLiveNodeStyle(node) {
  if (!node?.id || typeof document === 'undefined') return;
  const id = CSS.escape(String(node.id));
  for (const el of document.querySelectorAll(`[data-node-id="${id}"]`)) {
    if (node.type !== 'rect' && node.type !== 'button') continue;
    el.style.background = colorWithOpacity(
      node.fill,
      node.fillOpacity ?? 1,
    );
    const width = Number(node.strokeWidth);
    el.style.border =
      node.stroke && Number.isFinite(width) && width > 0
        ? `${width}px solid ${colorWithOpacity(
            node.stroke,
            node.strokeOpacity ?? 1,
          )}`
        : 'none';
  }
}

/**
 * Mantém X/Y/L/A ao vivo sem setState no App — evita re-render do canvas no drag.
 */
function LivePropertiesHost({
  liveGeomSetterRef,
  primaryNode,
  showScreenProps,
  selectedComment,
  multiCount,
  isScreenRoot,
  interactionMode,
  screens,
  selectedScreenId,
  prototypes,
  components,
  onChange,
  onChangeScreen,
  onAlign,
  onDistribute,
  onAddPrototypeLink,
  onDeletePrototypeLink,
  onChangeComment,
  onResolveComment,
  onDeleteComment,
  onCreateComponent,
  onInsertInstance,
  onSwitchVariant,
  onDetachInstance,
  onAutoLayout,
  designPanel,
}) {
  const [liveGeom, setLiveGeom] = useState(null);
  const [liveStyle, setLiveStyle] = useState(null);

  useEffect(() => {
    liveGeomSetterRef.current = setLiveGeom;
    return () => {
      if (liveGeomSetterRef.current === setLiveGeom) {
        liveGeomSetterRef.current = null;
      }
    };
  }, [liveGeomSetterRef]);

  useEffect(() => {
    setLiveGeom(null);
    setLiveStyle(null);
  }, [primaryNode?.id, multiCount, showScreenProps?.id]);

  const geometryNode =
    primaryNode && liveGeom && liveGeom.id === primaryNode.id
      ? {
          ...primaryNode,
          x: liveGeom.x ?? primaryNode.x,
          y: liveGeom.y ?? primaryNode.y,
          w: liveGeom.w ?? primaryNode.w,
          h: liveGeom.h ?? primaryNode.h,
          ...(liveGeom.cornerRadius != null
            ? { cornerRadius: liveGeom.cornerRadius }
            : {}),
          ...(liveGeom.rotation != null
            ? { rotation: liveGeom.rotation }
            : {}),
        }
      : primaryNode;
  const displayNode =
    geometryNode && liveStyle && liveStyle.id === geometryNode.id
      ? { ...geometryNode, ...liveStyle }
      : geometryNode;

  const previewStyle = (patch) => {
    if (!primaryNode) return;
    setLiveStyle((current) => {
      const next = {
        ...(current?.id === primaryNode.id ? current : {}),
        ...patch,
        id: primaryNode.id,
      };
      applyLiveNodeStyle({ ...primaryNode, ...next });
      return next;
    });
  };

  const cancelStylePreview = () => {
    setLiveStyle(null);
    applyLiveNodeStyle(primaryNode);
  };

  const commitChange = (patch) => {
    setLiveStyle(null);
    onChange?.(patch);
  };

  return (
    <PropertiesPanel
      node={displayNode}
      screen={showScreenProps}
      comment={selectedComment}
      multiCount={multiCount}
      isScreenRoot={isScreenRoot}
      interactionMode={interactionMode}
      screens={screens}
      selectedScreenId={selectedScreenId}
      prototypes={prototypes}
      components={components}
      onChange={commitChange}
      onPreview={previewStyle}
      onPreviewCancel={cancelStylePreview}
      onChangeScreen={onChangeScreen}
      onAlign={onAlign}
      onDistribute={onDistribute}
      onAddPrototypeLink={onAddPrototypeLink}
      onDeletePrototypeLink={onDeletePrototypeLink}
      onChangeComment={onChangeComment}
      onResolveComment={onResolveComment}
      onDeleteComment={onDeleteComment}
      onCreateComponent={onCreateComponent}
      onInsertInstance={onInsertInstance}
      onSwitchVariant={onSwitchVariant}
      onDetachInstance={onDetachInstance}
      onAutoLayout={onAutoLayout}
      designPanel={designPanel}
    />
  );
}

const SYNC_POLL_MS = 1500;
const NUDGE = 1;
const NUDGE_SHIFT = 10;
const DUP_OFFSET = 16;

function containsNodeId(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return true;
    if (
      (node.type === 'group' || node.type === 'component') &&
      containsNodeId(node.children || [], id)
    ) {
      return true;
    }
  }
  return false;
}

function ensureBoardExtras(data) {
  if (!data || typeof data !== 'object') return data;
  return {
    ...data,
    components: Array.isArray(data.components) ? data.components : [],
    prototypes: Array.isArray(data.prototypes) ? data.prototypes : [],
    comments: Array.isArray(data.comments) ? data.comments : [],
    versions: Array.isArray(data.versions) ? data.versions : [],
    tokens:
      data.tokens && typeof data.tokens === 'object' && !Array.isArray(data.tokens)
        ? data.tokens
        : {},
  };
}

function cloneBoard(board) {
  return structuredClone(board);
}

function isTypingTarget(el) {
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable;
}

/** Aplica patch comum (multi-select fill/opacity + flags). */
function applyNodePatch(node, patch) {
  const next = { ...node };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'id' || key === 'type' || key === 'children') continue;
    if (value === null || value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  if ('locked' in patch && !patch.locked) delete next.locked;
  if ('hidden' in patch && !patch.hidden) delete next.hidden;

  if ('fill' in patch && patch.fill != null) {
    if (node.type === 'rect' || node.type === 'button') {
      next.fill = patch.fill;
    } else if (node.type === 'text') {
      next.color = patch.fill;
      delete next.fill;
    } else {
      delete next.fill;
    }
  }

  if ('fillOpacity' in patch) {
    if (
      patch.fillOpacity != null &&
      (node.type === 'rect' || node.type === 'button')
    ) {
      next.fillOpacity = Math.min(1, Math.max(0, Number(patch.fillOpacity)));
    } else {
      delete next.fillOpacity;
    }
  }

  if ('strokeOpacity' in patch) {
    if (
      patch.strokeOpacity != null &&
      (node.type === 'rect' || node.type === 'button')
    ) {
      next.strokeOpacity = Math.min(
        1,
        Math.max(0, Number(patch.strokeOpacity)),
      );
    } else {
      delete next.strokeOpacity;
    }
  }

  if ('stroke' in patch && patch.stroke == null) {
    delete next.stroke;
    delete next.strokeWidth;
    delete next.strokeOpacity;
  }

  if ('constraints' in patch) {
    if (patch.constraints == null) {
      delete next.constraints;
    } else {
      next.constraints = normalizeConstraints(patch.constraints);
    }
  }

  if ('componentId' in patch && patch.componentId != null) {
    next.componentId = String(patch.componentId);
  }
  if ('variantId' in patch && patch.variantId != null) {
    next.variantId = String(patch.variantId);
  }

  if ('opacity' in patch && patch.opacity != null) {
    if (
      node.type === 'rect' ||
      node.type === 'image' ||
      node.type === 'text' ||
      node.type === 'button' ||
      node.type === 'group'
    ) {
      next.opacity = patch.opacity;
    } else {
      delete next.opacity;
    }
  }

  if ('rotation' in patch) {
    if (patch.rotation == null || Number(patch.rotation) === 0) {
      delete next.rotation;
    } else {
      next.rotation = Number(patch.rotation);
    }
  }

  return next;
}

function shallowNodeEqual(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.is(a[key], b[key]))
  );
}

const PERSIST_RETRIES = 3;
const PERSIST_RETRY_MS = 600;

export default function EditorView() {
  const { projectId } = useParams();
  const [board, setBoard] = useState(null);
  const {
    selectedScreenId,
    setSelectedScreenId,
    selectedNodeIds,
    setSelectedNodeIds,
    hoveredNodeId,
    setHoveredNodeId,
    selectedCommentId,
    setSelectedCommentId,
    selectedScreenIdRef,
    selectedNodeIdsRef,
    selectNode,
    selectScreen,
    clearSelection,
    hoverNode,
  } = useBoardSelection();
  const [error, setError] = useState(null);
  const [statusNote, setStatusNote] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [zoom, setZoom] = useState(0.55);
  const [handMode, setHandMode] = useState(false);
  const [activeTool, setActiveTool] = useState('move');
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [prototypeOpen, setPrototypeOpen] = useState(false);
  const exportMenuRef = useRef(null);
  const canvasRef = useRef(null);
  const liveGeomSetterRef = useRef(null);
  const panActiveRef = useRef(false);
  const boardRef = useRef(null);
  const dirtyRef = useRef(false);
  const knownRevisionRef = useRef(0);
  const persistGenRef = useRef(0);
  const persistInFlightRef = useRef(false);
  const thumbTimerRef = useRef(null);
  const clipboardRef = useRef([]);
  const screenSelectionReadyRef = useRef(false);

  boardRef.current = board;

  const selectTool = useCallback((toolId) => {
    setActiveTool(toolId);
    setHandMode(toolId === 'hand');
    if (toolId !== 'comment') setSelectedCommentId(null);
  }, []);

  const onPanActive = useCallback((active) => {
    panActiveRef.current = active;
  }, []);

  const onLiveGeometry = useCallback((geom) => {
    liveGeomSetterRef.current?.(geom);
  }, []);

  const persistBoard = useCallback(async (next) => {
    if (!next || typeof next !== 'object' || !projectId) return;
    dirtyRef.current = true;
    persistInFlightRef.current = true;
    const gen = ++persistGenRef.current;
    const expectedRevision = knownRevisionRef.current;
    let lastErr = null;

    for (let attempt = 0; attempt < PERSIST_RETRIES; attempt++) {
      if (gen !== persistGenRef.current) {
        persistInFlightRef.current = false;
        return;
      }
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: { ...next, revision: expectedRevision },
            expectedRevision,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          const remoteRev = Number(data?.revision) || 0;
          persistInFlightRef.current = false;
          // Mantém dirty até o usuário resolver (não auto-aplica remoto).
          setError(
            data?.error ||
              'Conflito: outra sessão alterou o projeto',
          );
          setConflict({
            remoteBoard: data?.board,
            remoteRevision: remoteRev,
            localBoard: next,
          });
          setStatusNote('Conflito de revisão — escolha qual versão manter');
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const revision = data?.revision ?? data?.board?.revision;
        if (typeof revision === 'number') {
          knownRevisionRef.current = Math.max(
            knownRevisionRef.current,
            revision,
          );
        }
        if (gen !== persistGenRef.current) {
          persistInFlightRef.current = false;
          return;
        }
        if (typeof revision === 'number' && data?.board) {
          const synced = { ...data.board, revision };
          boardRef.current = synced;
          setBoard(synced);
        }
        dirtyRef.current = false;
        persistInFlightRef.current = false;
        setUpdatedAt(new Date());
        setError(null);
        const savedBoard = boardRef.current;
        if (savedBoard?.screens?.length) {
          clearTimeout(thumbTimerRef.current);
          thumbTimerRef.current = setTimeout(() => {
            captureAndUploadProjectThumb(projectId, savedBoard).catch(() => {});
          }, 900);
        }
        return;
      } catch (err) {
        lastErr = err;
        if (attempt < PERSIST_RETRIES - 1) {
          setStatusNote(
            `Sync falhou — tentando de novo (${attempt + 1}/${PERSIST_RETRIES})…`,
          );
          await new Promise((r) => setTimeout(r, PERSIST_RETRY_MS * (attempt + 1)));
        }
      }
    }

    if (gen === persistGenRef.current) {
      persistInFlightRef.current = false;
      const msg = String(lastErr?.message || lastErr || 'erro de sync');
      setError(msg);
      setStatusNote(`Erro ao salvar: ${msg}`);
    }
  }, [projectId]);

  const { pushHistory, undo, redo } = useBoardHistory({
    boardRef,
    setBoard,
    selectedScreenIdRef,
    selectedNodeIdsRef,
    setSelectedScreenId,
    setSelectedNodeIds,
    persistBoard,
    cloneBoard,
  });

  const applyRemoteBoard = useCallback((data, { note } = {}) => {
    if (!data || typeof data !== 'object' || !Array.isArray(data.screens)) {
      return;
    }
    const remoteRev = Number(data.revision) || 0;
    const isFirst = boardRef.current == null;
    if (!isFirst && remoteRev <= knownRevisionRef.current) return;

    const wasExternal = !isFirst && remoteRev > knownRevisionRef.current;
    knownRevisionRef.current = remoteRev;
    const normalized = ensureBoardExtras(data);
    boardRef.current = normalized;
    setBoard(normalized);
    setError(null);
    setUpdatedAt(new Date());
    if (note) setStatusNote(note);
    else if (wasExternal) setStatusNote('Atualizado do disco');

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
        normalized.screens.some((s) => containsNodeId(s.nodes, id)),
      ),
    );
    setHoveredNodeId((prev) => {
      if (!prev) return null;
      const ok = normalized.screens.some((s) => containsNodeId(s.nodes, prev));
      return ok ? prev : null;
    });
    setSelectedCommentId((prev) => {
      if (!prev) return null;
      return (normalized.comments || []).some((c) => c.id === prev) ? prev : null;
    });
  }, []);

  const fetchBoard = useCallback(async () => {
    if (!projectId) return;
    if (panActiveRef.current || dirtyRef.current || persistInFlightRef.current) {
      return;
    }
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      if (panActiveRef.current || dirtyRef.current || persistInFlightRef.current) {
        return;
      }
      applyRemoteBoard(payload?.board);
    } catch (err) {
      setError(String(err.message || err));
    }
  }, [applyRemoteBoard, projectId]);

  const onRevisionChanged = useCallback(
    (rev) => {
      if (dirtyRef.current || persistInFlightRef.current || panActiveRef.current) {
        return;
      }
      if (boardRef.current != null && rev <= knownRevisionRef.current) return;
      fetchBoard();
    },
    [fetchBoard],
  );

  useBoardSync({
    projectId,
    enabled: Boolean(projectId) && !conflict,
    shouldSkip: () =>
      dirtyRef.current || persistInFlightRef.current || panActiveRef.current,
    knownRevision: knownRevisionRef.current,
    onRevisionChanged,
    pollMs: SYNC_POLL_MS,
  });

  useEffect(() => {
    if (!projectId) return;
    boardRef.current = null;
    knownRevisionRef.current = 0;
    dirtyRef.current = false;
    persistInFlightRef.current = false;
    screenSelectionReadyRef.current = false;
    setBoard(null);
    setSelectedScreenId(null);
    setSelectedNodeIds([]);
    setConflict(null);
    setError(null);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
      method: 'POST',
    }).catch(() => {});
    fetchBoard();
  }, [projectId, fetchBoard]);

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (!dirtyRef.current && !persistInFlightRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!statusNote) return;
    const t = setTimeout(() => setStatusNote(null), 2500);
    return () => clearTimeout(t);
  }, [statusNote]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e) => {
      if (exportMenuRef.current?.contains(e.target)) return;
      setExportOpen(false);
    };
    document.addEventListener('pointerdown', onDocClick);
    return () => document.removeEventListener('pointerdown', onDocClick);
  }, [exportOpen]);

  const commitBoard = useCallback(
    (next, nextSelectedIds, nextScreenId) => {
      const withExtras = syncAllComponentDefs(
        scrubBoardRefs(ensureBoardExtras(next)),
      );
      boardRef.current = withExtras;
      setBoard(withExtras);
      if (nextScreenId !== undefined) setSelectedScreenId(nextScreenId);
      if (nextSelectedIds !== undefined) setSelectedNodeIds(nextSelectedIds);
      persistBoard(withExtras);
    },
    [persistBoard],
  );

  const addScreen = useCallback(() => {
    const cur = boardRef.current;
    if (!cur) return;
    pushHistory();
    const screen = createScreen({
      name: `Tela ${cur.screens.length + 1}`,
      board: cur,
    });
    const next = { ...cur, screens: [...cur.screens, screen] };
    commitBoard(next, [], screen.id);
  }, [commitBoard, pushHistory]);

  const keepLocalConflict = useCallback(() => {
    if (!conflict) return;
    const local = conflict.localBoard || boardRef.current;
    if (!local) return;
    // CAS: sobrescreve remoto usando a revisão remota conhecida.
    knownRevisionRef.current = Number(conflict.remoteRevision) || 0;
    setConflict(null);
    setError(null);
    setStatusNote('Sobrescrevendo com versão local…');
    persistBoard(local);
  }, [conflict, persistBoard]);

  const acceptRemoteConflict = useCallback(() => {
    if (!conflict?.remoteBoard || typeof conflict.remoteBoard !== 'object') return;
    const normalized = ensureBoardExtras(conflict.remoteBoard);
    knownRevisionRef.current =
      Number(conflict.remoteRevision) || Number(normalized.revision) || 0;
    boardRef.current = normalized;
    setBoard(normalized);
    dirtyRef.current = false;
    persistInFlightRef.current = false;
    setConflict(null);
    setError(null);
    setStatusNote('Versão remota aplicada');
  }, [conflict]);

  const retryConflict = useCallback(async () => {
    if (!conflict || !projectId) return;
    const local = conflict.localBoard || boardRef.current;
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/revision`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const data = await res.json();
        knownRevisionRef.current =
          Number(data?.revision) || Number(conflict.remoteRevision) || 0;
      } else {
        knownRevisionRef.current = Number(conflict.remoteRevision) || 0;
      }
    } catch {
      knownRevisionRef.current = Number(conflict.remoteRevision) || 0;
    }
    setConflict(null);
    setError(null);
    setStatusNote('Tentando salvar novamente…');
    if (local) persistBoard(local);
  }, [conflict, persistBoard, projectId]);

  const deleteScreen = useCallback(
    (screenId) => {
      const cur = boardRef.current;
      if (!cur || !screenId) return;
      const idx = cur.screens.findIndex((s) => s.id === screenId);
      if (idx < 0) return;
      if (!window.confirm('Excluir esta tela? Esta ação pode ser desfeita com Ctrl+Z.')) {
        return;
      }
      pushHistory();
      const nextScreens = cur.screens.filter((s) => s.id !== screenId);
      const nextSel =
        selectedScreenIdRef.current === screenId
          ? nextScreens[Math.min(idx, nextScreens.length - 1)]?.id ?? null
          : selectedScreenIdRef.current;
      commitBoard(
        scrubBoardRefs({ ...cur, screens: nextScreens }),
        [],
        nextSel,
      );
    },
    [commitBoard, pushHistory],
  );

  const renameScreen = useCallback(
    (screenId, name) => {
      const cur = boardRef.current;
      if (!cur || !screenId) return;
      const trimmed = String(name || '').trim() || 'Tela';
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen || screen.name === trimmed) return;
      pushHistory();
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, name: trimmed } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const patchScreen = useCallback(
    (screenId, patch) => {
      const cur = boardRef.current;
      if (!cur || !screenId) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      pushHistory();
      const widthChanged =
        'width' in patch && Number(patch.width) !== Number(screen.width);
      const heightChanged =
        'height' in patch && Number(patch.height) !== Number(screen.height);

      let nextScreen;
      if (widthChanged || heightChanged) {
        // Passar a tela ORIGINAL: senão oldW===newW e constraints não aplicam.
        nextScreen = resizeScreenWithConstraints(
          screen,
          widthChanged ? patch.width : screen.width,
          heightChanged ? patch.height : screen.height,
        );
        nextScreen = {
          ...nextScreen,
          ...patch,
          width: nextScreen.width,
          height: nextScreen.height,
          nodes: nextScreen.nodes,
        };
      } else {
        nextScreen = { ...screen, ...patch };
        if (typeof nextScreen.width === 'number') {
          nextScreen.width = Math.max(1, nextScreen.width);
        }
        if (typeof nextScreen.height === 'number') {
          nextScreen.height = Math.max(1, nextScreen.height);
        }
      }
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? nextScreen : s,
        ),
      });
    },
    [commitBoard, pushHistory],
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
      scrubBoardRefs({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      }),
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
    const replaced = replaceDuplicatedMainsWithInstances(
      result.nodes,
      result.clonedIds,
      cur.components || [],
    );
    mutateScreenNodes(screenId, replaced.nodes, replaced.ids);
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
      const clone = cloneOrInstantiate(
        raw,
        cur.components || [],
        DUP_OFFSET,
        DUP_OFFSET,
      );
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
      let moved = false;
      for (const id of ids) {
        const node = findNodeById(nodes, id);
        if (!node || node.locked) continue;
        const result = moveNodeBy(nodes, id, dx, dy);
        if (result.updated) {
          nodes = result.nodes;
          moved = true;
        }
      }
      if (!moved) return;
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
      const node = findNodeById(screen.nodes, nodeId);
      if (!node || node.locked) return;
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
      let changed = false;
      const { nodes, updated } = updateNodeInTree(screen.nodes, nodeId, (n) => {
        const next = applyNodePatch(n, patch);
        if (shallowNodeEqual(n, next)) return n;
        changed = true;
        return next;
      });
      if (!updated || !changed) return;
      pushHistory();
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const patchNodes = useCallback(
    (screenId, nodeIds, patch) => {
      const cur = boardRef.current;
      if (!cur || !nodeIds?.length) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      let nodes = screen.nodes;
      let any = false;
      for (const id of nodeIds) {
        let changed = false;
        const res = updateNodeInTree(nodes, id, (n) => {
          const next = applyNodePatch(n, patch);
          if (shallowNodeEqual(n, next)) return n;
          changed = true;
          return next;
        });
        if (res.updated && changed) {
          nodes = res.nodes;
          any = true;
        }
      }
      if (!any) return;
      pushHistory();
      commitBoard({
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      });
    },
    [commitBoard, pushHistory],
  );

  const alignSelected = useCallback(
    (mode) => {
      const cur = boardRef.current;
      const screenId = selectedScreenIdRef.current;
      const ids = selectedNodeIdsRef.current;
      if (!cur || !screenId || ids.length < 2) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      const result = alignSelection(screen.nodes, ids, mode);
      if (!result.ok) return;
      mutateScreenNodes(screenId, result.nodes, ids);
    },
    [mutateScreenNodes],
  );

  const distributeSelected = useCallback(
    (axis) => {
      const cur = boardRef.current;
      const screenId = selectedScreenIdRef.current;
      const ids = selectedNodeIdsRef.current;
      if (!cur || !screenId || ids.length < 3) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      const result = distributeSelection(screen.nodes, ids, axis);
      if (!result.ok) return;
      mutateScreenNodes(screenId, result.nodes, ids);
    },
    [mutateScreenNodes],
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
        const node = findNodeById(nodes, id);
        if (!node || node.locked) continue;
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

  const duplicateMovedNodes = useCallback(
    (screenId, nodeIds, dx, dy) => {
      const ids = (Array.isArray(nodeIds) ? nodeIds : [nodeIds]).filter(Boolean);
      if (!ids.length || (!dx && !dy)) return;
      const cur = boardRef.current;
      if (!cur) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;

      const duplicated = duplicateSiblingNodes(screen.nodes, ids, 0);
      if (!duplicated.clonedIds.length) {
        setStatusNote('Não foi possível duplicar (nós em níveis diferentes)');
        return;
      }

      pushHistory();
      let nodes = duplicated.nodes;
      for (const id of duplicated.clonedIds) {
        const moved = moveNodeBy(nodes, id, dx, dy);
        if (moved.updated) nodes = moved.nodes;
      }
      const replaced = replaceDuplicatedMainsWithInstances(
        nodes,
        duplicated.clonedIds,
        cur.components || [],
      );

      commitBoard(
        {
          ...cur,
          screens: cur.screens.map((s) =>
            s.id === screenId ? { ...s, nodes: replaced.nodes } : s,
          ),
        },
        replaced.ids,
      );
    },
    [commitBoard, pushHistory],
  );

  const addPrototypeLink = useCallback(
    (toScreenId, transition = 'instant') => {
      const cur = boardRef.current;
      const screenId = selectedScreenIdRef.current;
      const nodeId = selectedNodeIdsRef.current[0];
      if (!cur || !screenId || !nodeId || !toScreenId) return;
      pushHistory();
      const link = {
        id: cryptoRandomId('proto'),
        fromScreenId: screenId,
        triggerNodeId: nodeId,
        toScreenId,
        transition: transition === 'dissolve' ? 'dissolve' : 'instant',
      };
      commitBoard({
        ...cur,
        prototypes: [...(cur.prototypes || []), link],
      });
      setStatusNote('Link de protótipo salvo');
    },
    [commitBoard, pushHistory],
  );

  const deletePrototypeLink = useCallback(
    (linkId) => {
      const cur = boardRef.current;
      if (!cur || !linkId) return;
      pushHistory();
      commitBoard({
        ...cur,
        prototypes: (cur.prototypes || []).filter((p) => p.id !== linkId),
      });
    },
    [commitBoard, pushHistory],
  );

  const addComment = useCallback(
    (screenId, x, y) => {
      const cur = boardRef.current;
      if (!cur || !screenId) return;
      pushHistory();
      const comment = {
        id: cryptoRandomId('comment'),
        screenId,
        x: Math.round(x),
        y: Math.round(y),
        text: '',
        resolved: false,
        createdAt: Date.now(),
      };
      commitBoard({
        ...cur,
        comments: [...(cur.comments || []), comment],
      });
      setSelectedCommentId(comment.id);
      setSelectedNodeIds([]);
      setSelectedScreenId(screenId);
    },
    [commitBoard, pushHistory],
  );

  const patchComment = useCallback(
    (commentId, patch) => {
      const cur = boardRef.current;
      if (!cur || !commentId) return;
      const comments = (cur.comments || []).map((c) =>
        c.id === commentId ? { ...c, ...patch } : c,
      );
      pushHistory();
      commitBoard({ ...cur, comments });
    },
    [commitBoard, pushHistory],
  );

  const resolveComment = useCallback(
    (commentId, resolved) => {
      patchComment(commentId, { resolved: !!resolved });
    },
    [patchComment],
  );

  const deleteComment = useCallback(
    (commentId) => {
      const cur = boardRef.current;
      if (!cur || !commentId) return;
      pushHistory();
      commitBoard({
        ...cur,
        comments: (cur.comments || []).filter((c) => c.id !== commentId),
      });
      setSelectedCommentId((prev) => (prev === commentId ? null : prev));
    },
    [commitBoard, pushHistory],
  );

  const createComponentFromSelection = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const ids = selectedNodeIdsRef.current;
    if (!cur || !screenId || !ids.length) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    if (!screen) return;
    const result = createComponentFromNodes(screen.nodes, ids);
    if (!result.component || !result.mainNode) {
      setStatusNote('Selecione irmãos para criar componente');
      return;
    }
    pushHistory();
    commitBoard(
      {
        ...cur,
        components: [...(cur.components || []), result.component],
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes: result.remainingNodes } : s,
        ),
      },
      [result.mainNode.id],
      screenId,
    );
    setStatusNote(
      `Componente "${result.component.name}" criado — este é o principal`,
    );
  }, [commitBoard, pushHistory]);

  const insertComponentInstance = useCallback(
    (componentId) => {
      const cur = boardRef.current;
      const screenId =
        selectedScreenIdRef.current || cur?.screens[0]?.id || null;
      if (!cur || !screenId || !componentId) return;
      const def = (cur.components || []).find((c) => c.id === componentId);
      if (!def) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      if (!screen) return;
      const instance = createInstance(def, undefined, 24, 24);
      pushHistory();
      const { nodes, inserted } = insertNodeInTree(
        screen.nodes,
        instance,
        null,
      );
      if (!inserted) return;
      commitBoard(
        {
          ...cur,
          screens: cur.screens.map((s) =>
            s.id === screenId ? { ...s, nodes } : s,
          ),
        },
        [instance.id],
        screenId,
      );
    },
    [commitBoard, pushHistory],
  );

  const switchInstanceVariantHandler = useCallback(
    (variantId) => {
      const cur = boardRef.current;
      const screenId = selectedScreenIdRef.current;
      const nodeId = selectedNodeIdsRef.current[0];
      if (!cur || !screenId || !nodeId) return;
      const screen = cur.screens.find((s) => s.id === screenId);
      const node = screen ? findNodeById(screen.nodes, nodeId) : null;
      if (!node || node.type !== 'instance') return;
      const def = (cur.components || []).find(
        (c) => c.id === node.componentId,
      );
      if (!def) return;
      const nextInstance = switchInstanceVariant(node, def, variantId);
      patchNode(screenId, nodeId, {
        variantId: nextInstance.variantId,
        w: nextInstance.w,
        h: nextInstance.h,
      });
    },
    [patchNode],
  );

  const detachInstanceHandler = useCallback(() => {
    const cur = boardRef.current;
    const screenId = selectedScreenIdRef.current;
    const nodeId = selectedNodeIdsRef.current[0];
    if (!cur || !screenId || !nodeId) return;
    const screen = cur.screens.find((s) => s.id === screenId);
    const node = screen ? findNodeById(screen.nodes, nodeId) : null;
    if (!node || node.type !== 'instance') return;
    const def = (cur.components || []).find((c) => c.id === node.componentId);
    const tree = detachInstance(node, def);
    pushHistory();
    let { nodes } = removeNodeFromTree(screen.nodes, nodeId);
    const inserted = insertNodeInTree(nodes, tree, null);
    nodes = inserted.nodes;
    commitBoard(
      {
        ...cur,
        screens: cur.screens.map((s) =>
          s.id === screenId ? { ...s, nodes } : s,
        ),
      },
      [tree.id],
      screenId,
    );
  }, [commitBoard, pushHistory]);

  const runExport = useCallback(
    async (kind) => {
      if (!selectedScreenIdRef.current) {
        setStatusNote('Selecione uma tela para exportar');
        setExportOpen(false);
        return;
      }
      const cur = boardRef.current;
      const screen = cur?.screens.find(
        (s) => s.id === selectedScreenIdRef.current,
      );
      if (!screen) return;
      try {
        if (kind === 'png') {
          const el = canvasRef.current?.getScreenElement?.(screen.id);
          await exportScreenPng(el, screen);
          setStatusNote('PNG exportado');
        } else if (kind === 'css') {
          exportScreenCss(screen, cur?.components || []);
          setStatusNote('CSS exportado');
        } else if (kind === 'react') {
          exportScreenReact(screen, cur?.components || []);
          setStatusNote('React exportado');
        }
      } catch (err) {
        setStatusNote(String(err?.message || err || 'Erro ao exportar'));
      }
      setExportOpen(false);
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;

      if (!mod && key === 'Escape') {
        e.preventDefault();
        if (
          activeTool === 'shape' ||
          activeTool === 'text' ||
          activeTool === 'button' ||
          activeTool === 'image' ||
          activeTool === 'prototype' ||
          activeTool === 'comment'
        ) {
          selectTool('move');
          return;
        }
        if (selectedCommentId) {
          setSelectedCommentId(null);
          return;
        }
        if (selectedNodeIdsRef.current.length) {
          setSelectedNodeIds([]);
          setHoveredNodeId(null);
          return;
        }
        clearSelection();
        return;
      }

      if (!mod && key === 'F4') {
        const screenId = selectedScreenIdRef.current;
        if (screenId) {
          e.preventDefault();
          canvasRef.current?.focusScreen?.(screenId);
        }
        return;
      }

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
      if (!mod && (key === 'b' || key === 'B')) {
        e.preventDefault();
        selectTool('button');
        return;
      }
      if (!mod && (key === 'i' || key === 'I')) {
        e.preventDefault();
        selectTool('image');
        return;
      }
      if (!mod && (key === 'p' || key === 'P')) {
        e.preventDefault();
        selectTool('prototype');
        return;
      }
      if (!mod && (key === 'c' || key === 'C')) {
        e.preventDefault();
        selectTool('comment');
        return;
      }

      if (!mod && (key === 'Delete' || key === 'Backspace')) {
        if (selectedNodeIdsRef.current.length) {
          e.preventDefault();
          deleteSelection();
          return;
        }
        if (selectedScreenIdRef.current) {
          e.preventDefault();
          deleteScreen(selectedScreenIdRef.current);
          return;
        }
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
    activeTool,
    clearSelection,
    copySelection,
    deleteScreen,
    deleteSelection,
    duplicateSelection,
    groupSelection,
    nudgeSelection,
    pasteClipboard,
    redo,
    selectTool,
    selectedCommentId,
    undo,
    ungroupSelection,
  ]);

  const screens = board?.screens || [];
  const selected = screens.find((s) => s.id === selectedScreenId);
  const dragEnabled = activeTool === 'move' && !handMode;
  const createTool =
    activeTool === 'shape'
      ? 'rect'
      : activeTool === 'text'
        ? 'text'
        : activeTool === 'button'
          ? 'button'
          : activeTool === 'image'
            ? 'image'
            : null;

  const interactionMode =
    activeTool === 'prototype'
      ? 'prototype'
      : activeTool === 'comment'
        ? 'comment'
        : 'edit';
  const primaryNode =
    selected && selectedNodeIds.length === 1
      ? findNodeById(selected.nodes, selectedNodeIds[0])
      : null;
  const showScreenProps =
    selected && selectedNodeIds.length === 0 && !selectedCommentId
      ? selected
      : null;
  const selectedComment =
    selectedCommentId && board?.comments
      ? board.comments.find((c) => c.id === selectedCommentId) || null
      : null;
  const isScreenRoot = !!(
    selected &&
    primaryNode &&
    selected.nodes.some((n) => n.id === primaryNode.id)
  );
  const components = board?.components || [];
  const prototypes = board?.prototypes || [];
  const comments = board?.comments || [];
  const versions = board?.versions || [];
  const tokens = board?.tokens || {};

  const setBoardTokens = useCallback(
    (nextTokens) => {
      const cur = boardRef.current;
      if (!cur) return;
      pushHistory();
      commitBoard({ ...cur, tokens: nextTokens || {} });
    },
    [commitBoard, pushHistory],
  );

  const createBoardVersion = useCallback(
    (name) => {
      const cur = boardRef.current;
      if (!cur) return;
      pushHistory();
      const snap = {
        id: cryptoRandomId('ver'),
        name: name || `Versão ${(cur.versions || []).length + 1}`,
        createdAt: new Date().toISOString(),
        revision: cur.revision,
        board: {
          screens: cur.screens,
          components: cur.components,
          prototypes: cur.prototypes,
          comments: cur.comments,
          tokens: cur.tokens,
        },
      };
      commitBoard({
        ...cur,
        versions: [...(cur.versions || []), snap].slice(-30),
      });
      setStatusNote('Versão salva');
    },
    [commitBoard, pushHistory],
  );

  const restoreBoardVersion = useCallback(
    (versionId) => {
      const cur = boardRef.current;
      if (!cur) return;
      const snap = (cur.versions || []).find((v) => v.id === versionId);
      if (!snap) return;
      const payload =
        snap.board && typeof snap.board === 'object'
          ? snap.board
          : {
              screens: snap.screens,
              components: snap.components,
              prototypes: snap.prototypes,
              comments: snap.comments,
              tokens: snap.tokens,
            };
      pushHistory();
      commitBoard({
        ...cur,
        screens: Array.isArray(payload.screens) ? payload.screens : cur.screens,
        components: Array.isArray(payload.components)
          ? payload.components
          : cur.components,
        prototypes: Array.isArray(payload.prototypes)
          ? payload.prototypes
          : cur.prototypes,
        comments: Array.isArray(payload.comments)
          ? payload.comments
          : cur.comments,
        tokens:
          payload.tokens && typeof payload.tokens === 'object'
            ? payload.tokens
            : cur.tokens,
      });
      setStatusNote('Versão restaurada');
    },
    [commitBoard, pushHistory],
  );

  const applyAutoLayoutToSelection = useCallback(
    (opts) => {
      const cur = boardRef.current;
      if (!cur || !selectedScreenId || !primaryNode) return;
      if (primaryNode.type !== 'group' && primaryNode.type !== 'component') {
        return;
      }
      pushHistory();
      const laid = applyAutoLayout(primaryNode.children || [], {
        ...(opts || {}),
        originX: primaryNode.x,
        originY: primaryNode.y,
      });
      commitBoard(
        {
          ...cur,
          screens: cur.screens.map((s) => {
            if (s.id !== selectedScreenId) return s;
            const res = updateNodeInTree(s.nodes, primaryNode.id, (n) => ({
              ...n,
              children: laid.children,
              w: laid.bounds.w,
              h: laid.bounds.h,
            }));
            return { ...s, nodes: res.nodes };
          }),
        },
        selectedNodeIds,
      );
    },
    [
      commitBoard,
      primaryNode,
      pushHistory,
      selectedNodeIds,
      selectedScreenId,
    ],
  );

  const designPanel = (
    <DesignPanel
      tokens={tokens}
      versions={versions}
      projectId={projectId}
      onSetTokens={setBoardTokens}
      onCreateVersion={createBoardVersion}
      onRestoreVersion={restoreBoardVersion}
    />
  );

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
        {!board ? (
          <div className="empty">Carregando…</div>
        ) : screens.length ? (
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
            interactionMode={interactionMode}
            components={components}
            prototypes={prototypes}
            comments={comments}
            selectedCommentId={selectedCommentId}
            onAddComment={addComment}
            onSelectComment={(id) => {
              setSelectedCommentId(id);
              setSelectedNodeIds([]);
            }}
            onCreateNode={createNode}
            onResizeCommit={resizeNode}
            onMoveCommit={moveNodes}
            onDuplicateMoveCommit={duplicateMovedNodes}
            onPatchNode={patchNode}
            onLiveGeometry={onLiveGeometry}
            onZoomChange={setZoom}
            onPanActive={onPanActive}
            smartGuidesEnabled={smartGuidesEnabled}
          />
        ) : (
          <div className="empty">
            <p>Nenhuma tela ainda.</p>
            <button type="button" className="empty-cta" onClick={addScreen}>
              Criar tela
            </button>
          </div>
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
            onAddScreen={addScreen}
            onRenameScreen={renameScreen}
            onDeleteScreen={deleteScreen}
            onToggleNodeFlag={(screenId, nodeId, flag) => {
              const screen = boardRef.current?.screens.find(
                (s) => s.id === screenId,
              );
              const node = screen ? findNodeById(screen.nodes, nodeId) : null;
              if (!node) return;
              patchNode(screenId, nodeId, { [flag]: !node[flag] });
            }}
            components={components}
            onInsertInstance={insertComponentInstance}
          />
        </aside>

        <aside className="floating-panel floating-props">
          <LivePropertiesHost
            liveGeomSetterRef={liveGeomSetterRef}
            primaryNode={primaryNode}
            showScreenProps={showScreenProps}
            selectedComment={selectedComment}
            multiCount={selectedNodeIds.length}
            isScreenRoot={isScreenRoot}
            interactionMode={interactionMode}
            screens={screens}
            selectedScreenId={selectedScreenId}
            prototypes={prototypes}
            components={components}
            onChange={(patch) => {
              if (!selectedScreenId) return;
              if (selectedNodeIds.length > 1) {
                patchNodes(selectedScreenId, selectedNodeIds, patch);
                return;
              }
              if (!primaryNode) return;
              patchNode(selectedScreenId, primaryNode.id, patch);
            }}
            onChangeScreen={(patch) => {
              if (!selectedScreenId) return;
              patchScreen(selectedScreenId, patch);
            }}
            onAlign={alignSelected}
            onDistribute={distributeSelected}
            onAddPrototypeLink={addPrototypeLink}
            onDeletePrototypeLink={deletePrototypeLink}
            onChangeComment={(patch) => {
              if (!selectedCommentId) return;
              patchComment(selectedCommentId, patch);
            }}
            onResolveComment={(resolved) => {
              if (!selectedCommentId) return;
              resolveComment(selectedCommentId, resolved);
            }}
            onDeleteComment={() => {
              if (!selectedCommentId) return;
              deleteComment(selectedCommentId);
            }}
            onCreateComponent={createComponentFromSelection}
            onInsertInstance={insertComponentInstance}
            onSwitchVariant={switchInstanceVariantHandler}
            onDetachInstance={detachInstanceHandler}
            onAutoLayout={applyAutoLayoutToSelection}
            designPanel={designPanel}
          />
        </aside>

        <header className="floating-panel floating-header">
          <div className="toolbar-left">
            <Link to="/" className="home-back-link" title="Voltar aos projetos">
              ← Projetos
            </Link>
            <h1>{selected ? selected.name : 'FigmaShow'}</h1>
            <span className="status">{statusText}</span>
          </div>
          <div className="toolbar-right">
            <div className="export-menu-wrap" ref={exportMenuRef}>
              <button
                type="button"
                className={`tool-btn${exportOpen ? ' active' : ''}`}
                title="Exportar tela selecionada"
                onClick={() => setExportOpen((v) => !v)}
              >
                Exportar
              </button>
              {exportOpen && (
                <div className="export-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runExport('png')}
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runExport('css')}
                  >
                    CSS
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runExport('react')}
                  >
                    React
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="tool-btn"
              title="Apresentar protótipo"
              disabled={!selectedScreenId}
              onClick={() => setPrototypeOpen(true)}
            >
              Apresentar
            </button>
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
              className={`tool-btn${smartGuidesEnabled ? ' active' : ''}`}
              title={
                smartGuidesEnabled
                  ? 'Guias inteligentes (ligado)'
                  : 'Guias inteligentes (desligado)'
              }
              aria-pressed={smartGuidesEnabled}
              onClick={() => setSmartGuidesEnabled((v) => !v)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 1.5V14.5M1.5 8H14.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M8 4.2L6.8 3M8 4.2L9.2 3M8 11.8L6.8 13M8 11.8L9.2 13M4.2 8L3 6.8M4.2 8L3 9.2M11.8 8L13 6.8M11.8 8L13 9.2"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
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
      {prototypeOpen && (
        <PrototypePreview
          screens={screens}
          prototypes={prototypes}
          components={components}
          startScreenId={selectedScreenId || screens[0]?.id}
          onClose={() => setPrototypeOpen(false)}
        />
      )}
      {conflict && (
        <div className="conflict-dialog-backdrop" role="presentation">
          <div
            className="conflict-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-dialog-title"
          >
            <h2 id="conflict-dialog-title">Conflito de revisão</h2>
            <p>
              O projeto foi alterado em outra sessão. A versão local ainda está
              intacta.
            </p>
            <div className="conflict-dialog-actions">
              <button type="button" onClick={keepLocalConflict}>
                Manter local
              </button>
              <button type="button" onClick={acceptRemoteConflict}>
                Aceitar remoto
              </button>
              <button type="button" onClick={retryConflict}>
                Tentar de novo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
