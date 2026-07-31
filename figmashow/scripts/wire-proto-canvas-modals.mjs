/**
 * Limpa balões soltos e cria links de protótipo tela → modal do canvas.
 * FIGMASHOW_API_URL=https://figma.rafaelrodrigofs.cloud node scripts/wire-proto-canvas-modals.mjs
 */
import {
  CANVAS_SCOPE,
  expandInteraction,
  normalizeBoard,
  scrubBoardRefs,
  syncAllComponentDefs,
} from '../packages/core/src/index.js';

const API = (process.env.FIGMASHOW_API_URL || '').replace(/\/+$/, '');
const PROJECT_ID = process.env.FIGMASHOW_PROJECT_ID || 'id_ef22ac7e';

const LINKS = [
  {
    fromScreenId: 'screen_86e931df',
    triggerNodeId: 'patients_add',
    toNodeId: 'modal_paciente_g',
    fromSide: 'bottom',
    name: 'Novo paciente',
  },
  {
    fromScreenId: 'screen_1db5d2a9',
    triggerNodeId: 'agenda_add',
    toNodeId: 'modal_atend_g',
    fromSide: 'bottom',
    name: 'Novo atendimento',
  },
  {
    fromScreenId: 'screen_cabccb71',
    triggerNodeId: 'finance_add',
    toNodeId: 'modal_pag_g',
    fromSide: 'bottom',
    name: 'Novo pagamento',
  },
  {
    fromScreenId: 'screen_e126f6c0',
    triggerNodeId: 'profile_more',
    toNodeId: 'modal_menu_g',
    fromSide: 'bottom',
    name: 'Menu',
  },
  {
    fromScreenId: 'screen_perfil_07',
    triggerNodeId: 'me_logout',
    toNodeId: 'modal_sair_g',
    fromSide: 'bottom',
    name: 'Sair',
  },
];

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function cryptoRandomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`;
}

async function runOnce() {
  const data = await api(`/api/projects/${PROJECT_ID}`);
  let board = normalizeBoard(data.board);
  const expectedRevision = Number(board.revision) || 0;

  const orphanTriggers = new Set(
    LINKS.map((l) => `${l.fromScreenId}::${l.triggerNodeId}`),
  );

  // Remove interactions órfãs (balões soltos) desses gatilhos
  const keepIx = [];
  const dropWf = new Set();
  for (const ix of board.domain?.interactions || []) {
    const key = `${ix.trigger?.screenId}::${ix.trigger?.nodeId}`;
    if (orphanTriggers.has(key) && !ix.prototypeLinkId) {
      if (ix.workflowId) dropWf.add(ix.workflowId);
      continue;
    }
    keepIx.push(ix);
  }
  board.domain = {
    ...board.domain,
    interactions: keepIx,
    workflows: (board.domain?.workflows || []).filter(
      (wf) => !dropWf.has(wf.id),
    ),
  };
  board.domainViews = {
    ...board.domainViews,
    workflows: (board.domainViews?.workflows || []).filter(
      (v) => !dropWf.has(v.workflowId),
    ),
  };

  // Remove links antigos quebrados para esses triggers
  board.prototypes = (board.prototypes || []).filter(
    (p) =>
      !LINKS.some(
        (l) =>
          l.fromScreenId === p.fromScreenId &&
          l.triggerNodeId === p.triggerNodeId,
      ),
  );

  const created = [];
  for (const spec of LINKS) {
    const link = {
      id: cryptoRandomId('proto'),
      fromScreenId: spec.fromScreenId,
      triggerNodeId: spec.triggerNodeId,
      toScreenId: CANVAS_SCOPE,
      toNodeId: spec.toNodeId,
      transition: 'dissolve',
      trigger: 'onClick',
      action: 'overlay',
      fromSide: spec.fromSide || 'bottom',
    };
    board.prototypes.push(link);

    const screen = (board.screens || []).find((s) => s.id === spec.fromScreenId);
    const out = expandInteraction({
      domain: board.domain,
      domainViews: board.domainViews,
      screenId: spec.fromScreenId,
      nodeId: spec.triggerNodeId,
      name: spec.name,
      prototypeLinkId: link.id,
      overlayNodeId: spec.toNodeId,
      transition: 'dissolve',
      replaceTerminal: true,
      layoutOrigin: {
        x: (screen?.x ?? 0) + (screen?.width || 390) + 64,
        y: screen?.y ?? 0,
      },
    });
    board.domain = out.domain;
    board.domainViews = out.domainViews;
    created.push({
      linkId: link.id,
      name: spec.name,
      toNodeId: spec.toNodeId,
      kind: out.workflow?.nodes?.[0]?.kind,
    });
  }

  board = syncAllComponentDefs(scrubBoardRefs(board));
  const saved = await api(`/api/projects/${PROJECT_ID}`, {
    method: 'PUT',
    body: JSON.stringify({ board, expectedRevision }),
  });

  return {
    revision: saved.revision,
    created,
    canvasProto: (board.prototypes || []).filter((p) => p.toNodeId).length,
  };
}

if (!API) {
  console.error('Defina FIGMASHOW_API_URL');
  process.exit(1);
}

for (let i = 0; i < 3; i += 1) {
  try {
    console.log(JSON.stringify(await runOnce(), null, 2));
    process.exit(0);
  } catch (err) {
    if (err.status === 409) {
      console.warn('Conflito, retry…');
      continue;
    }
    console.error(err);
    process.exit(1);
  }
}
