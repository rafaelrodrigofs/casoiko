/**
 * Componentes reutilizáveis (Fase 4 — Plano C).
 * Árvores de variante usam coordenadas LOCAIS (origem em 0,0).
 * Instâncias referenciam componentId + variantId e posicionam com x/y absolutos.
 */

import {
  cryptoRandomId,
  normalizeNode,
  cloneNodeTree,
  boundsFromChildren,
  shiftNodeTree,
  findNodeById,
  getNodeChildren,
  updateNodeInTree,
} from './schema.js';

/**
 * @typedef {import('./schema.js').BoardNode} BoardNode
 */

/**
 * @typedef {Object} ComponentVariant
 * @property {string} id
 * @property {string} name
 * @property {BoardNode} root - árvore em coordenadas locais
 */

/**
 * @typedef {Object} ComponentDef
 * @property {string} id
 * @property {string} name
 * @property {ComponentVariant[]} variants
 */

/**
 * @typedef {Object} InstanceNode
 * @property {string} id
 * @property {'instance'} type
 * @property {string} componentId
 * @property {string} variantId
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} [name]
 */

/**
 * AABB eixo-alinhado de um retângulo com rotação (pivô no centro).
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} [rotation]
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function rotatedRectAabb(x, y, w, h, rotation) {
  const width = Math.max(0, Number(w) || 0);
  const height = Math.max(0, Number(h) || 0);
  const deg = Number(rotation) || 0;
  if (!deg) {
    return { x, y, w: Math.max(1, width), h: Math.max(1, height) };
  }
  const rad = (deg * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of corners) {
    const dx = px - cx;
    const dy = py - cy;
    const rx = cx + dx * cos - dy * sin;
    const ry = cy + dx * sin + dy * cos;
    minX = Math.min(minX, rx);
    minY = Math.min(minY, ry);
    maxX = Math.max(maxX, rx);
    maxY = Math.max(maxY, ry);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

/**
 * Une vários AABBs.
 * @param {{ x: number, y: number, w: number, h: number }[]} boxes
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
function unionAabb(boxes) {
  if (!boxes.length) {
    return { x: 0, y: 0, w: 100, h: 40 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(1, maxX - minX),
    h: Math.max(1, maxY - minY),
  };
}

/**
 * AABB eixo-alinhado da árvore (inclui rotação dos nós).
 * Usado para dimensionar/alinhar instâncias ao visual.
 * @param {BoardNode} node
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function localTreeAabb(node) {
  if (!node) {
    return { x: 0, y: 0, w: 100, h: 40 };
  }
  if (node.type === 'group') {
    const children = node.children || [];
    if (!children.length) {
      return rotatedRectAabb(
        Number(node.x) || 0,
        Number(node.y) || 0,
        Number(node.w) || 0,
        Number(node.h) || 0,
        node.rotation,
      );
    }
    const inner = unionAabb(children.map((c) => localTreeAabb(c)));
    if (node.rotation) {
      return rotatedRectAabb(inner.x, inner.y, inner.w, inner.h, node.rotation);
    }
    return inner;
  }
  return rotatedRectAabb(
    Number(node.x) || 0,
    Number(node.y) || 0,
    Number(node.w) || 0,
    Number(node.h) || 0,
    node.rotation,
  );
}

/**
 * Converte nós absolutos em uma raiz local (AABB em 0,0).
 * Um nó → raiz deslocada; vários → group em 0,0 com filhos locais.
 * @param {BoardNode[]} nodes
 * @returns {BoardNode}
 */
function absoluteNodesToLocalRoot(nodes) {
  if (!nodes.length) {
    return normalizeNode({
      type: 'rect',
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      fill: '#E5E7EB',
    });
  }
  const clones = nodes.map((n) => cloneNodeTree(normalizeNode(n)));
  const b = unionAabb(clones.map((c) => localTreeAabb(c)));
  if (clones.length === 1) {
    return normalizeNode(shiftNodeTree(clones[0], -b.x, -b.y));
  }
  return normalizeNode({
    type: 'group',
    name: 'Component',
    x: 0,
    y: 0,
    w: b.w,
    h: b.h,
    children: clones.map((c) => shiftNodeTree(c, -b.x, -b.y)),
  });
}

