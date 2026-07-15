import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import PhoneFrame from './PhoneFrame.jsx';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const LABEL_H = 28;
/** Pinch/Ctrl+scroll — um pouco mais solto que 0.0015, sem voltar ao extremo. */
const WHEEL_ZOOM_SENSITIVITY = 0.0028;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function screenBounds(screens) {
  if (!screens.length) {
    return { minX: 0, minY: 0, maxX: 390, maxY: 844 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of screens) {
    const x = s.x ?? 0;
    const y = s.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y - LABEL_H);
    maxX = Math.max(maxX, x + s.width);
    maxY = Math.max(maxY, y + s.height);
  }
  return { minX, minY, maxX, maxY };
}

/** Zoom mantendo o ponto (ax, ay) do viewport fixo no mundo. */
function panAfterZoom(pan, prevZoom, nextZoom, ax, ay) {
  const ratio = nextZoom / prevZoom;
  return {
    x: ax - (ax - pan.x) * ratio,
    y: ay - (ay - pan.y) * ratio,
  };
}

const InfiniteCanvas = forwardRef(function InfiniteCanvas(
  {
    screens,
    selectedId,
    selectedNodeId,
    hoveredNodeId,
    onSelect,
    onSelectNode,
    onHoverNode,
    handMode,
    onZoomChange,
    focusRequest,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(0.55);
  const [spaceDown, setSpaceDown] = useState(false);
  const dragRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const screensRef = useRef(screens);
  const selectedIdRef = useRef(selectedId);
  const lastFocusT = useRef(null);

  panRef.current = pan;
  zoomRef.current = zoom;
  screensRef.current = screens;
  selectedIdRef.current = selectedId;

  const isPanningTool = handMode || spaceDown;

  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  const fitAll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const list = screensRef.current;
    const { minX, minY, maxX, maxY } = screenBounds(list);
    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);
    const pad = 64;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const z = clamp(
      Math.min((vw - pad * 2) / worldW, (vh - pad * 2) / worldH),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(z);
    setPan({
      x: vw / 2 - cx * z,
      y: vh / 2 - cy * z,
    });
  }, []);

  const focusScreen = useCallback((screenId) => {
    const el = viewportRef.current;
    const screen = screensRef.current.find((s) => s.id === screenId);
    if (!el || !screen) return;
    const z = zoomRef.current;
    const cx = (screen.x ?? 0) + screen.width / 2;
    const cy = (screen.y ?? 0) + screen.height / 2;
    setPan({
      x: el.clientWidth / 2 - cx * z,
      y: el.clientHeight / 2 - cy * z,
    });
  }, []);

  const zoomAt = useCallback((nextZoom, ax, ay) => {
    const prev = zoomRef.current;
    const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (next === prev) return;
    setPan((p) => panAfterZoom(p, prev, next, ax, ay));
    setZoom(next);
  }, []);

  const zoomBy = useCallback(
    (factor) => {
      const el = viewportRef.current;
      if (!el) return;
      const prev = zoomRef.current;
      const next = clamp(prev * factor, MIN_ZOOM, MAX_ZOOM);
      const screen = screensRef.current.find(
        (s) => s.id === selectedIdRef.current,
      );
      let ax;
      let ay;
      if (screen) {
        // Âncora = centro do frame selecionado, em coords do viewport
        const p = panRef.current;
        ax = p.x + ((screen.x ?? 0) + screen.width / 2) * prev;
        ay = p.y + ((screen.y ?? 0) + screen.height / 2) * prev;
      } else {
        ax = el.clientWidth / 2;
        ay = el.clientHeight / 2;
      }
      zoomAt(next, ax, ay);
    },
    [zoomAt],
  );

  useImperativeHandle(
    ref,
    () => ({
      fitAll,
      focusScreen,
      setZoomLevel(next) {
        const el = viewportRef.current;
        if (!el) {
          setZoom(clamp(next, MIN_ZOOM, MAX_ZOOM));
          return;
        }
        zoomAt(next, el.clientWidth / 2, el.clientHeight / 2);
      },
      zoomBy,
      getZoom: () => zoomRef.current,
    }),
    [fitAll, focusScreen, zoomAt, zoomBy],
  );

  // Fit once when screens first appear
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!screens.length || fittedOnce.current) return;
    fittedOnce.current = true;
    requestAnimationFrame(() => fitAll());
  }, [screens.length, fitAll]);

  // Só recentra quando chega um novo pedido (timestamp), nunca no poll/zoom.
  useEffect(() => {
    if (!focusRequest?.t) return;
    if (lastFocusT.current === focusRequest.t) return;
    lastFocusT.current = focusRequest.t;
    focusScreen(focusRequest.id);
  }, [focusRequest, focusScreen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Zoom with ctrl/cmd (inclui pinch no trackpad)
      if (e.ctrlKey || e.metaKey) {
        const prev = zoomRef.current;
        const next = clamp(
          prev * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        if (next === prev) return;
        setPan((p) => panAfterZoom(p, prev, next, mx, my));
        setZoom(next);
        return;
      }

      // Scroll / trackpad pans
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e) => {
    const panGesture =
      e.button === 1 || (e.button === 0 && (handMode || spaceDown));
    if (panGesture) {
      e.preventDefault();
      onHoverNode?.(null, null);
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y,
        pointerId: e.pointerId,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.type !== 'pan') return;
    setPan({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    });
  };

  const endDrag = (e) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const worldStyle = useMemo(
    () => ({
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: '0 0',
    }),
    [pan.x, pan.y, zoom],
  );

  return (
    <div
      ref={viewportRef}
      className={`infinite-viewport${isPanningTool ? ' panning' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => onHoverNode?.(null, null)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="infinite-world" style={worldStyle}>
        {screens.map((screen) => {
          const x = screen.x ?? 0;
          const y = screen.y ?? 0;
          const selected = screen.id === selectedId;
          return (
            <div
              key={screen.id}
              className={`artboard${selected ? ' selected' : ''}`}
              style={{ left: x, top: y - LABEL_H }}
              onPointerDown={(e) => {
                if (isPanningTool || e.button !== 0) return;
                e.stopPropagation();
                onSelect?.(screen.id);
              }}
            >
              <div className="artboard-label">{screen.name}</div>
              <PhoneFrame
                screen={screen}
                selectedNodeId={
                  selectedId === screen.id ? selectedNodeId : null
                }
                hoveredNodeId={hoveredNodeId}
                onSelectNode={
                  isPanningTool
                    ? undefined
                    : (nodeId) => onSelectNode?.(screen.id, nodeId)
                }
                onHoverNode={
                  isPanningTool
                    ? undefined
                    : (nodeId) => onHoverNode?.(screen.id, nodeId)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default InfiniteCanvas;
