import { useEffect, useRef, useState } from 'react';
import {
  collectLeafIds,
  cryptoRandomId,
  findNodeById,
  flattenLeaves,
  flattenVisibleLeaves,
  getNodeChildren,
  isContainerNode,
  normalizeConstraints,
  normalizeRotation,
} from '@figmashow/core/schema';
import { localTreeAabb } from '@figmashow/core/components';
import {
  clearGuidesOverlay,
  collectAlignTargets,
  renderGuidesOverlay,
  snapDrag,
  snapResize,
} from './smartGuides.js';

const DRAG_THRESHOLD = 3;
const ROTATE_SNAP = 15;

function nodeRotation(node) {
  return Number(node?.rotation) || 0;
}

function rotationStyle(deg) {
  const r = Number(deg) || 0;
  if (!r) return { transformOrigin: '50% 50%' };
  return {
    transform: `rotate(${r}deg)`,
    transformOrigin: '50% 50%',
  };
}

function colorWithOpacity(color, opacity = 1) {
  const raw = String(color || '').trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  const numericAlpha = Number(opacity);
  const alpha = Number.isFinite(numericAlpha)
    ? Math.min(1, Math.max(0, numericAlpha))
    : 1;
  if (!match || alpha >= 1) return raw;
  const hex =
    match[1].length === 3
      ? [...match[1]].map((digit) => `${digit}${digit}`).join('')
      : match[1];
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function nodeBorder(node) {
  const width = Number(node?.strokeWidth);
  if (!node?.stroke || !Number.isFinite(width) || width <= 0) return undefined;
  return `${width}px solid ${colorWithOpacity(
    node.stroke,
    node.strokeOpacity ?? 1,
  )}`;
}

/** Converte delta de tela → eixos locais do nó (inverso da rotação). */
function rotateDelta(dx, dy, deg) {
  const rad = ((-(Number(deg) || 0)) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { dx: dx * c - dy * s, dy: dx * s + dy * c };
}

function angleDeg(cx, cy, x, y) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

function snapAngle(deg, step = ROTATE_SNAP) {
  return Math.round(deg / step) * step;
}

function maxCornerRadius(w, h) {
  return Math.max(0, Math.min(Number(w) || 0, Number(h) || 0) / 2);
}

/** Ponto do mundo (tela do phone) → espaço local do AABB (desfaz rotation). */
function worldToLocalBox(box, rotation, wx, wy) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const local = rotateDelta(wx - cx, wy - cy, rotation);
  return { x: cx + local.dx, y: cy + local.dy };
}

/** Raio a partir da posição do ponteiro em relação a um canto. */
function radiusFromPointer(corner, box, px, py) {
  const maxR = maxCornerRadius(box.w, box.h);
  const inwardX = corner.includes('w')
    ? px - box.x
    : box.x + box.w - px;
  const inwardY = corner.includes('n')
    ? py - box.y
    : box.y + box.h - py;
  return Math.max(0, Math.min(maxR, Math.min(inwardX, inwardY)));
}

/** Posições left/top das 4 bolinhas de radius (espaço local do box). */
function radiusHandleInset(r, w, h, zoom = 1) {
  const maxR = maxCornerRadius(w, h);
  const rClamped = Math.min(Math.max(0, Number(r) || 0), maxR);
  const screenMin = 14 / Math.max(0.0001, zoom);
  // Espelha clamp(r, 14px/zoom, maxR) do CSS
  return Math.min(maxR, Math.max(rClamped, screenMin));
}

function applyRadiusHandlePositions(handleEls, box, r, zoom = 1) {
  if (!handleEls?.length) return;
  const inset = radiusHandleInset(r, box.w, box.h, zoom);
  const pos = {
    nw: { left: inset, top: inset },
    ne: { left: box.w - inset, top: inset },
    se: { left: box.w - inset, top: box.h - inset },
    sw: { left: inset, top: box.h - inset },
  };
  for (const el of handleEls) {
    const m = /radius-(nw|ne|se|sw)/.exec(el.className);
    const corner = m?.[1];
    if (!corner || !pos[corner]) continue;
    el.style.left = `${pos[corner].left}px`;
    el.style.top = `${pos[corner].top}px`;
  }
}

/**
 * Linhas de orientação de constraints (estilo Figma).
 * Só para nós raiz da tela.
 */
function ConstraintGuides({ node, screenW, screenH }) {
  if (!node) return null;
  const c = normalizeConstraints(node.constraints);
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  /** @type {{ key: string, className: string, style: Record<string, number> }[]} */
  const lines = [];

  if (c.left) {
    lines.push({
      key: 'left',
      className: 'constraint-guide constraint-guide-h',
      style: {
        left: 0,
        top: cy,
        width: Math.max(0, node.x),
      },
    });
  }
  if (c.right) {
    lines.push({
      key: 'right',
      className: 'constraint-guide constraint-guide-h',
      style: {
        left: node.x + node.w,
        top: cy,
        width: Math.max(0, screenW - (node.x + node.w)),
      },
    });
  }
  if (c.top) {
    lines.push({
      key: 'top',
      className: 'constraint-guide constraint-guide-v',
      style: {
        left: cx,
        top: 0,
        height: Math.max(0, node.y),
      },
    });
  }
  if (c.bottom) {
    lines.push({
      key: 'bottom',
      className: 'constraint-guide constraint-guide-v',
      style: {
        left: cx,
        top: node.y + node.h,
        height: Math.max(0, screenH - (node.y + node.h)),
      },
    });
  }

  const showCenterCross = (c.left && c.right) || (c.top && c.bottom);

  return (
    <div className="constraint-guides" aria-hidden="true">
      {lines.map((line) => (
        <div
          key={line.key}
          className={line.className}
          style={{
            left: line.style.left,
            top: line.style.top,
            width: line.style.width,
            height: line.style.height,
          }}
        />
      ))}
      {showCenterCross ? (
        <div
          className="constraint-guide-center"
          style={{ left: cx, top: cy }}
        />
      ) : null}
    </div>
  );
}

function ResolvedVisual({ node, components }) {
  if (node.type === 'group') {
    return (node.children || []).map((child) => (
      <ResolvedVisual key={child.id} node={child} components={components} />
    ));
  }
  return (
    <NodeView
      node={{ ...node, id: `vis-${node.id}` }}
      onPointerDownNode={() => {}}
      onHover={() => {}}
    />
  );
}

function InstanceView({
  instance,
  components,
  onPointerDownNode,
  onHover,
  onDoubleClickNode,
}) {
  const def = (components || []).find((c) => c.id === instance.componentId);
  const variant =
    def?.variants?.find((v) => v.id === instance.variantId) ||
    def?.variants?.[0];
  const root = variant?.root;
  const aabb = root
    ? localTreeAabb(root)
    : { x: 0, y: 0, w: instance.w, h: instance.h };

  const scaleX = aabb.w > 0 ? instance.w / aabb.w : 1;
  const scaleY = aabb.h > 0 ? instance.h / aabb.h : 1;
  const needsScale =
    Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

  const style = {
    left: instance.x,
    top: instance.y,
    width: instance.w,
    height: instance.h,
    opacity: instance.opacity ?? 1,
    ...rotationStyle(instance.rotation),
  };

  return (
    <div
      data-node-id={instance.id}
      className={`node node-instance${instance.locked ? ' node-locked' : ''}`}
      style={style}
      onPointerDown={(e) => onPointerDownNode?.(e, instance)}
      onPointerEnter={(e) => onHover?.(instance.id, e)}
      onPointerLeave={() => onHover?.(null)}
      onDoubleClick={(e) => onDoubleClickNode?.(e, instance)}
    >
      <div
        className="instance-visual"
        style={{
          pointerEvents: 'none',
          left: -aabb.x * scaleX,
          top: -aabb.y * scaleY,
          transform: needsScale ? `scale(${scaleX}, ${scaleY})` : undefined,
          transformOrigin: '0 0',
        }}
      >
        {root ? (
          <ResolvedVisual node={root} components={components} />
        ) : (
          <div
            className="node"
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              background: '#F1F5F9',
            }}
          />
        )}
      </div>
    </div>
  );
}

