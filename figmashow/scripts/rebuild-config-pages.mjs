/**
 * Telas filhas de Configurações: Conta, Notificações, Membros, Dados da casa, Sobre.
 * Posicionadas à direita do frame Configurações.
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
const GAP = 80;
const COL = W + GAP;

function header(prefix, title) {
  return {
    id: `grp_${prefix}_header`,
    type: 'group',
    name: 'Header',
    children: [
      {
        id: `${prefix}_header_bg`,
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
        id: `${prefix}_back`,
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
        id: `${prefix}_title`,
        type: 'text',
        name: 'Título',
        x: 56,
        y: STATUS,
        w: 280,
        h: BAR,
        text: title,
        fontSize: 17,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'left',
      },
    ],
  };
}

function sectionLabel(id, label, y) {
  return {
    id,
    type: 'text',
    name: label,
    x: PAD + 4,
    y,
    w: 220,
    h: 18,
    text: label,
    fontSize: 11,
    fontWeight: 700,
    color: '#6B7280',
    align: 'left',
  };
}

function fieldRow({ id, label, value, y }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: label,
    children: [
      {
        id: `${id}_label`,
        type: 'text',
        name: 'Label',
        x: PAD + 4,
        y,
        w: 200,
        h: 18,
        text: label,
        fontSize: 12,
        fontWeight: 600,
        color: '#6B7280',
        align: 'left',
      },
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Campo',
        x: PAD,
        y: y + 22,
        w: W - PAD * 2,
        h: 48,
        fill: '#FFFFFF',
        cornerRadius: 12,
        opacity: 1,
      },
      {
        id: `${id}_value`,
        type: 'text',
        name: 'Valor',
        x: PAD + 14,
        y: y + 34,
        w: W - PAD * 2 - 28,
        h: 24,
        text: value,
        fontSize: 15,
        fontWeight: 500,
        color: '#1E293B',
        align: 'left',
      },
    ],
  };
}

function primaryButton({ id, label, y }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: label,
    children: [
      {
        id: id,
        type: 'button',
        name: label,
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 52,
        label,
        fill: '#3B82F6',
        textColor: '#FFFFFF',
        cornerRadius: 14,
        fontSize: 16,
        fontWeight: 600,
      },
    ],
  };
}

function toggleRow({ id, title, subtitle, y, on = true }) {
  const trackX = W - PAD - 52;
  const trackY = y + 16;
  return {
    id: `grp_${id}`,
    type: 'group',
    name: title,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Linha fundo',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 64,
        fill: '#FFFFFF',
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: `${id}_title`,
        type: 'text',
        name: title,
        x: PAD + 16,
        y: y + 12,
        w: 240,
        h: 22,
        text: title,
        fontSize: 15,
        fontWeight: 600,
        color: '#1E293B',
        align: 'left',
      },
      {
        id: `${id}_sub`,
        type: 'text',
        name: 'Subtítulo',
        x: PAD + 16,
        y: y + 36,
        w: 240,
        h: 18,
        text: subtitle,
        fontSize: 12,
        fontWeight: 400,
        color: 'rgba(107,114,128,0.8)',
        align: 'left',
      },
      {
        id: `${id}_track`,
        type: 'rect',
        name: 'Switch track',
        x: trackX,
        y: trackY,
        w: 44,
        h: 28,
        fill: on ? '#3B82F6' : '#D1D5DB',
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: `${id}_thumb`,
        type: 'rect',
        name: 'Switch thumb',
        x: on ? trackX + 18 : trackX + 2,
        y: trackY + 2,
        w: 24,
        h: 24,
        fill: '#FFFFFF',
        cornerRadius: 12,
        opacity: 1,
      },
    ],
  };
}

function memberCard({ id, initials, name, role, y }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: name,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Card',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 72,
        fill: '#FFFFFF',
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: `${id}_avatar`,
        type: 'rect',
        name: 'Avatar',
        x: PAD + 14,
        y: y + 14,
        w: 44,
        h: 44,
        fill: 'rgba(59,130,246,0.12)',
        cornerRadius: 22,
        opacity: 1,
      },
      {
        id: `${id}_initials`,
        type: 'text',
        name: 'Iniciais',
        x: PAD + 14,
        y: y + 24,
        w: 44,
        h: 24,
        text: initials,
        fontSize: 14,
        fontWeight: 700,
        color: '#3B82F6',
        align: 'center',
      },
      {
        id: `${id}_name`,
        type: 'text',
        name: 'Nome',
        x: PAD + 72,
        y: y + 18,
        w: 180,
        h: 22,
        text: name,
        fontSize: 15,
        fontWeight: 600,
        color: '#1E293B',
        align: 'left',
      },
      {
        id: `${id}_role`,
        type: 'text',
        name: 'Papel',
        x: PAD + 72,
        y: y + 42,
        w: 180,
        h: 18,
        text: role,
        fontSize: 12,
        fontWeight: 400,
        color: 'rgba(107,114,128,0.85)',
        align: 'left',
      },
      matIcon({
        id: `${id}_more`,
        name: 'Mais',
        icon: 'more_horiz',
        x: W - PAD - 44,
        y: y + 22,
        w: 28,
        h: 28,
        size: 22,
        color: '#6B7280',
      }),
    ],
  };
}

function linkRow({ id, icon, title, y }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: title,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Linha fundo',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 52,
        fill: '#FFFFFF',
        cornerRadius: 14,
        opacity: 1,
      },
      matIcon({
        id: `${id}_icon`,
        name: 'Ícone',
        icon,
        x: PAD + 14,
        y: y + 12,
        w: 28,
        h: 28,
        size: 20,
        color: '#3B82F6',
      }),
      {
        id: `${id}_title`,
        type: 'text',
        name: title,
        x: PAD + 52,
        y: y + 14,
        w: 240,
        h: 24,
        text: title,
        fontSize: 15,
        fontWeight: 500,
        color: '#1E293B',
        align: 'left',
      },
      matIcon({
        id: `${id}_chev`,
        name: 'Chevron',
        icon: 'chevron_right',
        x: W - PAD - 40,
        y: y + 12,
        w: 28,
        h: 28,
        size: 22,
        color: 'rgba(107,114,128,0.45)',
      }),
    ],
  };
}

function screenConta() {
  let y = HEADER_H + 24;
  const nodes = [header('conta', 'Conta')];
  nodes.push({
    id: 'grp_conta_avatar',
    type: 'group',
    name: 'Avatar',
    children: [
      {
        id: 'conta_avatar_bg',
        type: 'rect',
        name: 'Avatar',
        x: (W - 88) / 2,
        y,
        w: 88,
        h: 88,
        fill: 'rgba(59,130,246,0.12)',
        cornerRadius: 44,
        opacity: 1,
      },
      matIcon({
        id: 'conta_avatar_icon',
        name: 'Ícone',
        icon: 'person',
        x: (W - 88) / 2,
        y: y + 22,
        w: 88,
        h: 44,
        size: 40,
        color: '#3B82F6',
      }),
      {
        id: 'conta_avatar_btn',
        type: 'text',
        name: 'Alterar foto',
        x: PAD,
        y: y + 100,
        w: W - PAD * 2,
        h: 22,
        text: 'Alterar foto',
        fontSize: 14,
        fontWeight: 600,
        color: '#3B82F6',
        align: 'center',
      },
    ],
  });
  y += 140;
  nodes.push(fieldRow({ id: 'conta_nome', label: 'NOME', value: 'Rafael', y }));
  y += 86;
  nodes.push(
    fieldRow({
      id: 'conta_email',
      label: 'E-MAIL',
      value: 'rafael@email.com',
      y,
    }),
  );
  y += 86;
  nodes.push(primaryButton({ id: 'conta_salvar', label: 'Salvar', y }));
  return nodes;
}

function screenNotif() {
  let y = HEADER_H + 20;
  const nodes = [header('notif', 'Notificações')];
  nodes.push(sectionLabel('notif_sec', 'ALERTAS', y));
  y += 26;
  nodes.push(
    toggleRow({
      id: 'notif_push',
      title: 'Push',
      subtitle: 'Notificações do sistema',
      y,
      on: true,
    }),
  );
  y += 74;
  nodes.push(
    toggleRow({
      id: 'notif_chat',
      title: 'Chat',
      subtitle: 'Mensagens da casa',
      y,
      on: true,
    }),
  );
  y += 74;
  nodes.push(
    toggleRow({
      id: 'notif_tarefas',
      title: 'Tarefas',
      subtitle: 'Lembretes do dia',
      y,
      on: true,
    }),
  );
  y += 74;
  nodes.push(
    toggleRow({
      id: 'notif_contas',
      title: 'Contas',
      subtitle: 'Vencimentos e pagamentos',
      y,
      on: false,
    }),
  );
  y += 74;
  nodes.push(
    toggleRow({
      id: 'notif_mercado',
      title: 'Mercado',
      subtitle: 'Atualizações da lista',
      y,
      on: true,
    }),
  );
  return nodes;
}

function screenMembros() {
  let y = HEADER_H + 20;
  const nodes = [header('membros', 'Membros')];
  nodes.push(sectionLabel('membros_sec', 'QUEM PARTICIPA', y));
  y += 26;
  nodes.push(
    memberCard({
      id: 'm_rafael',
      initials: 'R',
      name: 'Rafael',
      role: 'Admin · você',
      y,
    }),
  );
  y += 82;
  nodes.push(
    memberCard({
      id: 'm_natalia',
      initials: 'N',
      name: 'Natália',
      role: 'Membro',
      y,
    }),
  );
  y += 82;
  nodes.push(
    memberCard({
      id: 'm_pedro',
      initials: 'P',
      name: 'Pedro',
      role: 'Membro',
      y,
    }),
  );
  y += 100;
  nodes.push({
    id: 'grp_membros_invite',
    type: 'group',
    name: 'Convidar',
    children: [
      {
        id: 'membros_invite',
        type: 'button',
        name: 'Convidar membro',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 52,
        label: '+  Convidar membro',
        fill: '#3B82F6',
        textColor: '#FFFFFF',
        cornerRadius: 14,
        fontSize: 15,
        fontWeight: 600,
      },
    ],
  });
  return nodes;
}

function screenCasaInfo() {
  let y = HEADER_H + 24;
  const nodes = [header('casainfo', 'Dados da casa')];
  nodes.push(
    fieldRow({ id: 'casa_nome', label: 'NOME DA CASA', value: 'CAFOFO', y }),
  );
  y += 86;
  nodes.push(
    fieldRow({
      id: 'casa_desc',
      label: 'DESCRIÇÃO',
      value: 'Casa da família',
      y,
    }),
  );
  y += 86;
  nodes.push(sectionLabel('casa_meta_sec', 'RESUMO', y));
  y += 26;
  nodes.push({
    id: 'grp_casa_meta',
    type: 'group',
    name: 'Resumo',
    children: [
      {
        id: 'casa_meta_bg',
        type: 'rect',
        name: 'Card',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 88,
        fill: '#FFFFFF',
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: 'casa_meta_membros',
        type: 'text',
        name: 'Membros',
        x: PAD + 20,
        y: y + 20,
        w: 140,
        h: 22,
        text: '3 membros',
        fontSize: 15,
        fontWeight: 600,
        color: '#1E293B',
        align: 'left',
      },
      {
        id: 'casa_meta_desde',
        type: 'text',
        name: 'Desde',
        x: PAD + 20,
        y: y + 48,
        w: 200,
        h: 20,
        text: 'Criada em jan/2026',
        fontSize: 13,
        fontWeight: 400,
        color: 'rgba(107,114,128,0.85)',
        align: 'left',
      },
    ],
  });
  y += 110;
  nodes.push(primaryButton({ id: 'casa_salvar', label: 'Salvar', y }));
  return nodes;
}

function screenSobre() {
  let y = HEADER_H + 28;
  const nodes = [header('sobre', 'Sobre')];
  nodes.push({
    id: 'grp_sobre_brand',
    type: 'group',
    name: 'Marca',
    children: [
      {
        id: 'sobre_logo_bg',
        type: 'rect',
        name: 'Logo fundo',
        x: (W - 72) / 2,
        y,
        w: 72,
        h: 72,
        fill: '#3B82F6',
        cornerRadius: 18,
        opacity: 1,
      },
      matIcon({
        id: 'sobre_logo_icon',
        name: 'Logo',
        icon: 'home',
        x: (W - 72) / 2,
        y: y + 16,
        w: 72,
        h: 40,
        size: 36,
        color: '#FFFFFF',
      }),
      {
        id: 'sobre_app_name',
        type: 'text',
        name: 'Nome app',
        x: PAD,
        y: y + 88,
        w: W - PAD * 2,
        h: 28,
        text: 'Casoiko',
        fontSize: 22,
        fontWeight: 800,
        color: '#1E293B',
        align: 'center',
      },
      {
        id: 'sobre_version',
        type: 'text',
        name: 'Versão',
        x: PAD,
        y: y + 120,
        w: W - PAD * 2,
        h: 20,
        text: 'Versão 1.0.0',
        fontSize: 13,
        fontWeight: 400,
        color: '#6B7280',
        align: 'center',
      },
    ],
  });
  y += 164;
  nodes.push(linkRow({ id: 'sobre_termos', icon: 'description', title: 'Termos de uso', y }));
  y += 62;
  nodes.push(
    linkRow({
      id: 'sobre_priv',
      icon: 'privacy_tip',
      title: 'Política de privacidade',
      y,
    }),
  );
  y += 62;
  nodes.push(linkRow({ id: 'sobre_ajuda', icon: 'help_outline', title: 'Ajuda', y }));
  return nodes;
}

const DEFINITIONS = [
  { id: 'config_conta', name: 'Conta', nodes: screenConta },
  { id: 'config_notif', name: 'Notificações', nodes: screenNotif },
  { id: 'config_membros', name: 'Membros', nodes: screenMembros },
  { id: 'config_casa', name: 'Dados da casa', nodes: screenCasaInfo },
  { id: 'config_sobre', name: 'Sobre', nodes: screenSobre },
];

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const config = raw.screens.find((s) => s.id === 'config');
const baseX = (config?.x ?? 470) + COL;
const baseY = config?.y ?? -924;

for (let i = 0; i < DEFINITIONS.length; i++) {
  const def = DEFINITIONS[i];
  let screen = raw.screens.find((s) => s.id === def.id);
  if (!screen) {
    screen = createScreen({
      id: def.id,
      name: def.name,
      width: W,
      height: H,
      background: '#EEF5FC',
      board: { screens: raw.screens },
    });
    raw.screens.push(screen);
  }
  screen.name = def.name;
  screen.background = '#EEF5FC';
  screen.width = W;
  screen.height = H;
  screen.x = baseX + i * COL;
  screen.y = baseY;
  screen.nodes = def.nodes();
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

console.log(
  JSON.stringify(
    DEFINITIONS.map((d) => {
      const s = board.screens.find((x) => x.id === d.id);
      return { id: s.id, name: s.name, x: s.x, y: s.y };
    }),
    null,
    2,
  ),
);
