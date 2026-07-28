/**
 * Aplica ensure + insert_logic_step no projeto demo (mesma lógica do MCP).
 * Uso: node scripts/smoke-mcp-logic-board.mjs [projectId]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readBoard,
  updateBoard,
  resolveProjectBoardPath,
  setActiveProjectId,
  findNodeById,
} from '../packages/core/src/index.js';
import {
  expandInteraction,
  insertLogicStepOnPrototype,
  classifyWorkflowPathNodes,
} from '../packages/core/src/domain.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.FIGMASHOW_DATA =
  process.env.FIGMASHOW_DATA || path.join(root, 'data');

const projectId = process.argv[2] || 'id_b361b2a9';
setActiveProjectId(projectId);

const boardPath = resolveProjectBoardPath(projectId);
const board = readBoard(boardPath);
const link = (board.prototypes || [])[0];
if (!link) {
  console.error('Sem prototype links no projeto', projectId);
  process.exit(1);
}

const screen = (board.screens || []).find((s) => s.id === link.fromScreenId);
const nodeName = screen && findNodeById(screen.nodes, link.triggerNodeId)?.name;

const expanded = expandInteraction({
  domain: board.domain,
  domainViews: board.domainViews,
  screenId: link.fromScreenId,
  nodeId: link.triggerNodeId,
  name: nodeName || 'Interação',
  prototypeLinkId: link.id,
  toScreenId: link.toScreenId,
  transition: link.transition || 'instant',
});

let domain = expanded.domain;
let domainViews = expanded.domainViews;

const step1 = insertLogicStepOnPrototype({
  domain,
  domainViews,
  screens: board.screens,
  prototypes: board.prototypes,
  linkId: link.id,
  kind: 'validate',
});
domain = step1.domain;
domainViews = step1.domainViews;

const step2 = insertLogicStepOnPrototype({
  domain,
  domainViews,
  screens: board.screens,
  prototypes: board.prototypes,
  linkId: link.id,
  kind: 'apiCall',
});

board.domain = step2.domain;
board.domainViews = step2.domainViews;
updateBoard(() => board, boardPath);

const { onPath } = classifyWorkflowPathNodes(step2.workflow);
console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      linkId: link.id,
      workflowId: step2.workflow.id,
      kinds: step2.workflow.nodes.map((n) => n.kind),
      onPath,
      viewNodes: step2.domainViews.workflows.find(
        (v) => v.workflowId === step2.workflow.id,
      )?.nodes?.length,
    },
    null,
    2,
  ),
);
