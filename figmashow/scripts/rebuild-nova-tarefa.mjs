/**
 * Modal bottom sheet Nova tarefa (FAB +) — frame abaixo da tela Casa.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createScreen,
  normalizeBoard,
  writeBoard,
} from '../packages/core/src/index.js';
import { W, H, matIcon } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');
const PAD = 24;

const categories = [
  { id: 'routine', name: 'Rotina', icon: 'wb_sunny', color: '#F59E0B', selected: true },
  { id: 'cleaning', name: 'Limpeza', icon: 'cleaning_services', color: '#3B82F6' },
  { id: 'market', name: 'Mercado', icon: 'shopping_cart', color: '#10B981' },
  { id: 'work', name: 'Trabalho', icon: 'work', color: '#6366F1' },
  { id: 'health', name: 'Saúde', icon: 'local_hospital', color: '#EC4899' },
];

const members = [
  { id: 'm1', name: 'Rafael', initials: 'R', selected: true },
  { id: 'm2', name: 'Natália', initials: 'N', selected: false },
  { id: 'm3', name: 'Pedro', initials: 'P', selected: false },
];

function categoryChip(cat, x, y) {
  const kids = [
    {
      id: `cat_${cat.id}_bg`,
      type: 'rect',
      name: cat.name,
      x,
      y,
      w: 72,
      h: 76,
      fill: cat.selected ? `${cat.color}26` : '#F0F2F5',
      cornerRadius: 12,
      opacity: 1,
      stroke: cat.selected ? cat.color : 'transparent',
      strokeWidth: cat.selected ? 2 : 0,
    },
    matIcon({
      id: `cat_${cat.id}_icon`,
      name: 'Ícone',
      icon: cat.icon,
      x,
      y: y + 12,
      w: 72,
      h: 28,
      size: 26,
      color: cat.color,
    }),
    {
      id: `cat_${cat.id}_label`,
      type: 'text',
      name: 'Label',
      x,
      y: y + 48,
      w: 72,
      h: 16,
      text: cat.name,
      fontSize: 9,
      fontWeight: 600,
      color: cat.selected ? cat.color : '#6B7280',
      align: 'center',
    },
  ];
  return kids;
}

function memberChip(m, x, y) {
  const kids = [
    {
      id: `assignee_${m.id}_bg`,
      type: 'rect',
      name: m.name,
      x,
      y,
      w: 76,
      h: 92,
      fill: m.selected ? 'rgba(59,130,246,0.12)' : '#F0F2F5',
      cornerRadius: 20,
      opacity: 1,
      stroke: m.selected ? '#3B82F6' : '#E5E7EB',
      strokeWidth: m.selected ? 2.5 : 1,
    },
    {
      id: `assignee_${m.id}_avatar`,
      type: 'rect',
      name: 'Avatar',
      x: x + 14,
      y: y + 10,
      w: 48,
      h: 48,
      fill: m.selected ? 'rgba(59,130,246,0.2)' : '#FFFFFF',
      cornerRadius: 24,
      opacity: 1,
    },
    {
      id: `assignee_${m.id}_initials`,
      type: 'text',
      name: 'Inicial',
      x: x + 14,
      y: y + 22,
      w: 48,
      h: 24,
      text: m.initials,
      fontSize: 16,
      fontWeight: 700,
      color: m.selected ? '#3B82F6' : '#6B7280',
      align: 'center',
    },
    {
      id: `assignee_${m.id}_name`,
      type: 'text',
      name: 'Nome',
      x,
      y: y + 64,
      w: 76,
      h: 18,
      text: m.name,
      fontSize: 11,
      fontWeight: 700,
      color: m.selected ? '#3B82F6' : '#6B7280',
      align: 'center',
    },
  ];
  if (m.selected) {
    kids.push(
      {
        id: `assignee_${m.id}_check_bg`,
        type: 'rect',
        name: 'Check',
        x: x + 40,
        y: y + 40,
        w: 20,
        h: 20,
        fill: '#3B82F6',
        cornerRadius: 10,
        opacity: 1,
      },
      matIcon({
        id: `assignee_${m.id}_check`,
        name: 'Ícone check',
        icon: 'check',
        x: x + 40,
        y: y + 42,
        w: 20,
        h: 16,
        size: 12,
        color: '#FFFFFF',
      }),
    );
  }
  return kids;
}

function picker({ id, label, icon, value, x, y, w }) {
  return [
    {
      id: `${id}_label`,
      type: 'text',
      name: label,
      x: x + 4,
      y,
      w: w - 8,
      h: 16,
      text: label,
      fontSize: 12,
      fontWeight: 600,
      color: '#6B7280',
      align: 'left',
    },
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Picker',
      x,
      y: y + 22,
      w,
      h: 48,
      fill: 'rgba(59,130,246,0.08)',
      cornerRadius: 12,
      opacity: 1,
      stroke: 'rgba(59,130,246,0.35)',
      strokeWidth: 1,
    },
    matIcon({
      id: `${id}_icon`,
      name: 'Ícone',
      icon,
      x: x + 8,
      y: y + 34,
      w: 24,
      h: 24,
      size: 20,
      color: '#3B82F6',
    }),
    {
      id: `${id}_value`,
      type: 'text',
      name: 'Valor',
      x: x + 36,
      y: y + 36,
      w: w - 64,
      h: 22,
      text: value,
      fontSize: 13,
      fontWeight: 600,
      color: '#3B82F6',
      align: 'left',
    },
    matIcon({
      id: `${id}_chev`,
      name: 'Chevron',
      icon: 'chevron_right',
      x: x + w - 28,
      y: y + 34,
      w: 22,
      h: 24,
      size: 18,
      color: 'rgba(59,130,246,0.7)',
    }),
  ];
}

// Sheet height roughly matches content; phone frame shows scrim + sheet
const SHEET_TOP = 180;
const SHEET_H = H - SHEET_TOP;

const sheetKids = [
  {
    id: 'sheet_bg',
    type: 'rect',
    name: 'Fundo sheet',
    x: 0,
    y: SHEET_TOP,
    w: W,
    h: SHEET_H,
    fill: '#FFFFFF',
    cornerRadius: 24,
    opacity: 1,
  },
  {
    id: 'sheet_handle',
    type: 'rect',
    name: 'Handle',
    x: (W - 40) / 2,
    y: SHEET_TOP + 12,
    w: 40,
    h: 4,
    fill: '#D1D5DB',
    cornerRadius: 2,
    opacity: 1,
  },
  {
    id: 'sheet_title',
    type: 'text',
    name: 'Título',
    x: PAD,
    y: SHEET_TOP + 36,
    w: W - PAD * 2,
    h: 28,
    text: 'Nova tarefa',
    fontSize: 18,
    fontWeight: 700,
    color: '#1E293B',
    align: 'left',
  },
  {
    id: 'field_title_bg',
    type: 'rect',
    name: 'Campo título',
    x: PAD,
    y: SHEET_TOP + 76,
    w: W - PAD * 2,
    h: 52,
    fill: '#EEF5FC',
    cornerRadius: 12,
    opacity: 1,
  },
  {
    id: 'field_title_hint',
    type: 'text',
    name: 'Placeholder',
    x: PAD + 14,
    y: SHEET_TOP + 90,
    w: W - PAD * 2 - 28,
    h: 24,
    text: 'O que precisa ser feito?',
    fontSize: 15,
    fontWeight: 400,
    color: '#9CA3AF',
    align: 'left',
  },
  {
    id: 'label_categoria',
    type: 'text',
    name: 'Categoria',
    x: PAD,
    y: SHEET_TOP + 144,
    w: 160,
    h: 18,
    text: 'Categoria',
    fontSize: 13,
    fontWeight: 600,
    color: '#6B7280',
    align: 'left',
  },
];

let catX = PAD;
const catY = SHEET_TOP + 170;
for (const cat of categories) {
  sheetKids.push(...categoryChip(cat, catX, catY));
  catX += 80;
}

sheetKids.push({
  id: 'label_assignee',
  type: 'text',
  name: 'Quem vai fazer?',
  x: PAD,
  y: SHEET_TOP + 262,
  w: 200,
  h: 18,
  text: 'Quem vai fazer?',
  fontSize: 13,
  fontWeight: 600,
  color: '#6B7280',
  align: 'left',
});

let memX = PAD;
const memY = SHEET_TOP + 288;
for (const m of members) {
  sheetKids.push(...memberChip(m, memX, memY));
  memX += 88;
}

const pickY = SHEET_TOP + 396;
const pickW = (W - PAD * 2 - 12) / 2;
sheetKids.push(
  ...picker({
    id: 'pick_time',
    label: 'Horário',
    icon: 'schedule',
    value: 'Sem horário',
    x: PAD,
    y: pickY,
    w: pickW,
  }),
  ...picker({
    id: 'pick_repeat',
    label: 'Repetir',
    icon: 'repeat',
    value: 'Não repete',
    x: PAD + pickW + 12,
    y: pickY,
    w: pickW,
  }),
);

const prioY = SHEET_TOP + 486;
sheetKids.push(
  {
    id: 'prio_label',
    type: 'text',
    name: 'Prioridade alta',
    x: PAD,
    y: prioY + 6,
    w: 200,
    h: 24,
    text: 'Prioridade alta',
    fontSize: 15,
    fontWeight: 500,
    color: '#1E293B',
    align: 'left',
  },
  {
    id: 'prio_track',
    type: 'rect',
    name: 'Switch track',
    x: W - PAD - 44,
    y: prioY + 4,
    w: 44,
    h: 28,
    fill: '#D1D5DB',
    cornerRadius: 14,
    opacity: 1,
  },
  {
    id: 'prio_thumb',
    type: 'rect',
    name: 'Switch thumb',
    x: W - PAD - 42,
    y: prioY + 6,
    w: 24,
    h: 24,
    fill: '#FFFFFF',
    cornerRadius: 12,
    opacity: 1,
  },
  {
    id: 'label_sub',
    type: 'text',
    name: 'Subtarefas',
    x: PAD,
    y: prioY + 48,
    w: 160,
    h: 18,
    text: 'Subtarefas',
    fontSize: 13,
    fontWeight: 600,
    color: '#6B7280',
    align: 'left',
  },
  {
    id: 'sub_field_bg',
    type: 'rect',
    name: 'Campo subtarefa',
    x: PAD,
    y: prioY + 74,
    w: W - PAD * 2 - 56,
    h: 48,
    fill: '#EEF5FC',
    cornerRadius: 12,
    opacity: 1,
  },
  {
    id: 'sub_field_hint',
    type: 'text',
    name: 'Placeholder subtarefa',
    x: PAD + 14,
    y: prioY + 86,
    w: 200,
    h: 24,
    text: 'Ex: Separar louça suja',
    fontSize: 14,
    fontWeight: 400,
    color: '#9CA3AF',
    align: 'left',
  },
  {
    id: 'sub_add_bg',
    type: 'rect',
    name: 'Add subtarefa',
    x: W - PAD - 48,
    y: prioY + 74,
    w: 48,
    h: 48,
    fill: '#3B82F6',
    cornerRadius: 12,
    opacity: 1,
  },
  matIcon({
    id: 'sub_add_icon',
    name: 'Ícone add',
    icon: 'add',
    x: W - PAD - 48,
    y: prioY + 86,
    w: 48,
    h: 24,
    size: 24,
    color: '#FFFFFF',
  }),
  {
    id: 'btn_criar',
    type: 'button',
    name: 'Criar tarefa',
    x: PAD,
    y: H - 32 - 52,
    w: W - PAD * 2,
    h: 52,
    label: 'Criar tarefa',
    fill: '#3B82F6',
    textColor: '#FFFFFF',
    cornerRadius: 14,
    fontSize: 16,
    fontWeight: 600,
  },
);

const nodes = [
  {
    id: 'scrim',
    type: 'rect',
    name: 'Scrim',
    x: 0,
    y: 0,
    w: W,
    h: H,
    fill: 'rgba(15,31,53,0.45)',
    cornerRadius: 0,
    opacity: 1,
  },
  {
    id: 'grp_sheet',
    type: 'group',
    name: 'Bottom sheet',
    children: sheetKids,
  },
];

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const casa = raw.screens.find((s) => s.id === 'casa');
const casaX = casa?.x ?? 470;
const casaY = casa?.y ?? 0;
const GAP = 80;

let screen = raw.screens.find((s) => s.id === 'casa_nova_tarefa');
if (!screen) {
  screen = createScreen({
    id: 'casa_nova_tarefa',
    name: 'Nova tarefa',
    width: W,
    height: H,
    background: '#EEF5FC',
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = 'Nova tarefa';
screen.background = '#EEF5FC';
screen.width = W;
screen.height = H;
screen.x = casaX;
screen.y = casaY + H + GAP;
screen.nodes = nodes;

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

console.log(
  JSON.stringify(
    {
      id: screen.id,
      name: screen.name,
      x: screen.x,
      y: screen.y,
      groups: screen.nodes.map((n) => n.name),
    },
    null,
    2,
  ),
);
