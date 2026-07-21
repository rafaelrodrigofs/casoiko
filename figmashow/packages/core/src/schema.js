/** @typedef {'rect' | 'text' | 'button' | 'image' | 'group' | 'component' | 'instance'} NodeType */

/**
 * @typedef {Object} NodeConstraints
 * @property {boolean} left
 * @property {boolean} right
 * @property {boolean} top
 * @property {boolean} bottom
 */

/**
 * @typedef {Object} RectNode
 * @property {string} id
 * @property {'rect'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {string} [fill]
 * @property {number} [fillOpacity]
 * @property {number} [cornerRadius]
 * @property {number} [bottomRadius] - se definido, arredonda só a base (hero)
 * @property {number} [rotation] - graus (0–360), pivô no centro
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
 * @property {number} [strokeOpacity]
 * @property {number} [opacity]
 * @property {NodeConstraints} [constraints]
 */

/**
 * @typedef {Object} TextNode
 * @property {string} id
 * @property {'text'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {string} text
 * @property {number} [fontSize]
 * @property {number} [fontWeight]
 * @property {string} [color]
 * @property {'left'|'center'|'right'} [align]
 * @property {boolean} [icon] - renderiza como Material Icons (text = ligature)
 * @property {number} [rotation] - graus (0–360), pivô no centro
 * @property {NodeConstraints} [constraints]
 */

/**
 * @typedef {Object} ButtonNode
 * @property {string} id
 * @property {'button'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {string} label
 * @property {string} [fill]
 * @property {number} [fillOpacity]
 * @property {string} [textColor]
 * @property {number} [cornerRadius]
 * @property {number} [rotation] - graus (0–360), pivô no centro
 * @property {number} [fontSize]
 * @property {number} [fontWeight]
 * @property {string} [iconSrc]
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
 * @property {number} [strokeOpacity]
 * @property {NodeConstraints} [constraints]
 */

/**
 * @typedef {Object} ImageNode
 * @property {string} id
 * @property {'image'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {string} src
 * @property {'cover'|'contain'|'fill'} [fit]
 * @property {number} [rotation] - graus (0–360), pivô no centro
 * @property {NodeConstraints} [constraints]
 */

/**
 * Grupo estilo Figma. Filhos usam coordenadas absolutas na tela.
 * @typedef {Object} GroupNode
 * @property {string} id
 * @property {'group'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {BoardNode[]} children
 * @property {NodeConstraints} [constraints]
 */

/**
 * Componente principal no canvas (editável). Filhos em coords absolutas, como group.
 * @typedef {Object} ComponentMainNode
 * @property {string} id
 * @property {'component'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} componentId
 * @property {string} variantId
 * @property {BoardNode[]} children
 * @property {string} [name]
 * @property {NodeConstraints} [constraints]
 */

/**
 * Instância de componente (board v2).
 * @typedef {Object} InstanceNode
 * @property {string} id
 * @property {'instance'} type
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 * @property {string} componentId
 * @property {string} variantId
 * @property {NodeConstraints} [constraints]
 */

/** @typedef {RectNode | TextNode | ButtonNode | ImageNode | GroupNode | ComponentMainNode | InstanceNode} BoardNode */

/**
 * Container com filhos (grupo ou componente principal).
 * @param {BoardNode | null | undefined} node
 * @returns {BoardNode[] | null}
 */
export function getNodeChildren(node) {
  if (!node) return null;
  if (node.type === 'group') return node.children || [];
  if (node.type === 'component' && Array.isArray(node.children)) {
    return node.children;
  }
  return null;
}

/**
 * @param {BoardNode | null | undefined} node
 */
export function isContainerNode(node) {
  return getNodeChildren(node) != null;
}

/**
 * @typedef {Object} PrototypeLink
 * @property {string} id
 * @property {string} fromScreenId
 * @property {string} triggerNodeId
 * @property {string} toScreenId
 * @property {'instant'|'dissolve'} [transition]
 */

/**
 * @typedef {Object} BoardComment
 * @property {string} id
 * @property {string} screenId
 * @property {number} x
 * @property {number} y
 * @property {string} text
 * @property {boolean} [resolved]
 * @property {number} [createdAt]
 */

/**
 * @typedef {Object} Screen
 * @property {string} id
 * @property {string} name
 * @property {number} width
 * @property {number} height
 * @property {string} background
 * @property {number} x
 * @property {number} y
 * @property {BoardNode[]} nodes
 */

/**
 * @typedef {Object} Board
 * @property {number} version
 * @property {number} revision
 * @property {Screen[]} screens
 * @property {object[]} [components]
 * @property {PrototypeLink[]} [prototypes]
 * @property {BoardComment[]} [comments]
 */

export const DEFAULT_PHONE = { width: 390, height: 844 };
export const SCREEN_GAP = 80;

/** Normaliza graus para [0, 360). */
export function normalizeRotation(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return 0;
  let r = n % 360;
  if (r < 0) r += 360;
  // Evita -0 / 360
  if (r >= 360 - 1e-9) r = 0;
  return r;
}

