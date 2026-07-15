#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  boundsFromChildren,
  containsNodeId,
  countNodes,
  cryptoRandomId,
  createScreen,
  findNodeById,
  findScreen,
  normalizeNode,
  readBoard,
  removeNodeFromTree,
  resolveBoardPath,
  updateBoard,
  updateNodeInTree,
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
 * Insere nó na raiz ou dentro de um grupo (parentId).
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
  if (!parent || parent.type !== 'group') {
    throw new Error(`Grupo pai não encontrado: ${parentId}`);
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
      updateBoard((board) => {
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
      }, boardPath);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult(created);
  },
);

server.tool(
  'add_node',
  'Adiciona um nó (rect | text | button | image | group) em uma tela ou dentro de um grupo (parentId)',
  {
    screenId: z.string(),
    type: z.enum(['rect', 'text', 'button', 'image', 'group']),
    x: z.number().optional().describe('Obrigatório exceto group vazio'),
    y: z.number().optional(),
    w: z.number().optional(),
    h: z.number().optional(),
    id: z.string().optional(),
    parentId: z.string().optional().describe('ID de um group pai'),
    fill: z.string().optional(),
    cornerRadius: z.number().optional(),
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
      updateBoard((board) => {
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
              textColor: args.textColor ?? '#FFFFFF',
              cornerRadius: args.cornerRadius ?? 27,
              fontSize: args.fontSize ?? 16,
              fontWeight: args.fontWeight ?? 600,
            };
            if (args.iconSrc) node.iconSrc = args.iconSrc;
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
              cornerRadius: args.cornerRadius ?? 0,
              opacity: args.opacity ?? 1,
            };
          }
          node = normalizeNode(node);
        }
        insertNode(screen.nodes, node, args.parentId);
      }, boardPath);
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
      updateBoard((board) => {
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
      }, boardPath);
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
      updateBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        const res = removeNodeFromTree(screen.nodes, nodeId);
        if (!res.removed) throw new Error(`Nó não encontrado: ${nodeId}`);
        screen.nodes = res.nodes;
      }, boardPath);
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
      updateBoard((board) => {
        const screen = findScreen(board, screenId);
        if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
        screen.nodes = [];
      }, boardPath);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
    return textResult({ ok: true, screenId, nodes: [] });
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
