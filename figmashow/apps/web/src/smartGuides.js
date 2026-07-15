import { flattenLeaves } from '@figmashow/core/schema';

export const SNAP_THRESHOLD = 6;

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ axis: 'x' | 'y', pos: number, source: string }} AlignTarget
 * @typedef {{
 *   axis: 'x' | 'y',
 *   pos: number,
 *   from: number,
 *   to: number,
 *   marks: number[],
 * }} Guide
 */

/**
 * @param {Rect} rect
 * @returns {number[]}
 */
function xEdges(rect) {
  return [rect.x, rect.x + rect.w / 2, rect.x + rect.w];
}

/**
 * @param {Rect} rect
 * @returns {number[]}
 */
function yEdges(rect) {
  return [rect.y, rect.y + rect.h / 2, rect.y + rect.h];
}

/**
 * Targets de alinhamento: frame + outros nós (exceto excludeIds).
 * @param {{ width: number, height: number, nodes: unknown[] }} screen
 * @param {Set<string> | string[]} excludeIds
 * @returns {{ x: AlignTarget[], y: AlignTarget[], otherRects: Rect[] }}
 */
export function collectAlignTargets(screen, excludeIds) {
  const exclude =
    excludeIds instanceof Set ? excludeIds : new Set(excludeIds || []);

  /** @type {AlignTarget[]} */
  const x = [];
  /** @type {AlignTarget[]} */
  const y = [];
  /** @type {Rect[]} */
  const otherRects = [];

  const fw = Number(screen.width) || 390;
  const fh = Number(screen.height) || 844;

  x.push(
    { axis: 'x', pos: 0, source: 'frame' },
    { axis: 'x', pos: fw / 2, source: 'frame' },
    { axis: 'x', pos: fw, source: 'frame' },
  );
  y.push(
    { axis: 'y', pos: 0, source: 'frame' },
    { axis: 'y', pos: fh / 2, source: 'frame' },
    { axis: 'y', pos: fh, source: 'frame' },
  );

  const leaves = flattenLeaves(screen.nodes || []);
  for (const node of leaves) {
    if (exclude.has(node.id)) continue;
    const rect = { x: node.x, y: node.y, w: node.w, h: node.h };
    otherRects.push(rect);
    for (const pos of xEdges(rect)) {
      x.push({ axis: 'x', pos, source: node.id });
    }
    for (const pos of yEdges(rect)) {
      y.push({ axis: 'y', pos, source: node.id });
    }
  }

  return { x, y, otherRects };
}

/**
 * @param {number[]} movingEdges
 * @param {AlignTarget[]} targets
 * @param {number} threshold
 */
function bestSnap(movingEdges, targets, threshold) {
  let bestDelta = 0;
  let bestDist = threshold + 1;
  /** @type {number | null} */
  let bestPos = null;

  for (const edge of movingEdges) {
    for (const t of targets) {
      const dist = Math.abs(edge - t.pos);
      if (dist <= threshold && dist < bestDist) {
        bestDist = dist;
        bestDelta = t.pos - edge;
        bestPos = t.pos;
      }
    }
  }

  return { delta: bestDelta, pos: bestPos };
}

/**
 * @param {number[]} arr
 */
function uniqueSorted(arr) {
  return [...new Set(arr.map((n) => Math.round(n * 100) / 100))].sort(
    (a, b) => a - b,
  );
}

/**
 * @param {'x'|'y'} axis
 * @param {Rect} snapped
 * @param {number} pos
 * @param {{ width: number, height: number }} screen
 * @param {Rect[]} otherRects
 */
function guideSpanForAxis(axis, snapped, pos, screen, otherRects) {
  const eps = 0.51;

  if (axis === 'x') {
    let from = snapped.y;
    let to = snapped.y + snapped.h;
    /** @type {number[]} */
    const marks = [snapped.y + snapped.h / 2];

    if (
      Math.abs(pos - 0) < eps ||
      Math.abs(pos - screen.width / 2) < eps ||
      Math.abs(pos - screen.width) < eps
    ) {
      from = 0;
      to = screen.height;
      marks.push(0, screen.height / 2, screen.height);
    }

    for (const r of otherRects) {
      if (xEdges(r).some((e) => Math.abs(e - pos) < eps)) {
        from = Math.min(from, r.y);
        to = Math.max(to, r.y + r.h);
        marks.push(r.y + r.h / 2);
      }
    }

    return { from, to, marks: uniqueSorted(marks) };
  }

  let from = snapped.x;
  let to = snapped.x + snapped.w;
  /** @type {number[]} */
  const marks = [snapped.x + snapped.w / 2];

  if (
    Math.abs(pos - 0) < eps ||
    Math.abs(pos - screen.height / 2) < eps ||
    Math.abs(pos - screen.height) < eps
  ) {
    from = 0;
    to = screen.width;
    marks.push(0, screen.width / 2, screen.width);
  }

  for (const r of otherRects) {
    if (yEdges(r).some((e) => Math.abs(e - pos) < eps)) {
      from = Math.min(from, r.x);
      to = Math.max(to, r.x + r.w);
      marks.push(r.x + r.w / 2);
    }
  }

  return { from, to, marks: uniqueSorted(marks) };
}

/**
 * Snap + guias durante o arraste.
 * @param {Rect} originRect
 * @param {{ x: AlignTarget[], y: AlignTarget[], otherRects?: Rect[] }} targets
 * @param {number} dx
 * @param {number} dy
 * @param {{ width: number, height: number }} screen
 * @param {number} [threshold]
 */
