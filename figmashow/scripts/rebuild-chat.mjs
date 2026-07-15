/**
 * Cria a tela 05 — Chat no board FigmaShow (fiel ao Flutter).
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

const PAD = 12;
const COMPOSER_H = 64;
const COMPOSER_Y = NAV_Y - COMPOSER_H;

function bubbleWidth(text) {
  // ~8px/char + padding interno generoso (evita corte na borda arredondada)
  return Math.min(280, Math.max(120, 36 + text.length * 8));
}

function bubbleThem({ id, name, text, time, y, showName, showAvatar }) {
  const padX = 16;
  const bubbleW = bubbleWidth(text);
  const nameH = showName ? 18 : 0;
  const bubbleH = 56;
  const x = 12 + 28 + 6;
  const kids = [];

  if (showAvatar) {
    kids.push(
      {
        id: `${id}_av`,
        type: 'rect',
        name: 'Avatar',
        x: 12,
        y: y + nameH + bubbleH - 28,
        w: 28,
        h: 28,
        fill: 'rgba(59,130,246,0.15)',
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: `${id}_av_l`,
        type: 'text',
        name: 'Inicial',
        x: 12,
        y: y + nameH + bubbleH - 24,
        w: 28,
        h: 20,
        text: name.trim()[0] || '?',
        fontSize: 12,
        fontWeight: 700,
        color: '#3B82F6',
        align: 'center',
      },
    );
  }

  if (showName) {
    kids.push({
      id: `${id}_name`,
      type: 'text',
      name: 'Nome',
      x: x + 4,
      y,
      w: 180,
      h: 16,
      text: name,
      fontSize: 12,
      fontWeight: 600,
      color: '#3B82F6',
      align: 'left',
    });
  }

  kids.push(
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Bolha',
      x,
      y: y + nameH,
      w: bubbleW,
      h: bubbleH,
      fill: '#FFFFFF',
      cornerRadius: 18,
      opacity: 1,
    },
    {
      id: `${id}_text`,
      type: 'text',
      name: 'Texto',
      x: x + padX,
      y: y + nameH + 10,
      w: bubbleW - padX * 2,
      h: 22,
      text,
      fontSize: 14,
      fontWeight: 400,
      color: '#1E293B',
      align: 'left',
    },
    {
      id: `${id}_time`,
      type: 'text',
      name: 'Hora',
      x: x + padX,
      y: y + nameH + 34,
      w: bubbleW - padX * 2,
      h: 14,
      text: time,
      fontSize: 10,
      fontWeight: 400,
      color: 'rgba(107,114,128,0.75)',
      align: 'right',
    },
  );

  return {
    id: `grp_${id}`,
    type: 'group',
    name: `${name}: ${text.slice(0, 24)}`,
    children: kids,
  };
}

function bubbleMe({ id, text, time, y }) {
  const padX = 16;
  const bubbleW = bubbleWidth(text);
  const bubbleH = 56;
  const x = W - PAD - bubbleW;

  return {
    id: `grp_${id}`,
    type: 'group',
    name: `Eu: ${text.slice(0, 24)}`,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Bolha',
        x,
        y,
        w: bubbleW,
        h: bubbleH,
        fill: '#3B82F6',
        cornerRadius: 18,
        opacity: 1,
      },
      {
        id: `${id}_text`,
        type: 'text',
        name: 'Texto',
        x: x + padX,
        y: y + 10,
        w: bubbleW - padX * 2,
        h: 22,
        text,
        fontSize: 14,
        fontWeight: 400,
        color: '#FFFFFF',
        align: 'left',
      },
      {
        id: `${id}_time`,
        type: 'text',
        name: 'Hora',
        x: x + padX,
        y: y + 34,
        w: bubbleW - padX * 2,
        h: 14,
        text: time,
        fontSize: 10,
        fontWeight: 400,
        color: 'rgba(255,255,255,0.7)',
        align: 'right',
      },
    ],
  };
}

const header = {
  id: 'grp_chat_header',
  type: 'group',
  name: 'Header',
  children: [
    {
      id: 'chat_header_bg',
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
      id: 'chat_icon',
      name: 'Ícone',
      icon: 'chat_bubble',
      x: 20,
      y: STATUS,
      w: 28,
      h: BAR,
      size: 18,
      color: '#FFFFFF',
    }),
    {
      id: 'chat_title',
      type: 'text',
      name: 'Título',
      x: 52,
      y: STATUS,
      w: 200,
      h: BAR,
      text: 'Bate-papo',
      fontSize: 17,
      fontWeight: 700,
      color: '#FFFFFF',
      align: 'left',
    },
  ],
};

// Mensagens de cima para baixo (lista visual; no app é reverse)
let my = HEADER_H + 16;
const messages = [
  bubbleThem({
    id: 'msg_1',
    name: 'Natália',
    text: 'Alguém vai no mercado hoje?',
    time: '09:12',
    y: my,
    showName: true,
    showAvatar: false,
  }),
];
my += 18 + 56 + 10;

messages.push(
  bubbleThem({
    id: 'msg_2',
    name: 'Bradley',
    text: 'Posso passar depois do almoço',
    time: '09:14',
    y: my,
    showName: true,
    showAvatar: true,
  }),
);
my += 18 + 56 + 8;

messages.push(
  bubbleMe({
    id: 'msg_3',
    text: 'Coloquei leite e pão na lista',
    time: '09:15',
    y: my,
  }),
);
my += 56 + 8;

messages.push(
  bubbleThem({
    id: 'msg_4',
    name: 'Natália',
    text: 'Perfeito, obrigada!',
    time: '09:16',
    y: my,
    showName: true,
    showAvatar: true,
  }),
);
my += 18 + 56 + 8;

messages.push(
  bubbleMe({
    id: 'msg_5',
    text: 'Lembrem das tarefas de hoje',
    time: '09:18',
    y: my,
  }),
);

const composer = {
  id: 'grp_chat_composer',
  type: 'group',
  name: 'Composer',
  children: [
    {
      id: 'composer_bg',
      type: 'rect',
      name: 'Fundo composer',
      x: 0,
      y: COMPOSER_Y,
      w: W,
      h: COMPOSER_H,
      fill: '#FFFFFF',
      cornerRadius: 0,
      opacity: 1,
    },
    matIcon({
      id: 'composer_cam',
      name: 'Câmera',
      icon: 'photo_camera',
      x: 8,
      y: COMPOSER_Y + 14,
      w: 36,
      h: 36,
      size: 20,
      color: '#3B82F6',
    }),
    {
      id: 'composer_field',
      type: 'rect',
      name: 'Campo texto',
      x: 48,
      y: COMPOSER_Y + 12,
      w: W - 48 - 56,
      h: 40,
      fill: '#F0F2F5',
      cornerRadius: 20,
      opacity: 1,
    },
    {
      id: 'composer_hint',
      type: 'text',
      name: 'Placeholder',
      x: 64,
      y: COMPOSER_Y + 20,
      w: 180,
      h: 24,
      text: 'Mensagem',
      fontSize: 15,
      fontWeight: 400,
      color: '#6B7280',
      align: 'left',
    },
    {
      id: 'composer_send_bg',
      type: 'rect',
      name: 'Enviar fundo',
      x: W - 48,
      y: COMPOSER_Y + 14,
      w: 36,
      h: 36,
      fill: '#3B82F6',
      cornerRadius: 18,
      opacity: 1,
    },
    matIcon({
      id: 'composer_send',
      name: 'Enviar',
      icon: 'send',
      x: W - 48,
      y: COMPOSER_Y + 18,
      w: 36,
      h: 28,
      size: 16,
      color: '#FFFFFF',
    }),
  ],
};

const nav = bottomNav('chat');

const chatNodes = [
  header,
  {
    id: 'grp_chat_messages',
    type: 'group',
    name: 'Mensagens',
    children: messages,
  },
  composer,
  nav,
];

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
let screen = raw.screens.find((s) => s.id === 'chat');
if (!screen) {
  screen = createScreen({
    id: 'chat',
    name: '05 — Chat',
    width: W,
    height: H,
    background: '#EEF5FC',
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = '05 — Chat';
screen.background = '#EEF5FC';
screen.width = W;
screen.height = H;
screen.nodes = chatNodes;

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const c = board.screens.find((s) => s.id === 'chat');
console.log(
  JSON.stringify(
    {
      id: c.id,
      name: c.name,
      x: c.x,
      groups: c.nodes.map((n) => n.name),
    },
    null,
    2,
  ),
);