/** Normaliza transparência para o intervalo [0, 1]. */
function normalizeOpacity(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** Preserva largura zero; usa 1 apenas quando o valor não foi informado. */
function normalizeStrokeWidth(value) {
  if (value === undefined || value === null || value === '') return 1;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 1;
}

/** @returns {Board} */
export function emptyBoard() {
  return {
    version: 2,
    revision: 0,
    screens: [],
    components: [],
    prototypes: [],
    comments: [],
  };
}

/** Default: pin left+top (retrocompatível com posição absoluta). */
export function defaultConstraints() {
  return { left: true, right: false, top: true, bottom: false };
}

/**
 * @param {unknown} raw
 * @returns {NodeConstraints}
 */
export function normalizeConstraints(raw) {
  const src =
    raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const next = {
    left: src.left !== false,
    right: src.right === true,
    top: src.top !== false,
    bottom: src.bottom === true,
  };
  // Exige pelo menos um pin por eixo.
  if (!next.left && !next.right) next.left = true;
  if (!next.top && !next.bottom) next.top = true;
  return next;
}

function constraintsEqualDefault(c) {
  return c.left && !c.right && c.top && !c.bottom;
}

/**
 * Aplica constraints de um nó quando o frame muda de tamanho.
 * @param {{ x: number, y: number, w: number, h: number, constraints?: NodeConstraints }} node
 * @param {number} oldW
 * @param {number} oldH
 * @param {number} newW
 * @param {number} newH
 */
function applyAxisConstraints(node, oldW, oldH, newW, newH) {
  const c = normalizeConstraints(node.constraints);
  let { x, y, w, h } = node;

  const left = x;
  const right = oldW - (x + w);
  const top = y;
  const bottom = oldH - (y + h);

  if (c.left && c.right) {
    w = Math.max(1, newW - left - right);
    x = left;
  } else if (c.right) {
    x = newW - right - w;
  } else {
    x = left;
  }

  if (c.top && c.bottom) {
    h = Math.max(1, newH - top - bottom);
    y = top;
  } else if (c.bottom) {
    y = newH - bottom - h;
  } else {
    y = top;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
  };
}

/**
 * Redimensiona a tela aplicando constraints só nos nós raiz.
 * @param {Screen} screen
 * @param {number} width
 * @param {number} height
 * @returns {Screen}
 */
export function resizeScreenWithConstraints(screen, width, height) {
  const newW = Math.max(1, Math.round(Number(width) || 1));
  const newH = Math.max(1, Math.round(Number(height) || 1));
  const oldW = Math.max(1, Number(screen.width) || 1);
  const oldH = Math.max(1, Number(screen.height) || 1);
  if (newW === oldW && newH === oldH) {
    return { ...screen, width: newW, height: newH };
  }

  const nodes = (screen.nodes || []).map((node) => {
    const box = applyAxisConstraints(node, oldW, oldH, newW, newH);
    const dx = box.x - node.x;
    const dy = box.y - node.y;
    if (isContainerNode(node)) {
      let next = shiftNodeTree(node, dx, dy);
      if (box.w !== node.w || box.h !== node.h) {
        // stretch: redimensiona o grupo/componente inteiro
        const resized = resizeNodeBox([next], next.id, {
          x: box.x,
          y: box.y,
          w: box.w,
          h: box.h,
        });
        next = resized.updated || next;
      }
      return next;
    }
    return { ...node, ...box };
  });

  return { ...screen, width: newW, height: newH, nodes };
}

/**
 * @param {unknown} data
 * @returns {Board}
 */
export function normalizeBoard(data) {
  if (!data || typeof data !== 'object') return emptyBoard();
  const raw = /** @type {Record<string, unknown>} */ (data);
  const screens = Array.isArray(raw.screens) ? raw.screens : [];
  const version =
    typeof raw.version === 'number' && Number.isFinite(raw.version)
      ? Math.max(1, Math.floor(raw.version))
      : 1;
  let board = {
    version: Math.max(version, 2),
    revision:
      typeof raw.revision === 'number' && Number.isFinite(raw.revision)
        ? Math.max(0, Math.floor(raw.revision))
        : 0,
    screens: screens.map((s) => normalizeScreen(s)),
    components: Array.isArray(raw.components) ? raw.components : [],
    prototypes: normalizePrototypes(raw.prototypes),
    comments: normalizeComments(raw.comments),
  };
  board = applyScreenLayout(board);
  board = scrubBoardRefs(board);
  return board;
}

function normalizePrototypes(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const p = /** @type {Record<string, unknown>} */ (item);
      const transition =
        p.transition === 'dissolve' ? 'dissolve' : 'instant';
      return {
        id: String(p.id || cryptoRandomId('proto')),
        fromScreenId: String(p.fromScreenId || ''),
        triggerNodeId: String(p.triggerNodeId || ''),
        toScreenId: String(p.toScreenId || ''),
        transition,
      };
    })
    .filter(Boolean);
}

function normalizeComments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const c = /** @type {Record<string, unknown>} */ (item);
      return {
        id: String(c.id || cryptoRandomId('comment')),
        screenId: String(c.screenId || ''),
        x: Number(c.x) || 0,
        y: Number(c.y) || 0,
        text: String(c.text ?? ''),
        resolved: c.resolved === true,
        createdAt: Number(c.createdAt) || Date.now(),
      };
    })
    .filter(Boolean);
}

