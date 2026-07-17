#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  boundsFromChildren,
  containsNodeId,
  countNodes,
  createComponentFromNodes,
  createInstance,
  cryptoRandomId,
  createScreen,
  detachInstance,
  duplicateSiblingNodes,
  findNodeById,
  findScreen,
  groupSiblingNodes,
  isContainerNode,
  moveNodeBy,
  normalizeConstraints,
  normalizeNode,
  readBoard,
  removeNodeFromTree,
  reorderSiblingNode,
  reparentNode,
  replaceDuplicatedMainsWithInstances,
  resizeScreenWithConstraints,
  resolveBoardPath,
  scrubBoardRefs,
  screenToCss,
  screenToReact,
  summarizeNodeTree,
  switchInstanceVariant,
  syncAllComponentDefs,
  updateBoard,
  updateNodeInTree,
  addComponentVariant,
} from '../../core/src/index.js';

const boardPath = resolveBoardPath();

/**
 * @param {unknown} value
 */
function textResult(value) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

/**
 * @param {string} message
 */
function errorResult(message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

/**
 * Mutação + sync de componentes (igual commitBoard da UI).
 * @param {(board: import('../../core/src/schema.js').Board) => void} mutator
 */
function commitBoard(mutator) {
  return updateBoard((board) => {
    mutator(board);
    return syncAllComponentDefs(scrubBoardRefs(board));
  }, boardPath);
}

/**
 * Insere nó na raiz ou dentro de um group/component (parentId).
 * @param {import('../../core/src/schema.js').BoardNode[]} nodes
 * @param {import('../../core/src/schema.js').BoardNode} node
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

const server = new McpServer({
  name: 'figmashow',
  version: '0.1.0',
});

server.tool(
  'list_screens',
  'Lista id e nome de todas as telas do board FigmaShow',
  {},
  async () => {
    const board = readBoard(boardPath);
    return textResult(
      board.screens.map((s) => ({
        id: s.id,
        name: s.name,
        width: s.width,
        height: s.height,
        nodeCount: countNodes(s.nodes),
      })),
    );
  },
);

server.tool(
  'get_screen',
  'Retorna o JSON completo de uma tela',
  { screenId: z.string().describe('ID da tela') },
  async ({ screenId }) => {
    const board = readBoard(boardPath);
    const screen = findScreen(board, screenId);
    if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
    return textResult(screen);
  },
);

server.tool(
  'create_screen',
  'Cria uma nova tela mobile (default 390x844)',
  {
    name: z.string().describe('Nome da tela'),
    id: z.string().optional().describe('ID opcional (slug)'),
    width: z.number().optional(),
    height: z.number().optional(),
    background: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  },
  async ({ name, id, width, height, background, x, y }) => {
    let created;
    try {
      commitBoard((board) => {
        if (id && findScreen(board, id)) {
          throw new Error(`Já existe tela com id: ${id}`);
        }
        created = createScreen({
          name,
          id,
          width,
          height,
          background,
          x,
          y,
          board,
        });
        board.screens.push(created);
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(created);
  },
);

server.tool(
  'add_node',
  'Adiciona um nó (rect | text | button | image | group) em uma tela ou dentro de group/component (parentId)',
  {
    screenId: z.string(),
    type: z.enum(['rect', 'text', 'button', 'image', 'group']),
    x: z.number().optional().describe('Obrigatório exceto group vazio'),
    y: z.number().optional(),
    w: z.number().optional(),
    h: z.number().optional(),
    id: z.string().optional(),
    parentId: z
      .string()
      .optional()
      .describe('ID de um group ou componente principal pai'),
    fill: z.string().optional(),
    fillOpacity: z.number().min(0).max(1).optional(),
    stroke: z.string().optional(),
    strokeWidth: z.number().min(0).optional(),
    strokeOpacity: z.number().min(0).max(1).optional(),
    cornerRadius: z.number().optional(),
    rotation: z.number().optional().describe('Rotação em graus (0–360)'),
    opacity: z.number().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    color: z.string().optional(),
    align: z.enum(['left', 'center', 'right']).optional(),
    label: z.string().optional(),
    textColor: z.string().optional(),
    iconSrc: z.string().optional().describe('URL/ícone do botão'),
    src: z.string().optional().describe('URL da imagem (type=image)'),
    fit: z.enum(['cover', 'contain', 'fill']).optional(),
    name: z.string().optional().describe('Nome da camada (painel Camadas)'),
    children: z
      .array(z.record(z.unknown()))
      .optional()
      .describe('Filhos iniciais para type=group'),
  },
  async (args) => {
    let node;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, args.screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${args.screenId}`);
        if (args.id && containsNodeId(screen.nodes, args.id)) {
          throw new Error(`Já existe nó com id: ${args.id}`);
        }

        if (args.type === 'group') {
          node = normalizeNode({
            id: args.id || cryptoRandomId('group'),
            type: 'group',
            name: args.name,
            x: args.x,
            y: args.y,
            w: args.w,
            h: args.h,
            children: args.children || [],
          });
        } else {
          if (
            args.x === undefined ||
            args.y === undefined ||
            args.w === undefined ||
            args.h === undefined
          ) {
            throw new Error('x, y, w, h são obrigatórios para rect/text/button/image');
          }
          const base = {
            id: args.id || cryptoRandomId(args.type),
            type: args.type,
            x: args.x,
            y: args.y,
            w: args.w,
            h: args.h,
          };
          if (args.name) base.name = args.name;
          if (args.rotation != null) base.rotation = args.rotation;
          if (args.type === 'text') {
            node = {
              ...base,
              type: 'text',
              text: args.text ?? '',
              fontSize: args.fontSize ?? 16,
              fontWeight: args.fontWeight ?? 400,
              color: args.color ?? '#1A1D21',
              align: args.align ?? 'left',
            };
          } else if (args.type === 'button') {
            node = {
              ...base,
              type: 'button',
              label: args.label ?? 'Button',
              fill: args.fill ?? '#1B355A',
              fillOpacity: args.fillOpacity ?? 1,
              textColor: args.textColor ?? '#FFFFFF',
              cornerRadius: args.cornerRadius ?? 27,
              fontSize: args.fontSize ?? 16,
              fontWeight: args.fontWeight ?? 600,
            };
            if (args.iconSrc) node.iconSrc = args.iconSrc;
            if (args.stroke) {
              node.stroke = args.stroke;
              node.strokeWidth = args.strokeWidth ?? 1;
              node.strokeOpacity = args.strokeOpacity ?? 1;
            }
          } else if (args.type === 'image') {
            if (!args.src) throw new Error('src é obrigatório para type=image');
            node = {
              ...base,
              type: 'image',
              src: args.src,
              fit: args.fit ?? 'contain',
            };
          } else {
            node = {
              ...base,
              type: 'rect',
              fill: args.fill ?? '#E5E7EB',
              fillOpacity: args.fillOpacity ?? 1,
              cornerRadius: args.cornerRadius ?? 0,
              opacity: args.opacity ?? 1,
            };
            if (args.stroke) {
              node.stroke = args.stroke;
              node.strokeWidth = args.strokeWidth ?? 1;
              node.strokeOpacity = args.strokeOpacity ?? 1;
            }
          }
          node = normalizeNode(node);
        }
        insertNode(screen.nodes, node, args.parentId);
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(node);
  },
);

server.tool(
  'update_node',
  'Atualiza propriedades de um nó existente (busca em grupos aninhados)',
  {
    screenId: z.string(),
    nodeId: z.string(),
    patch: z
      .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .describe('Campos a atualizar (x, y, w, h, text, fill, name, etc.)'),
  },
  async ({ screenId, nodeId, patch }) => {
    let updated;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const res = updateNodeInTree(screen.nodes, nodeId, (prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(patch)) {
            if (key === 'id' || key === 'type' || key === 'children') continue;
            if (value === null) {
              delete next[key];
            } else {
              next[key] = value;
            }
          }
          return normalizeNode(next);
        });
        if (!res.updated) throw new Error(`Nó não encontrado: ${nodeId}`);
        screen.nodes = res.nodes;
        updated = res.updated;
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(updated);
  },
);

server.tool(
  'delete_node',
  'Remove um nó (ou grupo inteiro) de uma tela',
  {
    screenId: z.string(),
    nodeId: z.string(),
  },
  async ({ screenId, nodeId }) => {
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const res = removeNodeFromTree(screen.nodes, nodeId);
        if (!res.removed) throw new Error(`Nó não encontrado: ${nodeId}`);
        screen.nodes = res.nodes;
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, deleted: nodeId });
  },
);

server.tool(
  'clear_screen',
  'Remove todos os nós de uma tela (mantém o frame)',
  { screenId: z.string() },
  async ({ screenId }) => {
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        screen.nodes = [];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, screenId, nodes: [] });
  },
);

server.tool(
  'list_nodes',
  'Árvore resumida da tela (id, type, name, x/y/w/h, children) — use em vez de get_screen para inspecionar estrutura',
  { screenId: z.string() },
  async ({ screenId }) => {
    const board = readBoard(boardPath);
    const screen = findScreen(board, screenId);
    if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
    return textResult({
      screenId: screen.id,
      name: screen.name,
      width: screen.width,
      height: screen.height,
      nodeCount: countNodes(screen.nodes),
      nodes: summarizeNodeTree(screen.nodes),
    });
  },
);

server.tool(
  'duplicate_node',
  'Duplica um nó com offset. Se for componente principal, o clone vira instância.',
  {
    screenId: z.string(),
    nodeId: z.string(),
    offset: z.number().optional().describe('Offset em px (default 16)'),
  },
  async ({ screenId, nodeId, offset }) => {
    let clonedId;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        if (!containsNodeId(screen.nodes, nodeId)) {
          throw new Error(`Nó não encontrado: ${nodeId}`);
        }
        const result = duplicateSiblingNodes(
          screen.nodes,
          [nodeId],
          offset ?? 16,
        );
        if (!result.clonedIds.length) {
          throw new Error('Não foi possível duplicar o nó');
        }
        const replaced = replaceDuplicatedMainsWithInstances(
          result.nodes,
          result.clonedIds,
          board.components || [],
        );
        screen.nodes = replaced.nodes;
        clonedId = replaced.ids[0];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, sourceId: nodeId, clonedId });
  },
);

server.tool(
  'group_nodes',
  'Agrupa nós irmãos (mesmo pai) em um group',
  {
    screenId: z.string(),
    nodeIds: z.array(z.string()).min(1).describe('IDs dos nós a agrupar'),
    name: z.string().optional().describe('Nome do grupo'),
  },
  async ({ screenId, nodeIds, name }) => {
    let groupId;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const result = groupSiblingNodes(screen.nodes, nodeIds);
        if (!result.groupId) {
          throw new Error(
            'Só é possível agrupar irmãos (mesmo pai). Confira os IDs com list_nodes.',
          );
        }
        screen.nodes = result.nodes;
        groupId = result.groupId;
        if (name) {
          const res = updateNodeInTree(screen.nodes, groupId, (n) => ({
            ...n,
            name,
          }));
          screen.nodes = res.nodes;
        }
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, groupId, nodeIds });
  },
);

server.tool(
  'move_node',
  'Move nó: dx/dy, reparent (parentId) e/ou z-order (zDelta +1 frente / -1 trás)',
  {
    screenId: z.string(),
    nodeId: z.string(),
    dx: z.number().optional(),
    dy: z.number().optional(),
    parentId: z
      .union([z.string(), z.null()])
      .optional()
      .describe(
        'Novo pai (group ou component); null = raiz da tela; omitir = não reparentar',
      ),
    zDelta: z
      .number()
      .optional()
      .describe('+1 traz para frente entre irmãos, -1 envia para trás'),
  },
  async ({ screenId, nodeId, dx, dy, parentId, zDelta }) => {
    let node;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        if (!containsNodeId(screen.nodes, nodeId)) {
          throw new Error(`Nó não encontrado: ${nodeId}`);
        }

        let nodes = screen.nodes;

        if (parentId !== undefined) {
          const res = reparentNode(nodes, nodeId, parentId);
          if (!res.ok) throw new Error(res.error || 'Falha no reparent');
          nodes = res.nodes;
        }

        if ((dx && dx !== 0) || (dy && dy !== 0)) {
          const res = moveNodeBy(nodes, nodeId, dx || 0, dy || 0);
          if (!res.updated) throw new Error(`Nó não encontrado: ${nodeId}`);
          nodes = res.nodes;
        }

        if (zDelta && zDelta !== 0) {
          const res = reorderSiblingNode(nodes, nodeId, zDelta);
          if (!res.ok) {
            throw new Error('Não foi possível alterar o z-order do nó');
          }
          nodes = res.nodes;
        }

        screen.nodes = nodes;
        node = findNodeById(screen.nodes, nodeId);
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, node });
  },
);

server.tool(
  'batch_update',
  'Aplica vários patches de nós numa única gravação (uma revision)',
  {
    screenId: z.string(),
    updates: z
      .array(
        z.object({
          nodeId: z.string(),
          patch: z
            .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .describe('Campos a atualizar'),
        }),
      )
      .min(1),
  },
  async ({ screenId, updates }) => {
    /** @type {string[]} */
    const updatedIds = [];
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        let nodes = screen.nodes;
        for (const { nodeId, patch } of updates) {
          const res = updateNodeInTree(nodes, nodeId, (prev) => {
            const next = { ...prev };
            for (const [key, value] of Object.entries(patch)) {
              if (key === 'id' || key === 'type' || key === 'children') continue;
              if (value === null) delete next[key];
              else next[key] = value;
            }
            return normalizeNode(next);
          });
          if (!res.updated) {
            throw new Error(`Nó não encontrado: ${nodeId}`);
          }
          nodes = res.nodes;
          updatedIds.push(nodeId);
        }
        screen.nodes = nodes;
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, updatedIds, count: updatedIds.length });
  },
);

