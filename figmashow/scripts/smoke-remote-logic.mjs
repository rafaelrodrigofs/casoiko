/**
 * Aplica ensure + insert_logic_step no projeto remoto (mesma lógica do MCP).
 * Uso: FIGMASHOW_API_URL=... node scripts/smoke-remote-logic.mjs <projectId> <linkId>
 */
import {
  getBoardRemote,
  putBoardRemote,
} from '../packages/mcp/src/remote.js';
import {
  expandInteraction,
  insertLogicStepOnPrototype,
  classifyWorkflowPathNodes,
  findNodeById,
  simulateWorkflow,
} from '../packages/core/src/index.js';

const projectId = process.argv[2];
const linkId = process.argv[3];
if (!projectId || !linkId) {
  console.error('Uso: node scripts/smoke-remote-logic.mjs <projectId> <linkId>');
  process.exit(1);
}

const { board } = await getBoardRemote(projectId);
const link = (board.prototypes || []).find((p) => p.id === linkId);
if (!link) {
  console.error('Link não encontrado', linkId);
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
  layoutOrigin: {
    x: (screen?.x ?? 0) + (screen?.width || 390) + 64,
    y: screen?.y ?? 0,
  },
});

let domain = expanded.domain;
let domainViews = expanded.domainViews;

for (const kind of ['validate', 'apiCall', 'branch']) {
  const out = insertLogicStepOnPrototype({
    domain,
    domainViews,
    screens: board.screens,
    prototypes: board.prototypes,
    linkId: link.id,
    kind,
  });
  domain = out.domain;
  domainViews = out.domainViews;
}

board.domain = domain;
board.domainViews = domainViews;
const put = await putBoardRemote(board, projectId, board.revision);
const wf = (domain.workflows || []).find(
  (w) => w.id === expanded.interaction.workflowId,
) || domain.workflows?.[0];
const { onPath } = classifyWorkflowPathNodes(wf);
const sim = simulateWorkflow(wf, { forceOutcome: 'success' });

console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      url: `https://figma.rafaelrodrigofs.cloud/file/${projectId}`,
      linkId,
      workflowId: wf?.id,
      kinds: (wf?.nodes || []).map((n) => n.kind),
      onPath,
      simulate: sim.outcome,
      revision: put?.board?.revision ?? put?.revision,
    },
    null,
    2,
  ),
);