function renderScreenNodes(
  nodes,
  components,
  handlers,
) {
  const items = [];
  for (const node of nodes || []) {
    if (node.hidden) continue;
    if (isContainerNode(node)) {
      items.push(
        ...renderScreenNodes(getNodeChildren(node) || [], components, handlers),
      );
    } else if (node.type === 'instance') {
      items.push(
        <InstanceView
          key={node.id}
          instance={node}
          components={components}
          {...handlers}
        />,
      );
    } else {
      items.push(
        <NodeView key={node.id} node={node} {...handlers} />,
      );
    }
  }
  return items;
}

function NodeView({ node, onPointerDownNode, onHover, onDoubleClickNode }) {
  const style = {
    left: node.x,
    top: node.y,
    width: node.w,
    height: node.h,
    opacity: node.opacity ?? 1,
    ...rotationStyle(node.rotation),
  };

  const className = `node${
    node.type === 'text' ? ' node-text' : ''
  }${node.type === 'button' ? ' node-button' : ''}${
    node.locked ? ' node-locked' : ''
  }`;

  const handlers = {
    onPointerDown: (e) => onPointerDownNode?.(e, node),
    onPointerEnter: (e) => onHover?.(node.id, e),
    onPointerLeave: () => onHover?.(null),
    onDoubleClick: (e) => onDoubleClickNode?.(e, node),
  };

  if (node.type === 'text') {
    return (
      <div
        data-node-id={node.id}
        className={`${className}${node.icon ? ' node-icon' : ''}`}
        style={{
          ...style,
          color: node.color,
          fontSize: node.fontSize,
          fontWeight: node.icon ? 400 : node.fontWeight,
          textAlign: node.align || 'left',
          lineHeight: node.icon ? 1 : 1.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent:
            node.align === 'center'
              ? 'center'
              : node.align === 'right'
                ? 'flex-end'
                : 'flex-start',
        }}
        {...handlers}
      >
        {node.text}
      </div>
    );
  }

  if (node.type === 'button') {
    return (
      <div
        data-node-id={node.id}
        className={className}
        style={{
          ...style,
          background: colorWithOpacity(node.fill, node.fillOpacity ?? 1),
          color: node.textColor,
          borderRadius: node.cornerRadius,
          fontSize: node.fontSize,
          fontWeight: node.fontWeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxSizing: 'border-box',
          border: nodeBorder(node),
        }}
        {...handlers}
      >
        {node.iconSrc ? (
          <img
            className="node-button-icon"
            src={node.iconSrc}
            alt=""
            draggable={false}
          />
        ) : null}
        <span>{node.label}</span>
      </div>
    );
  }

  if (node.type === 'image') {
    const objectFit = node.fit || 'contain';
    return (
      <div
        data-node-id={node.id}
        className={`${className} node-image`}
        style={style}
        {...handlers}
      >
        <img
          src={node.src}
          alt={node.name || ''}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit,
            display: 'block',
            pointerEvents: 'none',
          }}
        />
      </div>
    );
  }

  const radius =
    node.bottomRadius != null
      ? `0 0 ${node.bottomRadius}px ${node.bottomRadius}px`
      : node.cornerRadius || 0;

  return (
    <div
      data-node-id={node.id}
      className={className}
      style={{
        ...style,
        background: colorWithOpacity(node.fill, node.fillOpacity ?? 1),
        borderRadius: radius,
        boxSizing: 'border-box',
        border: nodeBorder(node),
      }}
      {...handlers}
    />
  );
}

/** Caminho [raiz…alvo] até o nó, ou []. */
function findNodePath(nodes, id, trail = []) {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === id) return next;
    const kids = getNodeChildren(node);
    if (kids) {
      const found = findNodePath(kids, id, next);
      if (found.length) return found;
    }
  }
  return [];
}

/**
 * Sem Ctrl: se o clique cai dentro da seleção atual, mantém ela;
 * senão pega o grupo/componente externo. Com Ctrl/Cmd: nó profundo (folha).
 * @param {string[]} selectedIds
 */
function resolvePickTarget(screenNodes, leafId, deepSelect, selectedIds) {
  const path = findNodePath(screenNodes, leafId);
  if (!path.length) return null;
  const leaf = path[path.length - 1];
  const selectedSet = new Set(selectedIds || []);

  if (deepSelect) return leaf;

  // Preferência pelo nó selecionado mais profundo no caminho
  const selectedOnPath = [...path]
    .reverse()
    .find((n) => selectedSet.has(n.id));
  if (selectedOnPath) return selectedOnPath;

  const outerContainer = path.find((n) => isContainerNode(n));
  return outerContainer || leaf;
}

/** IDs selecionados que não são descendentes de outro selecionado. */
function topLevelSelectedIds(screenNodes, selectedIds) {
  return (selectedIds || []).filter((id) => {
    const path = findNodePath(screenNodes, id);
    if (!path.length) return false;
    return !path.slice(0, -1).some((n) => selectedIds.includes(n.id));
  });
}

function boundsOfNodes(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

function Outline({ node, kind }) {
  if (!node) return null;
  const isMain = node.type === 'component';
  const cls =
    kind === 'selected'
      ? isMain
        ? 'group-outline group-outline--component'
        : 'group-outline'
      : kind === 'ancestor'
        ? 'node-hover-ancestor'
        : kind === 'sibling'
          ? 'node-hover-sibling'
          : 'node-hover-outline';
  const radius = Number(node.cornerRadius) || 0;
  return (
    <div
      className={cls}
      data-outline-id={node.id}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        borderRadius: radius,
        ...rotationStyle(node.rotation),
      }}
    />
  );
}

/**
 * Hover estilo Figma.
 * - Sem deep: grupo externo sólido + filhos tracejados
 * - Com deep: folha sob o mouse (+ ancestrais)
 */
