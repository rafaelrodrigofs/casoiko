/** @typedef {'rect' | 'text' | 'button' | 'image' | 'group'} NodeType */

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
 * @property {number} [cornerRadius]
 * @property {number} [bottomRadius] - se definido, arredonda só a base (hero)
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
 * @property {number} [opacity]
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
 * @property {string} [textColor]
 * @property {number} [cornerRadius]
 * @property {number} [fontSize]
 * @property {number} [fontWeight]
 * @property {string} [iconSrc]
 * @property {string} [stroke]
 * @property {number} [strokeWidth]
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
 */

/** @typedef {RectNode | TextNode | ButtonNode | ImageNode | GroupNode} BoardNode */

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
 */

export const DEFAULT_PHONE = { width: 390, height: 844 };
export const SCREEN_GAP = 80;

/** @returns {Board} */
export function emptyBoard() {
  return { version: 1, revision: 0, screens: [] };
}

/**
 * @param {unknown} data
 * @returns {Board}
 */
export function normalizeBoard(data) {
  if (!data || typeof data !== 'object') return emptyBoard();
  const raw = /** @type {Record<string, unknown>} */ (data);
  const screens = Array.isArray(raw.screens) ? raw.screens : [];
  const board = {
    version: typeof raw.version === 'number' ? raw.version : 1,
    revision:
      typeof raw.revision === 'number' && Number.isFinite(raw.revision)
        ? Math.max(0, Math.floor(raw.revision))
        : 0,
    screens: screens.map((s) => normalizeScreen(s)),
  };
  return applyScreenLayout(board);
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
    node.type === 'group'
      ? node.type
      : 'rect';

  if (type === 'group') {
    const children = Array.isArray(node.children)
      ? node.children.map((c) => normalizeNode(c))
      : [];
    const bounds = boundsFromChildren(children);
    const hasBox =
      Number.isFinite(Number(node.x)) &&
      Number.isFinite(Number(node.y)) &&
      Number.isFinite(Number(node.w)) &&
      Number.isFinite(Number(node.h));
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
    return textNode;
  }

  if (type === 'button') {
    /** @type {ButtonNode} */
    const btn = {
      ...base,
      type: 'button',
      label: String(node.label ?? 'Button'),
      fill: String(node.fill || '#1B355A'),
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
      btn.strokeWidth = Number(node.strokeWidth) || 1;
    }
    return btn;
  }

  if (type === 'image') {
    const fit =
      node.fit === 'cover' || node.fit === 'fill' ? node.fit : 'contain';
    return {
      ...base,
      type: 'image',
      src: String(node.src || ''),
      fit,
    };
  }

  /** @type {RectNode} */
  const rect = {
    ...base,
    type: 'rect',
    fill: String(node.fill || '#E5E7EB'),
    cornerRadius: Number(node.cornerRadius) || 0,
    opacity: node.opacity === undefined ? 1 : Number(node.opacity),
  };
  if (Number.isFinite(Number(node.bottomRadius)) && Number(node.bottomRadius) > 0) {
    rect.bottomRadius = Number(node.bottomRadius);
  }
  if (typeof node.stroke === 'string' && node.stroke.trim()) {
    rect.stroke = node.stroke.trim();
    rect.strokeWidth = Number(node.strokeWidth) || 1;
  }
  return rect;
}

/**
 * Folhas renderizáveis (rect/text/button), ordem de pintura.
 * @param {BoardNode[]} nodes
 * @returns {Exclude<BoardNode, GroupNode>[]}
 */
export function flattenLeaves(nodes) {
  /** @type {Exclude<BoardNode, GroupNode>[]} */
  const out = [];
  for (const node of nodes) {
    if (node.type === 'group') {
      out.push(...flattenLeaves(node.children));
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * @param {BoardNode[]} nodes
 * @param {string} id
 * @returns {BoardNode | null}
 */
export function findNodeById(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'group') {
      const found = findNodeById(node.children, id);
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
    if (node.type === 'group') {
      const res = updateNodeInTree(node.children, id, updater);
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
  if (node.type === 'group') {
    return {
      ...node,
      x: node.x + dx,
      y: node.y + dy,
      children: node.children.map((c) => shiftNodeTree(c, dx, dy)),
    };
  }
  return { ...node, x: node.x + dx, y: node.y + dy };
}

/**
 * Recalcula bounds de todos os grupos (coords absolutas dos filhos).
 * @param {BoardNode} node
 */
export function refreshGroupBounds(node) {
  if (node.type !== 'group') return node;
  const children = node.children.map(refreshGroupBounds);
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
  if (node.type === 'group') {
    return flattenLeaves(node.children).map((n) => n.id);
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
      if (n.type !== 'group') continue;
      const res = tryGroup(n.children);
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
      if (n.type === 'group') {
        const res = tryUngroup(n.children);
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
  if (node.type === 'group') {
    return {
      ...node,
      id: cryptoRandomId('group'),
      children: node.children.map(cloneNodeTree),
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
      if (n.type !== 'group') continue;
      const children = tryDup(n.children);
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
    if (n.type !== 'group') return n;
    return refreshGroupBounds({ ...n, children: [...n.children, node] });
  });
  if (!updated || updated.type !== 'group') {
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
    if (node.type === 'group') {
      const children = node.children.map((c) =>
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
    if (node.type === 'group') {
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
    if (n.type !== 'group' || !containsNodeId(n.children, id)) continue;
    const inner = reorderSiblingNode(n.children, id, delta);
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
    if (node.type === 'group') {
      const res = removeNodeFromTree(node.children, id);
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
    if (node.type === 'group') n += countNodes(node.children);
  }
  return n;
}

/**
 * Label amigável para o painel Camadas.
 * @param {BoardNode} node
 */
export function layerLabel(node) {
  if (node.name) return node.name;
  if (node.type === 'group') return node.id;
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
