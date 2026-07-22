import fs from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
  findNodeParentInfo,
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
  applyBoardOperations,
  createProject,
  getProjectMeta,
  listProjects,
  readActiveProjectId,
  setActiveProjectId,
  resolveProjectBoardPath,
  resolveProjectIndexPath,
  renameProject,
  restoreProject,
  trashProject,
} from '../../core/src/index.js';
import {
  activateProjectRemote,
  createProjectRemote,
  getBoardRemote,
  getProjectRemote,
  isRemoteMode,
  listProjectsRemote,
  postOperationsRemote,
  putBoardRemote,
  renameProjectRemote,
  restoreProjectRemote,
  trashProjectRemote,
  createVersionRemote,
  restoreVersionRemote,
} from './remote.js';

/**
 * Snapshot no formato da API: `{ board: { screens, components, ... } }`.
 * Aceita também o formato legado flat (screens no topo).
 * @param {import('../../core/src/schema.js').Board} board
 * @param {string} [name]
 */
function makeVersionSnapshot(board, name) {
  return {
    id: cryptoRandomId('ver'),
    name: name || `Versão ${(board.versions || []).length + 1}`,
    createdAt: new Date().toISOString(),
    revision: board.revision,
    board: {
      screens: board.screens,
      components: board.components,
      prototypes: board.prototypes,
      comments: board.comments,
      tokens: board.tokens,
    },
  };
}

/**
 * Extrai payload de board de um snapshot (API ou legado).
 * @param {any} snap
 */
function versionBoardPayload(snap) {
  if (snap?.board && typeof snap.board === 'object') {
    return snap.board;
  }
  return {
    screens: snap?.screens,
    components: snap?.components,
    prototypes: snap?.prototypes,
    comments: snap?.comments,
    tokens: snap?.tokens,
  };
}

