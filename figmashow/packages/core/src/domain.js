/**
 * Domínio semântico do FigmaShow (Interaction → Workflow → API).
 * Entities ficam como stub vazio nesta fatia — não é o foco do MVP.
 */

import { findNodeById } from './schema.js';
import { samplePointsAlongPrototypeLink } from './prototypePath.js';

export {
  edgePoint,
  bezierControls,
  bezierPath,
  sampleCubicBezier,
  getPrototypeLinkEndpoints,
  samplePointsAlongPrototypeLink,
} from './prototypePath.js';

function cryptoRandomId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}_${rand}`;
}
export const WORKFLOW_KINDS = [
  'validate',
  'apiCall',
  'branch',
  'setState',
  'navigate',
  'showMessage',
];

export const API_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * @returns {import('./schema.js').Domain}
 */
export function emptyDomain() {
  return {
    version: 2,
    dialectHints: { sql: 'mariadb' },
    entities: [],
    relationships: [],
    interactions: [],
    workflows: [],
    apis: [],
    rules: [],
    functions: [],
    bindings: [],
  };
}

/**
 * @returns {{ entities: any[], workflows: any[] }}
 */
export function emptyDomainViews() {
  return { entities: [], workflows: [] };
}

/**
 * @param {unknown} raw
 */
export function normalizeDomain(raw) {
  if (!raw || typeof raw !== 'object') return emptyDomain();
  const d = /** @type {Record<string, unknown>} */ (raw);
  const version =
    typeof d.version === 'number' && Number.isFinite(d.version)
      ? Math.max(1, Math.floor(d.version))
      : 2;
  return {
    version: Math.max(version, 2),
    dialectHints:
      d.dialectHints && typeof d.dialectHints === 'object'
        ? /** @type {Record<string, unknown>} */ (d.dialectHints)
        : { sql: 'mariadb' },
    entities: Array.isArray(d.entities) ? d.entities : [],
    relationships: Array.isArray(d.relationships) ? d.relationships : [],
    interactions: normalizeInteractions(d.interactions),
    workflows: normalizeWorkflows(d.workflows),
    apis: normalizeApis(d.apis),
    rules: Array.isArray(d.rules) ? d.rules : [],
    functions: Array.isArray(d.functions) ? d.functions : [],
    bindings: Array.isArray(d.bindings) ? d.bindings : [],
  };
}

/**
 * @param {unknown} raw
 */
export function normalizeDomainViews(raw) {
  if (!raw || typeof raw !== 'object') return emptyDomainViews();
  const v = /** @type {Record<string, unknown>} */ (raw);
  return {
    entities: Array.isArray(v.entities) ? v.entities : [],
    workflows: normalizeWorkflowViews(v.workflows),
  };
}

function normalizeInteractions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const ix = /** @type {Record<string, unknown>} */ (item);
      const triggerRaw =
        ix.trigger && typeof ix.trigger === 'object'
          ? /** @type {Record<string, unknown>} */ (ix.trigger)
          : {};
      return {
        id: String(ix.id || cryptoRandomId('ix')),
        name: String(ix.name || 'Interação'),
        trigger: {
          type: 'uiEvent',
          event: String(triggerRaw.event || 'onClick'),
          screenId: String(triggerRaw.screenId || ''),
          nodeId: String(triggerRaw.nodeId || ''),
        },
        // Facetas opcionais — interactionId é a identidade; prototype não é obrigatório
        prototypeLinkId: ix.prototypeLinkId
          ? String(ix.prototypeLinkId)
          : null,
        workflowId: ix.workflowId ? String(ix.workflowId) : null,
      };
    })
    .filter(Boolean);
}

function normalizeWorkflows(list) {
  if (!Array.isArray(list)) return [];
  const kinds = new Set(WORKFLOW_KINDS);
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const wf = /** @type {Record<string, unknown>} */ (item);
      const nodes = Array.isArray(wf.nodes)
        ? wf.nodes
            .map((n) => {
              if (!n || typeof n !== 'object') return null;
              const node = /** @type {Record<string, unknown>} */ (n);
              const kind = kinds.has(/** @type {string} */ (node.kind))
                ? /** @type {string} */ (node.kind)
                : 'showMessage';
              return {
                id: String(node.id || cryptoRandomId('wn')),
                kind,
                name: String(node.name || kind),
                config:
                  node.config && typeof node.config === 'object'
                    ? /** @type {Record<string, unknown>} */ (node.config)
                    : {},
              };
            })
            .filter(Boolean)
        : [];
      const edges = Array.isArray(wf.edges)
        ? wf.edges
            .map((e) => {
              if (!e || typeof e !== 'object') return null;
              const edge = /** @type {Record<string, unknown>} */ (e);
              return {
                id: String(edge.id || cryptoRandomId('we')),
                from: String(edge.from || ''),
                to: String(edge.to || ''),
                when: edge.when != null ? String(edge.when) : undefined,
              };
            })
            .filter(Boolean)
        : [];
      const entryNodeId =
        typeof wf.entryNodeId === 'string' && wf.entryNodeId
          ? wf.entryNodeId
          : nodes[0]?.id || '';
      return {
        id: String(wf.id || cryptoRandomId('wf')),
        name: String(wf.name || 'Fluxo'),
        interactionId: wf.interactionId ? String(wf.interactionId) : null,
        entryNodeId,
        nodes,
        edges,
      };
    })
    .filter(Boolean);
}

function normalizeApis(list) {
  if (!Array.isArray(list)) return [];
  const methods = new Set(API_METHODS);
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const api = /** @type {Record<string, unknown>} */ (item);
      const method = methods.has(/** @type {string} */ (api.method))
        ? /** @type {string} */ (api.method)
        : 'POST';
      return {
        id: String(api.id || cryptoRandomId('api')),
        name: String(api.name || 'API'),
        method,
        path: String(api.path || '/'),
        // Reserva para binding físico futuro (Controller / endpoint real)
        physicalBindingId: api.physicalBindingId
          ? String(api.physicalBindingId)
          : null,
      };
    })
    .filter(Boolean);
}

function normalizeWorkflowViews(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const v = /** @type {Record<string, unknown>} */ (item);
      const nodes = Array.isArray(v.nodes)
        ? v.nodes
            .map((n) => {
              if (!n || typeof n !== 'object') return null;
              const node = /** @type {Record<string, unknown>} */ (n);
              return {
                nodeId: String(node.nodeId || ''),
                x: Number(node.x) || 0,
                y: Number(node.y) || 0,
              };
            })
            .filter((n) => n && n.nodeId)
        : [];
      return {
        workflowId: String(v.workflowId || ''),
        nodes,
      };
    })
    .filter((v) => v && v.workflowId);
}

/**
 * Remove refs órfãs de interactions/workflows/apis.
 * @param {any} domain
 * @param {{ screenIds: Set<string>, nodeIdsByScreen: Map<string, Set<string>>, prototypeIds: Set<string> }} ctx
 */
export function scrubDomainRefs(domain, ctx) {
  if (!domain) return emptyDomain();
  const prototypeIds = ctx.prototypeIds || new Set();
  const screenIds = ctx.screenIds || new Set();
  const nodeIdsByScreen = ctx.nodeIdsByScreen || new Map();

  let interactions = (domain.interactions || []).filter((ix) => {
    const { screenId, nodeId } = ix.trigger || {};
    if (!screenIds.has(screenId)) return false;
    const ids = nodeIdsByScreen.get(screenId);
    return ids?.has(nodeId);
  });

  interactions = interactions.map((ix) => ({
    ...ix,
    prototypeLinkId:
      ix.prototypeLinkId && prototypeIds.has(ix.prototypeLinkId)
        ? ix.prototypeLinkId
        : null,
  }));

  const interactionIds = new Set(interactions.map((ix) => ix.id));
  let workflows = (domain.workflows || []).filter(
    (wf) => !wf.interactionId || interactionIds.has(wf.interactionId),
  );

  const workflowIds = new Set(workflows.map((wf) => wf.id));
  interactions = interactions.map((ix) => ({
    ...ix,
    workflowId:
      ix.workflowId && workflowIds.has(ix.workflowId) ? ix.workflowId : null,
  }));

  const usedApiIds = new Set();
  for (const wf of workflows) {
    for (const n of wf.nodes || []) {
      if (n.kind === 'apiCall' && n.config?.apiId) usedApiIds.add(n.config.apiId);
    }
  }
  // Mantém todas as APIs declaradas (não só as usadas) — são recursos do domínio
  const apis = domain.apis || [];

  return {
    ...domain,
    interactions,
    workflows,
    apis,
  };
}

/**
 * Localiza Interaction pelo gatilho UI.
 * @param {any} domain
 * @param {string} screenId
 * @param {string} nodeId
 */
export function findInteractionByTrigger(domain, screenId, nodeId) {
  return (domain?.interactions || []).find(
    (ix) =>
      ix.trigger?.screenId === screenId && ix.trigger?.nodeId === nodeId,
  ) || null;
}

/**
 * @param {any} domain
 * @param {string} interactionId
 */
export function findWorkflowForInteraction(domain, interactionId) {
  const ix = (domain?.interactions || []).find((i) => i.id === interactionId);
  if (!ix?.workflowId) return null;
  return (domain?.workflows || []).find((w) => w.id === ix.workflowId) || null;
}

const WORKFLOW_NODE_GAP_Y = 100;
const WORKFLOW_NODE_GAP_X = 220;

/**
 * Labels de kind (UI / seed).
 */
export const WORKFLOW_KIND_LABEL = {
  validate: 'Validar',
  apiCall: 'API',
  branch: 'Condição',
  setState: 'Estado',
  navigate: 'Navegar',
  showMessage: 'Mensagem',
};

/**
 * Garante view de layout para um workflow (coluna ao lado do frame).
 * @param {{ entities: any[], workflows: any[] }} domainViews
 * @param {string} workflowId
 * @param {Array<{ id: string }>} nodes
 * @param {{ x?: number, y?: number }} [layoutOrigin]
 */
export function ensureWorkflowView(domainViews, workflowId, nodes, layoutOrigin) {
  const views = normalizeDomainViews(domainViews);
  const existing = (views.workflows || []).find((v) => v.workflowId === workflowId);
  const ox = Number(layoutOrigin?.x) || 40;
  const oy = Number(layoutOrigin?.y) || 40;
  const byId = new Map((existing?.nodes || []).map((n) => [n.nodeId, n]));
  const layoutNodes = (nodes || []).map((n, i) => {
    const prev = byId.get(n.id);
    if (prev) return prev;
    return {
      nodeId: n.id,
      x: ox,
      y: oy + i * WORKFLOW_NODE_GAP_Y,
    };
  });
  return {
    ...views,
    workflows: [
      ...(views.workflows || []).filter((v) => v.workflowId !== workflowId),
      { workflowId, nodes: layoutNodes },
    ],
  };
}

/**
 * Atualiza posição de um nó na view (só visual).
 * @param {{ entities: any[], workflows: any[] }} domainViews
 * @param {string} workflowId
 * @param {string} nodeId
 * @param {number} x
 * @param {number} y
 */
export function setWorkflowNodeViewPosition(domainViews, workflowId, nodeId, x, y) {
  const views = normalizeDomainViews(domainViews);
  const wfView = (views.workflows || []).find((v) => v.workflowId === workflowId);
  const nodes = [...(wfView?.nodes || [])];
  const idx = nodes.findIndex((n) => n.nodeId === nodeId);
  const nextPos = { nodeId, x: Number(x) || 0, y: Number(y) || 0 };
  if (idx >= 0) nodes[idx] = nextPos;
  else nodes.push(nextPos);
  return {
    ...views,
    workflows: [
      ...(views.workflows || []).filter((v) => v.workflowId !== workflowId),
      { workflowId, nodes },
    ],
  };
}

const LOGIC_CARD_W = 168;
const LOGIC_CARD_H = 56;

/**
 * Classifica nós: caminho principal (até navigate) vs laterais (ex. erro).
 * @param {any} workflow
 * @returns {{ onPath: string[], side: Array<{ nodeId: string, nearId: string }> }}
 */
export function classifyWorkflowPathNodes(workflow) {
  const nodes = workflow?.nodes || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outs = new Map();
  for (const e of workflow?.edges || []) {
    if (!outs.has(e.from)) outs.set(e.from, []);
    outs.get(e.from).push(e);
  }

  const onPath = [];
  const visited = new Set();
  let cur = workflow?.entryNodeId || nodes[0]?.id;
  let guard = 0;
  while (cur && guard < 64) {
    guard += 1;
    if (visited.has(cur)) break;
    visited.add(cur);
    const node = byId.get(cur);
    if (!node) break;
    if (node.kind !== 'navigate') onPath.push(cur);
    const edges = outs.get(cur) || [];
    const next =
      edges.find((e) => e.when === 'success') ||
      edges.find((e) => !e.when) ||
      edges[0];
    if (!next) break;
    // Se o atual é navigate, paramos
    if (node.kind === 'navigate') break;
    cur = next.to;
  }

  const onPathSet = new Set(onPath);
  const side = [];
  for (const e of workflow?.edges || []) {
    if (e.when !== 'error') continue;
    if (!byId.has(e.to) || onPathSet.has(e.to)) continue;
    const target = byId.get(e.to);
    if (target?.kind === 'navigate') continue;
    side.push({ nodeId: e.to, nearId: e.from });
  }
  // Nós órfãos restantes (não onPath, não navigate, não side)
  for (const n of nodes) {
    if (n.kind === 'navigate') continue;
    if (onPathSet.has(n.id)) continue;
    if (side.some((s) => s.nodeId === n.id)) continue;
    side.push({ nodeId: n.id, nearId: onPath[onPath.length - 1] || n.id });
  }

  return { onPath, side };
}

/**
 * Posiciona cards do workflow nos pontos da noodle do protótipo.
 * @param {{ entities: any[], workflows: any[] }} domainViews
 * @param {any} workflow
 * @param {Array<{ x: number, y: number }>} pathPoints — centros ao longo da curva (1 por onPath)
 */
export function layoutWorkflowAlongPath(domainViews, workflow, pathPoints) {
  if (!workflow?.id) return normalizeDomainViews(domainViews);
  const { onPath, side } = classifyWorkflowPathNodes(workflow);
  const posById = new Map();
  onPath.forEach((id, i) => {
    const p = pathPoints[i] || pathPoints[pathPoints.length - 1];
    if (!p) return;
    posById.set(id, {
      nodeId: id,
      x: p.x - LOGIC_CARD_W / 2,
      y: p.y - LOGIC_CARD_H / 2,
    });
  });
  for (const s of side) {
    const near = posById.get(s.nearId);
    const base = near || {
      x: (pathPoints[0]?.x || 40) - LOGIC_CARD_W / 2,
      y: (pathPoints[0]?.y || 40) - LOGIC_CARD_H / 2,
    };
    posById.set(s.nodeId, {
      nodeId: s.nodeId,
      x: base.x,
      y: base.y + LOGIC_CARD_H + 36,
    });
  }
  // navigate fica “na ponta” — não precisa de card no meio; se existir view antiga, remove
  const layoutNodes = [...posById.values()];
  const views = normalizeDomainViews(domainViews);
  return {
    ...views,
    workflows: [
      ...(views.workflows || []).filter((v) => v.workflowId !== workflow.id),
      { workflowId: workflow.id, nodes: layoutNodes },
    ],
  };
}

/**
 * Insere um passo no caminho principal, antes do navigate (ou no fim).
 * @param {any} workflow
 * @param {string} kind
 * @param {object} [config]
 */
export function insertStepOnMainPath(workflow, kind, config = {}) {
  const id = cryptoRandomId('wn');
  const node = {
    id,
    kind,
    name: WORKFLOW_KIND_LABEL[kind] || kind,
    config,
  };
  const nodes = [...(workflow.nodes || []), node];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges = [...(workflow.edges || [])];

  // Acha o navigate de sucesso no caminho principal
  let navId = null;
  let predId = null;
  const outs = new Map();
  for (const e of edges) {
    if (!outs.has(e.from)) outs.set(e.from, []);
    outs.get(e.from).push(e);
  }
  let cur = workflow.entryNodeId || nodes[0]?.id;
  let prev = null;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const n = byId.get(cur);
    if (n?.kind === 'navigate') {
      navId = cur;
      predId = prev;
      break;
    }
    const es = outs.get(cur) || [];
    const next =
      es.find((e) => e.when === 'success') ||
      es.find((e) => !e.when) ||
      es[0];
    prev = cur;
    cur = next?.to || null;
  }

  if (navId && predId) {
    // pred -> new -> nav (substitui pred -> nav)
    const nextEdges = edges.filter(
      (e) => !(e.from === predId && e.to === navId && (!e.when || e.when === 'success')),
    );
    const old = edges.find(
      (e) => e.from === predId && e.to === navId && (!e.when || e.when === 'success'),
    );
    nextEdges.push({
      id: cryptoRandomId('we'),
      from: predId,
      to: id,
      ...(old?.when ? { when: old.when } : {}),
    });
    nextEdges.push({
      id: cryptoRandomId('we'),
      from: id,
      to: navId,
    });
    return {
      ...workflow,
      nodes,
      edges: nextEdges,
      entryNodeId: workflow.entryNodeId,
    };
  }

  if (navId && !predId) {
    // entry era navigate: new vira entry
    return {
      ...workflow,
      nodes,
      edges: [
        ...edges,
        { id: cryptoRandomId('we'), from: id, to: navId },
      ],
      entryNodeId: id,
    };
  }

  // Sem navigate: anexa ao fim do caminho
  const last = predId || workflow.entryNodeId || nodes[0]?.id;
  if (last && last !== id) {
    edges.push({ id: cryptoRandomId('we'), from: last, to: id });
  }
  return {
    ...workflow,
    nodes,
    edges,
    entryNodeId: workflow.entryNodeId || id,
  };
}

/**
 * Cria Interaction + Workflow a partir de um gatilho UI (e PrototypeLink opcional).
 * interactionId é a identidade; prototypeLinkId é só faceta.
 *
 * @param {object} opts
 * @param {any} opts.domain
 * @param {string} opts.screenId
 * @param {string} opts.nodeId
 * @param {string} [opts.name]
 * @param {string|null} [opts.prototypeLinkId]
 * @param {string} [opts.toScreenId] — se houver, stub inclui navigate
 * @param {string} [opts.transition]
 * @param {{ entities: any[], workflows: any[] }} [opts.domainViews]
 * @param {{ x?: number, y?: number }} [opts.layoutOrigin] — âncora do grafo ao lado do frame
 */
export function expandInteraction(opts) {
  const domain = normalizeDomain(opts.domain);
  let domainViews = normalizeDomainViews(opts.domainViews);
  const existing = findInteractionByTrigger(
    domain,
    opts.screenId,
    opts.nodeId,
  );
  if (existing?.workflowId) {
    const wf = (domain.workflows || []).find((w) => w.id === existing.workflowId);
    domainViews = ensureWorkflowView(
      domainViews,
      existing.workflowId,
      wf?.nodes || [],
      opts.layoutOrigin,
    );
    return {
      domain,
      domainViews,
      interaction: existing,
      workflow: wf || null,
      created: false,
    };
  }

  const interactionId = existing?.id || cryptoRandomId('ix');
  const workflowId = cryptoRandomId('wf');

  const wnNav = cryptoRandomId('wn');

  // Stub mínimo: só navegar (ou mensagem). O usuário adiciona Validar/API/etc. depois.
  const hasNavigate = Boolean(opts.toScreenId);
  const entryNode = hasNavigate
    ? {
        id: wnNav,
        kind: 'navigate',
        name: WORKFLOW_KIND_LABEL.navigate,
        config: {
          toScreenId: opts.toScreenId,
          transition: opts.transition || 'instant',
        },
      }
    : {
        id: wnNav,
        kind: 'showMessage',
        name: WORKFLOW_KIND_LABEL.showMessage,
        config: { message: 'Ação executada', tone: 'info' },
      };

  const workflow = {
    id: workflowId,
    name: opts.name || 'Fluxo',
    interactionId,
    entryNodeId: wnNav,
    nodes: [entryNode],
    edges: [],
  };

  const interaction = {
    id: interactionId,
    name: opts.name || 'Interação',
    trigger: {
      type: 'uiEvent',
      event: 'onClick',
      screenId: opts.screenId,
      nodeId: opts.nodeId,
    },
    prototypeLinkId: opts.prototypeLinkId || null,
    workflowId,
  };

  const interactions = existing
    ? domain.interactions.map((ix) =>
        ix.id === existing.id ? interaction : ix,
      )
    : [...domain.interactions, interaction];

  const nextDomain = {
    ...domain,
    interactions,
    workflows: [...domain.workflows, workflow],
    apis: domain.apis,
  };

  const nextViews = ensureWorkflowView(
    domainViews,
    workflowId,
    workflow.nodes,
    opts.layoutOrigin,
  );

  return {
    domain: nextDomain,
    domainViews: nextViews,
    interaction,
    workflow,
    created: true,
  };
}

/**
 * Seed de fluxo Login completo (Validar → API → Branch → Navegar | Mensagem).
 * Usado em demos; não altera expand stub mínimo.
 *
 * @param {object} opts
 * @param {any} opts.domain
 * @param {{ entities: any[], workflows: any[] }} [opts.domainViews]
 * @param {string} opts.screenId
 * @param {string} opts.nodeId
 * @param {string} opts.toScreenId
 * @param {string} [opts.transition]
 * @param {string} [opts.name]
 * @param {string|null} [opts.prototypeLinkId]
 * @param {{ x?: number, y?: number }} [opts.layoutOrigin]
 */
export function seedLoginWorkflow(opts) {
  const base = expandInteraction(opts);
  const interactionId = base.interaction.id;
  const workflowId = base.workflow?.id || cryptoRandomId('wf');
  const wnVal = cryptoRandomId('wn');
  const wnApi = cryptoRandomId('wn');
  const wnBranch = cryptoRandomId('wn');
  const wnNav = cryptoRandomId('wn');
  const wnMsg = cryptoRandomId('wn');
  const apiId = cryptoRandomId('api');
  const ox = Number(opts.layoutOrigin?.x) || 40;
  const oy = Number(opts.layoutOrigin?.y) || 40;

  const workflow = {
    id: workflowId,
    name: opts.name || 'Login',
    interactionId,
    entryNodeId: wnVal,
    nodes: [
      {
        id: wnVal,
        kind: 'validate',
        name: WORKFLOW_KIND_LABEL.validate,
        config: { simulate: 'success' },
      },
      {
        id: wnApi,
        kind: 'apiCall',
        name: WORKFLOW_KIND_LABEL.apiCall,
        config: { apiId, simulate: 'success' },
      },
      {
        id: wnBranch,
        kind: 'branch',
        name: WORKFLOW_KIND_LABEL.branch,
        config: {},
      },
      {
        id: wnNav,
        kind: 'navigate',
        name: WORKFLOW_KIND_LABEL.navigate,
        config: {
          toScreenId: opts.toScreenId,
          transition: opts.transition || 'dissolve',
        },
      },
      {
        id: wnMsg,
        kind: 'showMessage',
        name: WORKFLOW_KIND_LABEL.showMessage,
        config: { message: 'Email ou senha inválidos', tone: 'error' },
      },
    ],
    edges: [
      { id: cryptoRandomId('we'), from: wnVal, to: wnApi },
      { id: cryptoRandomId('we'), from: wnApi, to: wnBranch },
      { id: cryptoRandomId('we'), from: wnBranch, to: wnNav, when: 'success' },
      { id: cryptoRandomId('we'), from: wnBranch, to: wnMsg, when: 'error' },
    ],
  };

  const interaction = {
    ...base.interaction,
    name: opts.name || 'Entrar',
    prototypeLinkId: opts.prototypeLinkId || base.interaction.prototypeLinkId,
    workflowId,
  };

  const domain = normalizeDomain(base.domain);
  const nextDomain = {
    ...domain,
    interactions: (domain.interactions || []).map((ix) =>
      ix.id === interactionId ? interaction : ix,
    ),
    workflows: [
      ...(domain.workflows || []).filter((w) => w.id !== workflowId),
      workflow,
    ],
    apis: [
      ...(domain.apis || []).filter((a) => a.id !== apiId),
      {
        id: apiId,
        name: 'Auth login',
        method: 'POST',
        path: '/api/auth/login',
        physicalBindingId: null,
      },
    ],
  };

  const layoutNodes = [
    { nodeId: wnVal, x: ox, y: oy },
    { nodeId: wnApi, x: ox, y: oy + WORKFLOW_NODE_GAP_Y },
    { nodeId: wnBranch, x: ox, y: oy + WORKFLOW_NODE_GAP_Y * 2 },
    {
      nodeId: wnNav,
      x: ox + WORKFLOW_NODE_GAP_X,
      y: oy + WORKFLOW_NODE_GAP_Y * 2,
    },
    {
      nodeId: wnMsg,
      x: ox + WORKFLOW_NODE_GAP_X,
      y: oy + WORKFLOW_NODE_GAP_Y * 3,
    },
  ];

  const prevViews = normalizeDomainViews(base.domainViews);
  const domainViews = {
    ...prevViews,
    workflows: [
      ...(prevViews.workflows || []).filter((v) => v.workflowId !== workflowId),
      { workflowId, nodes: layoutNodes },
    ],
  };

  return {
    domain: nextDomain,
    domainViews,
    interaction,
    workflow,
    created: true,
  };
}

/**
 * Interpreta um workflow de forma semi-executável (mock).
 * Não exige terminar em navigate — pode terminar em showMessage / setState.
 *
 * @param {any} workflow
 * @param {object} [opts]
 * @param {'success'|'error'} [opts.forceOutcome] — força branch no preview
 * @returns {{ steps: Array<{ nodeId: string, kind: string, name: string, detail?: string }>, outcome: 'navigate'|'message'|'state'|'done'|'error', navigate?: { toScreenId: string, transition: string }, message?: string, statePatches?: Record<string, unknown> }}
 */
export function simulateWorkflow(workflow, opts = {}) {
  const steps = [];
  if (!workflow?.entryNodeId || !workflow.nodes?.length) {
    return { steps, outcome: 'done' };
  }

  const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
  const outs = new Map();
  for (const e of workflow.edges || []) {
    if (!outs.has(e.from)) outs.set(e.from, []);
    outs.get(e.from).push(e);
  }

  let currentId = workflow.entryNodeId;
  let guard = 0;
  let navigate;
  let message;
  /** @type {Record<string, unknown>} */
  const statePatches = {};
  let lastBranch = opts.forceOutcome || 'success';

  while (currentId && guard < 64) {
    guard += 1;
    const node = byId.get(currentId);
    if (!node) break;

    const cfg = node.config || {};
    let detail = '';

    if (node.kind === 'validate') {
      const sim = cfg.simulate === 'error' ? 'error' : 'success';
      lastBranch = opts.forceOutcome || sim;
      detail = lastBranch;
    } else if (node.kind === 'apiCall') {
      const sim = cfg.simulate === 'error' ? 'error' : 'success';
      lastBranch = opts.forceOutcome || sim;
      detail = `${cfg.apiId || 'api'} → ${lastBranch}`;
    } else if (node.kind === 'branch') {
      detail = lastBranch;
    } else if (node.kind === 'setState') {
      if (cfg.key) statePatches[String(cfg.key)] = cfg.value;
      detail = `${cfg.key}=${cfg.value}`;
    } else if (node.kind === 'navigate') {
      navigate = {
        toScreenId: String(cfg.toScreenId || ''),
        transition: String(cfg.transition || 'instant'),
      };
      detail = navigate.toScreenId;
    } else if (node.kind === 'showMessage') {
      message = String(cfg.message || '');
      detail = message;
    }

    steps.push({
      nodeId: node.id,
      kind: node.kind,
      name: node.name,
      detail,
    });

    const edges = outs.get(currentId) || [];
    if (node.kind === 'branch') {
      const match =
        edges.find((e) => e.when === lastBranch) ||
        edges.find((e) => !e.when) ||
        null;
      currentId = match?.to || null;
      continue;
    }

    // Terminal kinds (sem aresta obrigatória)
    if (
      node.kind === 'navigate' ||
      node.kind === 'showMessage' ||
      (node.kind === 'setState' && edges.length === 0)
    ) {
      if (edges.length === 0) break;
    }

    const next = edges.find((e) => !e.when) || edges[0];
    currentId = next?.to || null;
  }

  if (navigate?.toScreenId) {
    return { steps, outcome: 'navigate', navigate, statePatches };
  }
  if (message) {
    return { steps, outcome: 'message', message, statePatches };
  }
  if (Object.keys(statePatches).length) {
    return { steps, outcome: 'state', statePatches };
  }
  return { steps, outcome: 'done', statePatches };
}

/**
 * Reancora cards do workflow na curva do PrototypeLink.
 * @param {{ entities: any[], workflows: any[] }} domainViews
 * @param {import('./schema.js').Screen[]} screens
 * @param {any[]} prototypes
 * @param {any} interaction
 * @param {any} workflow
 */
export function relayoutWorkflowOnPrototype(
  domainViews,
  screens,
  prototypes,
  interaction,
  workflow,
) {
  if (!interaction?.prototypeLinkId || !workflow) return domainViews;
  const link = (prototypes || []).find(
    (p) => p.id === interaction.prototypeLinkId,
  );
  if (!link) return domainViews;
  const { onPath } = classifyWorkflowPathNodes(workflow);
  const pts = samplePointsAlongPrototypeLink(
    screens || [],
    link,
    onPath.length,
  );
  return layoutWorkflowAlongPath(domainViews, workflow, pts);
}

/**
 * Default config por kind (igual UI do Lógico).
 * @param {string} kind
 * @param {object} [config]
 */
function defaultLogicStepConfig(kind, config) {
  if (config && typeof config === 'object' && Object.keys(config).length) {
    return { ...config };
  }
  if (kind === 'validate') return { simulate: 'success' };
  if (kind === 'apiCall') {
    return { apiId: cryptoRandomId('api'), simulate: 'success' };
  }
  if (kind === 'showMessage') return { message: 'Mensagem', tone: 'info' };
  if (kind === 'setState') return { key: 'status', value: 'ok' };
  if (kind === 'branch') return {};
  return config || {};
}

/**
 * Garante Interaction+Workflow no protótipo e insere um passo no caminho
 * (mesmo fluxo do + no Lógico da UI).
 *
 * @param {object} opts
 * @param {any} opts.domain
 * @param {any} opts.domainViews
 * @param {import('./schema.js').Screen[]} opts.screens
 * @param {any[]} opts.prototypes
 * @param {string} opts.linkId
 * @param {string} opts.kind
 * @param {object} [opts.config]
 */
export function insertLogicStepOnPrototype(opts) {
  const {
    screens = [],
    prototypes = [],
    linkId,
    kind,
  } = opts;
  if (!linkId || !kind) {
    throw new Error('linkId e kind são obrigatórios');
  }
  if (kind === 'navigate') {
    throw new Error(
      'Não use kind=navigate no caminho; o destino já é a tela do protótipo',
    );
  }
  if (!WORKFLOW_KINDS.includes(kind)) {
    throw new Error(`kind inválido: ${kind}`);
  }

  const link = (prototypes || []).find((p) => p.id === linkId);
  if (!link) throw new Error(`PrototypeLink não encontrado: ${linkId}`);

  const screen = (screens || []).find((s) => s.id === link.fromScreenId);
  const nodeName =
    screen && findNodeById(screen.nodes, link.triggerNodeId)?.name;

  let domain = opts.domain;
  let domainViews = opts.domainViews;
  const expanded = expandInteraction({
    domain,
    domainViews,
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
  domain = expanded.domain;
  domainViews = expanded.domainViews;
  const interaction = expanded.interaction;
  let workflow = (domain.workflows || []).find(
    (w) => w.id === interaction.workflowId,
  );
  if (!workflow) throw new Error('Workflow não encontrado após expand');

  const config = defaultLogicStepConfig(kind, opts.config);
  const apiId =
    kind === 'apiCall' ? config.apiId || cryptoRandomId('api') : null;
  if (kind === 'apiCall' && apiId) {
    config.apiId = apiId;
  }

  const beforeIds = new Set((workflow.nodes || []).map((n) => n.id));
  workflow = insertStepOnMainPath(workflow, kind, config);
  const newNode = (workflow.nodes || []).find((n) => !beforeIds.has(n.id));

  domain = {
    ...domain,
    workflows: (domain.workflows || []).map((w) =>
      w.id === workflow.id ? workflow : w,
    ),
    apis:
      kind === 'apiCall' && apiId
        ? [
            ...(domain.apis || []).filter((a) => a.id !== apiId),
            {
              id: apiId,
              name: 'API',
              method: 'POST',
              path: '/api/action',
              physicalBindingId: null,
            },
          ]
        : domain.apis,
  };

  domainViews = relayoutWorkflowOnPrototype(
    domainViews,
    screens,
    prototypes,
    interaction,
    workflow,
  );

  return {
    domain,
    domainViews,
    interaction,
    workflow,
    nodeId: newNode?.id || null,
  };
}