server.tool(
  'update_screen',
  'Atualiza nome, tamanho e/ou fundo de uma tela (W/H com constraints)',
  {
    screenId: z.string(),
    name: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    background: z.string().optional(),
  },
  async ({ screenId, name, width, height, background }) => {
    let screen;
    try {
      commitBoard((board) => {
        const s = findScreen(board, screenId);
        if (!s) throw new Error(`Tela não encontrada: ${screenId}`);
        if (name != null) s.name = name;
        if (background != null) s.background = background;
        if (width != null || height != null) {
          const next = resizeScreenWithConstraints(
            s,
            width ?? s.width,
            height ?? s.height,
          );
          Object.assign(s, next);
        }
        screen = { ...s };
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(screen);
  },
);

server.tool(
  'set_constraints',
  'Define constraints (pins L/R/T/B) de um nó raiz da tela',
  {
    screenId: z.string(),
    nodeId: z.string(),
    constraints: z.object({
      left: z.boolean().optional(),
      right: z.boolean().optional(),
      top: z.boolean().optional(),
      bottom: z.boolean().optional(),
    }),
  },
  async ({ screenId, nodeId, constraints }) => {
    let node;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const isRoot = screen.nodes.some((n) => n.id === nodeId);
        if (!isRoot) {
          throw new Error('Constraints só se aplicam a nós raiz da tela');
        }
        const res = updateNodeInTree(screen.nodes, nodeId, (n) => ({
          ...n,
          constraints: normalizeConstraints({
            ...n.constraints,
            ...constraints,
          }),
        }));
        if (!res.updated) throw new Error(`Nó não encontrado: ${nodeId}`);
        screen.nodes = res.nodes;
        node = findNodeById(screen.nodes, nodeId);
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(node);
  },
);

server.tool(
  'list_components',
  'Lista componentes reutilizáveis do board',
  {},
  async () => {
    const board = readBoard(boardPath);
    return textResult(board.components || []);
  },
);

server.tool(
  'create_component',
  'Converte nós irmãos em componente principal no canvas + def na biblioteca',
  {
    screenId: z.string(),
    nodeIds: z.array(z.string()).min(1),
    name: z.string().optional(),
  },
  async ({ screenId, nodeIds, name }) => {
    /** @type {{ component: unknown, mainNode: unknown } | null} */
    let payload = null;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const result = createComponentFromNodes(screen.nodes, nodeIds, name);
        if (!result.component || !result.mainNode) {
          throw new Error('Nós devem ser irmãos no mesmo nível');
        }
        screen.nodes = result.remainingNodes;
        board.components = [...(board.components || []), result.component];
        payload = {
          component: result.component,
          mainNode: result.mainNode,
        };
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(payload);
  },
);

server.tool(
  'add_component_variant',
  'Adiciona variante a um componente existente',
  {
    componentId: z.string(),
    name: z.string().optional(),
    root: z.record(z.unknown()).describe('Árvore raiz da variante (local)'),
  },
  async ({ componentId, name, root }) => {
    let variant;
    try {
      commitBoard((board) => {
        const idx = (board.components || []).findIndex(
          (c) => c.id === componentId,
        );
        if (idx < 0) throw new Error(`Componente não encontrado: ${componentId}`);
        const next = addComponentVariant(
          board.components[idx],
          normalizeNode(root),
          name,
        );
        board.components[idx] = next;
        variant = next.variants[next.variants.length - 1];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(variant);
  },
);

server.tool(
  'instantiate_component',
  'Insere uma instância de componente na tela',
  {
    screenId: z.string(),
    componentId: z.string(),
    variantId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
  },
  async ({ screenId, componentId, variantId, x, y }) => {
    let instance;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const def = (board.components || []).find((c) => c.id === componentId);
        if (!def) throw new Error(`Componente não encontrado: ${componentId}`);
        instance = createInstance(def, variantId, x ?? 0, y ?? 0);
        insertNode(screen.nodes, instance, undefined);
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(instance);
  },
);

server.tool(
  'set_instance_variant',
  'Troca a variante de uma instância',
  {
    screenId: z.string(),
    nodeId: z.string(),
    variantId: z.string(),
  },
  async ({ screenId, nodeId, variantId }) => {
    let node;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const inst = findNodeById(screen.nodes, nodeId);
        if (!inst || inst.type !== 'instance') {
          throw new Error(`Instância não encontrada: ${nodeId}`);
        }
        const def = (board.components || []).find(
          (c) => c.id === inst.componentId,
        );
        if (!def) throw new Error('Componente da instância não encontrado');
        const next = switchInstanceVariant(inst, def, variantId);
        const res = updateNodeInTree(screen.nodes, nodeId, () => next);
        screen.nodes = res.nodes;
        node = next;
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(node);
  },
);

server.tool(
  'detach_instance',
  'Desanexa instância em árvore editável',
  {
    screenId: z.string(),
    nodeId: z.string(),
  },
  async ({ screenId, nodeId }) => {
    let tree;
    try {
      commitBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const inst = findNodeById(screen.nodes, nodeId);
        if (!inst || inst.type !== 'instance') {
          throw new Error(`Instância não encontrada: ${nodeId}`);
        }
        const def = (board.components || []).find(
          (c) => c.id === inst.componentId,
        );
        tree = detachInstance(inst, def);
        const removed = removeNodeFromTree(screen.nodes, nodeId);
        insertNode(removed.nodes, tree, undefined);
        screen.nodes = removed.nodes;
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(tree);
  },
);

server.tool(
  'add_prototype_link',
  'Cria link de protótipo de um nó para outra tela',
  {
    fromScreenId: z.string(),
    triggerNodeId: z.string(),
    toScreenId: z.string(),
    transition: z.enum(['instant', 'dissolve']).optional(),
  },
  async ({ fromScreenId, triggerNodeId, toScreenId, transition }) => {
    let link;
    try {
      commitBoard((board) => {
        if (!findScreen(board, fromScreenId)) {
          throw new Error(`Tela origem não encontrada: ${fromScreenId}`);
        }
        if (!findScreen(board, toScreenId)) {
          throw new Error(`Tela destino não encontrada: ${toScreenId}`);
        }
        const from = findScreen(board, fromScreenId);
        if (!containsNodeId(from.nodes, triggerNodeId)) {
          throw new Error(`Nó gatilho não encontrado: ${triggerNodeId}`);
        }
        link = {
          id: cryptoRandomId('proto'),
          fromScreenId,
          triggerNodeId,
          toScreenId,
          transition: transition === 'dissolve' ? 'dissolve' : 'instant',
        };
        board.prototypes = [...(board.prototypes || []), link];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(link);
  },
);

server.tool(
  'delete_prototype_link',
  'Remove um link de protótipo pelo id',
  { linkId: z.string() },
  async ({ linkId }) => {
    try {
      commitBoard((board) => {
        board.prototypes = (board.prototypes || []).filter(
          (p) => p.id !== linkId,
        );
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, linkId });
  },
);

server.tool(
  'list_comments',
  'Lista comentários (opcionalmente filtrados por tela)',
  { screenId: z.string().optional() },
  async ({ screenId }) => {
    const board = readBoard(boardPath);
    const list = board.comments || [];
    return textResult(
      screenId ? list.filter((c) => c.screenId === screenId) : list,
    );
  },
);

server.tool(
  'add_comment',
  'Adiciona comentário em coordenadas da tela',
  {
    screenId: z.string(),
    x: z.number(),
    y: z.number(),
    text: z.string().optional(),
  },
  async ({ screenId, x, y, text }) => {
    let comment;
    try {
      commitBoard((board) => {
        if (!findScreen(board, screenId)) {
          throw new Error(`Tela não encontrada: ${screenId}`);
        }
        comment = {
          id: cryptoRandomId('comment'),
          screenId,
          x,
          y,
          text: text ?? '',
          resolved: false,
          createdAt: Date.now(),
        };
        board.comments = [...(board.comments || []), comment];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(comment);
  },
);

server.tool(
  'resolve_comment',
  'Marca comentário como resolvido ou reabre',
  {
    commentId: z.string(),
    resolved: z.boolean(),
  },
  async ({ commentId, resolved }) => {
    let comment;
    try {
      commitBoard((board) => {
        const list = board.comments || [];
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx < 0) throw new Error(`Comentário não encontrado: ${commentId}`);
        list[idx] = { ...list[idx], resolved };
        board.comments = list;
        comment = list[idx];
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(comment);
  },
);

server.tool(
  'export_screen_css',
  'Exporta a tela como CSS (string). PNG continua só na UI.',
  { screenId: z.string() },
  async ({ screenId }) => {
    const board = readBoard(boardPath);
    const screen = findScreen(board, screenId);
    if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
    return textResult({
      screenId,
      name: screen.name,
      css: screenToCss(screen),
    });
  },
);

server.tool(
  'export_screen_react',
  'Exporta a tela como JSX React (string). PNG continua só na UI.',
  { screenId: z.string() },
  async ({ screenId }) => {
    const board = readBoard(boardPath);
    const screen = findScreen(board, screenId);
    if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
    return textResult({
      screenId,
      name: screen.name,
      react: screenToReact(screen),
    });
  },
);

async function main() {
  console.error(`[figmashow] board: ${boardPath}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[figmashow] MCP stdio ready');
}

main().catch((err) => {
  console.error('[figmashow] fatal', err);
  process.exit(1);
});
