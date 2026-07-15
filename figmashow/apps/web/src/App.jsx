import { useCallback, useEffect, useRef, useState } from 'react';
import InfiniteCanvas from './InfiniteCanvas.jsx';
import LayersPanel from './LayersPanel.jsx';

const POLL_MS = 500;

function containsNodeId(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return true;
    if (node.type === 'group' && containsNodeId(node.children, id)) return true;
  }
  return false;
}

export default function App() {
  const [board, setBoard] = useState(null);
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [zoom, setZoom] = useState(0.55);
  const [handMode, setHandMode] = useState(false);
  const [focusRequest, setFocusRequest] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/board', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setBoard(data);
        setError(null);
        setUpdatedAt(new Date());
        setSelectedScreenId((prev) => {
          if (prev && data.screens.some((s) => s.id === prev)) return prev;
          return data.screens[0]?.id ?? null;
        });
        setSelectedNodeId((prev) => {
          if (!prev) return null;
          const screen = data.screens.find((s) =>
            containsNodeId(s.nodes, prev),
          );
          return screen ? prev : null;
        });
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

  const selectScreen = useCallback(
    (id) => {
      if (id !== selectedScreenId) {
        setFocusRequest({ id, t: Date.now() });
      }
      setSelectedScreenId(id);
      setSelectedNodeId(null);
      setHoveredNodeId(null);
    },
    [selectedScreenId],
  );

  const selectNode = useCallback(
    (screenId, nodeId) => {
      if (screenId !== selectedScreenId) {
        setFocusRequest({ id: screenId, t: Date.now() });
      }
      setSelectedScreenId(screenId);
      setSelectedNodeId(nodeId);
    },
    [selectedScreenId],
  );

  const hoverNode = useCallback((_screenId, nodeId) => {
    setHoveredNodeId(nodeId ?? null);
  }, []);

  const screens = board?.screens || [];
  const selected = screens.find((s) => s.id === selectedScreenId);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Figma<span>Show</span>
        </div>
        <p className="hint">
          Camadas à esquerda. Pan/zoom no canvas. Edite via MCP.
        </p>
        <LayersPanel
          screens={screens}
          selectedScreenId={selectedScreenId}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onSelectScreen={selectScreen}
          onSelectNode={selectNode}
          onHoverNode={hoverNode}
        />
      </aside>

      <main className="stage">
        <header className="toolbar">
          <div className="toolbar-left">
            <h1>{selected ? selected.name : 'FigmaShow'}</h1>
            <span className="status">
              {error
                ? `Erro: ${error}`
                : updatedAt
                  ? `Sync ${updatedAt.toLocaleTimeString()}`
                  : 'Carregando…'}
            </span>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className={`tool-btn${handMode ? ' active' : ''}`}
              title="Mão (pan)"
              onClick={() => setHandMode((v) => !v)}
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
        <div className="canvas-wrap">
          {screens.length ? (
            <InfiniteCanvas
              ref={canvasRef}
              screens={screens}
              selectedId={selectedScreenId}
              selectedNodeId={selectedNodeId}
              hoveredNodeId={hoveredNodeId}
              onSelect={selectScreen}
              onSelectNode={selectNode}
              onHoverNode={hoverNode}
              handMode={handMode}
              onZoomChange={setZoom}
              focusRequest={focusRequest}
            />
          ) : (
            <div className="empty">Selecione ou crie uma tela.</div>
          )}
        </div>
      </main>
    </div>
  );
}