function hoverOutlineNodes(
  screenNodes,
  hoveredLeafId,
  selectedIds,
  deepSelect,
) {
  if (!hoveredLeafId) {
    return { ancestors: [], siblings: [], target: null };
  }

  const selectedSet = new Set(selectedIds || []);
  const pick = resolvePickTarget(
    screenNodes,
    hoveredLeafId,
    deepSelect,
    selectedIds,
  );
  if (!pick || selectedSet.has(pick.id)) {
    return { ancestors: [], siblings: [], target: null };
  }

  if (!deepSelect && isContainerNode(pick)) {
    return {
      ancestors: [],
      siblings: (getNodeChildren(pick) || []).filter(
        (c) => !selectedSet.has(c.id),
      ),
      target: pick,
    };
  }

  const path = findNodePath(screenNodes, hoveredLeafId);
  if (!path.length) {
    return { ancestors: [], siblings: [], target: null };
  }
  const target = path[path.length - 1];
  return {
    ancestors: path.slice(0, -1).filter((n) => !selectedSet.has(n.id)),
    siblings: [],
    target: selectedSet.has(target.id) ? null : target,
  };
}

function gatherMoveOrigins(rootNode, selectedNode) {
  /** @type {Map<string, { x: number, y: number }>} */
  const origins = new Map();
  const leafIds = collectLeafIds(rootNode);
  const all = [
    rootNode,
    ...(isContainerNode(rootNode)
      ? flattenLeaves(getNodeChildren(rootNode) || [])
      : []),
  ];
  if (selectedNode) {
    const exists = all.some((n) => n.id === selectedNode.id);
    if (!exists) all.push(selectedNode);
  }
  for (const n of all) {
    origins.set(n.id, { x: n.x, y: n.y });
  }
  return { origins, leafIds };
}

function mergeMoveOrigins(entries) {
  /** @type {Map<string, { x: number, y: number }>} */
  const origins = new Map();
  /** @type {string[]} */
  const leafIds = [];
  for (const entry of entries) {
    for (const [id, origin] of entry.origins) {
      origins.set(id, origin);
    }
    leafIds.push(...entry.leafIds);
  }
  return { origins, leafIds: [...new Set(leafIds)] };
}

/** Cache de elementos no início do drag — evita querySelectorAll a cada pointermove. */
function cacheMoveDom(phoneEl, origins) {
  /** @type {Map<string, { nodes: HTMLElement[], outlines: HTMLElement[], origin: { x: number, y: number } }>} */
  const cache = new Map();
  if (!phoneEl) return cache;
  for (const [id, origin] of origins) {
    cache.set(id, {
      origin,
      nodes: [
        ...phoneEl.querySelectorAll(`[data-node-id="${CSS.escape(id)}"]`),
      ],
      outlines: [
        ...phoneEl.querySelectorAll(`[data-outline-id="${CSS.escape(id)}"]`),
      ],
    });
  }
  return cache;
}

function applyDomOffset(domCache, dx, dy, resizeHandles, selectionRect) {
  for (const entry of domCache.values()) {
    const x = entry.origin.x + dx;
    const y = entry.origin.y + dy;
    for (const el of entry.nodes) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    for (const el of entry.outlines) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }
  if (resizeHandles && selectionRect) {
    for (const el of resizeHandles) {
      el.style.left = `${selectionRect.x + dx}px`;
      el.style.top = `${selectionRect.y + dy}px`;
    }
  }
}

function clearAltProxies(drag) {
  for (const proxy of drag?.altProxyEls || []) proxy.el.remove();
  if (drag) drag.altProxyEls = [];
}

/**
 * Alt+drag estilo Figma:
 * - nós reais ficam pinados na origem
 * - proxies se movem com o cursor (+ chrome de seleção)
 */
function ensureAltProxies(phoneEl, drag) {
  if (!phoneEl || !drag || drag.altProxyEls?.length) return;
  /** @type {{ el: HTMLElement, origin: { x: number, y: number } }[]} */
  const proxies = [];
  for (const entry of drag.domCache?.values?.() || []) {
    for (const source of entry.nodes) {
      const clone = source.cloneNode(true);
      clone.removeAttribute('data-node-id');
      clone.classList.add('alt-drag-proxy');
      clone.style.pointerEvents = 'none';
      clone.setAttribute('aria-hidden', 'true');
      phoneEl.appendChild(clone);
      proxies.push({ el: clone, origin: entry.origin });
    }
  }
  drag.altProxyEls = proxies;
}

function applyAltMoveVisuals(drag, dx, dy) {
  if (!drag?.domCache) return;
  // Originals fixos na origem
  for (const entry of drag.domCache.values()) {
    for (const el of entry.nodes) {
      el.style.left = `${entry.origin.x}px`;
      el.style.top = `${entry.origin.y}px`;
    }
    // Outline acompanha o clone (o que está sendo arrastado)
    for (const el of entry.outlines) {
      el.style.left = `${entry.origin.x + dx}px`;
      el.style.top = `${entry.origin.y + dy}px`;
    }
  }
  for (const proxy of drag.altProxyEls || []) {
    proxy.el.style.left = `${proxy.origin.x + dx}px`;
    proxy.el.style.top = `${proxy.origin.y + dy}px`;
  }
  if (drag.resizeHandleEls && drag.originRect) {
    for (const el of drag.resizeHandleEls) {
      el.style.left = `${drag.originRect.x + dx}px`;
      el.style.top = `${drag.originRect.y + dy}px`;
    }
  }
}

function setAltDuplicateMode(phoneEl, drag, active, dx = 0, dy = 0) {
  if (!drag || drag.type !== 'move' || drag.altDuplicate === active) return;
  drag.altDuplicate = active;
  if (active) {
    ensureAltProxies(phoneEl, drag);
    applyAltMoveVisuals(drag, dx, dy);
  } else {
    clearAltProxies(drag);
    applyDomOffset(
      drag.domCache || new Map(),
      dx,
      dy,
      drag.resizeHandleEls,
      drag.originRect,
    );
  }
}

function isDeepSelectEvent(e) {
  return !!(e?.ctrlKey || e?.metaKey);
}

const RESIZE_CORNERS = ['nw', 'ne', 'se', 'sw'];
const RESIZE_EDGES = ['n', 'e', 's', 'w'];

function resizeCursorForHandle(handle) {
  if (handle === 'e' || handle === 'w') return 'ew-resize';
  if (handle === 'n' || handle === 's') return 'ns-resize';
  if (handle === 'nw' || handle === 'se') return 'nwse-resize';
  if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
  return 'ew-resize';
}

function setGlobalResizeCursor(cursor) {
  if (typeof document === 'undefined') return;
  if (cursor) {
    document.documentElement.dataset.figmashowResize = cursor;
  } else {
    delete document.documentElement.dataset.figmashowResize;
  }
}

/**
 * Redimensiona a box. Com fromCenter (Shift), espelha no lado oposto
 * mantendo o centro fixo.
 */
