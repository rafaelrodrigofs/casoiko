/**
 * Substitui emojis no board por Material Icons + bottom nav compartilhada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBoard, writeBoard } from '../packages/core/src/index.js';
import { bottomNav } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');

const ICON_MAP = {
  '⌂': 'home',
  '🛒': 'shopping_cart',
  '💬': 'chat_bubble',
  '📷': 'photo_camera',
  '📦': 'inventory_2',
  '💡': 'lightbulb',
  '📡': 'wifi',
  '🏠': 'home',
  '🥬': 'eco',
  '💊': 'medication',
  '✓': 'check',
  '‹': 'chevron_left',
  '›': 'chevron_right',
  '➤': 'send',
  '⎋': 'logout',
  '↓': 'arrow_downward',
  '↑': 'arrow_upward',
};

function fixNode(node) {
  if (node.type === 'group') {
    return { ...node, children: (node.children || []).map(fixNode) };
  }
  if (node.type !== 'text') return node;

  const t = String(node.text || '');
  // legado: "emoji\\nLabel" em um único nó — vira só label (nav será refeita)
  if (t.includes('\n')) {
    const parts = t.split('\n');
    const last = parts[parts.length - 1];
    return {
      ...node,
      text: last,
      icon: false,
    };
  }
  if (ICON_MAP[t]) {
    return {
      ...node,
      text: ICON_MAP[t],
      icon: true,
      fontWeight: 400,
      name: node.name && node.name !== t ? node.name : ICON_MAP[t],
    };
  }
  return node;
}

function isNavGroup(n) {
  return (
    n.type === 'group' &&
    (n.name === 'Bottom nav' ||
      /^grp_.*nav/.test(n.id) ||
      n.id === 'grp_casa_nav' ||
      n.id === 'grp_mercado_nav' ||
      n.id === 'grp_contas_nav' ||
      n.id === 'grp_chat_nav')
  );
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const activeByScreen = {
  casa: 'casa',
  mercado: 'mercado',
  contas: 'contas',
  chat: 'chat',
};

for (const screen of raw.screens) {
  screen.nodes = screen.nodes.filter((n) => !isNavGroup(n)).map(fixNode);
  const active = activeByScreen[screen.id];
  if (active) {
    screen.nodes.push(bottomNav(active));
  }
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const icons = [];
function collect(nodes) {
  for (const n of nodes) {
    if (n.type === 'group') collect(n.children);
    else if (n.icon) icons.push(n.text);
  }
}
for (const s of board.screens) collect(s.nodes);
console.log('ok icons:', [...new Set(icons)].join(', '));
console.log(
  'nav casa',
  board.screens
    .find((s) => s.id === 'casa')
    .nodes.find((n) => n.name === 'Bottom nav')
    .children.filter((c) => c.icon)
    .map((c) => c.text)
    .join(', '),
);
