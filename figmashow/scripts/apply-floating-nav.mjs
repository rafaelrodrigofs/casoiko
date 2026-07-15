/**
 * Reaplica nav flutuante (branco) e restaura FABs das telas.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBoard, writeBoard } from '../packages/core/src/index.js';
import { W, bottomNav, NAV_Y, matIcon } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');
const PAD = 16;
const fabSize = 56;

function casaFab() {
  return {
    id: 'grp_casa_fab',
    type: 'group',
    name: 'FAB',
    children: [
      {
        id: 'fab',
        type: 'button',
        name: 'FAB +',
        x: W - PAD - fabSize,
        y: NAV_Y - fabSize - 16,
        w: fabSize,
        h: fabSize,
        label: '+',
        fill: '#3B82F6',
        textColor: '#FFFFFF',
        cornerRadius: 16,
        fontSize: 28,
        fontWeight: 400,
      },
    ],
  };
}

function mercadoFab() {
  return {
    id: 'grp_mercado_fab',
    type: 'group',
    name: 'FAB',
    children: [
      {
        id: 'fab_nova_lista',
        type: 'button',
        name: 'Nova lista',
        x: W - PAD - 148,
        y: NAV_Y - 56 - 16,
        w: 148,
        h: 56,
        label: '+  Nova lista',
        fill: '#3B82F6',
        textColor: '#FFFFFF',
        cornerRadius: 16,
        fontSize: 15,
        fontWeight: 600,
      },
    ],
  };
}

function contasFab() {
  return {
    id: 'grp_contas_fab',
    type: 'group',
    name: 'FAB',
    children: [
      {
        id: 'fab_add',
        type: 'button',
        name: 'Adicionar',
        x: W - PAD - 56,
        y: NAV_Y - 56 - 16,
        w: 56,
        h: 56,
        label: '+',
        fill: '#3B82F6',
        textColor: '#FFFFFF',
        cornerRadius: 16,
        fontSize: 28,
        fontWeight: 400,
      },
    ],
  };
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));

const TARGETS = {
  casa: { active: 'casa', fab: casaFab },
  mercado: { active: 'mercado', fab: mercadoFab },
  contas: { active: 'contas', fab: contasFab },
  chat: { active: 'chat', fab: null },
};

for (const [screenId, cfg] of Object.entries(TARGETS)) {
  const screen = raw.screens.find((s) => s.id === screenId);
  if (!screen) continue;

  screen.nodes = screen.nodes.filter((n) => {
    if (n.name === 'Bottom nav') return false;
    if (typeof n.id === 'string' && n.id.startsWith('grp_nav_')) return false;
    if (n.name === 'FAB') return false;
    if (
      n.id === 'grp_casa_fab' ||
      n.id === 'grp_mercado_fab' ||
      n.id === 'grp_contas_fab'
    ) {
      return false;
    }
    return true;
  });

  if (screenId === 'chat') {
    const composer = screen.nodes.find((n) => n.id === 'grp_chat_composer');
    if (composer?.children) {
      const shiftTarget = NAV_Y - 64;
      const bg = composer.children.find((c) => c.id === 'composer_bg');
      if (bg && typeof bg.y === 'number') {
        const dy = shiftTarget - bg.y;
        for (const c of composer.children) {
          if (typeof c.y === 'number') c.y += dy;
        }
      }
    }
  }

  if (cfg.fab) screen.nodes.push(cfg.fab());
  screen.nodes.push(bottomNav(cfg.active));
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);
console.log('ok floating white nav + FABs restored');
