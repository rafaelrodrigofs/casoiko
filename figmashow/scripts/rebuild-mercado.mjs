/**
 * Cria a tela 03 — Mercado no board FigmaShow (fiel ao Flutter).
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
  NAV_Y,
  matIcon,
  bottomNav,
} from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');

const PAD = 16;

function listCard({ id, name, icon, subtitle, badge, y }) {
  const kids = [
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Card fundo',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 80,
      fill: '#FFFFFF',
      cornerRadius: 16,
      opacity: 1,
    },
    {
      id: `${id}_icon_bg`,
      type: 'rect',
      name: 'Ícone fundo',
      x: PAD + 16,
      y: y + 16,
      w: 48,
      h: 48,
      fill: 'rgba(59,130,246,0.1)',
      cornerRadius: 12,
      opacity: 1,
    },
    matIcon({
      id: `${id}_icon`,
      name: 'Ícone',
      icon,
      x: PAD + 16,
      y: y + 22,
      w: 48,
      h: 36,
      size: 22,
      color: '#3B82F6',
    }),
    {
      id: `${id}_title`,
      type: 'text',
      name,
      x: PAD + 16 + 48 + 14,
      y: y + 18,
      w: 200,
      h: 24,
      text: name,
      fontSize: 16,
      fontWeight: 700,
      color: '#1E293B',
      align: 'left',
    },
    {
      id: `${id}_sub`,
      type: 'text',
      name: 'Subtítulo',
      x: PAD + 16 + 48 + 14,
      y: y + 44,
      w: 220,
      h: 20,
      text: subtitle,
      fontSize: 13,
      fontWeight: 400,
      color: 'rgba(107,114,128,0.8)',
      align: 'left',
    },
  ];

  if (badge != null) {
    kids.push(
      {
        id: `${id}_badge`,
        type: 'rect',
        name: 'Badge pendentes',
        x: W - PAD - 16 - 36,
        y: y + 28,
        w: 36,
        h: 24,
        fill: '#3B82F6',
        cornerRadius: 12,
        opacity: 1,
      },
      {
        id: `${id}_badge_n`,
        type: 'text',
        name: String(badge),
        x: W - PAD - 16 - 36,
        y: y + 30,
        w: 36,
        h: 20,
        text: String(badge),
        fontSize: 13,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'center',
      },
    );
  } else {
    kids.push(
      matIcon({
        id: `${id}_chev`,
        name: 'Chevron',
        icon: 'chevron_right',
        x: W - PAD - 40,
        y: y + 26,
        w: 28,
        h: 28,
        size: 22,
        color: 'rgba(107,114,128,0.5)',
      }),
    );
  }

  return {
    id: `grp_${id}`,
    type: 'group',
    name,
    children: kids,
  };
}

const listY0 = HEADER_H + 12;
const listH = 80;
const listGap = 10;

const mercadoNodes = [
  {
    id: 'grp_mercado_header',
    type: 'group',
    name: 'Header',
    children: [
      {
        id: 'mercado_header_bg',
        type: 'rect',
        name: 'Fundo header',
        x: 0,
        y: 0,
        w: W,
        h: HEADER_H,
        fill: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 48%, #60A5FA 100%)',
        bottomRadius: 24,
        opacity: 1,
      },
      matIcon({
        id: 'mercado_icon',
        name: 'Ícone Mercado',
        icon: 'shopping_cart',
        x: 20,
        y: STATUS,
        w: 28,
        h: BAR,
        size: 18,
        color: '#FFFFFF',
      }),
      {
        id: 'mercado_title',
        type: 'text',
        name: 'Título',
        x: 52,
        y: STATUS,
        w: 160,
        h: BAR,
        text: 'Mercado',
        fontSize: 17,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'left',
      },
      matIcon({
        id: 'mercado_catalog',
        name: 'Catálogo',
        icon: 'inventory_2',
        x: W - 52,
        y: STATUS,
        w: 44,
        h: BAR,
        size: 18,
        color: '#FFFFFF',
      }),
    ],
  },
  {
    id: 'grp_mercado_lists',
    type: 'group',
    name: 'Listas',
    children: [
      listCard({
        id: 'list_mercado',
        name: 'Mercado',
        icon: 'shopping_cart',
        subtitle: '14/07 · 3 para comprar · R$ 47,90',
        badge: 3,
        y: listY0,
      }),
      listCard({
        id: 'list_feira',
        name: 'Feira',
        icon: 'eco',
        subtitle: '12/07 · Lista vazia',
        badge: null,
        y: listY0 + listH + listGap,
      }),
      listCard({
        id: 'list_farmacia',
        name: 'Farmácia',
        icon: 'medication',
        subtitle: '10/07 · Tudo comprado! (4 itens)',
        badge: null,
        y: listY0 + (listH + listGap) * 2,
      }),
    ],
  },
  {
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
  },
  bottomNav('mercado'),
];

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
let screen = raw.screens.find((s) => s.id === 'mercado');
if (!screen) {
  screen = createScreen({
    id: 'mercado',
    name: '03 — Mercado',
    width: W,
    height: H,
    background: '#EEF5FC',
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = '03 — Mercado';
screen.background = '#EEF5FC';
screen.width = W;
screen.height = H;
screen.nodes = mercadoNodes;

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const m = board.screens.find((s) => s.id === 'mercado');
console.log(
  JSON.stringify(
    {
      id: m.id,
      name: m.name,
      x: m.x,
      groups: m.nodes.map((n) => `${n.name} (${n.children?.length || 0})`),
    },
    null,
    2,
  ),
);