/**
 * Aceita uma raiz (já local ou absoluta) ou lista de nós absolutos.
 * @param {BoardNode | BoardNode[]} sourceNodesOrRoot
 * @returns {BoardNode}
 */
function toLocalRoot(sourceNodesOrRoot) {
  if (Array.isArray(sourceNodesOrRoot)) {
    return absoluteNodesToLocalRoot(sourceNodesOrRoot);
  }
  const clone = cloneNodeTree(normalizeNode(sourceNodesOrRoot));
  const aabb = localTreeAabb(clone);
  return normalizeNode(shiftNodeTree(clone, -aabb.x, -aabb.y));
}

/**
 * Extrai irmãos selecionados (mesmo padrão de groupSiblingNodes).
 * @param {BoardNode[]} nodes
 * @param {string[]} ids
 * @returns {{ remaining: BoardNode[], taken: BoardNode[], removedIds: string[] } | null}
 */
function extractSiblingNodes(nodes, ids) {
  const idSet = new Set((ids || []).filter(Boolean));
  if (idSet.size === 0) return null;

  /**
   * @param {BoardNode[]} list
   * @returns {{ remaining: BoardNode[], taken: BoardNode[], removedIds: string[] } | null}
   */
  function tryExtract(list) {
    const taken = list.filter((n) => idSet.has(n.id));
    if (taken.length === idSet.size) {
      const remaining = list.filter((n) => !idSet.has(n.id));
      return {
        remaining,
        taken,
        removedIds: taken.map((n) => n.id),
      };
    }

    for (let i = 0; i < list.length; i += 1) {
      const n = list[i];
      const kids = getNodeChildren(n);
      if (!kids) continue;
      const res = tryExtract(kids);
      if (!res) continue;
      const next = [...list];
      const childBounds = res.remaining.length
        ? boundsFromChildren(res.remaining)
        : { x: n.x, y: n.y, w: n.w, h: n.h };
      next[i] = {
        ...n,
        children: res.remaining,
        x: childBounds.x,
        y: childBounds.y,
        w: childBounds.w,
        h: childBounds.h,
      };
      return {
        remaining: next,
        taken: res.taken,
        removedIds: res.removedIds,
      };
    }
    return null;
  }

  return tryExtract(nodes);
}

/**
 * @param {unknown} variant
 * @returns {ComponentVariant}
 */
function normalizeVariant(variant) {
  const v = /** @type {Record<string, unknown>} */ (variant || {});
  return {
    id: String(v.id || cryptoRandomId('variant')),
    name: String(v.name || 'Default'),
    root: normalizeNode(v.root || { type: 'rect', x: 0, y: 0, w: 100, h: 40 }),
  };
}

/**
 * Normaliza a lista de componentes do board.
 * @param {unknown} list
 * @returns {ComponentDef[]}
 */
export function normalizeComponents(list) {
  if (!Array.isArray(list)) return [];
  return list.map((raw) => {
    const c = /** @type {Record<string, unknown>} */ (raw || {});
    const variants = Array.isArray(c.variants)
      ? c.variants.map(normalizeVariant)
      : [
          normalizeVariant({
            name: 'Default',
            root: { type: 'rect', x: 0, y: 0, w: 100, h: 40 },
          }),
        ];
    return {
      id: String(c.id || cryptoRandomId('component')),
      name: String(c.name || 'Component'),
      variants,
    };
  });
}

/**
 * Cria um componente a partir de nós irmãos selecionados.
 * O selecionado vira o PRINCIPAL no canvas (type: component); a def fica na biblioteca.
 * Duplicar o principal gera instância.
 * @param {BoardNode[]} nodes
 * @param {string[]} selectedIds
 * @param {string} [name]
 * @returns {{
 *   component: ComponentDef | null,
 *   mainNode: BoardNode | null,
 *   remainingNodes: BoardNode[],
 *   removedIds: string[],
 *   origin?: { x: number, y: number },
 * }}
 */
