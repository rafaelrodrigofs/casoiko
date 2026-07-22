/**
 * Auto-layout mínimo (stack vertical/horizontal) para filhos de um group.
 * Usado por MCP/UI; não muda o schema além de x/y/w/h.
 */

/**
 * @param {import('./schema.js').BoardNode[]} children
 * @param {{
 *   direction?: 'vertical' | 'horizontal',
 *   gap?: number,
 *   padding?: number,
 *   align?: 'start' | 'center' | 'end',
 * }} [opts]
 * @returns {{ children: import('./schema.js').BoardNode[], bounds: { x: number, y: number, w: number, h: number } }}
 */
export function applyAutoLayout(children, opts = {}) {
  const direction = opts.direction === 'horizontal' ? 'horizontal' : 'vertical';
  const gap = Number(opts.gap) || 8;
  const padding = Number(opts.padding) || 0;
  const align = opts.align || 'start';
  const list = Array.isArray(children) ? children.map((c) => ({ ...c })) : [];

  let cursor = padding;
  let maxCross = 0;

  for (const child of list) {
    const w = Number(child.w) || 0;
    const h = Number(child.h) || 0;
    if (direction === 'vertical') {
      child.x = padding;
      child.y = cursor;
      cursor += h + gap;
      maxCross = Math.max(maxCross, w);
    } else {
      child.x = cursor;
      child.y = padding;
      cursor += w + gap;
      maxCross = Math.max(maxCross, h);
    }
  }

  if (align !== 'start') {
    for (const child of list) {
      const w = Number(child.w) || 0;
      const h = Number(child.h) || 0;
      if (direction === 'vertical') {
        const space = maxCross - w;
        if (align === 'center') child.x = padding + space / 2;
        if (align === 'end') child.x = padding + space;
      } else {
        const space = maxCross - h;
        if (align === 'center') child.y = padding + space / 2;
        if (align === 'end') child.y = padding + space;
      }
    }
  }

  const mainSize = Math.max(0, cursor - gap) + padding;
  const bounds =
    direction === 'vertical'
      ? { x: 0, y: 0, w: maxCross + padding * 2, h: mainSize }
      : { x: 0, y: 0, w: mainSize, h: maxCross + padding * 2 };

  return { children: list, bounds };
}
