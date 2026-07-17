import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import PhoneFrame from './PhoneFrame.jsx';

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 256;
const LABEL_H = 28;
/** Pinch/Ctrl+scroll — um pouco mais solto que 0.0015, sem voltar ao extremo. */
const WHEEL_ZOOM_SENSITIVITY = 0.0028;
/** Debounce para sincronizar React depois do wheel contínuo. */
const WHEEL_COMMIT_MS = 120;

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

function worldTransform(pan, zoom) {
  return `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`;
}

const InfiniteCanvas = memo(forwardRef(function InfiniteCanvas(
  {
    screens,
    selectedId,
    selectedNodeIds = [],
    hoveredNodeId,
    onSelect,
    onClearSelection,
    onSelectNode,
    onHoverNode,
    handMode,
    dragEnabled = false,
    createTool = null,
    interactionMode = 'edit',
    components = [],
    prototypes = [],
    comments = [],
    selectedCommentId,
    onAddComment,
    onSelectComment,
    onCreateNode,
    onResizeCommit,
    onMoveCommit,
    onDuplicateMoveCommit,
    onPatchNode,
    onLiveGeometry,
    onZoomChange,
    onPanActive,
    smartGuidesEnabled = true,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(0.55);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);

  const dragRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const screensRef = useRef(screens);
  const selectedIdRef = useRef(selectedId);
  const rafIdRef = useRef(null);
  const wheelCommitTimerRef = useRef(null);
  const wheelActiveRef = useRef(false);
  const gestureRef = useRef(false);

  screensRef.current = screens;
  selectedIdRef.current = selectedId;

  const isPanningTool = handMode || spaceDown;
  const handModeRef = useRef(handMode);
  const spaceDownRef = useRef(spaceDown);
  const onHoverNodeRef = useRef(onHoverNode);
  const onPanActiveRef = useRef(onPanActive);
  handModeRef.current = handMode;
  spaceDownRef.current = spaceDown;
  onHoverNodeRef.current = onHoverNode;
  onPanActiveRef.current = onPanActive;

  const applyWorldTransform = useCallback(() => {
    const el = worldRef.current;
    if (!el) return;
    const z = zoomRef.current;
    el.style.transform = worldTransform(panRef.current, z);
    el.style.setProperty('--canvas-zoom', String(z));
  }, []);

  /** No máximo 1 paint de transform por frame. */
  const scheduleApply = useCallback(() => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      applyWorldTransform();
    });
  }, [applyWorldTransform]);

  /** Sincroniza React (header zoom %) sem reaplicar DOM desnecessariamente. */
  const commitCamera = useCallback(() => {
    const nextPan = panRef.current;
    const nextZoom = zoomRef.current;
    setPan((prev) =>
      prev.x === nextPan.x && prev.y === nextPan.y ? prev : { ...nextPan },
    );
    setZoom((prev) => (prev === nextZoom ? prev : nextZoom));
    onZoomChange?.(nextZoom);
  }, [onZoomChange]);

  const scheduleWheelCommit = useCallback(() => {
    if (wheelCommitTimerRef.current != null) {
      clearTimeout(wheelCommitTimerRef.current);
    }
    wheelCommitTimerRef.current = setTimeout(() => {
      wheelCommitTimerRef.current = null;
      if (wheelActiveRef.current) {
        wheelActiveRef.current = false;
        gestureRef.current = false;
        onPanActive?.(false);
      }
      commitCamera();
    }, WHEEL_COMMIT_MS);
  }, [commitCamera, onPanActive]);

  const setCamera = useCallback(
    (nextPan, nextZoom, { commit = true } = {}) => {
      panRef.current = nextPan;
      zoomRef.current = nextZoom;
      applyWorldTransform();
      if (commit) {
        setPan(nextPan);
        setZoom(nextZoom);
        onZoomChange?.(nextZoom);
      }
    },
    [applyWorldTransform, onZoomChange],
  );

  // Mantém refs alinhadas ao state apenas fora de gesture (evita resetar pan no meio do drag).
  useLayoutEffect(() => {
    if (gestureRef.current) {
      applyWorldTransform();
      return;
    }
    panRef.current = pan;
    zoomRef.current = zoom;
    applyWorldTransform();
  }, [pan, zoom, applyWorldTransform]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      if (wheelCommitTimerRef.current != null) {
        clearTimeout(wheelCommitTimerRef.current);
      }
    };
  }, []);

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
    setCamera(
      {
        x: vw / 2 - cx * z,
        y: vh / 2 - cy * z,
      },
      z,
    );
  }, [setCamera]);

  const focusScreen = useCallback(
    (screenId) => {
      const el = viewportRef.current;
      const screen = screensRef.current.find((s) => s.id === screenId);
      if (!el || !screen) return;
      const z = zoomRef.current;
      const cx = (screen.x ?? 0) + screen.width / 2;
      const cy = (screen.y ?? 0) + screen.height / 2;
      setCamera(
        {
          x: el.clientWidth / 2 - cx * z,
          y: el.clientHeight / 2 - cy * z,
        },
        z,
      );
    },
    [setCamera],
  );

  const zoomAt = useCallback(
    (nextZoom, ax, ay) => {
      const prev = zoomRef.current;
      const next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (next === prev) return;
      setCamera(panAfterZoom(panRef.current, prev, next, ax, ay), next);
    },
    [setCamera],
  );

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

  const getZoom = useCallback(() => zoomRef.current, []);

  useImperativeHandle(
    ref,
    () => ({
      fitAll,
      focusScreen,
      setZoomLevel(next) {
        const el = viewportRef.current;
        if (!el) {
          const z = clamp(next, MIN_ZOOM, MAX_ZOOM);
          setCamera(panRef.current, z);
          return;
        }
        zoomAt(next, el.clientWidth / 2, el.clientHeight / 2);
      },
      zoomBy,
      getZoom: () => zoomRef.current,
      getScreenElement(screenId) {
        const world = worldRef.current;
        if (!world || !screenId) return null;
        return world.querySelector(`[data-screen-id="${CSS.escape(String(screenId))}"]`);
      },
    }),
    [fitAll, focusScreen, zoomAt, zoomBy, setCamera],
  );

  const fittedOnce = useRef(false);
  useEffect(() => {
    if (!screens.length || fittedOnce.current) return;
    fittedOnce.current = true;
    requestAnimationFrame(() => fitAll());
  }, [screens.length, fitAll]);

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

      if (!wheelActiveRef.current) {
        wheelActiveRef.current = true;
        gestureRef.current = true;
        onPanActive?.(true);
      }

      if (e.ctrlKey || e.metaKey) {
        const prev = zoomRef.current;
        const next = clamp(
          prev * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        if (next !== prev) {
          panRef.current = panAfterZoom(panRef.current, prev, next, mx, my);
          zoomRef.current = next;
        }
      } else {
        panRef.current = {
          x: panRef.current.x - e.deltaX,
          y: panRef.current.y - e.deltaY,
        };
      }

      scheduleApply();
      scheduleWheelCommit();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [scheduleApply, scheduleWheelCommit, onPanActive]);

  // Pan em capture: roda antes dos nós (espaço / mão / botão do meio).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const beginPan = (e) => {
      const panGesture =
        e.button === 1 ||
        (e.button === 0 && (handModeRef.current || spaceDownRef.current));
      if (!panGesture) return;

      e.preventDefault();
      e.stopPropagation();
      onHoverNodeRef.current?.(null, null);
      setIsDraggingPan(true);
      gestureRef.current = true;
      onPanActiveRef.current?.(true);
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originX: panRef.current.x,
        originY: panRef.current.y,
        pointerId: e.pointerId,
      };
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag || drag.type !== 'pan') return;
      if (drag.pointerId !== e.pointerId) return;
      panRef.current = {
        x: drag.originX + (e.clientX - drag.startX),
        y: drag.originY + (e.clientY - drag.startY),
      };
      scheduleApply();
    };

    const onEnd = (e) => {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      dragRef.current = null;
      setIsDraggingPan(false);
      gestureRef.current = false;
      onPanActiveRef.current?.(false);
      commitCamera();
      if (el.hasPointerCapture?.(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    };

    el.addEventListener('pointerdown', beginPan, true);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    return () => {
      el.removeEventListener('pointerdown', beginPan, true);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
    };
  }, [scheduleApply, commitCamera]);

  const viewportClass = [
    'infinite-viewport',
    isPanningTool ? 'panning' : 'tool-move',
    isDraggingPan ? 'is-panning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={viewportRef}
      className={viewportClass}
      onPointerLeave={() => onHoverNode?.(null, null)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (isPanningTool || e.button !== 0) return;
        // Clique no fundo do canvas (fora dos frames) → limpa seleção
        if (e.target === viewportRef.current || e.target === worldRef.current) {
          onClearSelection?.();
        }
      }}
    >
      <div
        ref={worldRef}
        className="infinite-world"
        style={{ transformOrigin: '0 0' }}
      >
        {screens.map((screen) => {
          const x = screen.x ?? 0;
          const y = screen.y ?? 0;
          // Como no Figma: anel do frame só quando o frame em si está selecionado
          const frameSelected =
            screen.id === selectedId && selectedNodeIds.length === 0;
          return (
            <div
              key={screen.id}
              className={`artboard${frameSelected ? ' selected' : ''}`}
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
                selectedNodeIds={
                  selectedId === screen.id ? selectedNodeIds : []
                }
                hoveredNodeId={hoveredNodeId}
                onSelectNode={
                  isPanningTool
                    ? undefined
                    : (nodeId, opts) =>
                        onSelectNode?.(screen.id, nodeId, opts)
                }
                onHoverNode={
                  isPanningTool
                    ? undefined
                    : (nodeId) => onHoverNode?.(screen.id, nodeId)
                }
                dragEnabled={dragEnabled && !isPanningTool}
                createTool={isPanningTool ? null : createTool}
                interactionMode={interactionMode}
                components={components}
                prototypes={prototypes}
                allScreens={screens}
                comments={comments}
                selectedCommentId={selectedCommentId}
                onAddComment={onAddComment}
                onSelectComment={onSelectComment}
                onCreateNode={onCreateNode}
                onResizeCommit={onResizeCommit}
                getZoom={getZoom}
                onMoveCommit={onMoveCommit}
                onDuplicateMoveCommit={onDuplicateMoveCommit}
                onPatchNode={onPatchNode}
                onLiveGeometry={onLiveGeometry}
                onDragActive={onPanActive}
                smartGuidesEnabled={smartGuidesEnabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}));

export default InfiniteCanvas;
