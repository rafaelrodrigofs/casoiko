#!/usr/bin/env node
/**
 * Reorganiza camadas do projeto Natalia — grupos lógicos por seção (estilo Figma).
 */
import {
  findScreen,
  groupSiblingNodes,
  readBoard,
  removeNodeFromTree,
  scrubBoardRefs,
  syncAllComponentDefs,
  updateNodeInTree,
  writeBoard,
  resolveProjectBoardPath,
} from '../packages/core/src/index.js';

const PROJECT_ID = 'id_8aa2a1ba';
const path = resolveProjectBoardPath(PROJECT_ID);
let board = readBoard(path);

/**
 * @param {import('../packages/core/src/schema.js').BoardNode[]} nodes
 * @param {string[]} ids
 * @param {string} name
 */
function groupNamed(nodes, ids, name) {
  const result = groupSiblingNodes(nodes, ids);
  if (!result.groupId) {
    throw new Error(`Falha ao agrupar "${name}" (${ids.join(', ')})`);
  }
  const res = updateNodeInTree(result.nodes, result.groupId, (n) => ({
    ...n,
    name,
  }));
  return res.nodes;
}

/** @param {string} screenId @param {(nodes: import('../packages/core/src/schema.js').BoardNode[]) => import('../packages/core/src/schema.js').BoardNode[]} fn */
function organizeScreen(screenId, fn) {
  const screen = findScreen(board, screenId);
  if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
  screen.nodes = fn(screen.nodes);
}

// —— 01 Boas-vindas ——
organizeScreen('nat_welcome', (nodes) => {
  let n = nodes;
  n = groupNamed(n, ['w_hero', 'w_circle', 'w_initials'], 'Hero');
  n = groupNamed(n, ['w_name', 'w_role'], 'Identidade');
  n = groupNamed(n, ['w_quote_bg', 'w_quote'], 'Citação');
  const mainCta = n.find((node) => node.type === 'component');
  const actionIds = [mainCta?.id, 'w_cta2'].filter(Boolean);
  n = groupNamed(n, actionIds, 'Ações');
  return n;
});

// —— 02 Início ——
organizeScreen('nat_home', (nodes) => {
  let n = nodes;
  const withoutDup = removeNodeFromTree(n, 'h_cta');
  n = withoutDup.nodes;
  n = groupNamed(n, ['h_header', 'h_greet', 'h_title'], 'Header');
  n = groupNamed(
    n,
    ['h_card1', 'h_card1_i', 'h_card1_t', 'h_card1_d'],
    'Card / Serviços',
  );
  n = groupNamed(
    n,
    ['h_card2', 'h_card2_i', 'h_card2_t', 'h_card2_d'],
    'Card / Agendar',
  );
  n = groupNamed(
    n,
    ['h_section', 'h_slot', 'h_slot_t', 'h_slot_d'],
    'Próximo horário',
  );
  const inst = n.find((node) => node.type === 'instance');
  if (inst) n = groupNamed(n, [inst.id], 'CTA fixo');
  return n;
});

// —— 03 Sobre ——
organizeScreen('nat_about', (nodes) => {
  let n = nodes;
  n = groupNamed(n, ['a_header', 'a_photo', 'a_bio'], 'Conteúdo');
  n = groupNamed(n, ['a_crp', 'a_crp_t'], 'Credenciais');
  n = groupNamed(n, ['a_values'], 'Valores');
  return n;
});

// —— 04 Serviços ——
organizeScreen('nat_services', (nodes) => {
  let n = nodes;
  n = groupNamed(n, ['s1', 's1_t', 's1_d'], 'Terapia individual');
  n = groupNamed(n, ['s2', 's2_t', 's2_d'], 'Primeira consulta');
  n = groupNamed(n, ['s3', 's3_t', 's3_d'], 'Orientação parental');
  // Header por último (fica acima na árvore se a ordem for invertida na UI)
  n = groupNamed(n, ['s_title'], 'Header');
  return n;
});

// —— 05 Agendar ——
organizeScreen('nat_book', (nodes) => {
  let n = nodes;
  n = groupNamed(n, ['b_title', 'b_sub'], 'Header');
  n = groupNamed(n, ['b_field1', 'b_field1_l'], 'Campo / Nome');
  n = groupNamed(n, ['b_field2', 'b_field2_l'], 'Campo / E-mail');
  n = groupNamed(n, ['b_pills', 'b_pill1', 'b_pill2'], 'Modalidade');
  n = groupNamed(n, ['b_cta'], 'Confirmar');
  return n;
});

// —— 06 Contato ——
organizeScreen('nat_contact', (nodes) => {
  let n = nodes;
  n = groupNamed(n, ['c_title'], 'Header');
  n = groupNamed(
    n,
    ['c_card', 'c_name', 'c_email', 'c_phone', 'c_wa'],
    'Card / Contato',
  );
  n = groupNamed(n, ['c_ig'], 'Redes sociais');
  return n;
});

board = syncAllComponentDefs(scrubBoardRefs(board));
writeBoard(board, path);

const summary = board.screens.map((s) => ({
  screen: s.name,
  topLevel: s.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    children: n.children?.length ?? 0,
  })),
}));

console.log(JSON.stringify({ ok: true, summary }, null, 2));
