import { findNodeById } from './schema.js';

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
export function bezierControls(x1, y1, x2, y2, fromSide = 'right') {
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
  return { x1, y1, c1x, c1y, c2x, c2y, x2, y2 };
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {'top'|'right'|'bottom'|'left'} [fromSide]
 */
export function bezierPath(x1, y1, x2, y2, fromSide = 'right') {
  const c = bezierControls(x1, y1, x2, y2, fromSide);
  return `M ${c.x1} ${c.y1} C ${c.c1x} ${c.c1y}, ${c.c2x} ${c.c2y}, ${c.x2} ${c.y2}`;
}

/**
 * Ponto em curva cúbica (t ∈ [0,1]).
 * @param {{ x1:number,y1:number,c1x:number,c1y:number,c2x:number,c2y:number,x2:number,y2:number }} c
 * @param {number} t
 */
export function sampleCubicBezier(c, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * c.x1 + 3 * uu * t * c.c1x + 3 * u * tt * c.c2x + ttt * c.x2,
    y: uuu * c.y1 + 3 * uu * t * c.c1y + 3 * u * tt * c.c2y + ttt * c.y2,
  };
}

/**
 * Extremidades mundo de um PrototypeLink.
 * @param {import('./schema.js').Screen[]} screens
 * @param {any} link
 */
export function getPrototypeLinkEndpoints(screens, link) {
  const from = (screens || []).find((s) => s.id === link.fromScreenId);
  const to = (screens || []).find((s) => s.id === link.toScreenId);
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
  return { start, end, side, from, to, node };
}

/**
 * Pontos ao longo da noodle para N cards (centros).
 * @param {import('./schema.js').Screen[]} screens
 * @param {any} link
 * @param {number} count
 */
export function samplePointsAlongPrototypeLink(screens, link, count) {
  const ep = getPrototypeLinkEndpoints(screens, link);
  if (!ep || count <= 0) return [];
  const ctrl = bezierControls(
    ep.start.x,
    ep.start.y,
    ep.end.x,
    ep.end.y,
    ep.side,
  );
  const pts = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    pts.push(sampleCubicBezier(ctrl, t));
  }
  return pts;
}
