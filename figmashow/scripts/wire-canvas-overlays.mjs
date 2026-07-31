/**
 * Liga showOverlay/hideOverlay dos modais NatiPsico numa única revisão.
 * Uso: FIGMASHOW_API_URL=https://figma.rafaelrodrigofs.cloud node scripts/wire-canvas-overlays.mjs
 */
import {
  expandInteraction,
  insertLogicStepOnWorkflow,
  normalizeBoard,
  scrubBoardRefs,
  syncAllComponentDefs,
} from '../packages/core/src/index.js';

const API = (process.env.FIGMASHOW_API_URL || '').replace(/\/+$/, '');
const PROJECT_ID = process.env.FIGMASHOW_PROJECT_ID || 'id_ef22ac7e';

if (!API) {
  console.error('Defina FIGMASHOW_API_URL');
  process.exit(1);
}

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const OPENS = [
  {
    screenId: 'screen_86e931df',
    nodeId: 'patients_add',
    name: 'Novo paciente',
    overlayNodeId: 'modal_paciente_g',
  },
  {
    screenId: 'screen_1db5d2a9',
    nodeId: 'agenda_add',
    name: 'Novo atendimento',
    overlayNodeId: 'modal_atend_g',
  },
  {
    screenId: 'screen_cabccb71',
    nodeId: 'finance_add',
    name: 'Novo pagamento',
    overlayNodeId: 'modal_pag_g',
  },
  {
    screenId: 'screen_e126f6c0',
    nodeId: 'profile_more',
    name: 'Menu paciente',
    overlayNodeId: 'modal_menu_g',
  },
  {
    screenId: 'screen_perfil_07',
    nodeId: 'me_logout',
    name: 'Sair da conta',
    overlayNodeId: 'modal_sair_g',
  },
];

const CLOSES = [
  {
    nodeId: 'modal_paciente_save',
    name: 'Salvar paciente',
    overlayNodeId: 'modal_paciente_g',
    message: 'Paciente salvo',
    validate: true,
  },
  {
    nodeId: 'modal_atend_save',
    name: 'Salvar atendimento',
    overlayNodeId: 'modal_atend_g',
    message: 'Atendimento agendado',
  },
  {
    nodeId: 'modal_pag_save',
    name: 'Salvar pagamento',
    overlayNodeId: 'modal_pag_g',
    message: 'Pagamento registrado',
  },
  {
    nodeId: 'modal_edit_save',
    name: 'Salvar edição',
    overlayNodeId: 'modal_edit_g',
    message: 'Paciente atualizado',
  },
  {
    nodeId: 'modal_menu_arch',
    name: 'Arquivar',
    overlayNodeId: 'modal_menu_g',
    message: 'Paciente arquivado',
  },
  {
    nodeId: 'modal_sair_cancel',
    name: 'Cancelar saída',
    overlayNodeId: 'modal_sair_g',
  },
  // dim / fechar tocando o grupo
  { nodeId: 'modal_paciente_g', name: 'Fechar modal paciente', overlayNodeId: 'modal_paciente_g' },
  { nodeId: 'modal_atend_g', name: 'Fechar modal atendimento', overlayNodeId: 'modal_atend_g' },
  { nodeId: 'modal_pag_g', name: 'Fechar modal pagamento', overlayNodeId: 'modal_pag_g' },
  { nodeId: 'modal_menu_g', name: 'Fechar menu', overlayNodeId: 'modal_menu_g' },
  { nodeId: 'modal_edit_g', name: 'Fechar edição', overlayNodeId: 'modal_edit_g' },
  { nodeId: 'modal_sair_g', name: 'Fechar sair', overlayNodeId: 'modal_sair_g' },
];

async function runOnce() {
  const data = await api(`/api/projects/${PROJECT_ID}`);
  let board = normalizeBoard(data.board);
  const expectedRevision = Number(board.revision) || 0;

  for (const op of OPENS) {
    const out = expandInteraction({
      domain: board.domain,
      domainViews: board.domainViews,
      screenId: op.screenId,
      nodeId: op.nodeId,
      name: op.name,
      overlayNodeId: op.overlayNodeId,
      replaceTerminal: true,
    });
    board.domain = out.domain;
    board.domainViews = out.domainViews;
  }

  // Menu → Editar
  {
    const out = expandInteraction({
      domain: board.domain,
      domainViews: board.domainViews,
      screenId: '__canvas__',
      nodeId: 'modal_menu_edit',
      name: 'Editar paciente',
      overlayNodeId: 'modal_edit_g',
      replaceTerminal: true,
    });
    board.domain = out.domain;
    board.domainViews = out.domainViews;
  }

  // Confirmar sair → login
  {
    const out = expandInteraction({
      domain: board.domain,
      domainViews: board.domainViews,
      screenId: '__canvas__',
      nodeId: 'modal_sair_ok',
      name: 'Confirmar sair',
      toScreenId: 'screen_login_00',
      replaceTerminal: true,
    });
    board.domain = out.domain;
    board.domainViews = out.domainViews;
  }

  for (const op of CLOSES) {
    let out = expandInteraction({
      domain: board.domain,
      domainViews: board.domainViews,
      screenId: '__canvas__',
      nodeId: op.nodeId,
      name: op.name,
      overlayNodeId: op.overlayNodeId,
      hideOverlay: true,
      replaceTerminal: true,
    });
    board.domain = out.domain;
    board.domainViews = out.domainViews;
    const wfId = out.workflow?.id || out.interaction?.workflowId;
    if (op.validate && wfId) {
      out = insertLogicStepOnWorkflow({
        domain: board.domain,
        domainViews: board.domainViews,
        workflowId: wfId,
        kind: 'validate',
        config: { simulate: 'success' },
      });
      board.domain = out.domain;
      board.domainViews = out.domainViews;
    }
    if (op.message && wfId) {
      out = insertLogicStepOnWorkflow({
        domain: board.domain,
        domainViews: board.domainViews,
        workflowId: wfId,
        kind: 'showMessage',
        config: { message: op.message, tone: 'success' },
      });
      board.domain = out.domain;
      board.domainViews = out.domainViews;
    }
  }

  board = syncAllComponentDefs(scrubBoardRefs(board));
  const canvasIx = (board.domain.interactions || []).filter(
    (ix) => ix.trigger?.screenId === '__canvas__',
  );
  const overlayWf = (board.domain.workflows || []).filter((wf) =>
    (wf.nodes || []).some(
      (n) => n.kind === 'showOverlay' || n.kind === 'hideOverlay',
    ),
  );

  const saved = await api(`/api/projects/${PROJECT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ board, expectedRevision }),
  });

  return {
    revision: saved.revision,
    canvasInteractions: canvasIx.length,
    overlayWorkflows: overlayWf.length,
    sample: canvasIx.slice(0, 5).map((ix) => ({
      name: ix.name,
      nodeId: ix.trigger.nodeId,
    })),
  };
}

let lastErr;
for (let i = 0; i < 3; i += 1) {
  try {
    const result = await runOnce();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    lastErr = err;
    if (err.status === 409) {
      console.warn('Conflito de revisão, tentando de novo…');
      continue;
    }
    throw err;
  }
}
console.error(lastErr);
process.exit(1);