export function createFigmashowMcpServer() {
  /** Projeto fixado na sessão MCP (evita depender de active.json em modo remoto). */
  let pinnedProjectId = null;

  /** @returns {string|null} */
  function getPinnedOrActiveProjectId() {
    if (pinnedProjectId) return pinnedProjectId;
    if (isRemoteMode()) return null;
    return readActiveProjectId();
  }
  
  /** @param {string} projectId */
  function pinProject(projectId) {
    pinnedProjectId = projectId;
  }
  
  /** Caminho do board ativo (projeto aberto em modo multi-projeto). Só modo local. */
  function getBoardPath() {
    const indexPath = resolveProjectIndexPath();
    if (fs.existsSync(indexPath)) {
      const activeId = getPinnedOrActiveProjectId();
      if (activeId) {
        return resolveProjectBoardPath(activeId);
      }
    }
    return resolveBoardPath();
  }
  
  /** @returns {Promise<import('../../core/src/schema.js').Board>} */
  async function loadBoard() {
    if (isRemoteMode()) {
      const projectId = getPinnedOrActiveProjectId();
      if (!projectId) {
        throw new Error(
          'Nenhum projeto aberto. Use open_project ou create_project primeiro.',
        );
      }
      const { board } = await getBoardRemote(projectId);
      return board;
    }
    return readBoard(getBoardPath());
  }
  
  /** Avisos de configuração MCP (FIGMASHOW_DATA vs FIGMASHOW_BOARD legado / remoto). */
  function getMcpConfigHints() {
    /** @type {{ level: string, message: string }[]} */
    const hints = [];
    if (isRemoteMode()) {
      hints.push({
        level: 'info',
        message: `Modo remoto: ${process.env.FIGMASHOW_API_URL}`,
      });
      return hints;
    }
    const envBoard = process.env.FIGMASHOW_BOARD;
    const indexPath = resolveProjectIndexPath();
    if (envBoard && fs.existsSync(indexPath)) {
      hints.push({
        level: 'warning',
        message:
          'FIGMASHOW_BOARD está definido com multi-projeto (index.json). Use FIGMASHOW_DATA e remova FIGMASHOW_BOARD para o MCP seguir o projeto ativo.',
      });
    }
    if (!process.env.FIGMASHOW_DATA && !envBoard) {
      hints.push({
        level: 'info',
        message:
          'Defina FIGMASHOW_DATA apontando para figmashow/data para multi-projeto previsível. Ou FIGMASHOW_API_URL para editar a VPS.',
      });
    }
    return hints;
  }
  
  /** @param {Record<string, unknown>} payload */
  function withConfigHints(payload) {
    const hints = getMcpConfigHints();
    if (!hints.length) return payload;
    return { ...payload, mcpHints: hints };
  }
  
  /**
   * Erro detalhado quando group_nodes falha (pais diferentes ou nó ausente).
   * @param {import('../../core/src/schema.js').BoardNode[]} nodes
   * @param {string[]} nodeIds
   */
  function explainGroupNodesFailure(nodes, nodeIds) {
    /** @type {string[]} */
    const locations = [];
    const parentKeys = new Set();
    for (const id of nodeIds) {
      const info = findNodeParentInfo(nodes, id);
      if (!info.found) {
        return `Nó não encontrado: ${id}`;
      }
      const parentKey = info.parentId ?? '__root__';
      parentKeys.add(parentKey);
      const loc = info.parentId
        ? `dentro de "${info.parent?.name || info.parentId}"`
        : 'na raiz da tela';
      locations.push(`${id} (${loc})`);
    }
    if (parentKeys.size > 1) {
      return `Só é possível agrupar irmãos (mesmo pai). Atual: ${locations.join('; ')}. Use move_node com parentId=null ou parentId do grupo alvo antes de group_nodes.`;
    }
    return `Não foi possível agrupar: ${locations.join('; ')}. Confira os IDs com list_nodes.`;
  }
  
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
   * Em modo remoto: GET board → muta → PUT, com uma tentativa após conflito.
   * @param {(board: import('../../core/src/schema.js').Board) => void} mutator
   */
  async function commitBoard(mutator) {
    if (isRemoteMode()) {
      const projectId = getPinnedOrActiveProjectId();
      if (!projectId) {
        throw new Error(
          'Nenhum projeto aberto. Use open_project ou create_project primeiro.',
        );
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const { board } = await getBoardRemote(projectId);
        const expectedRevision = Number(board.revision) || 0;
        mutator(board);
        const synced = syncAllComponentDefs(scrubBoardRefs(board));
        try {
          return await putBoardRemote(synced, projectId, expectedRevision);
        } catch (err) {
          if (err?.code !== 'REVISION_CONFLICT' || attempt === 1) {
            if (err?.code === 'REVISION_CONFLICT') {
              throw new Error(
                'Conflito de revisão após nova tentativa. Use open_project novamente antes de repetir a operação.',
              );
            }
            throw err;
          }
        }
      }
      throw new Error('Falha inesperada ao salvar board');
    }
    return updateBoard((board) => {
      mutator(board);
      return syncAllComponentDefs(scrubBoardRefs(board));
    }, getBoardPath());
  }

  /**
   * POST /operations remoto com retry 1× em 409.
   * @param {Array<Record<string, unknown>>} operations
   */
  async function runRemoteOperations(operations) {
    const projectId = getPinnedOrActiveProjectId();
    if (!projectId) {
      throw new Error(
        'Nenhum projeto aberto. Use open_project ou create_project primeiro.',
      );
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { board } = await getBoardRemote(projectId);
      const expectedRevision = Number(board.revision) || 0;
      try {
        return await postOperationsRemote(
          projectId,
          operations,
          expectedRevision,
        );
      } catch (err) {
        if (err?.code !== 'REVISION_CONFLICT' || attempt === 1) {
          if (err?.code === 'REVISION_CONFLICT') {
            throw new Error(
              'Conflito de revisão após nova tentativa. Use open_project novamente antes de repetir a operação.',
            );
          }
          throw err;
        }
      }
    }
    throw new Error('Falha inesperada ao aplicar operações');
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
    version: '1.0.1',
  });
  
  server.tool(
    'list_projects',
    'Lista design files (projetos). Retorna qual está ativo para as demais tools.',
    {
      trashed: z
        .boolean()
        .optional()
        .describe('true = só lixeira; default = projetos ativos'),
    },
    async ({ trashed }) => {
      if (isRemoteMode()) {
        try {
          const { projects } = await listProjectsRemote({
            trashed: Boolean(trashed),
          });
          return textResult(
            withConfigHints({
              activeProjectId: getPinnedOrActiveProjectId(),
              pinnedProjectId,
              apiUrl: process.env.FIGMASHOW_API_URL,
              projects,
              hint: pinnedProjectId
                ? 'Projeto fixado na sessão MCP — demais tools editam este arquivo.'
                : 'Use open_project para fixar um projeto na sessão MCP (modo remoto).',
            }),
          );
        } catch (err) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
      }
      const activeProjectId = readActiveProjectId();
      const projects = listProjects({ trashed: Boolean(trashed) });
      return textResult(
        withConfigHints({
          activeProjectId,
          boardPath: getBoardPath(),
          projects,
        }),
      );
    },
  );
  
  server.tool(
    'create_project',
    'Cria um novo design file (390×844) e torna-o o projeto ativo do MCP',
    {
      name: z.string().optional().describe('Nome do projeto (default: Untitled)'),
    },
    async ({ name }) => {
      try {
        if (isRemoteMode()) {
          const project = await createProjectRemote(name || 'Untitled');
          pinProject(project.id);
          const { board } = await getBoardRemote(project.id);
          return textResult(
            withConfigHints({
              ok: true,
              project,
              activeProjectId: project.id,
              apiUrl: process.env.FIGMASHOW_API_URL,
              screenCount: board.screens?.length ?? 0,
              screens: (board.screens || []).map((s) => ({
                id: s.id,
                name: s.name,
              })),
            }),
          );
        }
        const project = createProject(name || 'Untitled');
        pinProject(project.id);
        setActiveProjectId(project.id);
        const board = await loadBoard();
        return textResult(
          withConfigHints({
            ok: true,
            project,
            activeProjectId: project.id,
            boardPath: getBoardPath(),
            screenCount: board.screens?.length ?? 0,
            screens: (board.screens || []).map((s) => ({
              id: s.id,
              name: s.name,
            })),
          }),
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'open_project',
    'Define o projeto ativo; create_screen / add_node etc. passam a editar este arquivo',
    { projectId: z.string().describe('ID do projeto (list_projects)') },
    async ({ projectId }) => {
      try {
        if (isRemoteMode()) {
          const { project, board } = await getProjectRemote(projectId);
          if (!project) {
            return errorResult(`Projeto não encontrado: ${projectId}`);
          }
          if (project.trashed) {
            return errorResult(
              `Projeto na lixeira: ${projectId}. Restaure na home antes de abrir.`,
            );
          }
          await activateProjectRemote(projectId);
          pinProject(projectId);
          return textResult(
            withConfigHints({
              ok: true,
              project,
              activeProjectId: projectId,
              apiUrl: process.env.FIGMASHOW_API_URL,
              screenCount: board.screens?.length ?? 0,
              screens: (board.screens || []).map((s) => ({
                id: s.id,
                name: s.name,
                width: s.width,
                height: s.height,
              })),
            }),
          );
        }
        const project = getProjectMeta(projectId);
        if (!project) {
          return errorResult(`Projeto não encontrado: ${projectId}`);
        }
        if (project.trashed) {
          return errorResult(
            `Projeto na lixeira: ${projectId}. Restaure na home antes de abrir.`,
          );
        }
        setActiveProjectId(projectId);
        pinProject(projectId);
        const board = await loadBoard();
        return textResult(
          withConfigHints({
            ok: true,
            project,
            activeProjectId: projectId,
            boardPath: getBoardPath(),
            screenCount: board.screens?.length ?? 0,
            screens: (board.screens || []).map((s) => ({
              id: s.id,
              name: s.name,
              width: s.width,
              height: s.height,
            })),
          }),
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'rename_project',
    'Renomeia um design file',
    {
      projectId: z.string(),
      name: z.string().min(1),
    },
    async ({ projectId, name }) => {
      try {
        const project = isRemoteMode()
          ? await renameProjectRemote(projectId, name)
          : renameProject(projectId, name);
        if (!project) return errorResult(`Projeto não encontrado: ${projectId}`);
        return textResult({ ok: true, project });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'trash_project',
    'Move um design file para a lixeira',
    { projectId: z.string() },
    async ({ projectId }) => {
      try {
        const project = isRemoteMode()
          ? await trashProjectRemote(projectId)
          : trashProject(projectId);
        if (!project) return errorResult(`Projeto não encontrado: ${projectId}`);
        if (pinnedProjectId === projectId) pinnedProjectId = null;
        return textResult({ ok: true, project });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'restore_project',
    'Restaura um design file da lixeira',
    { projectId: z.string() },
    async ({ projectId }) => {
      try {
        const project = isRemoteMode()
          ? await restoreProjectRemote(projectId)
          : restoreProject(projectId);
        if (!project) return errorResult(`Projeto não encontrado: ${projectId}`);
        return textResult({ ok: true, project });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'list_screens',
    'Lista id e nome de todas as telas do board FigmaShow',
    {},
    async () => {
      const board = await loadBoard();
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
      const board = await loadBoard();
      const screen = findScreen(board, screenId);
      if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
      return textResult(screen);
    },
  );
  
  server.tool(
    'delete_screen',
    'Remove uma tela e seus links de protótipo/comentários associados',
    { screenId: z.string().describe('ID da tela') },
    async ({ screenId }) => {
      try {
        await commitBoard((board) => {
          if (!findScreen(board, screenId)) {
            throw new Error(`Tela não encontrada: ${screenId}`);
          }
          board.screens = board.screens.filter((screen) => screen.id !== screenId);
          board.prototypes = (board.prototypes || []).filter(
            (link) =>
              link.fromScreenId !== screenId && link.toScreenId !== screenId,
          );
          board.comments = (board.comments || []).filter(
            (comment) => comment.screenId !== screenId,
          );
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
      return textResult({ ok: true, deleted: screenId });
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
        await commitBoard((board) => {
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
      bottomRadius: z
        .number()
        .optional()
        .describe('Arredonda só a base do rect (hero)'),
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
        await commitBoard((board) => {
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
              if (args.bottomRadius != null) {
                node.bottomRadius = args.bottomRadius;
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
      const board = await loadBoard();
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
          const screen = findScreen(board, screenId);
          if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
          const result = groupSiblingNodes(screen.nodes, nodeIds);
          if (!result.groupId) {
            throw new Error(explainGroupNodesFailure(screen.nodes, nodeIds));
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
    'batch_operations',
    'Aplica operações atômicas em uma única revisão do board',
    {
      operations: z.array(z.record(z.unknown())).min(1),
    },
    async ({ operations }) => {
      try {
        if (isRemoteMode()) {
          const result = await runRemoteOperations(operations);
          return textResult({
            ok: true,
            revision: result?.revision ?? result?.board?.revision,
            board: result?.board,
          });
        }

        const updated = updateBoard(
          (board) => applyBoardOperations(board, operations),
          getBoardPath(),
        );
        return textResult({
          ok: true,
          revision: updated.revision,
          board: updated,
        });
      } catch (err) {
        if (err?.code === 'REVISION_CONFLICT') {
          return errorResult(
            'Conflito de revisão. Use open_project novamente antes de repetir a operação.',
          );
        }
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    'add_nodes',
    'Adiciona vários nós em uma tela numa única revisão (atalho de batch_operations)',
    {
      screenId: z.string(),
      nodes: z.array(z.record(z.unknown())).min(1),
      parentId: z.string().optional(),
    },
    async ({ screenId, nodes, parentId }) => {
      try {
        const operations = nodes.map((node) => ({
          type: 'add_node',
          screenId,
          parentId,
          node,
        }));
        if (isRemoteMode()) {
          const result = await runRemoteOperations(operations);
          return textResult({
            ok: true,
            revision: result?.revision ?? result?.board?.revision,
            count: nodes.length,
          });
        }
        const updated = updateBoard(
          (board) => applyBoardOperations(board, operations),
          getBoardPath(),
        );
        return textResult({ ok: true, revision: updated.revision, count: nodes.length });
      } catch (err) {
        if (err?.code === 'REVISION_CONFLICT') {
          return errorResult(
            'Conflito de revisão. Use open_project novamente antes de repetir a operação.',
          );
        }
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'list_versions',
    'Lista snapshots de versão do projeto aberto',
    {},
    async () => {
      try {
        const board = await loadBoard();
        return textResult({
          versions: (board.versions || []).map((v) => ({
            id: v.id,
            name: v.name,
            createdAt: v.createdAt,
            revision: v.revision,
          })),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
  
  server.tool(
    'create_version',
    'Cria um snapshot nomeado do board atual',
    { name: z.string().optional() },
    async ({ name }) => {
      try {
        if (isRemoteMode()) {
          const projectId = getPinnedOrActiveProjectId();
          if (!projectId) {
            return errorResult(
              'Nenhum projeto aberto. Use open_project ou create_project primeiro.',
            );
          }
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const { board } = await getBoardRemote(projectId);
              const expectedRevision = Number(board.revision) || 0;
              const data = await createVersionRemote(
                projectId,
                name,
                expectedRevision,
              );
              return textResult(data);
            } catch (err) {
              if (err?.code !== 'REVISION_CONFLICT' || attempt === 1) {
                throw err;
              }
            }
          }
        }
        let snap;
        await commitBoard((board) => {
          snap = makeVersionSnapshot(board, name);
          board.versions = [...(board.versions || []), snap].slice(-30);
        });
        return textResult({ ok: true, version: snap });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    'restore_version',
    'Restaura um snapshot (substitui screens/components/prototypes/comments/tokens)',
    { versionId: z.string() },
    async ({ versionId }) => {
      try {
        if (isRemoteMode()) {
          const projectId = getPinnedOrActiveProjectId();
          if (!projectId) {
            return errorResult(
              'Nenhum projeto aberto. Use open_project ou create_project primeiro.',
            );
          }
          for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
              const { board } = await getBoardRemote(projectId);
              const expectedRevision = Number(board.revision) || 0;
              const data = await restoreVersionRemote(
                projectId,
                versionId,
                expectedRevision,
              );
              return textResult(data);
            } catch (err) {
              if (err?.code !== 'REVISION_CONFLICT' || attempt === 1) {
                throw err;
              }
            }
          }
        }
        await commitBoard((board) => {
          const snap = (board.versions || []).find((v) => v.id === versionId);
          if (!snap) throw new Error(`Versão não encontrada: ${versionId}`);
          const payload = versionBoardPayload(snap);
          if (Array.isArray(payload.screens)) board.screens = payload.screens;
          if (Array.isArray(payload.components)) {
            board.components = payload.components;
          }
          if (Array.isArray(payload.prototypes)) {
            board.prototypes = payload.prototypes;
          }
          if (Array.isArray(payload.comments)) board.comments = payload.comments;
          if (payload.tokens && typeof payload.tokens === 'object') {
            board.tokens = payload.tokens;
          }
        });
        return textResult({ ok: true, restored: versionId });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );

  server.tool(
    'set_tokens',
    'Define tokens de design no board (merge)',
    { tokens: z.record(z.unknown()) },
    async ({ tokens }) => {
      try {
        const operations = [{ type: 'set_tokens', tokens }];
        if (isRemoteMode()) {
          const result = await runRemoteOperations(operations);
          return textResult({
            ok: true,
            revision: result?.revision ?? result?.board?.revision,
            tokens: result?.board?.tokens,
          });
        }
        const updated = updateBoard(
          (board) => applyBoardOperations(board, operations),
          getBoardPath(),
        );
        return textResult({ ok: true, revision: updated.revision, tokens: updated.tokens });
      } catch (err) {
        if (err?.code === 'REVISION_CONFLICT') {
          return errorResult(
            'Conflito de revisão. Use open_project novamente antes de repetir a operação.',
          );
        }
        return errorResult(err instanceof Error ? err.message : String(err));
      }
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
          const screen = findScreen(board, screenId);
          if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
          const isRoot = screen.nodes.some((n) => n.id === nodeId);
          if (!isRoot) {
            const info = findNodeParentInfo(screen.nodes, nodeId);
            const where = info.parentId
              ? `dentro de "${info.parent?.name || info.parentId}"`
              : 'fora da tela';
            throw new Error(
              `Constraints só se aplicam a nós na raiz da tela (${nodeId} está ${where}). Use move_node com parentId=null antes de set_constraints.`,
            );
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
      const board = await loadBoard();
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
      /** @type {Record<string, unknown> | null} */
      let payload = null;
      try {
        await commitBoard((board) => {
          const screen = findScreen(board, screenId);
          if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
          const result = createComponentFromNodes(screen.nodes, nodeIds, name);
          if (!result.component || !result.mainNode) {
            throw new Error(explainGroupNodesFailure(screen.nodes, nodeIds));
          }
          screen.nodes = result.remainingNodes;
          board.components = [...(board.components || []), result.component];
          /** @type {Record<string, string>} */
          const idMap = {};
          for (const id of nodeIds) {
            idMap[id] = result.mainNode.id;
          }
          payload = {
            component: result.component,
            mainNode: result.mainNode,
            mainNodeId: result.mainNode.id,
            idMap,
            preservedChildIds: (result.mainNode.children || []).map((c) => c.id),
            hint:
              'Use mainNodeId como triggerNodeId em add_prototype_link (substitui os IDs em nodeIds). Os filhos originais continuam em preservedChildIds dentro do principal.',
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
      const board = await loadBoard();
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
        await commitBoard((board) => {
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
        await commitBoard((board) => {
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
      const board = await loadBoard();
      const screen = findScreen(board, screenId);
      if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
      return textResult({
        screenId,
        name: screen.name,
        css: screenToCss(screen, board.components || []),
      });
    },
  );
  
  server.tool(
    'export_screen_react',
    'Exporta a tela como JSX React (string). PNG continua só na UI.',
    { screenId: z.string() },
    async ({ screenId }) => {
      const board = await loadBoard();
      const screen = findScreen(board, screenId);
      if (!screen) return errorResult(`Tela não encontrada: ${screenId}`);
      return textResult({
        screenId,
        name: screen.name,
        react: screenToReact(screen, board.components || []),
      });
    },
  );
  
  return server;
}
