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
import PrototypeOverlay from './PrototypeOverlay.jsx';

const MIN_ZOOM = 0.01;
const MAX_ZOOM = 256;
const LABEL_H = 28;
const WHEEL_ZOOM_SENSITIVITY = 0.0028;
const WHEEL_COMMIT_MS = 120;
const MIN_FRAME = 20;

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

function normRect(x0, y0, x1, y1) {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  const width = Math.abs(x1 - x0);
  const height = Math.abs(y1 - y0);
  return { x, y, width, height };
}

const FRAME_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * @param {number} ox
 * @param {number} oy
 * @param {number} ow
 * @param {number} oh
 * @param {string} handle
 * @param {number} dx
 * @param {number} dy
 */
function resizeFrameBox(ox, oy, ow, oh, handle, dx, dy) {
  let x = ox;
  let y = oy;
  let w = ow;
  let h = oh;
  if (handle.includes('e')) w = Math.max(MIN_FRAME, ow + dx);
  if (handle.includes('s')) h = Math.max(MIN_FRAME, oh + dy);
  if (handle.includes('w')) {
    const nextW = Math.max(MIN_FRAME, ow - dx);
    x = ox + (ow - nextW);
    w = nextW;
  }
  if (handle.includes('n')) {
    const nextH = Math.max(MIN_FRAME, oh - dy);
    y = oy + (oh - nextH);
    h = nextH;
  }
  return { x, y, width: w, height: h };
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
    frameToolActive = false,
    interactionMode = 'edit',
    components = [],
    prototypes = [],
    comments = [],
    selectedCommentId,
    selectedPrototypeLinkId = null,
    onAddComment,
    onSelectComment,
    onCreateNode,
    onCreateScreen,
    onMoveScreen,
    onResizeScreen,
    onResizeCommit,
    onMoveCommit,
    onDuplicateMoveCommit,
    onPatchNode,
    onLiveGeometry,
    onZoomChange,
    onPanActive,
    smartGuidesEnabled = true,
    onCreatePrototypeLink,
    onSelectPrototypeLink,
  },
  ref,
) {
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [zoom, setZoom] = useState(0.55);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  /** @type {[null | { kind: string, screenId?: string, x: number, y: number, width: number, height: number, handle?: string }, Function]} */
  const [frameGesture, setFrameGesture] = useState(null);

  const dragRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const screensRef = useRef(screens);
  const selectedIdRef = useRef(selectedId);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const frameToolRef = useRef(frameToolActive);
  const rafIdRef = useRef(null);
  const wheelCommitTimerRef = useRef(null);
  const wheelActiveRef = useRef(false);
  const gestureRef = useRef(false);

  screensRef.current = screens;
  selectedIdRef.current = selectedId;
  selectedNodeIdsRef.current = selectedNodeIds;
  frameToolRef.current = frameToolActive;

  const isPanningTool = handMode || spaceDown;
  const handModeRef = useRef(handMode);
  const spaceDownRef = useRef(spaceDown);
  const onHoverNodeRef = useRef(onHoverNode);
  const onPanActiveRef = useRef(onPanActive);
  const onCreateScreenRef = useRef(onCreateScreen);
  const onMoveScreenRef = useRef(onMoveScreen);
  const onResizeScreenRef = useRef(onResizeScreen);
  handModeRef.current = handMode;
  spaceDownRef.current = spaceDown;
  onHoverNodeRef.current = onHoverNode;
  onPanActiveRef.current = onPanActive;
  onCreateScreenRef.current = onCreateScreen;
  onMoveScreenRef.current = onMoveScreen;
  onResizeScreenRef.current = onResizeScreen;

  const applyWorldTransform = useCallback(() => {
    const el = worldRef.current;
    if (!el) return;
    const z = zoomRef.current;
    el.style.transform = worldTransform(panRef.current, z);
    if (viewportRef.current) {
      viewportRef.current.style.setProperty('--canvas-zoom', String(z));
    }
  }, []);

  const scheduleApply = useCallback(() => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      applyWorldTransform();
    });
  }, [applyWorldTransform]);

  const commitCamera = useCallback(() => {
    const nextPan = panRef.current;
    const nextZoom = zoomRef.current;
    setPan(nextPan);
    setZoom(nextZoom);
    onZoomChange?.(nextZoom);
  }, [onZoomChange]);

  const setCamera = useCallback(
    (nextPan, nextZoom) => {
      panRef.current = nextPan;
      zoomRef.current = nextZoom;
      applyWorldTransform();
      setPan(nextPan);
      setZoom(nextZoom);
      onZoomChange?.(nextZoom);
    },
    [applyWorldTransform, onZoomChange],
  );

  const getZoom = useCallback(() => zoomRef.current, []);

  const clientToWorld = useCallback((clientX, clientY) => {
    const vp = viewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const rect = vp.getBoundingClientRect();
    const z = zoomRef.current || 1;
    const p = panRef.current;
    return {
      x: (clientX - rect.left - p.x) / z,
      y: (clientY - rect.top - p.y) / z,
    };
  }, []);

  useLayoutEffect(() => {
    if (gestureRef.current || wheelActiveRef.current) return;
    panRef.current = pan;
    zoomRef.current = zoom;
    applyWorldTransform();
  }, [pan, zoom, applyWorldTransform]);

  useImperativeHandle(
    ref,
    () => ({
      focusScreen(screenId) {
        const screen = screensRef.current.find((s) => s.id === screenId);
        const vp = viewportRef.current;
        if (!screen || !vp) return;
        const rect = vp.getBoundingClientRect();
        const z = zoomRef.current;
        const cx = (screen.x ?? 0) + screen.width / 2;
        const cy = (screen.y ?? 0) + screen.height / 2;
        setCamera(
          {
            x: rect.width / 2 - cx * z,
            y: rect.height / 2 - cy * z,
          },
          z,
        );
      },
      zoomBy(factor, ax, ay) {
        const prev = zoomRef.current;
        const next = clamp(prev * factor, MIN_ZOOM, MAX_ZOOM);
        if (next === prev) return;
        const vp = viewportRef.current;
        const rect = vp?.getBoundingClientRect();
        const px = ax ?? (rect ? rect.width / 2 : 0);
        const py = ay ?? (rect ? rect.height / 2 : 0);
        setCamera(panAfterZoom(panRef.current, prev, next, px, py), next);
      },
      fitAll() {
        const vp = viewportRef.current;
        if (!vp) return;
        const rect = vp.getBoundingClientRect();
        const b = screenBounds(screensRef.current);
        const pad = 80;
        const bw = Math.max(1, b.maxX - b.minX);
        const bh = Math.max(1, b.maxY - b.minY);
        const zx = (rect.width - pad * 2) / bw;
        const zy = (rect.height - pad * 2) / bh;
        const next = clamp(Math.min(zx, zy), MIN_ZOOM, 1.5);
        setCamera(
          {
            x: pad - b.minX * next,
            y: pad - b.minY * next,
          },
          next,
        );
      },
    }),
    [setCamera],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
          return;
        }
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const scheduleWheelCommit = useCallback(() => {
    if (wheelCommitTimerRef.current) clearTimeout(wheelCommitTimerRef.current);
    wheelCommitTimerRef.current = setTimeout(() => {
      wheelCommitTimerRef.current = null;
      wheelActiveRef.current = false;
      commitCamera();
    }, WHEEL_COMMIT_MS);
  }, [commitCamera]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      wheelActiveRef.current = true;
      gestureRef.current = true;

      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const prev = zoomRef.current;
        const next = clamp(
          prev * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        panRef.current = panAfterZoom(panRef.current, prev, next, mx, my);
        zoomRef.current = next;
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
  }, [scheduleApply, scheduleWheelCommit]);

  // Pan (espaço / mão / botão do meio)
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
      if (!drag || drag.pointerId !== e.pointerId) return;

      if (drag.type === 'pan') {
        panRef.current = {
          x: drag.originX + (e.clientX - drag.startX),
          y: drag.originY + (e.clientY - drag.startY),
        };
        scheduleApply();
        return;
      }

      if (drag.type === 'draw-frame') {
        const w = clientToWorld(e.clientX, e.clientY);
        const box = normRect(drag.originWorldX, drag.originWorldY, w.x, w.y);
        setFrameGesture({ kind: 'draw', ...box });
        return;
      }

      if (drag.type === 'move-screen') {
        const z = zoomRef.current || 1;
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        setFrameGesture({
          kind: 'move',
          screenId: drag.screenId,
          x: drag.originX + dx,
          y: drag.originY + dy,
          width: drag.width,
          height: drag.height,
        });
        return;
      }

      if (drag.type === 'resize-screen') {
        const z = zoomRef.current || 1;
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        const box = resizeFrameBox(
          drag.originX,
          drag.originY,
          drag.originW,
          drag.originH,
          drag.handle,
          dx,
          dy,
        );
        setFrameGesture({
          kind: 'resize',
          screenId: drag.screenId,
          handle: drag.handle,
          ...box,
        });
      }
    };

    const onEnd = (e) => {
      if (dragRef.current?.pointerId !== e.pointerId) return;
      const drag = dragRef.current;
      dragRef.current = null;
      setIsDraggingPan(false);
      gestureRef.current = false;
      onPanActiveRef.current?.(false);

      if (drag?.type === 'pan') {
        commitCamera();
      } else if (drag?.type === 'draw-frame') {
        const w = clientToWorld(e.clientX, e.clientY);
        const box = normRect(drag.originWorldX, drag.originWorldY, w.x, w.y);
        setFrameGesture(null);
        if (box.width >= MIN_FRAME && box.height >= MIN_FRAME) {
          onCreateScreenRef.current?.({
            x: Math.round(box.x),
            y: Math.round(box.y),
            width: Math.round(box.width),
            height: Math.round(box.height),
            name: `Quadro ${Math.round(box.width)}×${Math.round(box.height)}`,
          });
        }
      } else if (drag?.type === 'move-screen') {
        const z = zoomRef.current || 1;
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        setFrameGesture(null);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          onMoveScreenRef.current?.(drag.screenId, {
            x: Math.round(drag.originX + dx),
            y: Math.round(drag.originY + dy),
          });
        }
      } else if (drag?.type === 'resize-screen') {
        const z = zoomRef.current || 1;
        const dx = (e.clientX - drag.startX) / z;
        const dy = (e.clientY - drag.startY) / z;
        const box = resizeFrameBox(
          drag.originX,
          drag.originY,
          drag.originW,
          drag.originH,
          drag.handle,
          dx,
          dy,
        );
        setFrameGesture(null);
        onResizeScreenRef.current?.(drag.screenId, {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
      }

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
  }, [scheduleApply, commitCamera, clientToWorld]);

  const beginScreenMove = useCallback(
    (e, screen) => {
      if (isPanningTool || e.button !== 0) return;
      if (handModeRef.current || spaceDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(screen.id);
      const el = viewportRef.current;
      gestureRef.current = true;
      dragRef.current = {
        type: 'move-screen',
        screenId: screen.id,
        startX: e.clientX,
        startY: e.clientY,
        originX: screen.x ?? 0,
        originY: screen.y ?? 0,
        width: screen.width,
        height: screen.height,
        pointerId: e.pointerId,
      };
      setFrameGesture({
        kind: 'move',
        screenId: screen.id,
        x: screen.x ?? 0,
        y: screen.y ?? 0,
        width: screen.width,
        height: screen.height,
      });
      el?.setPointerCapture?.(e.pointerId);
    },
    [isPanningTool, onSelect],
  );

  const beginScreenResize = useCallback(
    (e, screen, handle) => {
      if (isPanningTool || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(screen.id);
      const el = viewportRef.current;
      gestureRef.current = true;
      dragRef.current = {
        type: 'resize-screen',
        screenId: screen.id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        originX: screen.x ?? 0,
        originY: screen.y ?? 0,
        originW: screen.width,
        originH: screen.height,
        pointerId: e.pointerId,
      };
      setFrameGesture({
        kind: 'resize',
        screenId: screen.id,
        handle,
        x: screen.x ?? 0,
        y: screen.y ?? 0,
        width: screen.width,
        height: screen.height,
      });
      el?.setPointerCapture?.(e.pointerId);
    },
    [isPanningTool, onSelect],
  );

  const viewportClass = [
    'infinite-viewport',
    isPanningTool ? 'panning' : frameToolActive ? 'tool-frame' : 'tool-move',
    isDraggingPan ? 'is-panning' : '',
    frameGesture ? 'is-frame-gesture' : '',
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

        // Ferramenta Quadro: desenhar no fundo
        if (
          frameToolRef.current &&
          (e.target === viewportRef.current || e.target === worldRef.current)
        ) {
          e.preventDefault();
          const w = clientToWorld(e.clientX, e.clientY);
          gestureRef.current = true;
          dragRef.current = {
            type: 'draw-frame',
            originWorldX: w.x,
            originWorldY: w.y,
            pointerId: e.pointerId,
          };
          setFrameGesture({
            kind: 'draw',
            x: w.x,
            y: w.y,
            width: 0,
            height: 0,
          });
          viewportRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }

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
          const live =
            frameGesture &&
            frameGesture.screenId === screen.id &&
            (frameGesture.kind === 'move' || frameGesture.kind === 'resize')
              ? frameGesture
              : null;
          const x = live ? live.x : (screen.x ?? 0);
          const y = live ? live.y : (screen.y ?? 0);
          const width = live ? live.width : screen.width;
          const height = live ? live.height : screen.height;
          const displayScreen =
            live && live.kind === 'resize'
              ? { ...screen, x, y, width, height }
              : live && live.kind === 'move'
                ? { ...screen, x, y }
                : screen;

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
              <div
                className="artboard-label"
                onPointerDown={(e) => {
                  if (isPanningTool || e.button !== 0) return;
                  // Label sempre pode iniciar move do frame
                  if (!frameToolActive) {
                    beginScreenMove(e, {
                      ...screen,
                      x: screen.x ?? 0,
                      y: screen.y ?? 0,
                    });
                  } else {
                    e.stopPropagation();
                    onSelect?.(screen.id);
                  }
                }}
              >
                {screen.name}
              </div>
              <div className="artboard-frame-wrap" style={{ width, height }}>
                <PhoneFrame
                  screen={displayScreen}
                  selectedNodeIds={
                    selectedId === screen.id ? selectedNodeIds : []
                  }
                  hoveredNodeId={hoveredNodeId}
                  onSelectNode={
                    isPanningTool || frameToolActive
                      ? undefined
                      : (nodeId, opts) =>
                          onSelectNode?.(screen.id, nodeId, opts)
                  }
                  onHoverNode={
                    isPanningTool
                      ? undefined
                      : (nodeId) => onHoverNode?.(screen.id, nodeId)
                  }
                  dragEnabled={
                    dragEnabled && !isPanningTool && !frameToolActive
                  }
                  createTool={
                    isPanningTool || frameToolActive ? null : createTool
                  }
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
                  onFrameBackgroundPointerDown={
                    frameSelected && !frameToolActive && dragEnabled
                      ? (e) =>
                          beginScreenMove(e, {
                            ...screen,
                            x: screen.x ?? 0,
                            y: screen.y ?? 0,
                          })
                      : undefined
                  }
                />
                {frameSelected && !frameToolActive && (
                  <>
                    {FRAME_HANDLES.map((h) => (
                      <div
                        key={h}
                        className={`frame-resize-handle frame-resize-${h}`}
                        onPointerDown={(e) =>
                          beginScreenResize(
                            e,
                            {
                              ...screen,
                              x: screen.x ?? 0,
                              y: screen.y ?? 0,
                              width,
                              height,
                            },
                            h,
                          )
                        }
                      />
                    ))}
                    {(live || frameSelected) && (
                      <div className="frame-size-badge">
                        {Math.round(width)} × {Math.round(height)}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {frameGesture?.kind === 'draw' && (
          <div
            className="frame-draw-ghost"
            style={{
              left: frameGesture.x,
              top: frameGesture.y,
              width: Math.max(1, frameGesture.width),
              height: Math.max(1, frameGesture.height),
            }}
          >
            <div className="frame-size-badge">
              {Math.round(frameGesture.width)} ×{' '}
              {Math.round(frameGesture.height)}
            </div>
          </div>
        )}

        <PrototypeOverlay
          active={interactionMode === 'prototype'}
          screens={screens}
          prototypes={prototypes}
          selectedScreenId={selectedId}
          selectedNodeIds={selectedNodeIds}
          selectedLinkId={selectedPrototypeLinkId}
          worldToClient={clientToWorld}
          onCreateLink={onCreatePrototypeLink}
          onSelectLink={onSelectPrototypeLink}
        />
      </div>
    </div>
  );
}));

export default InfiniteCanvas;
