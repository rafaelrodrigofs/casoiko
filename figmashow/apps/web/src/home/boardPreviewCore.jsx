import { useMemo } from 'react';
import { resolveInstanceTree } from '@figmashow/core/components';
import { getNodeChildren, isContainerNode } from '@figmashow/core/schema';
import { BoardNodeView } from '../boardNodeView.jsx';

const MAX_NODES_PER_SCREEN = 250;

export function flattenPreviewNodes(nodes, components, out = []) {
  for (const node of nodes || []) {
    if (out.length >= MAX_NODES_PER_SCREEN) return out;
    if (node.hidden) continue;
    if (node.type === 'instance') {
      const resolved = resolveInstanceTree(node, components);
      if (resolved) {
        const kids = getNodeChildren(resolved);
        if (kids?.length) flattenPreviewNodes(kids, components, out);
        else if (resolved.type !== 'instance') out.push(resolved);
      }
      continue;
    }
    if (isContainerNode(node)) {
      flattenPreviewNodes(getNodeChildren(node), components, out);
      continue;
    }
    out.push(node);
  }
  return out;
}

/** Ordena telas como no canvas (esquerda → direita, depois Y). */
export function sortScreensForPreview(screens) {
  return [...(screens || [])].sort((a, b) => {
    const ax = Number(a.x) || 0;
    const bx = Number(b.x) || 0;
    if (ax !== bx) return ax - bx;
    return (Number(a.y) || 0) - (Number(b.y) || 0);
  });
}

/**
 * Layout estilo Figma: cada artboard ocupa um slot com escala própria.
 * @param {import('@figmashow/core/schema').Screen[]} screens
 * @param {number} width
 * @param {number} height
 * @param {number} [maxScreens]
 */
export function layoutPreviewScreens(screens, width, height, maxScreens = 8) {
  const list = sortScreensForPreview(screens).slice(0, maxScreens);
  if (!list.length) return [];

  const pad = 10;
  const gap = 6;
  const availW = Math.max(1, width - pad * 2);
  const availH = Math.max(1, height - pad * 2);

  const slots = list.map((screen) => {
    const sw = Number(screen.width) || 390;
    const sh = Number(screen.height) || 844;
    const scale = availH / sh;
    return { screen, scale, slotW: sw * scale, slotH: sh * scale };
  });

  let totalW =
    slots.reduce((acc, s) => acc + s.slotW, 0) + gap * Math.max(0, slots.length - 1);
  let shrink = totalW > availW ? availW / totalW : 1;

  let x = pad + Math.max(0, (availW - totalW * shrink) / 2);
  return slots.map(({ screen, scale, slotW, slotH }) => {
    const s = scale * shrink;
    const w = slotW * shrink;
    const h = slotH * shrink;
    const top = pad + (availH - h) / 2;
    const layout = {
      screen,
      scale: s,
      left: x,
      top,
      width: w,
      height: h,
    };
    x += w + gap * shrink;
    return layout;
  });
}

function PreviewScreenSlot({ slot, components }) {
  const { screen, scale, left, top, width, height } = slot;
  const nodes = useMemo(
    () => flattenPreviewNodes(screen.nodes, components),
    [screen.nodes, components],
  );

  return (
    <div
      className="board-mini-screen"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        background: screen.background || '#fff',
        borderRadius: Math.max(2, 3 * scale),
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
      }}
    >
      {nodes.map((node) => (
        <BoardNodeView key={node.id} node={node} scale={scale} />
      ))}
    </div>
  );
}

/**
 * Canvas de preview (compartilhado entre home e captura PNG).
 */
export default function BoardPreviewCanvas({
  board,
  width,
  height,
  maxScreens = 8,
  className = '',
}) {
  const slots = useMemo(
    () => layoutPreviewScreens(board?.screens || [], width, height, maxScreens),
    [board?.screens, width, height, maxScreens],
  );
  const components = board?.components || [];

  if (!slots.length) {
    return (
      <div
        className={`board-mini-preview board-mini-preview--empty ${className}`.trim()}
        style={{ width, height }}
      />
    );
  }

  return (
    <div
      className={`board-mini-preview ${className}`.trim()}
      style={{ width, height, background: '#ececec' }}
    >
      <div className="board-mini-canvas" style={{ width, height, position: 'relative' }}>
        {slots.map((slot) => (
          <PreviewScreenSlot
            key={slot.screen.id}
            slot={slot}
            components={components}
          />
        ))}
      </div>
    </div>
  );
}
