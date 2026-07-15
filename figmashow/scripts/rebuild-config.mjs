/**
 * Frame Configurações — acima da tela Casa (rota a partir do menu overflow).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createScreen,
  normalizeBoard,
  writeBoard,
} from '../packages/core/src/index.js';
import { W, H, STATUS, BAR, HEADER_H, matIcon } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');
const PAD = 16;
const ROW_H = 56;

function settingsRow({ id, icon, title, subtitle, y, danger = false }) {
  const kids = [
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Linha fundo',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: ROW_H,
      fill: '#FFFFFF',
      cornerRadius: 14,
      opacity: 1,
    },
    {
      id: `${id}_icon_bg`,
      type: 'rect',
      name: 'Ícone fundo',
      x: PAD + 12,
      y: y + 10,
      w: 36,
      h: 36,
      fill: danger ? 'rgba(192,57,43,0.1)' : 'rgba(59,130,246,0.1)',
      cornerRadius: 10,
      opacity: 1,
    },
    matIcon({
      id: `${id}_icon`,
      name: `Ícone ${title}`,
      icon,
      x: PAD + 12,
      y: y + 14,
      w: 36,
      h: 28,
      size: 20,
      color: danger ? '#C0392B' : '#3B82F6',
    }),
    {
      id: `${id}_title`,
      type: 'text',
      name: title,
      x: PAD + 60,
      y: subtitle ? y + 10 : y + 16,
      w: 240,
      h: 22,
      text: title,
      fontSize: 15,
      fontWeight: 600,
      color: danger ? '#C0392B' : '#1E293B',
      align: 'left',
    },
  ];

  if (subtitle) {
    kids.push({
      id: `${id}_sub`,
      type: 'text',
      name: 'Subtítulo',
      x: PAD + 60,
      y: y + 32,
      w: 240,
      h: 18,
      text: subtitle,
      fontSize: 12,
      fontWeight: 400,
      color: 'rgba(107,114,128,0.8)',
      align: 'left',
    });
  }

  if (!danger) {
    kids.push(
      matIcon({
        id: `${id}_chev`,
        name: 'Chevron',
        icon: 'chevron_right',
        x: W - PAD - 40,
        y: y + 14,
        w: 28,
        h: 28,
        size: 22,
        color: 'rgba(107,114,128,0.45)',
      }),
    );
  }

  return {
    id: `grp_${id}`,
    type: 'group',
    name: title,
    children: kids,
  };
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const casa = raw.screens.find((s) => s.id === 'casa');
const casaX = casa?.x ?? 470;
const casaY = casa?.y ?? 0;
const GAP = 80;

const nodes = [
  {
    id: 'grp_config_header',
    type: 'group',
    name: 'Header',
    children: [
      {
        id: 'config_header_bg',
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
        id: 'config_back',
        name: 'Voltar',
        icon: 'arrow_back',
        x: 12,
        y: STATUS,
        w: 40,
        h: BAR,
        size: 22,
        color: '#FFFFFF',
      }),
      {
        id: 'config_title',
        type: 'text',
        name: 'Título',
        x: 56,
        y: STATUS,
        w: 260,
        h: BAR,
        text: 'Configurações',
        fontSize: 17,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'left',
      },
    ],
  },
  {
    id: 'grp_config_profile',
    type: 'group',
    name: 'Perfil',
    children: [
      {
        id: 'profile_card',
        type: 'rect',
        name: 'Card perfil',
        x: PAD,
        y: HEADER_H + 16,
        w: W - PAD * 2,
        h: 88,
        fill: '#FFFFFF',
        cornerRadius: 16,
        opacity: 1,
      },
      {
        id: 'profile_avatar',
        type: 'rect',
        name: 'Avatar',
        x: PAD + 16,
        y: HEADER_H + 16 + 18,
        w: 52,
        h: 52,
        fill: 'rgba(59,130,246,0.15)',
        cornerRadius: 26,
        opacity: 1,
      },
      matIcon({
        id: 'profile_avatar_icon',
        name: 'Ícone avatar',
        icon: 'person',
        x: PAD + 16,
        y: HEADER_H + 16 + 26,
        w: 52,
        h: 36,
        size: 28,
        color: '#3B82F6',
      }),
      {
        id: 'profile_name',
        type: 'text',
        name: 'Nome',
        x: PAD + 84,
        y: HEADER_H + 16 + 22,
        w: 220,
        h: 24,
        text: 'Rafael',
        fontSize: 17,
        fontWeight: 700,
        color: '#1E293B',
        align: 'left',
      },
      {
        id: 'profile_email',
        type: 'text',
        name: 'E-mail',
        x: PAD + 84,
        y: HEADER_H + 16 + 48,
        w: 220,
        h: 20,
        text: 'rafael@email.com',
        fontSize: 13,
        fontWeight: 400,
        color: 'rgba(107,114,128,0.85)',
        align: 'left',
      },
    ],
  },
];

let y = HEADER_H + 16 + 88 + 20;

const section = (id, label, top) => ({
  id,
  type: 'text',
  name: label,
  x: PAD + 4,
  y: top,
  w: 200,
  h: 18,
  text: label,
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7280',
  align: 'left',
});

nodes.push(section('sec_conta', 'CONTA', y));
y += 26;

nodes.push(
  settingsRow({
    id: 'row_conta',
    icon: 'manage_accounts',
    title: 'Conta',
    subtitle: 'Nome, e-mail e foto',
    y,
  }),
);
y += ROW_H + 10;

nodes.push(
  settingsRow({
    id: 'row_notif',
    icon: 'notifications',
    title: 'Notificações',
    subtitle: 'Push e lembretes',
    y,
  }),
);
y += ROW_H + 20;

nodes.push(section('sec_casa', 'CASA', y));
y += 26;

nodes.push(
  settingsRow({
    id: 'row_membros',
    icon: 'groups',
    title: 'Membros',
    subtitle: 'Quem participa da casa',
    y,
  }),
);
y += ROW_H + 10;

nodes.push(
  settingsRow({
    id: 'row_casa_info',
    icon: 'home',
    title: 'Dados da casa',
    subtitle: 'Nome e preferências',
    y,
  }),
);
y += ROW_H + 20;

nodes.push(section('sec_app', 'APP', y));
y += 26;

nodes.push(
  settingsRow({
    id: 'row_sobre',
    icon: 'info',
    title: 'Sobre',
    subtitle: 'Versão e termos',
    y,
  }),
);
y += ROW_H + 16;

nodes.push(
  settingsRow({
    id: 'row_sair',
    icon: 'logout',
    title: 'Sair da conta',
    y,
    danger: true,
  }),
);

let screen = raw.screens.find((s) => s.id === 'config');
if (!screen) {
  screen = createScreen({
    id: 'config',
    name: 'Configurações',
    width: W,
    height: H,
    background: '#EEF5FC',
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = 'Configurações';
screen.background = '#EEF5FC';
screen.width = W;
screen.height = H;
screen.x = casaX;
screen.y = casaY - H - GAP;
screen.nodes = nodes;

// Menu overflow um pouco acima / à direita do gap entre Config e Casa
const overflow = raw.screens.find((s) => s.id === 'casa_overflow');
if (overflow) {
  overflow.x = casaX + W - overflow.width;
  overflow.y = screen.y + H + 24;
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const c = board.screens.find((s) => s.id === 'config');
console.log(
  JSON.stringify(
    {
      id: c.id,
      name: c.name,
      x: c.x,
      y: c.y,
      groups: c.nodes.map((n) => n.name),
      overflowY: overflow?.y,
    },
    null,
    2,
  ),
);
