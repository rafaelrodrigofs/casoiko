/**
 * Painel Admin (acesso pelo ícone no header do Perfil).
 * Hub + Visualizações + Conclusões + Banco de dados.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createScreen,
  normalizeBoard,
  writeBoard,
} from '../packages/core/src/index.js';
import { W, H, STATUS, BAR, HEADER_H, matIcon, colors } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath = path.resolve(__dirname, '../data/board.json');
const PAD = 16;
const GAP = 80;
const ROW_H = 64;

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
        fill: colors.headerGradient,
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
    w: 280,
    h: 18,
    text: label,
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    align: 'left',
  };
}

function adminRow({ id, icon, title, subtitle, y, danger = false }) {
  const kids = [
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Linha fundo',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: ROW_H,
      fill: colors.surface,
      cornerRadius: 14,
      opacity: 1,
      stroke: danger ? 'rgba(192,57,43,0.18)' : 'rgba(59,130,246,0.10)',
      strokeWidth: 1,
    },
    {
      id: `${id}_icon_bg`,
      type: 'rect',
      name: 'Ícone fundo',
      x: PAD + 12,
      y: y + 14,
      w: 36,
      h: 36,
      fill: danger ? 'rgba(192,57,43,0.10)' : 'rgba(59,130,246,0.10)',
      cornerRadius: 10,
      opacity: 1,
    },
    matIcon({
      id: `${id}_icon`,
      name: `Ícone ${title}`,
      icon,
      x: PAD + 12,
      y: y + 18,
      w: 36,
      h: 28,
      size: 20,
      color: danger ? colors.danger : colors.primary,
    }),
    {
      id: `${id}_title`,
      type: 'text',
      name: title,
      x: PAD + 60,
      y: y + 14,
      w: 240,
      h: 22,
      text: title,
      fontSize: 15,
      fontWeight: 600,
      color: danger ? colors.danger : colors.text,
      align: 'left',
    },
    {
      id: `${id}_sub`,
      type: 'text',
      name: 'Subtítulo',
      x: PAD + 60,
      y: y + 36,
      w: 250,
      h: 18,
      text: subtitle,
      fontSize: 12,
      fontWeight: 400,
      color: 'rgba(100,116,139,0.9)',
      align: 'left',
    },
  ];

  if (!danger) {
    kids.push(
      matIcon({
        id: `${id}_chev`,
        name: 'Chevron',
        icon: 'chevron_right',
        x: W - PAD - 40,
        y: y + 18,
        w: 28,
        h: 28,
        size: 22,
        color: 'rgba(100,116,139,0.45)',
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

function tipCard({ id, title, body, y }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: title,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Tip fundo',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 72,
        fill: 'rgba(59,130,246,0.08)',
        cornerRadius: 14,
        opacity: 1,
      },
      matIcon({
        id: `${id}_icon`,
        name: 'Info',
        icon: 'lightbulb',
        x: PAD + 12,
        y: y + 22,
        w: 28,
        h: 28,
        size: 22,
        color: colors.primary,
      }),
      {
        id: `${id}_title`,
        type: 'text',
        name: 'Titulo tip',
        x: PAD + 48,
        y: y + 12,
        w: W - PAD * 2 - 60,
        h: 18,
        text: title,
        fontSize: 13,
        fontWeight: 700,
        color: colors.text,
        align: 'left',
      },
      {
        id: `${id}_body`,
        type: 'text',
        name: 'Corpo tip',
        x: PAD + 48,
        y: y + 34,
        w: W - PAD * 2 - 60,
        h: 30,
        text: body,
        fontSize: 12,
        fontWeight: 400,
        color: colors.textSecondary,
        align: 'left',
      },
    ],
  };
}

function statMini({ id, label, value, x, y, w }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name: label,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Fundo',
        x,
        y,
        w,
        h: 72,
        fill: colors.surface,
        cornerRadius: 14,
        opacity: 1,
        stroke: 'rgba(59,130,246,0.10)',
        strokeWidth: 1,
      },
      {
        id: `${id}_label`,
        type: 'text',
        name: 'Label',
        x: x + 12,
        y: y + 12,
        w: w - 24,
        h: 16,
        text: label,
        fontSize: 11,
        fontWeight: 500,
        color: colors.textSecondary,
        align: 'left',
      },
      {
        id: `${id}_value`,
        type: 'text',
        name: 'Valor',
        x: x + 12,
        y: y + 32,
        w: w - 24,
        h: 28,
        text: value,
        fontSize: 22,
        fontWeight: 800,
        color: colors.text,
        align: 'left',
      },
    ],
  };
}

function listRow({ id, title, meta, y, badge }) {
  const kids = [
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Item',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 56,
      fill: colors.surface,
      cornerRadius: 12,
      opacity: 1,
    },
    {
      id: `${id}_title`,
      type: 'text',
      name: 'Titulo',
      x: PAD + 14,
      y: y + 10,
      w: 220,
      h: 20,
      text: title,
      fontSize: 14,
      fontWeight: 600,
      color: colors.text,
      align: 'left',
    },
    {
      id: `${id}_meta`,
      type: 'text',
      name: 'Meta',
      x: PAD + 14,
      y: y + 32,
      w: 260,
      h: 16,
      text: meta,
      fontSize: 11,
      fontWeight: 400,
      color: colors.textSecondary,
      align: 'left',
    },
  ];
  if (badge) {
    kids.push(
      {
        id: `${id}_badge_bg`,
        type: 'rect',
        name: 'Badge bg',
        x: W - PAD - 72,
        y: y + 16,
        w: 56,
        h: 24,
        fill: badge.danger
          ? 'rgba(192,57,43,0.12)'
          : 'rgba(59,130,246,0.12)',
        cornerRadius: 8,
        opacity: 1,
      },
      {
        id: `${id}_badge`,
        type: 'text',
        name: 'Badge',
        x: W - PAD - 72,
        y: y + 19,
        w: 56,
        h: 18,
        text: badge.text,
        fontSize: 10,
        fontWeight: 700,
        color: badge.danger ? colors.danger : colors.primary,
        align: 'center',
      },
    );
  }
  return {
    id: `grp_${id}`,
    type: 'group',
    name: title,
    children: kids,
  };
}

// —— Hub Admin
function screenHub() {
  const nodes = [header('admin', 'Admin')];
  let y = HEADER_H + 16;

  nodes.push({
    id: 'grp_admin_badge',
    type: 'group',
    name: 'Badge admin',
    children: [
      {
        id: 'admin_badge_bg',
        type: 'rect',
        name: 'Fundo',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 56,
        fill: colors.surface,
        cornerRadius: 14,
        opacity: 1,
        stroke: 'rgba(59,130,246,0.12)',
        strokeWidth: 1,
      },
      matIcon({
        id: 'admin_badge_icon',
        name: 'Shield',
        icon: 'verified_user',
        x: PAD + 14,
        y: y + 14,
        w: 28,
        h: 28,
        size: 22,
        color: colors.primary,
      }),
      {
        id: 'admin_badge_title',
        type: 'text',
        name: 'Titulo',
        x: PAD + 50,
        y: y + 12,
        w: 260,
        h: 18,
        text: 'Painel do administrador',
        fontSize: 14,
        fontWeight: 700,
        color: colors.text,
        align: 'left',
      },
      {
        id: 'admin_badge_sub',
        type: 'text',
        name: 'Sub',
        x: PAD + 50,
        y: y + 32,
        w: 280,
        h: 16,
        text: 'Gerencie dados, visualizações e ferramentas',
        fontSize: 12,
        fontWeight: 400,
        color: colors.textSecondary,
        align: 'left',
      },
    ],
  });
  y += 72;

  nodes.push(
    tipCard({
      id: 'admin_tip',
      title: 'Sobre números do Perfil',
      body: '“Concluídas” no topo = hoje. O anel usa 7/30/90 dias.',
      y,
    }),
  );
  y += 88;

  nodes.push(sectionLabel('admin_sec_ver', 'VISUALIZAÇÕES', y));
  y += 26;

  nodes.push(
    adminRow({
      id: 'admin_row_viz',
      icon: 'insights',
      title: 'Visualizações',
      subtitle: 'Resumos por membro, dia e categoria',
      y,
    }),
  );
  y += ROW_H + 10;

  nodes.push(
    adminRow({
      id: 'admin_row_checks',
      icon: 'task_alt',
      title: 'Conclusões',
      subtitle: 'Listar checks e achar órfãos',
      y,
    }),
  );
  y += ROW_H + 20;

  nodes.push(sectionLabel('admin_sec_dados', 'DADOS & APP', y));
  y += 26;

  nodes.push(
    adminRow({
      id: 'admin_row_db',
      icon: 'storage',
      title: 'Banco de dados',
      subtitle: 'Coleções Firestore e contagens',
      y,
    }),
  );
  y += ROW_H + 10;

  nodes.push(
    adminRow({
      id: 'admin_row_export',
      icon: 'download',
      title: 'Exportar / importar',
      subtitle: 'Backup JSON da casa',
      y,
    }),
  );
  y += ROW_H + 10;

  nodes.push(
    adminRow({
      id: 'admin_row_config',
      icon: 'settings',
      title: 'Configurações da casa',
      subtitle: 'Membros, conta e preferências',
      y,
    }),
  );
  y += ROW_H + 20;

  nodes.push(sectionLabel('admin_sec_danger', 'ZONA PERIGOSA', y));
  y += 26;

  nodes.push(
    adminRow({
      id: 'admin_row_cleanup',
      icon: 'delete_sweep',
      title: 'Limpeza',
      subtitle: 'Remover checks sem tarefa',
      y,
      danger: true,
    }),
  );

  return nodes;
}

// —— Visualizações
function screenViz() {
  const cardW = (W - PAD * 2 - 10) / 2;
  const nodes = [
    header('admin_viz', 'Visualizações'),
    sectionLabel('viz_sec', 'RESUMO DA CASA', HEADER_H + 16),
    statMini({
      id: 'viz_tasks',
      label: 'Tarefas ativas',
      value: '18',
      x: PAD,
      y: HEADER_H + 40,
      w: cardW,
    }),
    statMini({
      id: 'viz_checks',
      label: 'Checks (30d)',
      value: '29',
      x: PAD + cardW + 10,
      y: HEADER_H + 40,
      w: cardW,
    }),
    statMini({
      id: 'viz_orphans',
      label: 'Checks órfãos',
      value: '3',
      x: PAD,
      y: HEADER_H + 124,
      w: cardW,
    }),
    statMini({
      id: 'viz_members',
      label: 'Membros',
      value: '2',
      x: PAD + cardW + 10,
      y: HEADER_H + 124,
      w: cardW,
    }),
  ];

  let y = HEADER_H + 214;
  nodes.push(sectionLabel('viz_sec_members', 'POR MEMBRO (30 DIAS)', y));
  y += 26;

  const members = [
    { name: 'Rafael', meta: '22 conclusões · 76%', badge: 'Você' },
    { name: 'Ana', meta: '7 conclusões · 24%', badge: null },
  ];
  for (const [i, m] of members.entries()) {
    nodes.push(
      listRow({
        id: `viz_m_${i}`,
        title: m.name,
        meta: m.meta,
        y,
        badge: m.badge ? { text: m.badge } : null,
      }),
    );
    y += 64;
  }

  y += 8;
  nodes.push(sectionLabel('viz_sec_days', 'DIAS COM MAIS ATIVIDADE', y));
  y += 26;

  const tops = [
    { title: '12 jul 2026', meta: '8 tarefas concluídas' },
    { title: '08 jul 2026', meta: '5 tarefas concluídas' },
    { title: '03 jul 2026', meta: '4 tarefas concluídas' },
  ];
  for (const [i, t] of tops.entries()) {
    nodes.push(
      listRow({
        id: `viz_d_${i}`,
        title: t.title,
        meta: t.meta,
        y,
      }),
    );
    y += 64;
  }

  return nodes;
}

// —— Conclusões (ajuda a achar checks “fantasma”)
function screenChecks() {
  const nodes = [
    header('admin_chk', 'Conclusões'),
    tipCard({
      id: 'chk_tip',
      title: 'Por que aparece no Perfil?',
      body: 'Checks antigos ou sem tarefa ainda entram no anel de 30 dias.',
      y: HEADER_H + 16,
    }),
  ];

  let y = HEADER_H + 104;
  nodes.push(sectionLabel('chk_sec_filter', 'FILTROS', y));
  y += 26;

  // chips
  const chips = ['Todas', 'Suas', 'Órfãs', 'Sem prova'];
  chips.forEach((label, i) => {
    const chipW = 72;
    const x = PAD + i * (chipW + 8);
    const active = i === 2;
    nodes.push({
      id: `chk_chip_${i}`,
      type: 'rect',
      name: `Chip ${label}`,
      x,
      y,
      w: chipW,
      h: 30,
      fill: active ? colors.primary : colors.surface,
      cornerRadius: 15,
      opacity: 1,
      stroke: active ? colors.primary : 'rgba(59,130,246,0.15)',
      strokeWidth: 1,
    });
    nodes.push({
      id: `chk_chip_t_${i}`,
      type: 'text',
      name: label,
      x,
      y: y + 6,
      w: chipW,
      h: 18,
      text: label,
      fontSize: 12,
      fontWeight: 600,
      color: active ? '#FFFFFF' : colors.text,
      align: 'center',
    });
  });
  y += 46;

  nodes.push(sectionLabel('chk_sec_list', 'ÚLTIMAS CONCLUSÕES', y));
  y += 26;

  const items = [
    {
      title: 'Lavar louça',
      meta: 'Rafael · 14 jul · ok',
      badge: { text: 'OK' },
    },
    {
      title: 'task_id deletado',
      meta: 'Rafael · 11 jul · sem tarefa',
      badge: { text: 'Órfã', danger: true },
    },
    {
      title: 'Aspirar sala',
      meta: 'Ana · 10 jul · ok',
      badge: { text: 'OK' },
    },
    {
      title: 'check antigo',
      meta: 'Rafael · 02 jul · tarefa sumiu',
      badge: { text: 'Órfã', danger: true },
    },
  ];
  for (const [i, it] of items.entries()) {
    nodes.push(
      listRow({
        id: `chk_i_${i}`,
        title: it.title,
        meta: it.meta,
        y,
        badge: it.badge,
      }),
    );
    y += 64;
  }

  y += 8;
  nodes.push({
    id: 'grp_chk_cta',
    type: 'group',
    name: 'CTA limpar',
    children: [
      {
        id: 'chk_cta_bg',
        type: 'rect',
        name: 'Botão',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 48,
        fill: colors.danger,
        cornerRadius: 14,
        opacity: 1,
      },
      {
        id: 'chk_cta_label',
        type: 'text',
        name: 'Label',
        x: PAD,
        y: y + 14,
        w: W - PAD * 2,
        h: 22,
        text: 'Remover 3 órfãs',
        fontSize: 15,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'center',
      },
    ],
  });

  return nodes;
}

// —— Banco de dados
function screenDb() {
  const nodes = [
    header('admin_db', 'Banco de dados'),
    tipCard({
      id: 'db_tip',
      title: 'Somente leitura por padrão',
      body: 'Use limpeza só depois de revisar órfãos e exportar backup.',
      y: HEADER_H + 16,
    }),
  ];

  let y = HEADER_H + 104;
  nodes.push(sectionLabel('db_sec', 'COLEÇÕES', y));
  y += 26;

  const cols = [
    { title: 'tasks', meta: '18 documentos' },
    { title: 'task_checks', meta: '124 documentos · 3 órfãos' },
    { title: 'houses / members', meta: '1 casa · 2 membros' },
    { title: 'market_lists / items', meta: '4 listas · 31 itens' },
    { title: 'finance / bills', meta: '12 lançamentos' },
    { title: 'messages', meta: '86 mensagens' },
  ];
  for (const [i, c] of cols.entries()) {
    nodes.push(
      listRow({
        id: `db_c_${i}`,
        title: c.title,
        meta: c.meta,
        y,
      }),
    );
    y += 64;
  }

  y += 8;
  nodes.push(sectionLabel('db_sec_tools', 'FERRAMENTAS', y));
  y += 26;

  nodes.push(
    adminRow({
      id: 'db_row_refresh',
      icon: 'sync',
      title: 'Recalcular contagens',
      subtitle: 'Atualiza o resumo do painel',
      y,
    }),
  );
  y += ROW_H + 10;

  nodes.push(
    adminRow({
      id: 'db_row_export',
      icon: 'ios_share',
      title: 'Exportar casa (JSON)',
      subtitle: 'Download das coleções principais',
      y,
    }),
  );

  return nodes;
}

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
const perfil = raw.screens.find((s) => s.id === 'perfil');
const baseX = (perfil?.x ?? 2350) + W + GAP;
const baseY = perfil?.y ?? 0;

const screensDef = [
  { id: 'admin', name: '07 — Admin', nodes: screenHub(), col: 0, row: 0 },
  {
    id: 'admin_viz',
    name: 'Admin · Visualizações',
    nodes: screenViz(),
    col: 1,
    row: 0,
  },
  {
    id: 'admin_checks',
    name: 'Admin · Conclusões',
    nodes: screenChecks(),
    col: 0,
    row: 1,
  },
  {
    id: 'admin_db',
    name: 'Admin · Banco',
    nodes: screenDb(),
    col: 1,
    row: 1,
  },
];

for (const def of screensDef) {
  let screen = raw.screens.find((s) => s.id === def.id);
  if (!screen) {
    screen = createScreen({
      id: def.id,
      name: def.name,
      width: W,
      height: H,
      background: colors.background,
      board: { screens: raw.screens },
    });
    raw.screens.push(screen);
  }
  screen.name = def.name;
  screen.background = colors.background;
  screen.width = W;
  screen.height = H;
  screen.x = baseX + def.col * (W + GAP);
  screen.y = baseY + def.row * (H + GAP);
  screen.nodes = def.nodes;
}

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

console.log(
  JSON.stringify(
    {
      from: 'perfil',
      screens: screensDef.map((d) => {
        const s = board.screens.find((x) => x.id === d.id);
        return { id: s.id, name: s.name, x: s.x, y: s.y };
      }),
    },
    null,
    2,
  ),
);
