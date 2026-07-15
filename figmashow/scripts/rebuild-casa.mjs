/**
 * Reconstrói a tela Casa alinhada ao Flutter (estado sem tarefas).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBoard, writeBoard } from '../packages/core/src/index.js';
import { W, H, STATUS, matIcon, bottomNav, NAV_Y } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');

const PAD = 16;
// STATUS already from shared (44)
const TITLE_H = 44;
const BODY_TOP = STATUS + 2 + TITLE_H + 8; // ~98
const RING = 108;
const HERO_H = BODY_TOP + 124 + 12; // ~234

function chip(id, label, x, y, w, selected) {
  return {
    id,
    type: 'button',
    name: `Chip ${label}`,
    x,
    y,
    w,
    h: 36,
    label,
    fill: selected ? 'rgba(59,130,246,0.12)' : '#FFFFFF',
    textColor: selected ? '#3B82F6' : '#6B7280',
    cornerRadius: 24,
    fontSize: 13,
    fontWeight: selected ? 700 : 500,
    stroke: selected ? '#3B82F6' : '#E5E7EB',
    strokeWidth: selected ? 1.5 : 1,
  };
}

function dayCell(id, label, num, x, selected, barColor) {
  /** @type {object[]} */
  const kids = [];
  if (selected) {
    kids.push({
      id: `${id}_bg`,
      type: 'rect',
      name: 'Dia selecionado',
      x,
      y: 0,
      w: 44,
      h: 64,
      fill: 'rgba(59,130,246,0.12)',
      cornerRadius: 12,
      stroke: '#3B82F6',
      strokeWidth: 1.5,
      opacity: 1,
    });
  }
  kids.push(
    {
      id: `${id}_wd`,
      type: 'text',
      name: label,
      x,
      y: 8,
      w: 44,
      h: 14,
      text: label,
      fontSize: 10,
      fontWeight: 600,
      color: selected ? '#3B82F6' : '#6B7280',
      align: 'center',
    },
    {
      id: `${id}_num`,
      type: 'text',
      name: String(num),
      x,
      y: 24,
      w: 44,
      h: 18,
      text: String(num),
      fontSize: 14,
      fontWeight: 800,
      color: selected ? '#3B82F6' : '#1E293B',
      align: 'center',
    },
    {
      id: `${id}_bar`,
      type: 'rect',
      name: 'Barra progresso',
      x: x + 10,
      y: 52,
      w: 24,
      h: 3,
      fill: barColor || '#E5E7EB',
      cornerRadius: 2,
      opacity: 1,
    },
  );
  return kids;
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const casa = raw.screens.find((s) => s.id === 'casa');
if (!casa) throw new Error('tela casa não encontrada');

const weekY = HERO_H + 16 + 36 + 16 + 12; // after chips + gaps + handle
const days = [
  { id: 'day_13', label: 'seg.', num: 13, selected: false },
  { id: 'day_14', label: 'ter.', num: 14, selected: true },
  { id: 'day_15', label: 'qua.', num: 15, selected: false, bar: '#F87171' },
  { id: 'day_16', label: 'qui.', num: 16, selected: false, bar: '#F87171' },
  { id: 'day_17', label: 'sex.', num: 17, selected: false, bar: '#F87171' },
  { id: 'day_18', label: 'sáb.', num: 18, selected: false, bar: '#F87171' },
  { id: 'day_19', label: 'dom.', num: 19, selected: false },
];

const dayStartX = 28;
const dayGap = 48;
const weekChildren = [
  {
    id: 'cal_handle',
    type: 'rect',
    name: 'Handle calendário',
    x: (W - 36) / 2,
    y: weekY - 12,
    w: 36,
    h: 4,
    fill: '#E5E7EB',
    cornerRadius: 2,
    opacity: 1,
  },
  matIcon({
    id: 'cal_prev',
    name: 'Semana anterior',
    icon: 'chevron_left',
    x: 4,
    y: weekY + 20,
    w: 24,
    h: 24,
    size: 20,
    color: '#6B7280',
  }),
  matIcon({
    id: 'cal_next',
    name: 'Próxima semana',
    icon: 'chevron_right',
    x: W - 28,
    y: weekY + 20,
    w: 24,
    h: 24,
    size: 20,
    color: '#6B7280',
  }),
];