export function createComponentFromNodes(nodes, selectedIds, name) {
  const extracted = extractSiblingNodes(nodes, selectedIds);
  if (!extracted || !extracted.taken.length) {
    return {
      component: null,
      mainNode: null,
      remainingNodes: nodes,
      removedIds: [],
    };
  }

  const takenNorm = extracted.taken.map((n) => normalizeNode(n));
  const originAabb = unionAabb(takenNorm.map((n) => localTreeAabb(n)));
  const root = absoluteNodesToLocalRoot(extracted.taken);
  const componentId = cryptoRandomId('component');
  const variantId = cryptoRandomId('variant');
  const componentName =
    name && String(name).trim()
      ? String(name).trim()
      : takenNorm.length === 1 && takenNorm[0].name
        ? String(takenNorm[0].name)
        : 'Component';

  /** @type {ComponentDef} */
  const component = {
    id: componentId,
    name: componentName,
    variants: [
      {
        id: variantId,
        name: 'Default',
        root,
      },
    ],
  };

  /** @type {BoardNode} */
  const mainNode = normalizeNode({
    type: 'component',
    id: cryptoRandomId('component_main'),
    name: componentName,
    componentId,
    variantId,
    x: originAabb.x,
    y: originAabb.y,
    w: originAabb.w,
    h: originAabb.h,
    children: takenNorm,
  });

  const remainingNodes = replaceTakenWithMain(nodes, selectedIds, mainNode);

  return {
    component,
    mainNode,
    remainingNodes,
    removedIds: extracted.removedIds,
    origin: { x: originAabb.x, y: originAabb.y },
  };
}

/**
 * Substitui os irmãos selecionados pelo main no mesmo slot.
 * @param {BoardNode[]} nodes
 * @param {string[]} selectedIds
 * @param {BoardNode} mainNode
 * @returns {BoardNode[]}
 */
function replaceTakenWithMain(nodes, selectedIds, mainNode) {
  const idSet = new Set((selectedIds || []).filter(Boolean));

  /**
   * @param {BoardNode[]} list
   * @returns {BoardNode[]}
   */
  function walk(list) {
    const taken = list.filter((n) => idSet.has(n.id));
    if (taken.length === idSet.size && taken.length > 0) {
      /** @type {BoardNode[]} */
      const next = [];
      let inserted = false;
      for (const n of list) {
        if (idSet.has(n.id)) {
          if (!inserted) {
            next.push(mainNode);
            inserted = true;
          }
        } else {
          next.push(n);
        }
      }
      return next;
    }

    return list.map((n) => {
      const kids = getNodeChildren(n);
      if (!kids) return n;
      const childNext = walk(kids);
      if (childNext === kids) return n;
      const b = childNext.length
        ? boundsFromChildren(childNext)
        : { x: n.x, y: n.y, w: n.w, h: n.h };
      return {
        ...n,
        children: childNext,
        x: b.x,
        y: b.y,
        w: b.w,
        h: b.h,
      };
    });
  }

  return walk(nodes);
}

/**
 * Atualiza a variante Default a partir do main no canvas.
 * @param {ComponentDef[]} components
 * @param {BoardNode} mainNode
 * @returns {ComponentDef[]}
 */
export function syncComponentDefFromMain(components, mainNode) {
  if (!mainNode || mainNode.type !== 'component' || !mainNode.componentId) {
    return components;
  }
  const kids = getNodeChildren(mainNode) || [];
  const root = absoluteNodesToLocalRoot(kids);
  return (components || []).map((c) => {
    if (c.id !== mainNode.componentId) return c;
    const variantId = mainNode.variantId;
    const variants = (c.variants || []).map((v, i) => {
      if (variantId ? v.id === variantId : i === 0) {
        return { ...v, root };
      }
      return v;
    });
    return {
      ...c,
      name: mainNode.name || c.name,
      variants,
    };
  });
}