/** Remove prototypes/comments órfãos. */
export function scrubBoardRefs(board) {
  const screenIds = new Set((board.screens || []).map((s) => s.id));
  const nodeIdsByScreen = new Map();
  for (const screen of board.screens || []) {
    const ids = new Set();
    const walk = (nodes) => {
      for (const n of nodes || []) {
        ids.add(n.id);
        if (getNodeChildren(n)) walk(getNodeChildren(n));
      }
    };
    walk(screen.nodes);
    nodeIdsByScreen.set(screen.id, ids);
  }

  const prototypes = (board.prototypes || []).filter((p) => {
    if (!screenIds.has(p.fromScreenId) || !screenIds.has(p.toScreenId)) {
      return false;
    }
    const ids = nodeIdsByScreen.get(p.fromScreenId);
    return ids?.has(p.triggerNodeId);
  });

  const comments = (board.comments || []).filter((c) =>
    screenIds.has(c.screenId),
  );

  return { ...board, prototypes, comments };
}

/**
 * Se x/y faltarem, coloca as telas em fila horizontal.
 * @param {Board} board
 * @returns {Board}
 */
export function applyScreenLayout(board) {
  let nextX = 0;
  const screens = board.screens.map((screen) => {
    const hasX = Number.isFinite(screen.x);
    const hasY = Number.isFinite(screen.y);
    if (hasX && hasY) {
      nextX = Math.max(nextX, screen.x + screen.width + SCREEN_GAP);
      return screen;
    }
    const x = hasX ? screen.x : nextX;
    const y = hasY ? screen.y : 0;
    nextX = x + screen.width + SCREEN_GAP;
    return { ...screen, x, y };
  });
  return { ...board, screens };
}

/**
 * @param {unknown} s
 * @returns {Screen}
 */
function normalizeScreen(s) {
  const screen = /** @type {Record<string, unknown>} */ (s || {});
  const hasX = screen.x !== undefined && screen.x !== null && screen.x !== '';
  const hasY = screen.y !== undefined && screen.y !== null && screen.y !== '';
  return {
    id: String(screen.id || cryptoRandomId('screen')),
    name: String(screen.name || 'Untitled'),
    width: Number(screen.width) || DEFAULT_PHONE.width,
    height: Number(screen.height) || DEFAULT_PHONE.height,
    background: String(screen.background || '#FFFFFF'),
    x: hasX ? Number(screen.x) : undefined,
    y: hasY ? Number(screen.y) : undefined,
    nodes: Array.isArray(screen.nodes)
      ? screen.nodes.map((n) => normalizeNode(n))
      : [],
  };
}

/**
 * Bounds a partir dos filhos (coordenadas absolutas).
 * @param {BoardNode[]} children
 */
