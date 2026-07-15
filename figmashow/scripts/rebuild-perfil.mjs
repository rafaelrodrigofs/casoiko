/**
 * Tela Perfil — referência soft dashboard (FigmaShow).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createScreen,
  normalizeBoard,
  writeBoard,
} from '../packages/core/src/index.js';
import {
  W,
  H,
  STATUS,
  BAR,
  HEADER_H,
  matIcon,
  bottomNav,
  colors,
} from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');
const PAD = 16;

function heatCell(id, x, y, fill) {
  return {
    id,
    type: 'rect',
    name: 'Dia',
    x,
    y,
    w: 10,
    h: 10,
    fill,
    cornerRadius: 2,
    opacity: 1,
  };
}

const nodes = [];

// —— Header igual Mercado/Chat (gradiente + bottom radius)
nodes.push({
  id: 'grp_perfil_header',
  type: 'group',
  name: 'Header',
  children: [
    {
      id: 'perfil_header_bg',
      type: 'rect',
      name: 'Fundo header',
      x: 0,
      y: 0,
      w: W,
      h: HEADER_H,
      fill: colors.headerGradient,
      bottomRadius: 24,
      opacity: 1,
    },
    matIcon({
      id: 'perfil_icon',
      name: 'Ícone',
      icon: 'person',
      x: 20,
      y: STATUS,
      w: 28,
      h: BAR,
      size: 18,
      color: '#FFFFFF',
    }),
    {
      id: 'perfil_title',
      type: 'text',
      name: 'Título',
      x: 52,
      y: STATUS,
      w: 200,
      h: BAR,
      text: 'Perfil',
      fontSize: 17,
      fontWeight: 700,
      color: '#FFFFFF',
      align: 'left',
    },
    // Admin → painel de gerenciamento (só para administradores)
    matIcon({
      id: 'perfil_admin_btn',
      name: 'Admin',
      icon: 'admin_panel_settings',
      x: W - 52,
      y: STATUS,
      w: 40,
      h: BAR,
      size: 24,
      color: '#FFFFFF',
    }),
  ],
});

// —— Saudação (abaixo do header)
const greetY = HEADER_H + 16;
nodes.push({
  id: 'grp_perfil_greet',
  type: 'group',
  name: 'Saudação',
  children: [
    {
      id: 'perfil_avatar',
      type: 'rect',
      name: 'Avatar',
      x: PAD,
      y: greetY,
      w: 52,
      h: 52,
      fill: 'rgba(59,130,246,0.18)',
      cornerRadius: 26,
      opacity: 1,
    },
    matIcon({
      id: 'perfil_avatar_icon',
      name: 'Foto',
      icon: 'person',
      x: PAD,
      y: greetY + 12,
      w: 52,
      h: 28,
      size: 28,
      color: colors.primary,
    }),
    {
      id: 'perfil_hello',
      type: 'text',
      name: 'Saudação',
      x: PAD + 64,
      y: greetY + 6,
      w: 280,
      h: 24,
      text: 'Oi, Rafael',
      fontSize: 20,
      fontWeight: 800,
      color: colors.text,
      align: 'left',
    },
    {
      id: 'perfil_streak',
      type: 'text',
      name: 'Streak',
      x: PAD + 64,
      y: greetY + 32,
      w: 280,
      h: 18,
      text: 'Rotina da casa em dia por 1 dia!',
      fontSize: 13,
      fontWeight: 400,
      color: colors.textSecondary,
      align: 'left',
    },
  ],
});

// —— Stats
const statsY = greetY + 68;
const cardW = (W - PAD * 2 - 12) / 2;
nodes.push({
  id: 'grp_perfil_stats',
  type: 'group',
  name: 'Estatísticas',
  children: [
    {
      id: 'stat_done_bg',
      type: 'rect',
      name: 'Card concluídas',
      x: PAD,
      y: statsY,
      w: cardW,
      h: 88,
      fill: 'rgba(59,130,246,0.10)',
      cornerRadius: 16,
      opacity: 1,
    },
    {
      id: 'stat_done_label',
      type: 'text',
      name: 'Label concluídas',
      x: PAD + 12,
      y: statsY + 14,
      w: cardW - 24,
      h: 18,
      text: 'Concluídas hoje',
      fontSize: 12,
      fontWeight: 500,
      color: colors.textSecondary,
      align: 'left',
    },
    {
      id: 'stat_done_value',
      type: 'text',
      name: 'Valor concluídas',
      x: PAD + 12,
      y: statsY + 40,
      w: cardW - 24,
      h: 36,
      text: '12',
      fontSize: 32,
      fontWeight: 800,
      color: colors.text,
      align: 'left',
    },
    {
      id: 'stat_pend_bg',
      type: 'rect',
      name: 'Card pendentes',
      x: PAD + cardW + 12,
      y: statsY,
      w: cardW,
      h: 88,
      fill: 'rgba(59,130,246,0.10)',
      cornerRadius: 16,
      opacity: 1,
    },
    {
      id: 'stat_pend_label',
      type: 'text',
      name: 'Label pendentes',
      x: PAD + cardW + 24,
      y: statsY + 14,
      w: cardW - 24,
      h: 18,
      text: 'Pendentes hoje',
      fontSize: 12,
      fontWeight: 500,
      color: colors.textSecondary,
      align: 'left',
    },
    {
      id: 'stat_pend_value',
      type: 'text',
      name: 'Valor pendentes',
      x: PAD + cardW + 24,
      y: statsY + 40,
      w: cardW - 24,
      h: 36,
      text: '3',
      fontSize: 32,
      fontWeight: 800,
      color: colors.text,
      align: 'left',
    },
  ],
});

// —— Heatmap
const heatY = statsY + 104;
const heatH = 248;
const heatKids = [
  {
    id: 'heat_bg',
    type: 'rect',
    name: 'Card mapa',
    x: PAD,
    y: heatY,
    w: W - PAD * 2,
    h: heatH,
    fill: colors.surface,
    cornerRadius: 18,
    opacity: 1,
    stroke: 'rgba(59,130,246,0.10)',
    strokeWidth: 1,
  },
  {
    id: 'heat_title',
    type: 'text',
    name: 'Título mapa',
    x: PAD + 14,
    y: heatY + 14,
    w: 200,
    h: 22,
    text: 'Mapa de calor anual',
    fontSize: 15,
    fontWeight: 700,
    color: colors.text,
    align: 'left',
  },
  matIcon({
    id: 'heat_info',
    name: 'Info',
    icon: 'info',
    x: PAD + 168,
    y: heatY + 14,
    w: 22,
    h: 22,
    size: 16,
    color: colors.textSecondary,
  }),
  {
    id: 'heat_year_bg',
    type: 'rect',
    name: 'Ano fundo',
    x: W - PAD - 72,
    y: heatY + 12,
    w: 56,
    h: 26,
    fill: colors.background,
    cornerRadius: 8,
    opacity: 1,
  },
  {
    id: 'heat_year',
    type: 'text',
    name: 'Ano',
    x: W - PAD - 72,
    y: heatY + 15,
    w: 56,
    h: 20,
    text: '2026',
    fontSize: 12,
    fontWeight: 600,
    color: colors.text,
    align: 'center',
  },
];

const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
days.forEach((d, i) => {
  heatKids.push({
    id: `heat_d_${i}`,
    type: 'text',
    name: d,
    x: PAD + 10,
    y: heatY + 52 + i * 18,
    w: 16,
    h: 14,
    text: d,
    fontSize: 9,
    fontWeight: 500,
    color: colors.textSecondary,
    align: 'center',
  });
});

const gridX0 = PAD + 32;
const gridY0 = heatY + 52;
const cols = 20;
const colGap = 14;
for (let col = 0; col < cols; col++) {
  for (let row = 0; row < 7; row++) {
    const n = (col * 7 + row) % 5;
    const fill =
      n === 0
        ? '#E8F1FE'
        : n === 1
          ? '#BFDBFE'
          : n === 2
            ? '#93C5FD'
            : n === 3
              ? '#60A5FA'
              : '#3B82F6';
    heatKids.push(
      heatCell(`heat_${col}_${row}`, gridX0 + col * colGap, gridY0 + row * 18, fill),
    );
  }
}

// Meses sob o grid (faixa ~jul–nov da referência, espaçados)
const months = ['jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const monthY = gridY0 + 7 * 18 + 8;
const monthSpan = (cols - 1) * colGap;
months.forEach((m, i) => {
  const x = gridX0 + (i / (months.length - 1)) * monthSpan - 10;
  heatKids.push({
    id: `heat_m_${i}`,
    type: 'text',
    name: m,
    x,
    y: monthY,
    w: 36,
    h: 14,
    text: m,
    fontSize: 10,
    fontWeight: 500,
    color: colors.textSecondary,
    align: 'left',
  });
});

nodes.push({
  id: 'grp_perfil_heatmap',
  type: 'group',
  name: 'Mapa de calor',
  children: heatKids,
});

// —— Donut / concluídas
const doneY = heatY + heatH + 16;
nodes.push({
  id: 'grp_perfil_done',
  type: 'group',
  name: 'Tarefas concluídas',
  children: [
    {
      id: 'done_bg',
      type: 'rect',
      name: 'Card',
      x: PAD,
      y: doneY,
      w: W - PAD * 2,
      h: 140,
      fill: colors.surface,
      cornerRadius: 18,
      opacity: 1,
      stroke: 'rgba(59,130,246,0.10)',
      strokeWidth: 1,
    },
    {
      id: 'done_title',
      type: 'text',
      name: 'Título',
      x: PAD + 14,
      y: doneY + 14,
      w: 160,
      h: 22,
      text: 'Tarefas concluídas ▾',
      fontSize: 14,
      fontWeight: 700,
      color: colors.text,
      align: 'left',
    },
    {
      id: 'done_range_bg',
      type: 'rect',
      name: 'Período fundo',
      x: W - PAD - 100,
      y: doneY + 12,
      w: 84,
      h: 26,
      fill: colors.background,
      cornerRadius: 8,
      opacity: 1,
    },
    {
      id: 'done_range',
      type: 'text',
      name: 'Período',
      x: W - PAD - 100,
      y: doneY + 15,
      w: 84,
      h: 20,
      text: '30 dias ▾',
      fontSize: 12,
      fontWeight: 600,
      color: colors.text,
      align: 'center',
    },
    {
      id: 'done_ring_outer',
      type: 'rect',
      name: 'Anel externo',
      x: PAD + 28,
      y: doneY + 52,
      w: 64,
      h: 64,
      fill: 'rgba(59,130,246,0.12)',
      cornerRadius: 32,
      opacity: 1,
    },
    {
      id: 'done_ring_inner',
      type: 'rect',
      name: 'Anel interno',
      x: PAD + 40,
      y: doneY + 64,
      w: 40,
      h: 40,
      fill: colors.surface,
      cornerRadius: 20,
      opacity: 1,
    },
    {
      id: 'done_empty',
      type: 'text',
      name: 'Empty',
      x: PAD + 110,
      y: doneY + 72,
      w: 200,
      h: 24,
      text: 'Nenhuma tarefa',
      fontSize: 15,
      fontWeight: 600,
      color: colors.textSecondary,
      align: 'left',
    },
  ],
});

nodes.push(bottomNav('perfil'));

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const chat = raw.screens.find((s) => s.id === 'chat');

let screen = raw.screens.find((s) => s.id === 'perfil');
if (!screen) {
  screen = createScreen({
    id: 'perfil',
    name: '06 — Perfil',
    width: W,
    height: H,
    background: colors.background,
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = '06 — Perfil';
screen.background = colors.background;
screen.width = W;
screen.height = H;
screen.x = (chat?.x ?? 1880) + W + 80;
screen.y = chat?.y ?? 0;
screen.nodes = nodes;

// Atualiza navs das abas principais com 5 itens
const tabMap = {
  casa: 'casa',
  mercado: 'mercado',
  contas: 'contas',
  chat: 'chat',
  perfil: 'perfil',
};
for (const [id, active] of Object.entries(tabMap)) {
  const s = raw.screens.find((x) => x.id === id);
  if (!s) continue;
  s.nodes = s.nodes.filter((n) => n.name !== 'Bottom nav');
  s.nodes.push(bottomNav(active));
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

console.log(
  JSON.stringify(
    {
      id: screen.id,
      x: screen.x,
      y: screen.y,
      groups: screen.nodes.map((n) => n.name),
    },
    null,
    2,
  ),
);
