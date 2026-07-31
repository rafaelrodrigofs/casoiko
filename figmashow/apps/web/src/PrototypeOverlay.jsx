import { useCallback, useEffect, useRef, useState } from 'react';
import { CANVAS_SCOPE, findNodeById } from '@figmashow/core/schema';
import {
  edgePoint,
  bezierControls,
  bezierPath,
  sampleCubicBezier,
  getPrototypeLinkEndpoints,
  samplePointsAlongPrototypeLink,
} from '@figmashow/core/domain';

export {
  edgePoint,
  bezierControls,
  bezierPath,
  sampleCubicBezier,
  getPrototypeLinkEndpoints,
  samplePointsAlongPrototypeLink,
};

const SIDES = ['top', 'right', 'bottom', 'left'];

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
 * Hit em grupo/nó raiz do canvas (modais). Prefere o menor (mais específico).
 * @param {import('@figmashow/core/schema').BoardNode[]} canvasNodes
 * @param {number} wx
 * @param {number} wy
 */
function hitCanvasNode(canvasNodes, wx, wy) {
  let best = null;
  let bestArea = Infinity;
  for (const n of canvasNodes || []) {
    if (n.hidden) continue;
    const x = n.x || 0;
    const y = n.y || 0;
    const w = n.w || 0;
    const h = n.h || 0;
    if (wx >= x && wx <= x + w && wy >= y && wy <= y + h) {
      const area = Math.max(1, w * h);
      if (area < bestArea) {
        bestArea = area;
        best = n;
      }
    }
  }
  return best;
}

/**
 * Overlay de handles + noodles no modo Protótipo (coords de mundo do canvas).
 */
export default function PrototypeOverlay({
  screens = [],
  canvasNodes = [],
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
  const [hoverTarget, setHoverTarget] = useState(null);
  const dragRef = useRef(null);
  const screensRef = useRef(screens);
  const canvasRef = useRef(canvasNodes);

  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);

  useEffect(() => {
    canvasRef.current = canvasNodes;
  }, [canvasNodes]);

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

  const resolveDrop = useCallback((wx, wy, fromScreenId) => {
    const canvasHit = hitCanvasNode(canvasRef.current, wx, wy);
    if (canvasHit) {
      return {
        kind: 'canvas',
        toScreenId: CANVAS_SCOPE,
        toNodeId: canvasHit.id,
        highlight: {
          x: canvasHit.x || 0,
          y: canvasHit.y || 0,
          w: canvasHit.w || 0,
          h: canvasHit.h || 0,
        },
      };
    }
    const screenHit = hitScreen(screensRef.current, wx, wy, fromScreenId);
    if (screenHit) {
      return {
        kind: 'screen',
        toScreenId: screenHit.id,
        highlight: {
          x: screenHit.x ?? 0,
          y: screenHit.y ?? 0,
          w: screenHit.width,
          h: screenHit.height,
        },
      };
    }
    return null;
  }, []);

  const endDrag = useCallback(
    (clientX, clientY, cancelled) => {
      const d = dragRef.current;
      setDrag(null);
      setHoverTarget(null);
      if (!d || cancelled) return;
      const world = d.worldFromClient?.(clientX, clientY);
      if (!world) return;
      const target = resolveDrop(world.x, world.y, d.fromScreenId);
      if (!target) return;
      onCreateLink?.({
        fromScreenId: d.fromScreenId,
        triggerNodeId: d.triggerNodeId,
        toScreenId: target.toScreenId,
        ...(target.toNodeId ? { toNodeId: target.toNodeId } : {}),
        fromSide: d.fromSide,
        transition: 'instant',
      });
    },
    [onCreateLink, resolveDrop],
  );

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (e) => {
      const world = drag.worldFromClient?.(e.clientX, e.clientY);
      if (!world) return;
      setDrag((prev) =>
        prev ? { ...prev, cursorX: world.x, cursorY: world.y } : prev,
      );
      const target = resolveDrop(world.x, world.y, drag.fromScreenId);
      setHoverTarget(target);
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
  }, [drag, endDrag, resolveDrop]);

  if (!active) return null;

  const noodles = (prototypes || [])
    .map((link) => {
      const ep = getPrototypeLinkEndpoints(screens, link, canvasNodes);
      if (!ep) return null;
      return { link, start: ep.start, end: ep.end, side: ep.side, toSide: ep.toSide || 'left' };
    })
    .filter(Boolean);

  const startHandleDrag = (side, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!originScreen || !selectedNode || !nodeWorldBox) return;
    const start = edgePoint(nodeWorldBox, side);
    const worldFromClient = (clientX, clientY) =>
      typeof worldToClient === 'function'
        ? worldToClient(clientX, clientY)
        : null;
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
      {hoverTarget?.highlight && (
        <div
          className="prototype-drop-highlight"
          style={{
            left: hoverTarget.highlight.x,
            top: hoverTarget.highlight.y,
            width: hoverTarget.highlight.w,
            height: hoverTarget.highlight.h,
          }}
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
        {noodles.map(({ link, start, end, side, toSide }) => {
          const selected = link.id === selectedLinkId;
          const d = bezierPath(start.x, start.y, end.x, end.y, side, toSide);
          return (
            <g key={link.id} className={selected ? 'is-selected' : undefined}>
              <path
                className="prototype-noodle-hit"
                d={d}
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
                d={d}
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
