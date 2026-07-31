import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CANVAS_SCOPE } from '@figmashow/core/schema';
import PhoneFrame, { buildCreatedNode } from './PhoneFrame.jsx';
import PrototypeOverlay from './PrototypeOverlay.jsx';
import LogicLayerOverlay from './LogicLayerOverlay.jsx';

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
    canvasNodes = [],
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
    onInsertLogicOnPrototype,
    editorLayer = 'conceptual',
    logicGraphs = [],
    selectedLogicNodeId = null,
    selectedLogicLinkId = null,
    onSelectLogicLink,
    onSelectLogicNode,
    onMoveLogicNode,
    onConnectLogicNodes,
    onAddLogicNodeAt,
    onClearLogicSelection,
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

  /**
   * Telas exibidas no canvas (posição do board).
   */
  const displayScreens = useMemo(() => screens || [], [screens]);

  /** Telas com posição live do gesto — overlays (linhas/nós) acompanham o arraste. */
  const screensForOverlays = useMemo(() => {
    if (
      !frameGesture ||
      (frameGesture.kind !== 'move' && frameGesture.kind !== 'resize') ||
      !frameGesture.screenId
    ) {
      return displayScreens;
    }
    return displayScreens.map((s) => {
      if (s.id !== frameGesture.screenId) return s;
      return {
        ...s,
        x: frameGesture.x,
        y: frameGesture.y,
        width: frameGesture.width ?? s.width,
        height: frameGesture.height ?? s.height,
      };
    });
  }, [displayScreens, frameGesture]);

  screensRef.current = displayScreens;
  selectedIdRef.current = selectedId;
  selectedNodeIdsRef.current = selectedNodeIds;
  frameToolRef.current = frameToolActive;
  const createToolRef = useRef(createTool);
  createToolRef.current = createTool;
  const onCreateNodeRef = useRef(onCreateNode);
  onCreateNodeRef.current = onCreateNode;

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
      fitScreens(screenIds) {
        const vp = viewportRef.current;
        if (!vp || !screenIds?.length) return;
        const idSet = new Set(screenIds);
        const subset = (screensRef.current || []).filter((s) =>
          idSet.has(s.id),
        );
        if (!subset.length) return;
        const rect = vp.getBoundingClientRect();
        const b = screenBounds(subset);
        const bw = Math.max(1, b.maxX - b.minX);
        const bh = Math.max(1, b.maxY - b.minY);

        // Área útil: desconta header, tools, drawer e painéis flutuantes
        let padL = 48;
        let padR = 48;
        let padT = 88;
        let padB = 96;
        const root = vp.closest('.canvas-wrap') || document;
        const measureInset = (sel, side) => {
          const el = root.querySelector?.(sel) || document.querySelector(sel);
          if (!el) return;
          const er = el.getBoundingClientRect();
          if (side === 'right' && er.left < rect.right && er.right > rect.left) {
            padR = Math.max(padR, rect.right - er.left + 16);
          }
          if (side === 'left' && er.right > rect.left && er.left < rect.right) {
            padL = Math.max(padL, er.right - rect.left + 16);
          }
          if (side === 'top' && er.bottom > rect.top && er.top < rect.bottom) {
            padT = Math.max(padT, er.bottom - rect.top + 12);
          }
          if (side === 'bottom' && er.top < rect.bottom && er.bottom > rect.top) {
            padB = Math.max(padB, rect.bottom - er.top + 12);
          }
        };
        measureInset('.logic-drawer', 'right');
        measureInset('.floating-panel.floating-layers', 'left');
        measureInset('.floating-panel.floating-header', 'top');
        measureInset('.figma-tools-bar', 'bottom');

        const availW = Math.max(120, rect.width - padL - padR);
        const availH = Math.max(120, rect.height - padT - padB);
        const zx = availW / bw;
        const zy = availH / bh;
        const next = clamp(Math.min(zx, zy) * 0.92, MIN_ZOOM, 1.5);
        const cx = (b.minX + b.maxX) / 2;
        const cy = (b.minY + b.maxY) / 2;
        const viewCx = padL + availW / 2;
        const viewCy = padT + availH / 2;
        setCamera(
          {
            x: viewCx - cx * next,
            y: viewCy - cy * next,
          },
          next,
        );
      },
      getCamera() {
        return { pan: { ...panRef.current }, zoom: zoomRef.current };
      },
      setCameraState(nextPan, nextZoom) {
        if (!nextPan) return;
        setCamera(nextPan, nextZoom ?? zoomRef.current);
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

      if (drag.type === 'draw-canvas-node') {
        const w = clientToWorld(e.clientX, e.clientY);
        const box = normRect(drag.originWorldX, drag.originWorldY, w.x, w.y);
        setFrameGesture({
          kind: 'draw-node',
          createType: drag.createType,
          ...box,
        });
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
      } else if (drag?.type === 'draw-canvas-node') {
        const w = clientToWorld(e.clientX, e.clientY);
        const box = normRect(drag.originWorldX, drag.originWorldY, w.x, w.y);
        setFrameGesture(null);
        const createType = drag.createType || 'rect';
        const defaults =
          createType === 'text'
            ? { w: 120, h: 28 }
            : createType === 'button'
              ? { w: 160, h: 48 }
              : createType === 'image'
                ? { w: 160, h: 120 }
                : { w: 100, h: 100 };
        const tooSmall = box.width < 4 && box.height < 4;
        const nodeBox = tooSmall
          ? {
              x: drag.originWorldX,
              y: drag.originWorldY,
              w: defaults.w,
              h: defaults.h,
            }
          : {
              x: box.x,
              y: box.y,
              w: Math.max(1, box.width),
              h: Math.max(1, box.height),
            };
        onCreateNodeRef.current?.(
          CANVAS_SCOPE,
          buildCreatedNode(createType, nodeBox),
        );
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

        const t = e.target;
        const onCanvasBg =
          t === viewportRef.current ||
          t === worldRef.current ||
          (t instanceof Element && t.classList.contains('infinite-world'));
        const onInteractive = Boolean(
          t instanceof Element &&
            t.closest(
              '.artboard, .canvas-free-layer .node, .logic-node, .logic-add-menu, .logic-noodle-hit, .logic-noodle--axis, .phone-root, .resize-handle, .resize-edge-n, .resize-edge-s, .resize-edge-e, .resize-edge-w',
            ),
        );

        // Ferramenta Quadro: desenhar no fundo
        if (frameToolRef.current && onCanvasBg && !onInteractive) {
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

        // Shape/texto/botão no vazio do canvas → nó livre (fora de frames)
        if (
          createToolRef.current &&
          onCanvasBg &&
          !onInteractive &&
          !frameToolRef.current
        ) {
          e.preventDefault();
          const w = clientToWorld(e.clientX, e.clientY);
          gestureRef.current = true;
          dragRef.current = {
            type: 'draw-canvas-node',
            createType: createToolRef.current,
            originWorldX: w.x,
            originWorldY: w.y,
            pointerId: e.pointerId,
          };
          setFrameGesture({
            kind: 'draw-node',
            createType: createToolRef.current,
            x: w.x,
            y: w.y,
            width: 0,
            height: 0,
          });
          viewportRef.current?.setPointerCapture?.(e.pointerId);
          return;
        }

        // Clique fora: tira foco da linha/nó (igual Esc) + seleção do frame
        if (onCanvasBg && !onInteractive) {
          onClearLogicSelection?.();
          onClearSelection?.();
        }
      }}
    >
      <div
        ref={worldRef}
        className="infinite-world"
        style={{ transformOrigin: '0 0' }}
      >
        {displayScreens.map((screen) => {
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
          const logicDimmed = editorLayer === 'logic';
          const logicScreenActive =
            logicDimmed && selectedId && screen.id === selectedId;
          const logicScreenIdle =
            logicDimmed && selectedId && screen.id !== selectedId;

          return (
            <div
              key={screen.id}
              className={`artboard${frameSelected ? ' selected' : ''}${
                logicDimmed ? ' artboard--dimmed' : ''
              }${logicScreenActive ? ' artboard--logic-active' : ''}${
                logicScreenIdle ? ' artboard--logic-idle' : ''
              }`}
              style={{ left: x, top: y - LABEL_H }}
              onPointerDown={(e) => {
                if (isPanningTool || e.button !== 0) return;
                if (editorLayer === 'logic') {
                  e.stopPropagation();
                  onSelect?.(screen.id);
                  return;
                }
                e.stopPropagation();
                onSelect?.(screen.id);
              }}
            >
              <div
                className="artboard-label"
                onPointerDown={(e) => {
                  if (isPanningTool || e.button !== 0) return;
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
                {logicDimmed ? (
                  <button
                    type="button"
                    className="artboard-logic-pick"
                    aria-label={`Selecionar ${screen.name}`}
                    title="Selecionar esta tela"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
                      // Já selecionado: arrasta o frame; senão, só seleciona
                      if (screen.id === selectedId && !frameToolActive) {
                        beginScreenMove(e, {
                          ...screen,
                          x: screen.x ?? 0,
                          y: screen.y ?? 0,
                        });
                      } else {
                        onSelect?.(screen.id);
                      }
                    }}
                  />
                ) : null}
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
                  canvasNodes={canvasNodes}
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

        <div className="canvas-free-layer" aria-label="Objetos fora de frames">
          <PhoneFrame
            freeCanvas
            screen={{
              id: CANVAS_SCOPE,
              name: 'Canvas',
              width: 1,
              height: 1,
              background: 'transparent',
              x: 0,
              y: 0,
              nodes: canvasNodes || [],
            }}
            selectedNodeIds={
              selectedId === CANVAS_SCOPE ? selectedNodeIds : []
            }
            hoveredNodeId={
              selectedId === CANVAS_SCOPE ? hoveredNodeId : null
            }
            onSelectNode={
              isPanningTool || frameToolActive
                ? undefined
                : (nodeId, opts) => onSelectNode?.(CANVAS_SCOPE, nodeId, opts)
            }
            onHoverNode={
              isPanningTool
                ? undefined
                : (nodeId) => onHoverNode?.(CANVAS_SCOPE, nodeId)
            }
            dragEnabled={dragEnabled && !isPanningTool && !frameToolActive}
            createTool={null}
            interactionMode={interactionMode}
            components={components}
            prototypes={[]}
            allScreens={screens}
            comments={[]}
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

        {frameGesture?.kind === 'draw-node' && (
          <div
            className="frame-draw-ghost frame-draw-ghost--node"
            style={{
              left: frameGesture.x,
              top: frameGesture.y,
              width: Math.max(1, frameGesture.width),
              height: Math.max(1, frameGesture.height),
            }}
          />
        )}

        <PrototypeOverlay
          active={
            editorLayer === 'conceptual' && interactionMode === 'prototype'
          }
          screens={screensForOverlays}
          canvasNodes={canvasNodes}
          prototypes={prototypes}
          selectedScreenId={selectedId}
          selectedNodeIds={selectedNodeIds}
          selectedLinkId={selectedPrototypeLinkId}
          worldToClient={clientToWorld}
          onCreateLink={onCreatePrototypeLink}
          onSelectLink={onSelectPrototypeLink}
        />

        <LogicLayerOverlay
          active={editorLayer === 'logic'}
          graphs={logicGraphs}
          screens={screensForOverlays}
          canvasNodes={canvasNodes}
          prototypes={prototypes}
          selectedNodeId={selectedLogicNodeId}
          selectedScreenId={selectedId}
          selectedLinkId={selectedLogicLinkId}
          clientToWorld={clientToWorld}
          onSelectNode={onSelectLogicNode}
          onSelectLink={onSelectLogicLink}
          onMoveNode={onMoveLogicNode}
          onConnect={onConnectLogicNodes}
          onAddNodeAt={onAddLogicNodeAt}
          onInsertOnPrototype={onInsertLogicOnPrototype}
          onClearSelection={onClearLogicSelection}
        />
      </div>
    </div>
  );
}));

export default InfiniteCanvas;
