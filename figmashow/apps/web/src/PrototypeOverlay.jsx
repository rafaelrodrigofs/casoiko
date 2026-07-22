import { useCallback, useEffect, useRef, useState } from 'react';
import { findNodeById } from '@figmashow/core/schema';

const SIDES = ['top', 'right', 'bottom', 'left'];

/**
 * @param {{ x: number, y: number, w: number, h: number }} box
 * @param {'top'|'right'|'bottom'|'left'} side
 */
export function edgePoint(box, side) {
  const midX = box.x + box.w / 2;
  const midY = box.y + box.h / 2;
  switch (side) {
    case 'top':
      return { x: midX, y: box.y };
    case 'bottom':
      return { x: midX, y: box.y + box.h };
    case 'left':
      return { x: box.x, y: midY };
    case 'right':
    default:
      return { x: box.x + box.w, y: midY };
  }
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {'top'|'right'|'bottom'|'left'} [fromSide]
 */
export function bezierPath(x1, y1, x2, y2, fromSide = 'right') {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const dist = Math.max(40, Math.min(180, (dx + dy) * 0.35));
  let c1x = x1;
  let c1y = y1;
  let c2x = x2;
  let c2y = y2;
  if (fromSide === 'right') {
    c1x = x1 + dist;
    c2x = x2 - dist;
  } else if (fromSide === 'left') {
    c1x = x1 - dist;
    c2x = x2 + dist;
  } else if (fromSide === 'top') {
    c1y = y1 - dist;
    c2y = y2 + dist;
  } else {
    c1y = y1 + dist;
    c2y = y2 - dist;
  }
  return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`;
}

/**
 * @param {import('@figmashow/core/schema').Screen[]} screens
 * @param {number} wx
 * @param {number} wy
 * @param {string} [excludeId]
 */
function hitScreen(screens, wx, wy, excludeId) {
  for (let i = screens.length - 1; i >= 0; i -= 1) {
    const s = screens[i];
    if (s.id === excludeId) continue;
    const x = s.x ?? 0;
    const y = s.y ?? 0;
    if (wx >= x && wx <= x + s.width && wy >= y && wy <= y + s.height) {
      return s;
    }
  }
  return null;
}

/**
 * Overlay de handles + noodles no modo Protótipo (coords de mundo do canvas).
 */
export default function PrototypeOverlay({
  screens = [],
  prototypes = [],
  selectedScreenId,
  selectedNodeIds = [],
  selectedLinkId = null,
  active = false,
  onCreateLink,
  onSelectLink,
  worldToClient,
}) {
  const [drag, setDrag] = useState(null);
  const [hoverTargetId, setHoverTargetId] = useState(null);
  const dragRef = useRef(null);
  const screensRef = useRef(screens);

  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  const selectedNodeId =
    selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const originScreen = screens.find((s) => s.id === selectedScreenId);
  const selectedNode =
    originScreen && selectedNodeId
      ? findNodeById(originScreen.nodes, selectedNodeId)
      : null;

  const nodeWorldBox =
    originScreen && selectedNode
      ? {
          x: (originScreen.x ?? 0) + (selectedNode.x || 0),
          y: (originScreen.y ?? 0) + (selectedNode.y || 0),
          w: selectedNode.w || 0,
          h: selectedNode.h || 0,
        }
      : null;

  const endDrag = useCallback(
    (clientX, clientY, cancelled) => {
      const d = dragRef.current;
      setDrag(null);
      setHoverTargetId(null);
      if (!d || cancelled) return;
      const world = d.worldFromClient?.(clientX, clientY);
      if (!world) return;
      const target = hitScreen(
        screensRef.current,
        world.x,
        world.y,
        d.fromScreenId,
      );
      if (!target) return;
      onCreateLink?.({
        fromScreenId: d.fromScreenId,
        triggerNodeId: d.triggerNodeId,
        toScreenId: target.id,
        fromSide: d.fromSide,
        transition: 'instant',
      });
    },
    [onCreateLink],
  );

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => {
      const world = drag.worldFromClient?.(e.clientX, e.clientY);
      if (!world) return;
      setDrag((prev) =>
        prev
          ? { ...prev, cursorX: world.x, cursorY: world.y }
          : prev,
      );
      const target = hitScreen(
        screensRef.current,
        world.x,
        world.y,
        drag.fromScreenId,
      );
      setHoverTargetId(target?.id || null);
    };
    const onUp = (e) => endDrag(e.clientX, e.clientY, false);
    const onKey = (e) => {
      if (e.key === 'Escape') endDrag(0, 0, true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [drag, endDrag]);

  if (!active) return null;

  const noodles = (prototypes || [])
    .map((link) => {
      const from = screens.find((s) => s.id === link.fromScreenId);
      const to = screens.find((s) => s.id === link.toScreenId);
      if (!from || !to) return null;
      const node = findNodeById(from.nodes, link.triggerNodeId);
      if (!node || node.hidden) return null;
      const box = {
        x: (from.x ?? 0) + (node.x || 0),
        y: (from.y ?? 0) + (node.y || 0),
        w: node.w || 0,
        h: node.h || 0,
      };
      const side = link.fromSide || 'right';
      const start = edgePoint(box, side);
      const end = {
        x: to.x ?? 0,
        y: (to.y ?? 0) + to.height / 2,
      };
      return { link, start, end, side };
    })
    .filter(Boolean);

  const startHandleDrag = (side, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!originScreen || !selectedNode || !nodeWorldBox) return;
    const start = edgePoint(nodeWorldBox, side);
    const worldFromClient = (clientX, clientY) => {
      if (typeof worldToClient === 'function') {
        return worldToClient(clientX, clientY);
      }
      return null;
    };
    const world = worldFromClient(e.clientX, e.clientY) || start;
    setDrag({
      fromScreenId: originScreen.id,
      triggerNodeId: selectedNode.id,
      fromSide: side,
      startX: start.x,
      startY: start.y,
      cursorX: world.x,
      cursorY: world.y,
      worldFromClient,
    });
  };

  return (
    <div className="prototype-overlay" aria-hidden={!active}>
      {hoverTargetId && (
        <div
          className="prototype-drop-highlight"
          style={(() => {
            const s = screens.find((sc) => sc.id === hoverTargetId);
            if (!s) return { display: 'none' };
            return {
              left: s.x ?? 0,
              top: s.y ?? 0,
              width: s.width,
              height: s.height,
            };
          })()}
        />
      )}

      <svg className="prototype-noodles" overflow="visible">
        <defs>
          <marker
            id="proto-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="#0d99ff" />
          </marker>
        </defs>
        {noodles.map(({ link, start, end, side }) => {
          const selected = link.id === selectedLinkId;
          return (
            <g key={link.id} className={selected ? 'is-selected' : undefined}>
              <path
                className="prototype-noodle-hit"
                d={bezierPath(start.x, start.y, end.x, end.y, side)}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectLink?.(link.id, {
                    x: e.clientX + 12,
                    y: e.clientY + 12,
                  });
                }}
              />
              <path
                className={`prototype-noodle${selected ? ' selected' : ''}`}
                d={bezierPath(start.x, start.y, end.x, end.y, side)}
                fill="none"
                markerEnd="url(#proto-arrow)"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectLink?.(link.id, {
                    x: e.clientX + 12,
                    y: e.clientY + 12,
                  });
                }}
              />
            </g>
          );
        })}
        {drag && (
          <path
            className="prototype-noodle prototype-noodle--draft"
            d={bezierPath(
              drag.startX,
              drag.startY,
              drag.cursorX,
              drag.cursorY,
              drag.fromSide,
            )}
            fill="none"
            markerEnd="url(#proto-arrow)"
          />
        )}
      </svg>

      {nodeWorldBox &&
        SIDES.map((side) => {
          const p = edgePoint(nodeWorldBox, side);
          return (
            <button
              key={side}
              type="button"
              className={`prototype-edge-handle prototype-edge-${side}`}
              style={{ left: p.x, top: p.y }}
              title={`Ligar pelo lado ${side}`}
              aria-label={`Criar link pelo lado ${side}`}
              onPointerDown={(e) => startHandleDrag(side, e)}
            >
              +
            </button>
          );
        })}
    </div>
  );
}
