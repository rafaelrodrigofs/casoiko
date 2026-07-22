import {
  addComponentVariant,
  createComponentFromNodes,
  createInstance,
  detachInstance,
  replaceDuplicatedMainsWithInstances,
  switchInstanceVariant,
  syncAllComponentDefs,
} from './components.js';
import {
  containsNodeId,
  createScreen,
  duplicateSiblingNodes,
  findNodeById,
  groupSiblingNodes,
  isContainerNode,
  moveNodeBy,
  normalizeConstraints,
  normalizeNode,
  removeNodeFromTree,
  reorderSiblingNode,
  reparentNode,
  resizeScreenWithConstraints,
  scrubBoardRefs,
  updateNodeInTree,
  boundsFromChildren,
} from './schema.js';
import { applyAutoLayout } from './autoLayout.js';

/**
 * Aplica uma lista de operações atômicas em memória.
 * @param {import('./schema.js').Board} board
 * @param {Array<Record<string, unknown>>} operations
 * @returns {import('./schema.js').Board}
 */
export function applyBoardOperations(board, operations) {
  if (!Array.isArray(operations) || !operations.length) {
    throw new Error('operations deve ser um array não vazio');
  }

  let next = structuredClone
    ? structuredClone(board)
    : JSON.parse(JSON.stringify(board));

  for (const op of operations) {
    const type = String(op?.type || '');
    switch (type) {
      case 'create_screen': {
        const created = createScreen({
          name: String(op.name || 'Frame'),
          id: op.id ? String(op.id) : undefined,
          width: op.width != null ? Number(op.width) : undefined,
          height: op.height != null ? Number(op.height) : undefined,
          background: op.background ? String(op.background) : undefined,
          x: op.x != null ? Number(op.x) : undefined,
          y: op.y != null ? Number(op.y) : undefined,
          board: next,
        });
        next.screens.push(created);
        break;
      }
      case 'delete_screen': {
        const screenId = String(op.screenId || '');
        next.screens = next.screens.filter((s) => s.id !== screenId);
        next.prototypes = (next.prototypes || []).filter(
          (p) => p.fromScreenId !== screenId && p.toScreenId !== screenId,
        );
        next.comments = (next.comments || []).filter(
          (c) => c.screenId !== screenId,
        );
        break;
      }
      case 'update_screen': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        if (op.name != null) screen.name = String(op.name);
        if (op.background != null) screen.background = String(op.background);
        if (op.width != null || op.height != null) {
          Object.assign(
            screen,
            resizeScreenWithConstraints(
              screen,
              op.width != null ? Number(op.width) : screen.width,
              op.height != null ? Number(op.height) : screen.height,
            ),
          );
        }
        break;
      }
      case 'clear_screen': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        screen.nodes = [];
        break;
      }
      case 'add_node': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const node = normalizeNode(op.node || op);
        insertNode(screen.nodes, node, op.parentId ? String(op.parentId) : undefined);
        break;
      }
      case 'update_node': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const patch = /** @type {Record<string, unknown>} */ (op.patch || {});
        const res = updateNodeInTree(screen.nodes, String(op.nodeId), (prev) => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(patch)) {
            if (k === 'id' || k === 'type' || k === 'children') continue;
            if (v === null) delete merged[k];
            else merged[k] = v;
          }
          return normalizeNode(merged);
        });
        if (!res.updated) throw new Error(`Nó não encontrado: ${op.nodeId}`);
        screen.nodes = res.nodes;
        break;
      }
      case 'delete_node': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const res = removeNodeFromTree(screen.nodes, String(op.nodeId));
        if (!res.removed) throw new Error(`Nó não encontrado: ${op.nodeId}`);
        screen.nodes = res.nodes;
        break;
      }
      case 'move_node': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        let nodes = screen.nodes;
        const nodeId = String(op.nodeId);
        if (op.parentId !== undefined) {
          const res = reparentNode(
            nodes,
            nodeId,
            op.parentId === null ? null : String(op.parentId),
          );
          if (!res.ok) throw new Error(res.error || 'Falha no reparent');
          nodes = res.nodes;
        }
        if ((op.dx && op.dx !== 0) || (op.dy && op.dy !== 0)) {
          const res = moveNodeBy(nodes, nodeId, Number(op.dx) || 0, Number(op.dy) || 0);
          if (!res.updated) throw new Error(`Nó não encontrado: ${nodeId}`);
          nodes = res.nodes;
        }
        if (op.zDelta && op.zDelta !== 0) {
          const res = reorderSiblingNode(nodes, nodeId, Number(op.zDelta));
          if (!res.ok) throw new Error('Falha no z-order');
          nodes = res.nodes;
        }
        screen.nodes = nodes;
        break;
      }
      case 'batch_update': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        let nodes = screen.nodes;
        const updates = Array.isArray(op.updates) ? op.updates : [];
        for (const u of updates) {
          const res = updateNodeInTree(nodes, String(u.nodeId), (prev) => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(u.patch || {})) {
              if (k === 'id' || k === 'type' || k === 'children') continue;
              if (v === null) delete merged[k];
              else merged[k] = v;
            }
            return normalizeNode(merged);
          });
          if (!res.updated) throw new Error(`Nó não encontrado: ${u.nodeId}`);
          nodes = res.nodes;
        }
        screen.nodes = nodes;
        break;
      }
      case 'group_nodes': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const ids = Array.isArray(op.nodeIds) ? op.nodeIds.map(String) : [];
        const result = groupSiblingNodes(screen.nodes, ids);
        if (!result.groupId) throw new Error('Não foi possível agrupar');
        screen.nodes = result.nodes;
        if (op.name) {
          const res = updateNodeInTree(screen.nodes, result.groupId, (n) => ({
            ...n,
            name: String(op.name),
          }));
          screen.nodes = res.nodes;
        }
        break;
      }
      case 'duplicate_node': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const nodeId = String(op.nodeId);
        if (!containsNodeId(screen.nodes, nodeId)) {
          throw new Error(`Nó não encontrado: ${nodeId}`);
        }
        const result = duplicateSiblingNodes(
          screen.nodes,
          [nodeId],
          op.offset != null ? Number(op.offset) : 16,
        );
        const replaced = replaceDuplicatedMainsWithInstances(
          result.nodes,
          result.clonedIds,
          next.components || [],
        );
        screen.nodes = replaced.nodes;
        break;
      }
      case 'set_constraints': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const nodeId = String(op.nodeId);
        if (!screen.nodes.some((n) => n.id === nodeId)) {
          throw new Error('Constraints só na raiz da tela');
        }
        const res = updateNodeInTree(screen.nodes, nodeId, (n) => ({
          ...n,
          constraints: normalizeConstraints({
            ...n.constraints,
            ...(op.constraints || {}),
          }),
        }));
        if (!res.updated) throw new Error(`Nó não encontrado: ${nodeId}`);
        screen.nodes = res.nodes;
        break;
      }
      case 'auto_layout': {
        const screen = next.screens.find((s) => s.id === op.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${op.screenId}`);
        const groupId = String(op.nodeId || op.groupId || '');
        const group = findNodeById(screen.nodes, groupId);
        if (!group || !isContainerNode(group)) {
          throw new Error(`Group não encontrado: ${groupId}`);
        }
        const laid = applyAutoLayout(group.children || [], {
          direction: op.direction,
          gap: op.gap,
          padding: op.padding,
          align: op.align,
        });
        group.children = laid.children;
        group.w = laid.bounds.w;
        group.h = laid.bounds.h;
        break;
      }
      case 'set_tokens': {
        next.tokens = {
          ...(next.tokens || {}),
          ...(op.tokens && typeof op.tokens === 'object' ? op.tokens : {}),
        };
        break;
      }
      default:
        throw new Error(`Operação desconhecida: ${type}`);
    }
  }

  return syncAllComponentDefs(scrubBoardRefs(next));
}

/**
 * @param {import('./schema.js').BoardNode[]} nodes
 * @param {import('./schema.js').BoardNode} node
 * @param {string} [parentId]
 */
function insertNode(nodes, node, parentId) {
  if (!parentId) {
    nodes.push(node);
    return;
  }
  const parent = findNodeById(nodes, parentId);
  if (!parent || !isContainerNode(parent)) {
    throw new Error(`Container pai não encontrado: ${parentId}`);
  }
  parent.children.push(node);
  const b = boundsFromChildren(parent.children);
  parent.x = b.x;
  parent.y = b.y;
  parent.w = b.w;
  parent.h = b.h;
}