days.forEach((d, i) => {
  const x = dayStartX + i * dayGap;
  const kids = dayCell(d.id, d.label, d.num, x, d.selected, d.bar);
  for (const k of kids) {
    if (k.type === 'rect' && k.id.endsWith('_bg')) {
      k.y = weekY;
      k.h = 64;
    } else if (k.id.endsWith('_wd')) {
      k.y = weekY + 8;
    } else if (k.id.endsWith('_num')) {
      k.y = weekY + 24;
    } else if (k.id.endsWith('_bar')) {
      k.y = weekY + 52;
    }
    weekChildren.push(k);
  }
});

const emptyY = weekY + 64 + 12 + 16;
const fabSize = 56;

const casaNodes = [
  {
    id: 'grp_casa_hero',
    type: 'group',
    name: 'Hero',
    children: [
      {
        id: 'hero',
        type: 'rect',
        name: 'Fundo hero',
        x: 0,
        y: 0,
        w: W,
        h: HERO_H,
        fill: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 48%, #60A5FA 100%)',
        bottomRadius: 24,
        opacity: 1,
      },
      {
        id: 'hero_blob_r',
        type: 'rect',
        name: 'Blob decorativo',
        x: 250,
        y: -10,
        w: 160,
        h: 160,
        fill: 'rgba(255,255,255,0.06)',
        cornerRadius: 80,
        opacity: 1,
      },
      {
        id: 'hero_blob_l',
        type: 'rect',
        name: 'Blob accent',
        x: -30,
        y: HERO_H - 80,
        w: 120,
        h: 120,
        fill: 'rgba(100,116,139,0.12)',
        cornerRadius: 60,
        opacity: 1,
      },
      {
        id: 'hero_title',
        type: 'text',
        name: 'Título Casa',
        x: 20,
        y: STATUS + 2,
        w: W - 40,
        h: TITLE_H,
        text: 'Casa',
        fontSize: 22,
        fontWeight: 800,
        color: '#FFFFFF',
        align: 'center',
      },
      matIcon({
        id: 'hero_menu',
        name: 'Mais opções',
        icon: 'more_vert',
        x: W - 48,
        y: STATUS + 8,
        w: 40,
        h: 32,
        size: 22,
        color: '#FFFFFF',
      }),
      {
        id: 'grp_casa_health',
        type: 'group',
        name: 'Saúde',
        children: [
          {
            id: 'ring_outer',
            type: 'rect',
            name: 'Anel track',
            x: 32,
            y: BODY_TOP + 8,
            w: RING,
            h: RING,
            fill: 'rgba(255,255,255,0.12)',
            cornerRadius: RING / 2,
            opacity: 1,
          },
          {
            id: 'ring_inner',
            type: 'rect',
            name: 'Anel miolo',
            x: 32 + 12,
            y: BODY_TOP + 8 + 12,
            w: RING - 24,
            h: RING - 24,
            fill: 'rgba(15,31,53,0.55)',
            cornerRadius: (RING - 24) / 2,
            opacity: 1,
          },
          {
            id: 'ring_value',
            type: 'text',
            name: 'Percentual',
            x: 32,
            y: BODY_TOP + 8 + 30,
            w: RING,
            h: 30,
            text: '—',
            fontSize: 26,
            fontWeight: 800,
            color: '#FFFFFF',
            align: 'center',
          },
          {
            id: 'ring_label',
            type: 'text',
            name: 'Label saúde',
            x: 32,
            y: BODY_TOP + 8 + 60,
            w: RING,
            h: 16,
            text: 'saúde',
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.75)',
            align: 'center',
          },
        ],
      },
      {
        id: 'grp_casa_status',
        type: 'group',
        name: 'Status',
        children: [
          {
            id: 'badge',
            type: 'rect',
            name: 'Badge status',
            x: 154,
            y: BODY_TOP + 12,
            w: 168,
            h: 26,
            fill: 'rgba(100,116,139,0.2)',
            cornerRadius: 20,
            stroke: 'rgba(100,116,139,0.45)',
            strokeWidth: 1,
            opacity: 1,
          },
          {
            id: 'badge_text',
            type: 'text',
            name: 'AGUARDANDO ROTINA',
            x: 158,
            y: BODY_TOP + 15,
            w: 160,
            h: 20,
            text: 'AGUARDANDO ROTINA',
            fontSize: 9,
            fontWeight: 800,
            color: '#94A3B8',
            align: 'center',
          },
          {
            id: 'estado_title',
            type: 'text',
            name: 'Estado da casa',
            x: 154,
            y: BODY_TOP + 46,
            w: 210,
            h: 26,
            text: 'Estado da casa',
            fontSize: 20,
            fontWeight: 800,
            color: '#FFFFFF',
            align: 'left',
          },
          {
            id: 'estado_sub',
            type: 'text',
            name: 'Subtítulo estado',
            x: 154,
            y: BODY_TOP + 74,
            w: 210,
            h: 40,
            text: 'Crie tarefas para acompanhar o dia da família.',
            fontSize: 13,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.85)',
            align: 'left',
          },
        ],
      },
    ],
  },
  {
    id: 'grp_casa_chips',
    type: 'group',
    name: 'Filtro membros',
    children: [
      chip('chip_todos', 'Todos', PAD, HERO_H + 16, 72, true),
      chip('chip_bradley', 'Bradley', PAD + 80, HERO_H + 16, 88, false),
      chip('chip_natalia', 'Natália', PAD + 176, HERO_H + 16, 84, false),
      chip('chip_rafael', 'Rafael', PAD + 268, HERO_H + 16, 90, false),
    ],
  },
  {
    id: 'grp_casa_week',
    type: 'group',
    name: 'Semana',
    children: weekChildren,
  },
  {
    id: 'grp_casa_empty',
    type: 'group',
    name: 'Empty state',
    children: [
      {
        id: 'empty_card',
        type: 'rect',
        name: 'Card vazio',
        x: PAD,
        y: emptyY,
        w: W - PAD * 2,
        h: 168,
        fill: 'rgba(255,255,255,0.7)',
        cornerRadius: 16,
        opacity: 1,
      },
      matIcon({
        id: 'empty_icon',
        name: 'Ícone empty',
        icon: 'task_alt',
        x: PAD,
        y: emptyY + 28,
        w: W - PAD * 2,
        h: 48,
        size: 40,
        color: '#6B7280',
      }),
      {
        id: 'empty_title',
        type: 'text',
        name: 'Nenhuma tarefa',
        x: PAD + 20,
        y: emptyY + 84,
        w: W - PAD * 2 - 40,
        h: 24,
        text: 'Nenhuma tarefa neste dia',
        fontSize: 16,
        fontWeight: 600,
        color: '#1E293B',
        align: 'center',
      },
      {
        id: 'empty_sub',
        type: 'text',
        name: 'Dica empty',
        x: PAD + 28,
        y: emptyY + 114,
        w: W - PAD * 2 - 56,
        h: 40,
        text: 'Toque em + Nova tarefa para organizar a rotina da casa.',
        fontSize: 14,
        fontWeight: 400,
        color: '#6B7280',
        align: 'center',
      },
    ],
  },
  {
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
  },
  bottomNav('casa'),
];

casa.background = '#EEF5FC';
casa.width = W;
casa.height = H;
casa.nodes = casaNodes;

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const c = board.screens.find((s) => s.id === 'casa');
console.log(
  JSON.stringify(
    {
      heroH: HERO_H,
      emptyY,
      groups: c.nodes.map((n) => n.name),
    },
    null,
    2,
  ),
);
