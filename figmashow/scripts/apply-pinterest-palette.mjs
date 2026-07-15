/**
 * Aplica paleta soft blue (ref. Pinterest) em todo o board.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBoard, writeBoard } from '../packages/core/src/index.js';
import { COLOR_REPLACEMENTS } from './tokens.mjs';
import { bottomNav } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');

function remapString(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const [from, to] of COLOR_REPLACEMENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

function walk(node) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = walk(node[i]);
    return node;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (typeof v === 'string') node[key] = remapString(v);
      else node[key] = walk(v);
    }
  }
  return node;
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
walk(raw);

// Refresh floating navs com tokens novos
const tabByScreen = {
  casa: 'casa',
  mercado: 'mercado',
  contas: 'contas',
  chat: 'chat',
};

for (const [screenId, active] of Object.entries(tabByScreen)) {
  const screen = raw.screens.find((s) => s.id === screenId);
  if (!screen) continue;
  screen.nodes = screen.nodes.filter((n) => n.name !== 'Bottom nav');
  screen.nodes.push(bottomNav(active));
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

// Sanity: legado navy não deve restar nos fills principais
const dump = JSON.stringify(board);
const leftover = [
  '#1B355A',
  '#0F1F35',
  '#2A4A7A',
  '#F6F7F9',
  'rgba(27,53,90',
].filter((c) => dump.includes(c));

console.log(
  JSON.stringify(
    {
      ok: leftover.length === 0,
      leftover,
      samplePrimary: dump.includes('#3B82F6'),
      sampleBg: dump.includes('#EEF5FC'),
      screens: board.screens.map((s) => s.id),
    },
    null,
    2,
  ),
);