export function snapDrag(
  originRect,
  targets,
  dx,
  dy,
  screen,
  threshold = SNAP_THRESHOLD,
) {
  const otherRects = targets.otherRects || [];
  const raw = {
    x: originRect.x + dx,
    y: originRect.y + dy,
    w: originRect.w,
    h: originRect.h,
  };

  const snapX = bestSnap(xEdges(raw), targets.x, threshold);
  const snapY = bestSnap(yEdges(raw), targets.y, threshold);

  const nextDx = dx + snapX.delta;
  const nextDy = dy + snapY.delta;

  const snapped = {
    x: originRect.x + nextDx,
    y: originRect.y + nextDy,
    w: originRect.w,
    h: originRect.h,
  };

  /** @type {Guide[]} */
  const guides = [];

  if (snapX.pos != null) {
    const span = guideSpanForAxis('x', snapped, snapX.pos, screen, otherRects);
    guides.push({ axis: 'x', pos: snapX.pos, ...span });
  }
  if (snapY.pos != null) {
    const span = guideSpanForAxis('y', snapped, snapY.pos, screen, otherRects);
    guides.push({ axis: 'y', pos: snapY.pos, ...span });
  }

  return {
    dx: nextDx,
    dy: nextDy,
    guides,
    size: {
      w: Math.round(snapped.w),
      h: Math.round(snapped.h),
      x: snapped.x,
      y: snapped.y,
    },
  };
}

/**
 * Snap + guias durante o resize (borda/canto que está sendo puxada).
 * @param {Rect} box
 * @param {string} handle
 * @param {{ x: AlignTarget[], y: AlignTarget[], otherRects?: Rect[] }} targets
 * @param {{ width: number, height: number }} screen
 * @param {boolean} fromCenter
 * @param {Rect} originBox
 * @param {number} [threshold]
 */
export function snapResize(
  box,
  handle,
  targets,
  screen,
  fromCenter,
  originBox,
  threshold = SNAP_THRESHOLD,
) {
  const otherRects = targets.otherRects || [];
  let { x, y, w, h } = box;
  /** @type {Guide[]} */
  const guides = [];

  const snapH = handle.includes('e') || handle.includes('w');
  const snapV = handle.includes('n') || handle.includes('s');

  if (snapH) {
    const edge = handle.includes('e') ? x + w : x;
    const snap = bestSnap([edge], targets.x, threshold);
    if (snap.pos != null) {
      if (fromCenter) {
        const cx = originBox.x + originBox.w / 2;
        if (handle.includes('e')) {
          w = Math.max(1, 2 * (snap.pos - cx));
        } else {
          w = Math.max(1, 2 * (cx - snap.pos));
        }
        x = cx - w / 2;
      } else if (handle.includes('e')) {
        w = Math.max(1, snap.pos - x);
      } else {
        const right = x + w;
        x = snap.pos;
        w = Math.max(1, right - x);
      }
      const snapped = { x, y, w, h };
      const span = guideSpanForAxis(
        'x',
        snapped,
        snap.pos,
        screen,
        otherRects,
      );
      guides.push({ axis: 'x', pos: snap.pos, ...span });
    }
  }

  if (snapV) {
    const edge = handle.includes('s') ? y + h : y;
    const snap = bestSnap([edge], targets.y, threshold);
    if (snap.pos != null) {
      if (fromCenter) {
        const cy = originBox.y + originBox.h / 2;
        if (handle.includes('s')) {
          h = Math.max(1, 2 * (snap.pos - cy));
        } else {
          h = Math.max(1, 2 * (cy - snap.pos));
        }
        y = cy - h / 2;
      } else if (handle.includes('s')) {
        h = Math.max(1, snap.pos - y);
      } else {
        const bottom = y + h;
        y = snap.pos;
        h = Math.max(1, bottom - y);
      }
      const snapped = { x, y, w, h };
      const span = guideSpanForAxis(
        'y',
        snapped,
        snap.pos,
        screen,
        otherRects,
      );
      guides.push({ axis: 'y', pos: snap.pos, ...span });
    }
  }

  const next = { x, y, w, h };
  return {
    box: next,
    guides,
    size: {
      w: Math.round(next.w),
      h: Math.round(next.h),
      x: next.x,
      y: next.y,
    },
  };
}

/**
 * @param {HTMLElement | null} overlay
 * @param {Guide[]} guides
 * @param {{ w: number, h: number, x: number, y: number } | null} size
 */
export function renderGuidesOverlay(overlay, guides, size) {
  if (!overlay) return;
  overlay.replaceChildren();

  for (const g of guides) {
    const line = document.createElement('div');
    line.className = `smart-guide smart-guide-${g.axis}`;
    if (g.axis === 'x') {
      line.style.left = `${g.pos}px`;
      line.style.top = `${g.from}px`;
      line.style.height = `${Math.max(1, g.to - g.from)}px`;
    } else {
      line.style.top = `${g.pos}px`;
      line.style.left = `${g.from}px`;
      line.style.width = `${Math.max(1, g.to - g.from)}px`;
    }
    overlay.appendChild(line);

    for (const m of g.marks || []) {
      const mark = document.createElement('div');
      mark.className = 'smart-guide-mark';
      if (g.axis === 'x') {
        mark.style.left = `${g.pos}px`;
        mark.style.top = `${m}px`;
      } else {
        mark.style.left = `${m}px`;
        mark.style.top = `${g.pos}px`;
      }
      overlay.appendChild(mark);
    }
  }

  if (size) {
    const label = document.createElement('div');
    label.className = 'size-label';
    label.textContent = `${size.w} × ${size.h}`;
    label.style.left = `${size.x + size.w / 2}px`;
    label.style.top = `${size.y + size.h + 8}px`;
    overlay.appendChild(label);
  }
}

/**
 * @param {HTMLElement | null} overlay
 */
export function clearGuidesOverlay(overlay) {
  if (overlay) overlay.replaceChildren();
}