/**
 * Percorre o board e sincroniza defs a partir de todos os mains.
 * Também atualiza w/h das instâncias para acompanhar o tamanho do principal
 * (cor, radius, filhos etc. já vêm do root resolvido no render).
 * @param {{ components?: ComponentDef[], screens?: { nodes?: BoardNode[] }[] }} board
 */
export function syncAllComponentDefs(board) {
  let components = Array.isArray(board.components) ? [...board.components] : [];

  /** @param {BoardNode[]} nodes */
  function walkMains(nodes) {
    for (const node of nodes || []) {
      if (node.type === 'component') {
        components = syncComponentDefFromMain(components, node);
      }
      const kids = getNodeChildren(node);
      if (kids) walkMains(kids);
    }
  }

  for (const screen of board.screens || []) {
    walkMains(screen.nodes || []);
  }

  const screens = (board.screens || []).map((screen) => ({
    ...screen,
    nodes: syncInstanceSizesToDefs(screen.nodes || [], components),
  }));

  return { ...board, components, screens };
}

/**
 * Ajusta w/h de cada instance ao AABB atual da variante (espelha resize do main).
 * @param {BoardNode[]} nodes
 * @param {ComponentDef[]} components
 * @returns {BoardNode[]}
 */
function syncInstanceSizesToDefs(nodes, components) {
  return (nodes || []).map((node) => {
    if (node.type === 'instance') {
      const def = (components || []).find((c) => c.id === node.componentId);
      const variant = def ? findVariant(def, node.variantId) : null;
      if (!variant?.root) return node;
      const aabb = localTreeAabb(variant.root);
      const w = Math.max(1, Number(aabb.w) || node.w);
      const h = Math.max(1, Number(aabb.h) || node.h);
      if (w === node.w && h === node.h) return node;
      return { ...node, w, h };
    }
    const kids = getNodeChildren(node);
    if (kids) {
      const children = syncInstanceSizesToDefs(kids, components);
      if (children === kids) return node;
      return { ...node, children };
    }
    return node;
  });
}

/**
 * Se o nó for main component, devolve uma instância; senão clona.
 * @param {BoardNode} node
 * @param {ComponentDef[]} components
 * @param {number} [dx]
 * @param {number} [dy]
 * @returns {BoardNode}
 */
export function cloneOrInstantiate(node, components, dx = 0, dy = 0) {
  if (node.type === 'component') {
    const def = (components || []).find((c) => c.id === node.componentId);
    if (def) {
      return createInstance(def, node.variantId, node.x + dx, node.y + dy);
    }
  }
  return shiftNodeTree(cloneNodeTree(node), dx, dy);
}

/**
 * Após duplicateSiblingNodes, troca clones de main por instâncias.
 * @param {BoardNode[]} nodes
 * @param {string[]} clonedIds
 * @param {ComponentDef[]} components
 * @returns {{ nodes: BoardNode[], ids: string[] }}
 */
export function replaceDuplicatedMainsWithInstances(
  nodes,
  clonedIds,
  components,
) {
  let next = nodes;
  const ids = [];
  for (const id of clonedIds || []) {
    const node = findNodeById(next, id);
    if (node?.type === 'component') {
      const def = (components || []).find((c) => c.id === node.componentId);
      if (def) {
        const inst = createInstance(def, node.variantId, node.x, node.y);
        if (node.name) inst.name = node.name;
        const res = updateNodeInTree(next, id, () => inst);
        if (res.updated) {
          next = res.nodes;
          ids.push(inst.id);
          continue;
        }
      }
    }
    ids.push(id);
  }
  return { nodes: next, ids };
}

/**
 * Adiciona uma variante a partir de uma árvore (local ou absoluta).
 * @param {ComponentDef} component
 * @param {BoardNode | BoardNode[]} sourceNodesOrRoot
 * @param {string} [name]
 * @returns {ComponentDef}
 */