export function boundsFromChildren(children) {
  if (!children.length) {
    return { x: 0, y: 0, w: 100, h: 40 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of children) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w);
    maxY = Math.max(maxY, c.y + c.h);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

/**
 * @param {unknown} n
 * @returns {BoardNode}
 */
export function normalizeNode(n) {
  const node = /** @type {Record<string, unknown>} */ (n || {});
  const type =
    node.type === 'text' ||
    node.type === 'button' ||
    node.type === 'image' ||
    node.type === 'group' ||
    node.type === 'component' ||
    node.type === 'instance'
      ? node.type
      : 'rect';

  if (type === 'group' || type === 'component') {
    const children = Array.isArray(node.children)
      ? node.children.map((c) => normalizeNode(c))
      : [];
    const bounds = boundsFromChildren(children);
    const hasBox =
      Number.isFinite(Number(node.x)) &&
      Number.isFinite(Number(node.y)) &&
      Number.isFinite(Number(node.w)) &&
      Number.isFinite(Number(node.h));
    if (type === 'component') {
      /** @type {ComponentMainNode} */
      const main = {
        id: String(node.id || cryptoRandomId('component_main')),
        type: 'component',
        componentId: String(node.componentId || ''),
        variantId: String(node.variantId || ''),
        x: hasBox ? Number(node.x) : bounds.x,
        y: hasBox ? Number(node.y) : bounds.y,
        w: hasBox ? Number(node.w) : bounds.w,
        h: hasBox ? Number(node.h) : bounds.h,
        children,
      };
      if (typeof node.name === 'string' && node.name.trim()) {
        main.name = node.name.trim();
      }
      if (node.locked === true) main.locked = true;
      if (node.hidden === true) main.hidden = true;
      attachConstraints(main, node);
      return main;
    }
    /** @type {GroupNode} */
    const group = {
      id: String(node.id || cryptoRandomId('group')),
      type: 'group',
      x: hasBox ? Number(node.x) : bounds.x,
      y: hasBox ? Number(node.y) : bounds.y,
      w: hasBox ? Number(node.w) : bounds.w,
      h: hasBox ? Number(node.h) : bounds.h,
      children,
    };
    if (typeof node.name === 'string' && node.name.trim()) {
      group.name = node.name.trim();
    }
    if (node.locked === true) group.locked = true;
    if (node.hidden === true) group.hidden = true;
    attachConstraints(group, node);
    return group;
  }

  const base = {
    id: String(node.id || cryptoRandomId('node')),
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
    w: Number(node.w) || 100,
    h: Number(node.h) || 40,
  };
  if (typeof node.name === 'string' && node.name.trim()) {
    base.name = node.name.trim();
  }
  if (node.locked === true) base.locked = true;
  if (node.hidden === true) base.hidden = true;
  const rotation = normalizeRotation(node.rotation);
  if (rotation) base.rotation = rotation;

  if (type === 'instance') {
    /** @type {InstanceNode} */
    const inst = {
      ...base,
      type: 'instance',
      componentId: String(node.componentId || ''),
      variantId: String(node.variantId || ''),
      w: Math.max(1, Number(node.w) || 100),
      h: Math.max(1, Number(node.h) || 40),
    };
    attachConstraints(inst, node);
    return inst;
  }

  if (type === 'text') {
    /** @type {TextNode} */
    const textNode = {
      ...base,
      type: 'text',
      text: String(node.text ?? ''),
      fontSize: Number(node.fontSize) || 16,
      fontWeight: Number(node.fontWeight) || 400,
      color: String(node.color || '#1A1D21'),
      align: node.align === 'center' || node.align === 'right' ? node.align : 'left',
    };
    if (node.icon === true) textNode.icon = true;
    attachConstraints(textNode, node);
    return textNode;
  }

  if (type === 'button') {
    /** @type {ButtonNode} */
    const btn = {
      ...base,
      type: 'button',
      label: String(node.label ?? 'Button'),
      fill: String(node.fill || '#1B355A'),
      fillOpacity: normalizeOpacity(node.fillOpacity),
      textColor: String(node.textColor || '#FFFFFF'),
      cornerRadius: Number(node.cornerRadius) || 27,
      fontSize: Number(node.fontSize) || 16,
      fontWeight: Number(node.fontWeight) || 600,
    };
    if (typeof node.iconSrc === 'string' && node.iconSrc.trim()) {
      btn.iconSrc = node.iconSrc.trim();
    }
    if (typeof node.stroke === 'string' && node.stroke.trim()) {
      btn.stroke = node.stroke.trim();
      btn.strokeWidth = normalizeStrokeWidth(node.strokeWidth);
      btn.strokeOpacity = normalizeOpacity(node.strokeOpacity);
    }
    attachConstraints(btn, node);
    return btn;
  }

  if (type === 'image') {
    const fit =
      node.fit === 'cover' || node.fit === 'fill' ? node.fit : 'contain';
    const image = {
      ...base,
      type: 'image',
      src: String(node.src || ''),
      fit,
    };
    attachConstraints(image, node);
    return image;
  }

  /** @type {RectNode} */
  const rect = {
    ...base,
    type: 'rect',
    fill: String(node.fill || '#E5E7EB'),
    fillOpacity: normalizeOpacity(node.fillOpacity),
    cornerRadius: Number(node.cornerRadius) || 0,
    opacity: normalizeOpacity(node.opacity),
  };
  if (Number.isFinite(Number(node.bottomRadius)) && Number(node.bottomRadius) > 0) {
    rect.bottomRadius = Number(node.bottomRadius);
  }
  if (typeof node.stroke === 'string' && node.stroke.trim()) {
    rect.stroke = node.stroke.trim();
    rect.strokeWidth = normalizeStrokeWidth(node.strokeWidth);
    rect.strokeOpacity = normalizeOpacity(node.strokeOpacity);
  }
  attachConstraints(rect, node);
  return rect;
}

function attachConstraints(target, source) {
  if (!source || typeof source !== 'object') return;
  if (!('constraints' in source) || source.constraints == null) return;
  const c = normalizeConstraints(source.constraints);
  if (!constraintsEqualDefault(c)) {
    target.constraints = c;
  }
}

/**
 * Folhas renderizáveis (rect/text/button), ordem de pintura.
 * @param {BoardNode[]} nodes
 * @returns {Exclude<BoardNode, GroupNode>[]}
 */
export function flattenLeaves(nodes) {
  /** @type {Exclude<BoardNode, GroupNode | ComponentMainNode>[]} */
  const out = [];
  for (const node of nodes) {
    const kids = getNodeChildren(node);
    if (kids) {
      out.push(...flattenLeaves(kids));
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * Folhas visíveis (ignora hidden e filhos de grupos hidden).
 * @param {BoardNode[]} nodes
 * @returns {Exclude<BoardNode, GroupNode | ComponentMainNode>[]}
 */
export function flattenVisibleLeaves(nodes) {
  /** @type {Exclude<BoardNode, GroupNode | ComponentMainNode>[]} */
  const out = [];
  for (const node of nodes) {
    if (node.hidden) continue;
    const kids = getNodeChildren(node);
    if (kids) {
      out.push(...flattenVisibleLeaves(kids));
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * Alinha nós selecionados (irmãos ou raiz) pelo bounding box da seleção.
 * @param {BoardNode[]} nodes
 * @param {string[]} ids
 * @param {'left'|'center'|'right'|'top'|'middle'|'bottom'} mode
 */
export function alignSelection(nodes, ids, mode) {
  const unique = [...new Set(ids)];
  /** @type {BoardNode[]} */
  const items = [];
  for (const id of unique) {
    const n = findNodeById(nodes, id);
    if (n) items.push(n);
  }
  if (items.length < 2) return { nodes, ok: false };

  const minX = Math.min(...items.map((n) => n.x));
  const maxR = Math.max(...items.map((n) => n.x + n.w));
  const minY = Math.min(...items.map((n) => n.y));
  const maxB = Math.max(...items.map((n) => n.y + n.h));
  const cx = (minX + maxR) / 2;
  const cy = (minY + maxB) / 2;

  let next = nodes;
  for (const item of items) {
    let x = item.x;
    let y = item.y;
    if (mode === 'left') x = minX;
    else if (mode === 'center') x = cx - item.w / 2;
    else if (mode === 'right') x = maxR - item.w;
    else if (mode === 'top') y = minY;
    else if (mode === 'middle') y = cy - item.h / 2;
    else if (mode === 'bottom') y = maxB - item.h;
    const dx = Math.round(x - item.x);
    const dy = Math.round(y - item.y);
    if (!dx && !dy) continue;
    const res = moveNodeBy(next, item.id, dx, dy);
    if (res.updated) next = res.nodes;
  }
  return { nodes: next, ok: true };
}

/**
 * Distribui espaçamento uniforme entre o primeiro e o último (eixo).
 * @param {BoardNode[]} nodes
 * @param {string[]} ids
 * @param {'horizontal'|'vertical'} axis
 */
export function distributeSelection(nodes, ids, axis) {
  const unique = [...new Set(ids)];
  /** @type {BoardNode[]} */
  const items = [];
  for (const id of unique) {
    const n = findNodeById(nodes, id);
    if (n) items.push(n);
  }
  if (items.length < 3) return { nodes, ok: false };

  const sorted =
    axis === 'horizontal'
      ? [...items].sort((a, b) => a.x - b.x || a.y - b.y)
      : [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan =
    axis === 'horizontal'
      ? last.x + last.w - first.x
      : last.y + last.h - first.y;
  const sumSizes = sorted.reduce(
    (acc, n) => acc + (axis === 'horizontal' ? n.w : n.h),
    0,
  );
  const gap = (totalSpan - sumSizes) / (sorted.length - 1);
  if (!Number.isFinite(gap)) return { nodes, ok: false };

  let cursor = axis === 'horizontal' ? first.x : first.y;
  let next = nodes;
  for (const item of sorted) {
    const size = axis === 'horizontal' ? item.w : item.h;
    const target = cursor;
    const dx = axis === 'horizontal' ? Math.round(target - item.x) : 0;
    const dy = axis === 'vertical' ? Math.round(target - item.y) : 0;
    if (dx || dy) {
      const res = moveNodeBy(next, item.id, dx, dy);
      if (res.updated) next = res.nodes;
    }
    cursor += size + gap;
  }
  return { nodes: next, ok: true };
}

/**
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @returns {BoardNode | null}
 */
export function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    const kids = getNodeChildren(node);
    if (kids) {
      const found = findNodeById(kids, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * @param {BoardNode[]} nodes
 * @param {string} id
 */
export function containsNodeId(nodes, id) {
  return findNodeById(nodes, id) != null;
}

/**
 * Atualiza um nó na árvore (imutável).
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @param {(node: BoardNode) => BoardNode} updater
 * @returns {{ nodes: BoardNode[], updated: BoardNode | null }}
 */
export function updateNodeInTree(nodes, id, updater) {
  /** @type {BoardNode | null} */
  let updated = null;
  const next = nodes.map((node) => {
    if (node.id === id) {
      updated = updater(node);
      return updated;
    }
    const kids = getNodeChildren(node);
    if (kids) {
      const res = updateNodeInTree(kids, id, updater);
      if (res.updated) {
        updated = res.updated;
        return { ...node, children: res.nodes };
      }
    }
    return node;
  });
  return { nodes: next, updated };
}

/**
 * Desloca um nó (e filhos, se grupo) em dx/dy.
 * @param {BoardNode} node
 * @param {number} dx
 * @param {number} dy
 */
export function shiftNodeTree(node, dx, dy) {
  const kids = getNodeChildren(node);
  if (kids) {
    return {
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      children: kids.map((c) => shiftNodeTree(c, dx, dy)),
    };
  }
  return { ...node, x: node.x + dx, y: node.y + dy };
}

/**
 * Recalcula bounds de todos os grupos/componentes (coords absolutas dos filhos).
 * @param {BoardNode} node
 */
export function refreshGroupBounds(node) {
  const kids = getNodeChildren(node);
  if (!kids) return node;
  const children = kids.map(refreshGroupBounds);
  if (!children.length) return { ...node, children };
  const b = boundsFromChildren(children);
  return { ...node, children, x: b.x, y: b.y, w: b.w, h: b.h };
}

/**
 * Move um nó por id; atualiza bounds dos grupos.
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @param {number} dx
 * @param {number} dy
 */
export function moveNodeBy(nodes, id, dx, dy) {
  if (!dx && !dy) return { nodes, updated: findNodeById(nodes, id) };
  const { nodes: moved, updated } = updateNodeInTree(nodes, id, (node) =>
    shiftNodeTree(node, dx, dy),
  );
  if (!updated) return { nodes, updated: null };
  const next = moved.map(refreshGroupBounds);
  return { nodes: next, updated: findNodeById(next, id) };
}

/**
 * IDs de todas as folhas sob um nó (ou o próprio se for folha).
 * @param {BoardNode} node
 * @returns {string[]}
 */
export function collectLeafIds(node) {
  const kids = getNodeChildren(node);
  if (kids) {
    return flattenLeaves(kids).map((n) => n.id);
  }
  return [node.id];
}

/**
 * Agrupa nós irmãos (mesmo pai) sob um novo group.
 * @param {BoardNode[]} nodes
 * @param {string[]} ids
 * @returns {{ nodes: BoardNode[], groupId: string | null }}
 */
export function groupSiblingNodes(nodes, ids) {
  const idSet = new Set((ids || []).filter(Boolean));
  if (idSet.size === 0) return { nodes, groupId: null };

  /**
   * @param {BoardNode[]} list
   * @returns {{ nodes: BoardNode[], groupId: string } | null}
   */
  function tryGroup(list) {
    const taken = list.filter((n) => idSet.has(n.id));
    if (taken.length === idSet.size) {
      /** @type {BoardNode[]} */
      const remaining = [];
      let insertAt = -1;
      for (const n of list) {
        if (idSet.has(n.id)) {
          if (insertAt < 0) insertAt = remaining.length;
        } else {
          remaining.push(n);
        }
      }
      const b = boundsFromChildren(taken);
      const groupId = cryptoRandomId('group');
      /** @type {GroupNode} */
      const group = {
        id: groupId,
        type: 'group',
        name: 'Grupo',
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
        children: taken,
      };
      remaining.splice(insertAt < 0 ? remaining.length : insertAt, 0, group);
      return { nodes: remaining, groupId };
    }

    for (let i = 0; i < list.length; i += 1) {
      const n = list[i];
      const kids = getNodeChildren(n);
      if (!kids) continue;
      const res = tryGroup(kids);
      if (!res) continue;
      const next = [...list];
      next[i] = refreshGroupBounds({ ...n, children: res.nodes });
      return { nodes: next, groupId: res.groupId };
    }
    return null;
  }

  const result = tryGroup(nodes);
  if (!result) return { nodes, groupId: null };
  return {
    nodes: result.nodes.map(refreshGroupBounds),
    groupId: result.groupId,
  };
}

/**
 * Desfaz um group: sobe os filhos para o nível do group.
 * @param {BoardNode[]} nodes
 * @param {string} groupId
 * @returns {{ nodes: BoardNode[], ok: boolean, childIds: string[] }}
 */
export function ungroupNode(nodes, groupId) {
  /**
   * @param {BoardNode[]} list
   * @returns {{ nodes: BoardNode[], childIds: string[] } | null}
   */
  function tryUngroup(list) {
    for (let i = 0; i < list.length; i += 1) {
      const n = list[i];
      if (n.id === groupId) {
        if (n.type !== 'group') return null;
        const childIds = n.children.map((c) => c.id);
        return {
          nodes: [...list.slice(0, i), ...n.children, ...list.slice(i + 1)],
          childIds,
        };
      }
      const kids = getNodeChildren(n);
      if (kids) {
        const res = tryUngroup(kids);
        if (!res) continue;
        const next = [...list];
        next[i] = refreshGroupBounds({ ...n, children: res.nodes });
        return { nodes: next, childIds: res.childIds };
      }
    }
    return null;
  }

  const result = tryUngroup(nodes);
  if (!result) return { nodes, ok: false, childIds: [] };
  return {
    nodes: result.nodes.map(refreshGroupBounds),
    ok: true,
    childIds: result.childIds,
  };
}

/**
 * Clona um nó com novos IDs (recursivo).
 * @param {BoardNode} node
 * @returns {BoardNode}
 */
export function cloneNodeTree(node) {
  const kids = getNodeChildren(node);
  if (kids) {
    return {
      ...node,
      id: cryptoRandomId(node.type === 'component' ? 'component_main' : 'group'),
      children: kids.map(cloneNodeTree),
    };
  }
  return { ...node, id: cryptoRandomId(node.type || 'node') };
}

/**
 * Duplica irmãos selecionados com offset; retorna IDs dos clones.
 * @param {BoardNode[]} nodes
 * @param {string[]} ids
 * @param {number} [offset=16]
 * @returns {{ nodes: BoardNode[], clonedIds: string[] }}
 */
export function duplicateSiblingNodes(nodes, ids, offset = 16) {
  const idSet = new Set((ids || []).filter(Boolean));
  if (idSet.size === 0) return { nodes, clonedIds: [] };

  /** @type {string[]} */
  const clonedIds = [];

  /**
   * @param {BoardNode[]} list
   * @returns {BoardNode[] | null}
   */
  function tryDup(list) {
    const indexes = [];
    for (let i = 0; i < list.length; i += 1) {
      if (idSet.has(list[i].id)) indexes.push(i);
    }
    if (indexes.length === idSet.size) {
      /** @type {BoardNode[]} */
      const next = [...list];
      let insertAt = indexes[indexes.length - 1] + 1;
      for (const i of indexes) {
        const clone = shiftNodeTree(cloneNodeTree(list[i]), offset, offset);
        next.splice(insertAt, 0, clone);
        clonedIds.push(clone.id);
        insertAt += 1;
      }
      return next.map(refreshGroupBounds);
    }

    for (let i = 0; i < list.length; i += 1) {
      const n = list[i];
      const kids = getNodeChildren(n);
      if (!kids) continue;
      const children = tryDup(kids);
      if (!children) continue;
      const next = [...list];
      next[i] = refreshGroupBounds({ ...n, children });
      return next;
    }
    return null;
  }

  const result = tryDup(nodes);
  if (!result) return { nodes, clonedIds: [] };
  return { nodes: result.map(refreshGroupBounds), clonedIds };
}

/**
 * Insere um nó na raiz da tela (ou dentro de parentId se for group).
 * @param {BoardNode[]} nodes
 * @param {BoardNode} node
 * @param {string | null} [parentId]
 * @returns {{ nodes: BoardNode[], inserted: BoardNode | null }}
 */
export function insertNodeInTree(nodes, node, parentId = null) {
  if (!parentId) {
    return { nodes: [...nodes, node], inserted: node };
  }
  const { nodes: next, updated } = updateNodeInTree(nodes, parentId, (n) => {
    if (!isContainerNode(n)) return n;
    return refreshGroupBounds({
      ...n,
      children: [...(getNodeChildren(n) || []), node],
    });
  });
  if (!updated || !isContainerNode(updated)) {
    return { nodes, inserted: null };
  }
  return { nodes: next.map(refreshGroupBounds), inserted: node };
}

/**
 * Redimensiona um nó (e escala filhos se for group).
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @param {{ x: number, y: number, w: number, h: number }} box
 */
export function resizeNodeBox(nodes, id, box) {
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Math.max(1, Number(box.w));
  const h = Math.max(1, Number(box.h));

  /** @param {BoardNode} node */
  function scaleTree(node, ox, oy, nx, ny, sx, sy) {
    const kids = getNodeChildren(node);
    if (kids) {
      const children = kids.map((c) =>
        scaleTree(c, ox, oy, nx, ny, sx, sy),
      );
      return refreshGroupBounds({ ...node, children });
    }
    return {
      ...node,
      x: nx + (node.x - ox) * sx,
      y: ny + (node.y - oy) * sy,
      w: Math.max(1, node.w * sx),
      h: Math.max(1, node.h * sy),
    };
  }

  const { nodes: next, updated } = updateNodeInTree(nodes, id, (node) => {
    if (isContainerNode(node)) {
      const ox = node.x;
      const oy = node.y;
      const ow = Math.max(1, node.w);
      const oh = Math.max(1, node.h);
      return scaleTree(node, ox, oy, x, y, w / ow, h / oh);
    }
    return { ...node, x, y, w, h };
  });
  if (!updated) return { nodes, updated: null };
  return { nodes: next.map(refreshGroupBounds), updated: findNodeById(next, id) };
}

/**
 * Reordena um nó entre irmãos: delta -1 sobe no array, +1 desce.
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @param {number} delta
 * @returns {{ nodes: BoardNode[], ok: boolean }}
 */
export function reorderSiblingNode(nodes, id, delta) {
  if (!delta) return { nodes, ok: false };

  const i = nodes.findIndex((n) => n.id === id);
  if (i >= 0) {
    const j = i + delta;
    if (j < 0 || j >= nodes.length) return { nodes, ok: false };
    const next = [...nodes];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    return { nodes: next, ok: true };
  }

  for (let k = 0; k < nodes.length; k += 1) {
    const n = nodes[k];
    const kids = getNodeChildren(n);
    if (!kids || !containsNodeId(kids, id)) continue;
    const inner = reorderSiblingNode(kids, id, delta);
    if (!inner.ok) return { nodes, ok: false };
    const next = [...nodes];
    next[k] = { ...n, children: inner.nodes };
    return { nodes: next, ok: true };
  }

  return { nodes, ok: false };
}

/**
 * Remove um nó (ou grupo inteiro) da árvore.
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @returns {{ nodes: BoardNode[], removed: BoardNode | null }}
 */
export function removeNodeFromTree(nodes, id) {
  /** @type {BoardNode | null} */
  let removed = null;
  /** @type {BoardNode[]} */
  const next = [];
  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
      continue;
    }
    if (isContainerNode(node)) {
      const res = removeNodeFromTree(getNodeChildren(node) || [], id);
      if (res.removed) {
        removed = res.removed;
        next.push({ ...node, children: res.nodes });
        continue;
      }
    }
    next.push(node);
  }
  return { nodes: next, removed };
}

/**
 * Conta nós folha (+ grupos opcionalmente).
 * @param {BoardNode[]} nodes
 */
export function countNodes(nodes) {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    const kids = getNodeChildren(node);
    if (kids) n += countNodes(kids);
  }
  return n;
}

/**
 * Árvore resumida para agentes (sem props visuais pesadas).
 * @param {BoardNode[]} nodes
 * @returns {object[]}
 */
export function summarizeNodeTree(nodes) {
  return (nodes || []).map((node) => {
    /** @type {Record<string, unknown>} */
    const row = {
      id: node.id,
      type: node.type,
      name: node.name || layerLabel(node),
      x: Math.round(node.x),
      y: Math.round(node.y),
      w: Math.round(node.w),
      h: Math.round(node.h),
    };
    if (node.locked) row.locked = true;
    if (node.hidden) row.hidden = true;
    const kids = getNodeChildren(node);
    if (kids) {
      row.children = summarizeNodeTree(kids);
    }
    return row;
  });
}

/**
 * Localiza o pai direto de um nó na árvore.
 * @param {BoardNode[]} nodes
 * @param {string} nodeId
 * @returns {{ found: boolean, parent: BoardNode | null, parentId: string | null }}
 */
export function findNodeParentInfo(nodes, nodeId) {
  /**
   * @param {BoardNode[]} list
   * @param {BoardNode | null} parent
   */
  function walk(list, parent) {
    for (const n of list) {
      if (n.id === nodeId) {
        return { found: true, parent, parentId: parent?.id ?? null };
      }
      const kids = getNodeChildren(n);
      if (kids?.length) {
        const res = walk(kids, n);
        if (res.found) return res;
      }
    }
    return { found: false, parent: null, parentId: null };
  }
  return walk(nodes, null);
}

/**
 * Remove groups vazios (ex.: após reparent tirar o último filho).
 * @param {BoardNode[]} nodes
 * @returns {BoardNode[]}
 */
export function pruneEmptyGroups(nodes) {
  /**
   * @param {BoardNode[]} list
   * @returns {BoardNode[]}
   */
  function walk(list) {
    /** @type {BoardNode[]} */
    const next = [];
    for (const n of list) {
      const kids = getNodeChildren(n);
      if (kids?.length) {
        const childNext = walk(kids);
        if (childNext.length === 0 && n.type === 'group') continue;
        if (childNext !== kids) {
          next.push(refreshGroupBounds({ ...n, children: childNext }));
          continue;
        }
      } else if (n.type === 'group') {
        continue;
      }
      next.push(n);
    }
    return next;
  }
  return walk(nodes);
}

/**
 * Move nó para outro grupo (ou raiz se parentId null).
 * Não permite mover um grupo para dentro de si mesmo.
 * @param {BoardNode[]} nodes
 * @param {string} nodeId
 * @param {string | null} parentId
 * @returns {{ nodes: BoardNode[], ok: boolean, error?: string }}
 */
export function reparentNode(nodes, nodeId, parentId = null) {
  const node = findNodeById(nodes, nodeId);
  if (!node) return { nodes, ok: false, error: `Nó não encontrado: ${nodeId}` };

  if (parentId) {
    if (parentId === nodeId) {
      return { nodes, ok: false, error: 'Não é possível reparentar para si mesmo' };
    }
    const parent = findNodeById(nodes, parentId);
    if (!parent || !isContainerNode(parent)) {
      return { nodes, ok: false, error: `Grupo pai não encontrado: ${parentId}` };
    }
    if (isContainerNode(node) && containsNodeId(getNodeChildren(node) || [], parentId)) {
      return {
        nodes,
        ok: false,
        error: 'Não é possível mover um grupo para dentro de um descendente',
      };
    }
  }

  const removed = removeNodeFromTree(nodes, nodeId);
  if (!removed.removed) return { nodes, ok: false, error: `Nó não encontrado: ${nodeId}` };

  const inserted = insertNodeInTree(removed.nodes, removed.removed, parentId);
  if (!inserted.inserted) {
    return { nodes: removed.nodes, ok: false, error: 'Falha ao inserir no novo pai' };
  }
  return { nodes: pruneEmptyGroups(inserted.nodes), ok: true };
}

/**
 * Label amigável para o painel Camadas.
 * @param {BoardNode} node
 */
export function layerLabel(node) {
  if (node.name) return node.name;
  if (node.type === 'group') return node.id;
  if (node.type === 'component') return 'Componente';
  if (node.type === 'instance') return 'Instância';
  if (node.type === 'text' && node.text) {
    const t = node.text.replace(/\s+/g, ' ').trim();
    return t.length > 28 ? `${t.slice(0, 28)}…` : t;
  }
  if (node.type === 'button' && node.label) return node.label;
  return node.id;
}

/** @param {string} [prefix] */
export function cryptoRandomId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/**
 * @param {Object} [opts]
 * @param {string} [opts.name]
 * @param {string} [opts.id]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {string} [opts.background]
 * @param {number} [opts.x]
 * @param {number} [opts.y]
 * @param {Board} [opts.board] board atual para auto-posição
 * @returns {Screen}
 */
export function createScreen(opts = {}) {
  const width = opts.width || DEFAULT_PHONE.width;
  const height = opts.height || DEFAULT_PHONE.height;
  let x = opts.x;
  let y = opts.y;
  if (x === undefined || y === undefined) {
    const screens = opts.board?.screens || [];
    x =
      x ??
      screens.reduce(
        (acc, s) =>
          Math.max(acc, (Number.isFinite(s.x) ? s.x : 0) + s.width + SCREEN_GAP),
        0,
      );
    y = y ?? 0;
  }
  return {
    id: opts.id || cryptoRandomId('screen'),
    name: opts.name || 'Nova tela',
    width,
    height,
    background: opts.background || '#FFFFFF',
    x,
    y,
    nodes: [],
  };
}