function applyResizeBox(origin, handle, dx, dy, fromCenter = false) {
  if (!fromCenter) {
    let { x, y, w, h } = origin;
    if (handle.includes('e')) w = Math.max(1, origin.w + dx);
    if (handle.includes('s')) h = Math.max(1, origin.h + dy);
    if (handle.includes('w')) {
      w = Math.max(1, origin.w - dx);
      x = origin.x + origin.w - w;
    }
    if (handle.includes('n')) {
      h = Math.max(1, origin.h - dy);
      y = origin.y + origin.h - h;
    }
    return { x, y, w, h };
  }

  const cx = origin.x + origin.w / 2;
  const cy = origin.y + origin.h / 2;
  let w = origin.w;
  let h = origin.h;

  if (handle.includes('e') || handle.includes('w')) {
    const dw = handle.includes('e') ? dx : -dx;
    w = Math.max(1, origin.w + 2 * dw);
  }
  if (handle.includes('n') || handle.includes('s')) {
    const dh = handle.includes('s') ? dy : -dy;
    h = Math.max(1, origin.h + 2 * dh);
  }

  return {
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
  };
}

function buildCreatedNode(type, box) {
  const x = Math.round(Math.min(box.x, box.x + box.w));
  const y = Math.round(Math.min(box.y, box.y + box.h));
  const w = Math.max(1, Math.round(Math.abs(box.w)));
  const h = Math.max(1, Math.round(Math.abs(box.h)));
  if (type === 'text') {
    return {
      id: cryptoRandomId('text'),
      type: 'text',
      name: 'Texto',
      x,
      y,
      w: Math.max(w, 40),
      h: Math.max(h, 24),
      text: 'Texto',
      fontSize: 16,
      fontWeight: 400,
      color: '#1A1D21',
      align: 'left',
    };
  }
  if (type === 'button') {
    return {
      id: cryptoRandomId('button'),
      type: 'button',
      name: 'Botão',
      x,
      y,
      w: Math.max(w, 80),
      h: Math.max(h, 40),
      label: 'Botão',
      fill: '#3B82F6',
      textColor: '#FFFFFF',
      cornerRadius: 12,
      fontSize: 16,
      fontWeight: 600,
    };
  }
  if (type === 'image') {
    return {
      id: cryptoRandomId('image'),
      type: 'image',
      name: 'Imagem',
      x,
      y,
      w: Math.max(w, 80),
      h: Math.max(h, 80),
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23E5E7EB' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239CA3AF' font-family='sans-serif' font-size='20'%3EImage%3C/text%3E%3C/svg%3E",
      fit: 'cover',
    };
  }
  return {
    id: cryptoRandomId('rect'),
    type: 'rect',
    name: 'Retângulo',
    x,
    y,
    w: Math.max(w, 8),
    h: Math.max(h, 8),
    fill: '#93C5FD',
    cornerRadius: 8,
    opacity: 1,
  };
}