export function addComponentVariant(component, sourceNodesOrRoot, name) {
  const root = toLocalRoot(sourceNodesOrRoot);
  const variantName =
    name && String(name).trim()
      ? String(name).trim()
      : `Variant ${component.variants.length + 1}`;
  /** @type {ComponentVariant} */
  const variant = {
    id: cryptoRandomId('variant'),
    name: variantName,
    root,
  };
  return {
    ...component,
    variants: [...component.variants, variant],
  };
}

/**
 * @param {ComponentDef} component
 * @param {string} [variantId]
 * @returns {ComponentVariant | null}
 */
function findVariant(component, variantId) {
  if (!component?.variants?.length) return null;
  if (variantId) {
    const found = component.variants.find((v) => v.id === variantId);
    if (found) return found;
  }
  return component.variants[0] || null;
}

/**
 * Cria um nó instance posicionado em (x, y).
 * @param {ComponentDef} component
 * @param {string} [variantId]
 * @param {number} x
 * @param {number} y
 * @returns {InstanceNode}
 */
export function createInstance(component, variantId, x, y) {
  const variant = findVariant(component, variantId);
  const root = variant?.root;
  const aabb = root ? localTreeAabb(root) : { w: 100, h: 40 };
  /** @type {InstanceNode} */
  const instance = {
    id: cryptoRandomId('instance'),
    type: 'instance',
    componentId: component.id,
    variantId: variant?.id || String(variantId || ''),
    x: Number(x) || 0,
    y: Number(y) || 0,
    w: Math.max(1, Number(aabb.w) || 100),
    h: Math.max(1, Number(aabb.h) || 40),
  };
  if (component.name) instance.name = component.name;
  return instance;
}

/**
 * Troca a variante da instance e atualiza w/h.
 * @param {InstanceNode} instance
 * @param {ComponentDef} component
 * @param {string} variantId
 * @returns {InstanceNode}
 */
export function switchInstanceVariant(instance, component, variantId) {
  const variant = findVariant(component, variantId);
  if (!variant) {
    return { ...instance, variantId };
  }
  const aabb = localTreeAabb(variant.root);
  return {
    ...instance,
    variantId: variant.id,
    w: Math.max(1, Number(aabb.w) || 100),
    h: Math.max(1, Number(aabb.h) || 40),
  };
}

/**
 * Placeholder quando componente/variante está ausente.
 * @param {Pick<InstanceNode, 'id'|'x'|'y'|'w'|'h'>} instance
 * @returns {BoardNode}
 */
function missingPlaceholder(instance) {
  return normalizeNode({
    id: instance.id || cryptoRandomId('missing'),
    type: 'rect',
    name: 'Missing component',
    x: Number(instance.x) || 0,
    y: Number(instance.y) || 0,
    w: Math.max(1, Number(instance.w) || 100),
    h: Math.max(1, Number(instance.h) || 40),
    fill: '#F1F5F9',
  });
}

/**
 * Resolve a instance para uma árvore absoluta (detach).
 * @param {InstanceNode} instance
 * @param {ComponentDef | null | undefined} component
 * @returns {BoardNode}
 */
export function detachInstance(instance, component) {
  const variant = component
    ? findVariant(component, instance.variantId)
    : null;
  if (!variant?.root) {
    return missingPlaceholder(instance);
  }
  const clone = cloneNodeTree(variant.root);
  const aabb = localTreeAabb(clone);
  return normalizeNode(
    shiftNodeTree(clone, instance.x - aabb.x, instance.y - aabb.y),
  );
}

/**
 * Resolve a instance para renderização a partir da lista de componentes.
 * @param {InstanceNode} instance
 * @param {ComponentDef[]} components
 * @returns {BoardNode}
 */
export function resolveInstanceTree(instance, components) {
  const list = Array.isArray(components) ? components : [];
  const def = list.find((c) => c.id === instance.componentId);
  if (!def) {
    return missingPlaceholder(instance);
  }
  return detachInstance(instance, def);
}