export default function PhoneFrame({
  screen,
  selectedNodeIds = [],
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
  dragEnabled = false,
  createTool = null,
  interactionMode = 'edit',
  components = [],
  prototypes = [],
  allScreens = [],
  comments = [],
  selectedCommentId,
  onAddComment,
  onSelectComment,
  onCreateNode,
  onResizeCommit,
  getZoom,
  onMoveCommit,
  onDuplicateMoveCommit,
  onPatchNode,
  onLiveGeometry,
  onDragActive,
  smartGuidesEnabled = true,
}) {
  const phoneRef = useRef(null);
  const dragRef = useRef(null);
  const guidesRef = useRef(null);
  const deepSelectRef = useRef(false);
  const hoveredLeafRef = useRef(null);
  const selectedIdsRef = useRef(selectedNodeIds);
  const dragRafRef = useRef(null);
  const pendingLiveGeomRef = useRef(null);
  const onLiveGeometryRef = useRef(onLiveGeometry);
  const chromeLabelRef = useRef(null);
  onLiveGeometryRef.current = onLiveGeometry;
  const [createPreview, setCreatePreview] = useState(null);
  const [editingText, setEditingText] = useState(null);

  const [deepSelect, setDeepSelect] = useState(false);
  const [hoveredLeafId, setHoveredLeafId] = useState(null);

  selectedIdsRef.current = selectedNodeIds;

  const editMode = interactionMode === 'edit';
  const commentMode = interactionMode === 'comment';
  const effectiveDrag = dragEnabled && editMode && !commentMode;
  const selectedNodes = selectedNodeIds
    .map((id) => findNodeById(screen.nodes, id))
    .filter(Boolean);
  const singleSelected =
    selectedNodes.length === 1 ? selectedNodes[0] : null;
  const canResize =
    singleSelected && !singleSelected.locked && effectiveDrag && !createTool;
  const isConstraintRoot =
    !!singleSelected &&
    (screen.nodes || []).some((n) => n.id === singleSelected.id);
  const canRadius =
    canResize &&
    (singleSelected.type === 'rect' || singleSelected.type === 'button');
  const canRotate =
    canResize &&
    !isContainerNode(singleSelected) &&
    ['rect', 'text', 'button', 'image'].includes(singleSelected.type);

  // Prefer leaf local; fallback hoveredNodeId do App (ex. painel camadas).
  const leafForHover = hoveredLeafId || hoveredNodeId;
  const { ancestors, siblings, target } = hoverOutlineNodes(
    screen.nodes,
    leafForHover,
    selectedNodeIds,
    deepSelect,
  );

  const emitHoverPick = (leafId, deep) => {
    if (!leafId) {
      onHoverNode?.(null);
      return;
    }
    const pick = resolvePickTarget(
      screen.nodes,
      leafId,
      deep,
      selectedIdsRef.current,
    );
    onHoverNode?.(pick?.id ?? leafId);
  };

  const localPoint = (e) => {
    const rect = phoneRef.current?.getBoundingClientRect();
    const zoom = Math.max(0.0001, getZoom?.() ?? 1);
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  useEffect(() => {
    const syncDeep = (on) => {
      deepSelectRef.current = on;
      setDeepSelect(on);
      if (hoveredLeafRef.current) {
        emitHoverPick(hoveredLeafRef.current, on);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') syncDeep(true);
      if (e.key === 'Alt') {
        const drag = dragRef.current;
        setAltDuplicateMode(
          phoneRef.current,
          drag,
          true,
          drag?.lastDx ?? 0,
          drag?.lastDy ?? 0,
        );
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') syncDeep(false);
      if (e.key === 'Alt') {
        const drag = dragRef.current;
        setAltDuplicateMode(
          phoneRef.current,
          drag,
          false,
          drag?.lastDx ?? 0,
          drag?.lastDy ?? 0,
        );
      }
    };
    const onBlur = () => {
      syncDeep(false);
      const drag = dragRef.current;
      setAltDuplicateMode(
        phoneRef.current,
        drag,
        false,
        drag?.lastDx ?? 0,
        drag?.lastDy ?? 0,
      );
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      setGlobalResizeCursor(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só montar listeners
  }, [screen.nodes]);

  const endDrag = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const duplicateOnDrop = drag.type === 'move' && drag.altDuplicate;
    // Antes do commit: limpa proxies e alinha o DOM ao que o React espera
    clearAltProxies(drag);
    if (drag.type === 'move' && duplicateOnDrop) {
      applyDomOffset(
        drag.domCache || new Map(),
        0,
        0,
        drag.resizeHandleEls,
        drag.originRect,
      );
    }
    dragRef.current = null;
    if (dragRafRef.current != null) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingLiveGeomRef.current = null;
    onDragActive?.(false);
    onLiveGeometry?.(null);
    setCreatePreview(null);
    if (drag.type === 'resize') {
      setGlobalResizeCursor(null);
    }
    if (drag.type === 'radius' || drag.type === 'rotate') {
      setGlobalResizeCursor(null);
      const label = chromeLabelRef.current;
      if (label) label.style.display = 'none';
    }

    const phoneEl = phoneRef.current;
    if (phoneEl?.hasPointerCapture?.(e.pointerId)) {
      phoneEl.releasePointerCapture(e.pointerId);
    }

    clearGuidesOverlay(guidesRef.current);

    if (drag.type === 'create') {
      const box = drag.box;
      if (!box || (Math.abs(box.w) < 4 && Math.abs(box.h) < 4)) {
        // clique simples → tamanho padrão
        const p = drag.origin;
        const defaults =
          drag.createType === 'text'
            ? { w: 120, h: 28 }
            : drag.createType === 'button'
              ? { w: 160, h: 48 }
              : drag.createType === 'image'
                ? { w: 160, h: 120 }
                : { w: 100, h: 100 };
        const node = buildCreatedNode(drag.createType, {
          x: p.x,
          y: p.y,
          ...defaults,
        });
        onCreateNode?.(screen.id, node);
        return;
      }
      onCreateNode?.(screen.id, buildCreatedNode(drag.createType, box));
      return;
    }

    if (drag.type === 'resize') {
      if (!drag.moved || !drag.lastBox) return;
      onResizeCommit?.(screen.id, drag.nodeId, drag.lastBox);
      return;
    }

    if (drag.type === 'radius') {
      if (!drag.moved) return;
      const r = Math.round(drag.lastRadius ?? 0);
      onPatchNode?.(screen.id, drag.nodeId, {
        cornerRadius: r,
        bottomRadius: null,
      });
      return;
    }

    if (drag.type === 'rotate') {
      if (!drag.moved) return;
      const rot = normalizeRotation(drag.lastRotation ?? 0);
      onPatchNode?.(screen.id, drag.nodeId, {
        rotation: rot === 0 ? null : rot,
      });
      return;
    }

    if (!drag.moved) return;
    const dx = drag.lastDx ?? 0;
    const dy = drag.lastDy ?? 0;
    if (dx || dy) {
      if (duplicateOnDrop) {
        onDuplicateMoveCommit?.(screen.id, drag.moveIds, dx, dy);
      } else {
        onMoveCommit?.(screen.id, drag.moveIds, dx, dy);
      }
    }
  };

  const onPointerDownCreate = (e) => {
    if (e.button !== 0 || !createTool) return;
    e.stopPropagation();
    const p = localPoint(e);
    dragRef.current = {
      type: 'create',
      pointerId: e.pointerId,
      createType: createTool,
      origin: p,
      box: { x: p.x, y: p.y, w: 0, h: 0 },
      moved: false,
    };
    setCreatePreview({ x: p.x, y: p.y, w: 0, h: 0 });
    onDragActive?.(true);
    phoneRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownResize = (e, handle) => {
    if (e.button !== 0 || !singleSelected || !dragEnabled) return;
    if (singleSelected.locked) return;
    e.stopPropagation();
    e.preventDefault();
    const leafIds = collectLeafIds(singleSelected);
    const exclude = new Set([singleSelected.id, ...leafIds]);
    const targets = collectAlignTargets(screen, exclude);
    const phoneEl = phoneRef.current;
    const nodeId = singleSelected.id;
    dragRef.current = {
      type: 'resize',
      pointerId: e.pointerId,
      nodeId,
      handle,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originBox: {
        x: singleSelected.x,
        y: singleSelected.y,
        w: singleSelected.w,
        h: singleSelected.h,
      },
      originRotation: nodeRotation(singleSelected),
      targets,
      lastBox: null,
      moved: false,
      nodeEls:
        phoneEl && singleSelected.type !== 'group'
          ? [
              ...phoneEl.querySelectorAll(
                `[data-node-id="${CSS.escape(nodeId)}"]`,
              ),
            ]
          : [],
      outlineEls: phoneEl
        ? [
            ...phoneEl.querySelectorAll(
              `[data-outline-id="${CSS.escape(nodeId)}"]`,
            ),
          ]
        : [],
      resizeHandleEls: phoneEl
        ? [...phoneEl.querySelectorAll('.resize-handles')]
        : [],
    };
    setGlobalResizeCursor(resizeCursorForHandle(handle));
    onDragActive?.(true);
    phoneEl?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownRadius = (e, corner) => {
    if (e.button !== 0 || !singleSelected || !canRadius) return;
    e.stopPropagation();
    e.preventDefault();
    const phoneEl = phoneRef.current;
    const nodeId = singleSelected.id;
    const box = {
      x: singleSelected.x,
      y: singleSelected.y,
      w: singleSelected.w,
      h: singleSelected.h,
    };
    dragRef.current = {
      type: 'radius',
      pointerId: e.pointerId,
      nodeId,
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originBox: box,
      originRotation: nodeRotation(singleSelected),
      lastRadius: Number(singleSelected.cornerRadius) || 0,
      moved: false,
      nodeEls: phoneEl
        ? [
            ...phoneEl.querySelectorAll(
              `[data-node-id="${CSS.escape(nodeId)}"]`,
            ),
          ]
        : [],
      outlineEls: phoneEl
        ? [
            ...phoneEl.querySelectorAll(
              `[data-outline-id="${CSS.escape(nodeId)}"]`,
            ),
          ]
        : [],
      radiusHandleEls: phoneEl
        ? [...phoneEl.querySelectorAll('.radius-handle')]
        : [],
    };
    setGlobalResizeCursor('radius');
    onDragActive?.(true);
    phoneEl?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownRotate = (e, corner) => {
    if (e.button !== 0 || !singleSelected || !canRotate) return;
    e.stopPropagation();
    e.preventDefault();
    const phoneEl = phoneRef.current;
    const nodeId = singleSelected.id;
    const box = {
      x: singleSelected.x,
      y: singleSelected.y,
      w: singleSelected.w,
      h: singleSelected.h,
    };
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const p = localPoint(e);
    dragRef.current = {
      type: 'rotate',
      pointerId: e.pointerId,
      nodeId,
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originBox: box,
      originRotation: nodeRotation(singleSelected),
      startAngle: angleDeg(cx, cy, p.x, p.y),
      lastRotation: nodeRotation(singleSelected),
      moved: false,
      nodeEls: phoneEl
        ? [
            ...phoneEl.querySelectorAll(
              `[data-node-id="${CSS.escape(nodeId)}"]`,
            ),
          ]
        : [],
      outlineEls: phoneEl
        ? [
            ...phoneEl.querySelectorAll(
              `[data-outline-id="${CSS.escape(nodeId)}"]`,
            ),
          ]
        : [],
      resizeHandleEls: phoneEl
        ? [...phoneEl.querySelectorAll('.resize-handles')]
        : [],
    };
    setGlobalResizeCursor('rotate');
    onDragActive?.(true);
    phoneEl?.setPointerCapture?.(e.pointerId);
  };

  const onPointerDownNode = (e, leafNode) => {
    if (createTool) {
      onPointerDownCreate(e);
      return;
    }
    if (e.button !== 0) return;
    if (!onSelectNode && !dragEnabled) return;
    e.stopPropagation();

    const deep = isDeepSelectEvent(e);
    const additive = !!e.shiftKey;
    const currentIds = selectedIdsRef.current || [];
    const pick = resolvePickTarget(
      screen.nodes,
      leafNode.id,
      deep,
      currentIds,
    );
    if (!pick) return;
    const pickId = pick.id;

    /** @type {string[]} */
    let nextIds;
    if (additive) {
      nextIds = currentIds.includes(pickId)
        ? currentIds.filter((id) => id !== pickId)
        : [...currentIds, pickId];
      onSelectNode?.(pickId, { additive: true });
      // Shift só altera a seleção — sem iniciar arraste
      return;
    }
    if (currentIds.includes(pickId) && currentIds.length > 1) {
      // Clique em item já na multi-seleção → mantém todos
      nextIds = currentIds;
      onSelectNode?.(pickId, { preserve: true });
    } else {
      nextIds = [pickId];
      onSelectNode?.(pickId);
    }

    if (!dragEnabled) return;

    const moveIds = topLevelSelectedIds(screen.nodes, nextIds);
    if (!moveIds.length) return;

    const moveNodes = moveIds
      .map((id) => findNodeById(screen.nodes, id))
      .filter(Boolean);
    if (moveNodes.some((n) => n.locked)) return;

    const { origins, leafIds } = mergeMoveOrigins(
      moveNodes.map((n) => gatherMoveOrigins(n, n)),
    );
    const exclude = new Set([...moveIds, ...leafIds]);
    const targets = collectAlignTargets(screen, exclude);
    const originRect = boundsOfNodes(moveNodes);
    const phoneEl = phoneRef.current;

    dragRef.current = {
      type: 'move',
      pointerId: e.pointerId,
      moveIds,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origins,
      leafIds,
      targets,
      originRect,
      moved: false,
      lastDx: 0,
      lastDy: 0,
      altDuplicate: false,
      altProxyEls: [],
      domCache: cacheMoveDom(phoneEl, origins),
      resizeHandleEls: phoneEl
        ? [...phoneEl.querySelectorAll('.resize-handles')]
        : [],
    };
    if (e.altKey) {
      setAltDuplicateMode(phoneEl, dragRef.current, true, 0, 0);
    }
    onDragActive?.(true);
    phoneEl?.setPointerCapture?.(e.pointerId);
  };

  /** Pega o objeto pelo centro (marcador estilo Corel) e inicia o move. */
  const onPointerDownCenter = (e) => {
    if (e.button !== 0 || !singleSelected || !dragEnabled) return;
    if (singleSelected.locked) return;
    e.stopPropagation();
    e.preventDefault();

    const moveIds = topLevelSelectedIds(screen.nodes, [singleSelected.id]);
    if (!moveIds.length) return;
    const moveNodes = moveIds
      .map((id) => findNodeById(screen.nodes, id))
      .filter(Boolean);
    if (moveNodes.some((n) => n.locked)) return;

    const { origins, leafIds } = mergeMoveOrigins(
      moveNodes.map((n) => gatherMoveOrigins(n, n)),
    );
    const exclude = new Set([...moveIds, ...leafIds]);
    const targets = collectAlignTargets(screen, exclude);
    const originRect = boundsOfNodes(moveNodes);
    const phoneEl = phoneRef.current;

    dragRef.current = {
      type: 'move',
      pointerId: e.pointerId,
      moveIds,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origins,
      leafIds,
      targets,
      originRect,
      moved: false,
      lastDx: 0,
      lastDy: 0,
      altDuplicate: false,
      altProxyEls: [],
      domCache: cacheMoveDom(phoneEl, origins),
      resizeHandleEls: phoneEl
        ? [...phoneEl.querySelectorAll('.resize-handles')]
        : [],
    };
    if (e.altKey) {
      setAltDuplicateMode(phoneEl, dragRef.current, true, 0, 0);
    }
    onDragActive?.(true);
    phoneEl?.setPointerCapture?.(e.pointerId);
  };

  const flushLiveGeometry = () => {
    const geom = pendingLiveGeomRef.current;
    pendingLiveGeomRef.current = undefined;
    if (geom !== undefined) onLiveGeometryRef.current?.(geom);
  };

  const scheduleLiveGeometry = (geom) => {
    pendingLiveGeomRef.current = geom;
    if (dragRafRef.current != null) return;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      flushLiveGeometry();
    });
  };

  const onPointerMoveNode = (e) => {
    const drag = dragRef.current;

    if (!drag) {
      const deep = isDeepSelectEvent(e);
      if (deep !== deepSelectRef.current) {
        deepSelectRef.current = deep;
        setDeepSelect(deep);
        if (hoveredLeafRef.current) {
          emitHoverPick(hoveredLeafRef.current, deep);
        }
      }
      return;
    }
    if (drag.pointerId !== e.pointerId) return;

    const zoom = Math.max(0.0001, getZoom?.() ?? 1);

    if (drag.type === 'create') {
      const p = localPoint(e);
      const box = {
        x: drag.origin.x,
        y: drag.origin.y,
        w: p.x - drag.origin.x,
        h: p.y - drag.origin.y,
      };
      drag.box = box;
      drag.moved = true;
      setCreatePreview(box);
      return;
    }

    if (drag.type === 'resize') {
      const rawScreenDx = (e.clientX - drag.startClientX) / zoom;
      const rawScreenDy = (e.clientY - drag.startClientY) / zoom;
      const dist = Math.hypot(
        e.clientX - drag.startClientX,
        e.clientY - drag.startClientY,
      );
      if (!drag.moved && dist < DRAG_THRESHOLD) return;
      drag.moved = true;
      const fromCenter = !!e.shiftKey;
      const local = rotateDelta(
        rawScreenDx,
        rawScreenDy,
        drag.originRotation || 0,
      );
      const raw = applyResizeBox(
        drag.originBox,
        drag.handle,
        local.dx,
        local.dy,
        fromCenter,
      );
      const snapped =
        !smartGuidesEnabled || drag.originRotation
          ? { box: raw, guides: [], size: null }
          : snapResize(
              raw,
              drag.handle,
              drag.targets || { x: [], y: [], otherRects: [] },
              { width: screen.width, height: screen.height },
              fromCenter,
              drag.originBox,
            );
      const box = snapped.box;
      drag.lastBox = box;
      for (const el of drag.outlineEls || []) {
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.w}px`;
        el.style.height = `${box.h}px`;
      }
      for (const el of drag.resizeHandleEls || []) {
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.w}px`;
        el.style.height = `${box.h}px`;
      }
      for (const el of drag.nodeEls || []) {
        el.style.left = `${box.x}px`;
        el.style.top = `${box.y}px`;
        el.style.width = `${box.w}px`;
        el.style.height = `${box.h}px`;
      }
      if (smartGuidesEnabled) {
        renderGuidesOverlay(guidesRef.current, snapped.guides, snapped.size);
      } else {
        clearGuidesOverlay(guidesRef.current);
      }
      scheduleLiveGeometry({
        id: drag.nodeId,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
      });
      return;
    }

    if (drag.type === 'radius') {
      const p = localPoint(e);
      const dist = Math.hypot(
        e.clientX - drag.startClientX,
        e.clientY - drag.startClientY,
      );
      if (!drag.moved && dist < DRAG_THRESHOLD) return;
      drag.moved = true;
      const local = worldToLocalBox(
        drag.originBox,
        drag.originRotation || 0,
        p.x,
        p.y,
      );
      const r = Math.round(
        radiusFromPointer(drag.corner, drag.originBox, local.x, local.y),
      );
      drag.lastRadius = r;
      const radCss = `${r}px`;
      for (const el of drag.nodeEls || []) {
        el.style.borderRadius = radCss;
      }
      for (const el of drag.outlineEls || []) {
        el.style.borderRadius = radCss;
      }
      applyRadiusHandlePositions(
        drag.radiusHandleEls,
        drag.originBox,
        r,
        zoom,
      );
      const label = chromeLabelRef.current;
      if (label) {
        label.style.display = 'block';
        label.textContent = `Radius ${r}`;
        label.style.left = `${p.x}px`;
        label.style.top = `${p.y - 28}px`;
      }
      scheduleLiveGeometry({
        id: drag.nodeId,
        x: drag.originBox.x,
        y: drag.originBox.y,
        w: drag.originBox.w,
        h: drag.originBox.h,
        cornerRadius: r,
      });
      return;
    }

    if (drag.type === 'rotate') {
      const p = localPoint(e);
      const box = drag.originBox;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const dist = Math.hypot(
        e.clientX - drag.startClientX,
        e.clientY - drag.startClientY,
      );
      if (!drag.moved && dist < DRAG_THRESHOLD) return;
      drag.moved = true;
      let next =
        drag.originRotation + (angleDeg(cx, cy, p.x, p.y) - drag.startAngle);
      if (e.shiftKey) next = snapAngle(next);
      next = normalizeRotation(next);
      drag.lastRotation = next;
      const t = next ? `rotate(${next}deg)` : 'none';
      for (const el of drag.nodeEls || []) {
        el.style.transform = t === 'none' ? '' : t;
        el.style.transformOrigin = '50% 50%';
      }
      for (const el of drag.outlineEls || []) {
        el.style.transform = t === 'none' ? '' : t;
        el.style.transformOrigin = '50% 50%';
      }
      for (const el of drag.resizeHandleEls || []) {
        el.style.transform = t === 'none' ? '' : t;
        el.style.transformOrigin = '50% 50%';
      }
      const label = chromeLabelRef.current;
      if (label) {
        label.style.display = 'block';
        label.textContent = `${Math.round(next)}°`;
        label.style.left = `${p.x}px`;
        label.style.top = `${p.y - 28}px`;
      }
      scheduleLiveGeometry({
        id: drag.nodeId,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        rotation: next,
      });
      return;
    }

    const rawDx = (e.clientX - drag.startClientX) / zoom;
    const rawDy = (e.clientY - drag.startClientY) / zoom;
    const dist = Math.hypot(
      e.clientX - drag.startClientX,
      e.clientY - drag.startClientY,
    );
    if (!drag.moved && dist < DRAG_THRESHOLD) return;
    drag.moved = true;

    // Shift: trava no eixo dominante (horizontal OU vertical), como no Figma/Corel.
    let moveDx = rawDx;
    let moveDy = rawDy;
    if (e.shiftKey) {
      if (Math.abs(rawDx) >= Math.abs(rawDy)) {
        moveDy = 0;
      } else {
        moveDx = 0;
      }
    }

    const snapped = smartGuidesEnabled
      ? snapDrag(
          drag.originRect,
          drag.targets,
          moveDx,
          moveDy,
          { width: screen.width, height: screen.height },
        )
      : {
          dx: moveDx,
          dy: moveDy,
          guides: [],
          size: {
            w: Math.round(drag.originRect.w),
            h: Math.round(drag.originRect.h),
            x: drag.originRect.x + moveDx,
            y: drag.originRect.y + moveDy,
          },
        };
    drag.lastDx = snapped.dx;
    drag.lastDy = snapped.dy;

    const wantAlt = !!e.altKey;
    if (wantAlt !== !!drag.altDuplicate) {
      setAltDuplicateMode(
        phoneRef.current,
        drag,
        wantAlt,
        snapped.dx,
        snapped.dy,
      );
    } else if (drag.altDuplicate) {
      applyAltMoveVisuals(drag, snapped.dx, snapped.dy);
    } else {
      applyDomOffset(
        drag.domCache || new Map(),
        snapped.dx,
        snapped.dy,
        drag.resizeHandleEls,
        drag.originRect,
      );
    }
    if (smartGuidesEnabled) {
      renderGuidesOverlay(guidesRef.current, snapped.guides, snapped.size);
    } else {
      clearGuidesOverlay(guidesRef.current);
    }

    if (drag.moveIds?.length === 1 && drag.originRect) {
      scheduleLiveGeometry({
        id: drag.moveIds[0],
        x: drag.originRect.x + snapped.dx,
        y: drag.originRect.y + snapped.dy,
        w: drag.originRect.w,
        h: drag.originRect.h,
      });
    }
  };

  const onDoubleClickNode = (e, leafNode) => {
    if (createTool || leafNode.type !== 'text' || leafNode.icon) return;
    e.stopPropagation();
    e.preventDefault();
    const pick = resolvePickTarget(
      screen.nodes,
      leafNode.id,
      true,
      selectedIdsRef.current || [],
    );
    const textNode =
      pick?.type === 'text' ? pick : leafNode.type === 'text' ? leafNode : null;
    if (!textNode || textNode.locked) return;
    onSelectNode?.(textNode.id);
    setEditingText({
      id: textNode.id,
      value: textNode.text || '',
      x: textNode.x,
      y: textNode.y,
      w: textNode.w,
      h: textNode.h,
      color: textNode.color,
      fontSize: textNode.fontSize,
      fontWeight: textNode.fontWeight,
      align: textNode.align || 'left',
    });
  };

  const commitTextEdit = () => {
    if (!editingText) return;
    const { id, value } = editingText;
    setEditingText(null);
    onPatchNode?.(screen.id, id, { text: value });
  };

  const onNodeHover = (leafId, e) => {
    if (dragRef.current || createTool) return;
    if (leafId == null) {
      hoveredLeafRef.current = null;
      setHoveredLeafId(null);
      onHoverNode?.(null);
      return;
    }
    const deep = e ? isDeepSelectEvent(e) : deepSelectRef.current;
    if (e && deep !== deepSelectRef.current) {
      deepSelectRef.current = deep;
      setDeepSelect(deep);
    }
    hoveredLeafRef.current = leafId;
    setHoveredLeafId(leafId);
    emitHoverPick(leafId, deep);
  };

  const previewBox = createPreview
    ? {
        left: Math.min(createPreview.x, createPreview.x + createPreview.w),
        top: Math.min(createPreview.y, createPreview.y + createPreview.h),
        width: Math.abs(createPreview.w),
        height: Math.abs(createPreview.h),
      }
    : null;

  const nodeHandlers = {
    onPointerDownNode,
    onHover: onNodeHover,
    onDoubleClickNode,
  };

  const screenPrototypes = (prototypes || []).filter(
    (p) => p.fromScreenId === screen.id,
  );
  const screenComments = (comments || []).filter(
    (c) => c.screenId === screen.id,
  );

  return (
    <div
      ref={phoneRef}
      data-screen-id={screen.id}
      className={`phone${effectiveDrag ? ' drag-enabled' : ''}${createTool ? ' create-tool' : ''}${commentMode ? ' comment-mode' : ''}${interactionMode === 'prototype' ? ' prototype-mode' : ''}`}
      style={{
        width: screen.width,
        height: screen.height,
        background: screen.background,
      }}
      onPointerLeave={() => {
        if (!dragRef.current) onNodeHover(null);
      }}
      onPointerDown={(e) => {
        if (commentMode && e.button === 0) {
          const p = localPoint(e);
          onAddComment?.(screen.id, p.x, p.y);
          e.stopPropagation();
          return;
        }
        if (createTool && e.target === phoneRef.current) {
          onPointerDownCreate(e);
        }
      }}
      onPointerMove={onPointerMoveNode}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {renderScreenNodes(screen.nodes, components, nodeHandlers)}
      {screenPrototypes.map((link) => {
        const node = findNodeById(screen.nodes, link.triggerNodeId);
        if (!node || node.hidden) return null;
        const destName =
          allScreens.find((s) => s.id === link.toScreenId)?.name ||
          link.toScreenId;
        return (
          <div
            key={link.id}
            className="prototype-link"
            style={{
              left: node.x + node.w - 8,
              top: node.y - 10,
            }}
            title={`Protótipo → ${destName}`}
          >
            <span className="prototype-link-label">→ {destName}</span>
          </div>
        );
      })}
      {screenComments.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`comment-pin${c.resolved ? ' is-resolved' : ''}${selectedCommentId === c.id ? ' is-active' : ''}`}
          style={{ left: c.x, top: c.y }}
          title={c.text || 'Comentário'}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectComment?.(c.id);
          }}
        />
      ))}
      {editingText && (
        <textarea
          className="inline-text-editor"
          autoFocus
          value={editingText.value}
          style={{
            left: editingText.x,
            top: editingText.y,
            width: editingText.w,
            height: Math.max(editingText.h, 24),
            color: editingText.color,
            fontSize: editingText.fontSize,
            fontWeight: editingText.fontWeight,
            textAlign: editingText.align,
          }}
          onChange={(e) =>
            setEditingText((prev) =>
              prev ? { ...prev, value: e.target.value } : prev,
            )
          }
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditingText(null);
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
      )}
      {selectedNodes.map((node) => (
        <Outline key={`sel-${node.id}`} node={node} kind="selected" />
      ))}
      {isConstraintRoot && (
        <ConstraintGuides
          node={singleSelected}
          screenW={screen.width}
          screenH={screen.height}
        />
      )}
      {canResize && (
        <div
          className="resize-handles"
          style={{
            left: singleSelected.x,
            top: singleSelected.y,
            width: singleSelected.w,
            height: singleSelected.h,
            ...rotationStyle(singleSelected.rotation),
          }}
        >
          {canRotate &&
            RESIZE_CORNERS.map((h) => (
              <button
                key={`rot-${h}`}
                type="button"
                className={`rotate-zone rotate-zone-${h}`}
                aria-label={`Rotacionar ${h}`}
                onPointerDown={(e) => onPointerDownRotate(e, h)}
              />
            ))}
          {RESIZE_EDGES.map((h) => (
            <button
              key={`edge-${h}`}
              type="button"
              className={`resize-edge resize-edge-${h}`}
              aria-label={`Redimensionar borda ${h}`}
              onPointerDown={(e) => onPointerDownResize(e, h)}
            />
          ))}
          <button
            type="button"
            className="center-handle"
            aria-label="Mover pelo centro"
            title="Centro"
            onPointerDown={onPointerDownCenter}
          >
            <span className="center-handle-label">centro</span>
          </button>
          {RESIZE_CORNERS.map((h) => (
            <button
              key={`corner-${h}`}
              type="button"
              className={`resize-handle resize-${h}`}
              aria-label={`Redimensionar canto ${h}`}
              onPointerDown={(e) => onPointerDownResize(e, h)}
            />
          ))}
          {canRadius &&
            RESIZE_CORNERS.map((h) => {
              const r = Number(singleSelected.cornerRadius) || 0;
              const maxR = maxCornerRadius(
                singleSelected.w,
                singleSelected.h,
              );
              // Pelo menos ~14px de tela para dentro do canto (como no
              // Figma), seguindo o raio quando ele for maior.
              const rClamped = Math.min(r, maxR);
              const inset = `clamp(${rClamped}px, 14px / var(--canvas-zoom, 1), ${maxR}px)`;
              const pos =
                h === 'nw'
                  ? { left: `calc(${inset})`, top: `calc(${inset})` }
                  : h === 'ne'
                    ? {
                        left: `calc(100% - (${inset}))`,
                        top: `calc(${inset})`,
                      }
                    : h === 'se'
                      ? {
                          left: `calc(100% - (${inset}))`,
                          top: `calc(100% - (${inset}))`,
                        }
                      : {
                          left: `calc(${inset})`,
                          top: `calc(100% - (${inset}))`,
                        };
              return (
                <button
                  key={`rad-${h}`}
                  type="button"
                  className={`radius-handle radius-${h}`}
                  style={pos}
                  aria-label={`Arredondar canto ${h}`}
                  onPointerDown={(e) => onPointerDownRadius(e, h)}
                />
              );
            })}
        </div>
      )}
      {ancestors.map((node) => (
        <Outline key={`anc-${node.id}`} node={node} kind="ancestor" />
      ))}
      {siblings.map((node) => (
        <Outline key={`sib-${node.id}`} node={node} kind="sibling" />
      ))}
      {target &&
        !isContainerNode(target) &&
        !selectedNodeIds.includes(target.id) && (
        <Outline node={target} kind="hover" />
      )}
      {target &&
        isContainerNode(target) &&
        !selectedNodeIds.includes(target.id) && (
        <Outline node={target} kind="ancestor" />
      )}
      {previewBox && (
        <div
          className="create-preview"
          style={{
            left: previewBox.left,
            top: previewBox.top,
            width: Math.max(1, previewBox.width),
            height: Math.max(1, previewBox.height),
          }}
        />
      )}
      <div
        ref={chromeLabelRef}
        className="chrome-drag-label"
        aria-hidden="true"
      />
      <div ref={guidesRef} className="smart-guides-overlay" aria-hidden="true" />
    </div>
  );
}
