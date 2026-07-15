/**
 * Cria a tela 04 — Contas no board FigmaShow (fiel ao Flutter).
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

function billTile({ id, name, icon, subtitle, subtitleColor, y, paid, badge }) {
  const kids = [
    {
      id: `${id}_bg`,
      type: 'rect',
      name: 'Card fundo',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 72,
      fill: paid ? 'rgba(255,255,255,0.55)' : '#FFFFFF',
      cornerRadius: 14,
      opacity: 1,
    },
    {
      id: `${id}_icon_bg`,
      type: 'rect',
      name: 'Ícone fundo',
      x: PAD + 12,
      y: y + 14,
      w: 40,
      h: 40,
      fill: 'rgba(59,130,246,0.1)',
      cornerRadius: 20,
      opacity: 1,
    },
    matIcon({
      id: `${id}_icon`,
      name: 'Ícone',
      icon,
      x: PAD + 12,
      y: y + 18,
      w: 40,
      h: 32,
      size: 18,
      color: '#3B82F6',
    }),
    {
      id: `${id}_title`,
      type: 'text',
      name,
      x: PAD + 64,
      y: y + 12,
      w: paid || badge ? 168 : 220,
      h: 22,
      text: name,
      fontSize: 16,
      fontWeight: 500,
      color: paid ? 'rgba(107,114,128,0.55)' : '#1E293B',
      align: 'left',
    },
    {
      id: `${id}_sub`,
      type: 'text',
      name: 'Subtítulo',
      x: PAD + 64,
      y: y + 36,
      w: paid || badge ? 168 : 250,
      h: 28,
      text: subtitle,
      fontSize: 11,
      fontWeight: subtitleColor === '#C0392B' ? 700 : 400,
      color: subtitleColor || 'rgba(107,114,128,0.65)',
      align: 'left',
    },
  ];

  if (paid) {
    kids.push(
      matIcon({
        id: `${id}_check`,
        name: 'Pago',
        icon: 'check',
        x: W - PAD - 44,
        y: y + 22,
        w: 32,
        h: 28,
        size: 22,
        color: '#2E7D4F',
      }),
    );
  } else if (badge) {
    kids.push(
      {
        id: `${id}_pay_bg`,
        type: 'rect',
        name: 'Botão pagar',
        x: W - PAD - 78,
        y: y + 20,
        w: 62,
        h: 32,
        fill: '#3B82F6',
        cornerRadius: 16,
        opacity: 1,
      },
      {
        id: `${id}_pay`,
        type: 'text',
        name: 'Pagar',
        x: W - PAD - 78,
        y: y + 24,
        w: 62,
        h: 24,
        text: 'Pagar',
        fontSize: 13,
        fontWeight: 700,
        color: '#FFFFFF',
        align: 'center',
      },
    );
  }

  return {
    id: `grp_${id}`,
    type: 'group',
    name,
    children: kids,
  };
}

function txTile({ id, name, amount, color, y, icon }) {
  return {
    id: `grp_${id}`,
    type: 'group',
    name,
    children: [
      {
        id: `${id}_bg`,
        type: 'rect',
        name: 'Card fundo',
        x: PAD,
        y,
        w: W - PAD * 2,
        h: 64,
        fill: '#FFFFFF',
        cornerRadius: 14,
        opacity: 1,
      },
      matIcon({
        id: `${id}_icon`,
        name: 'Ícone',
        icon,
        x: PAD + 12,
        y: y + 16,
        w: 36,
        h: 32,
        size: 18,
        color,
      }),
      {
        id: `${id}_title`,
        type: 'text',
        name,
        x: PAD + 52,
        y: y + 12,
        w: 150,
        h: 22,
        text: name,
        fontSize: 15,
        fontWeight: 600,
        color: '#1E293B',
        align: 'left',
      },
      {
        id: `${id}_sub`,
        type: 'text',
        name: 'Meta',
        x: PAD + 52,
        y: y + 34,
        w: 140,
        h: 18,
        text: '14/07 · Avulso',
        fontSize: 12,
        fontWeight: 400,
        color: 'rgba(107,114,128,0.65)',
        align: 'left',
      },
      {
        id: `${id}_amt`,
        type: 'text',
        name: 'Valor',
        x: PAD + 200,
        y: y + 20,
        w: W - PAD * 2 - 200 - 8,
        h: 24,
        text: amount,
        fontSize: 14,
        fontWeight: 700,
        color,
        align: 'right',
      },
    ],
  };
}

let y = HEADER_H + 12;

const header = {
  id: 'grp_contas_header',
  type: 'group',
  name: 'Header',
  children: [
    {
      id: 'contas_header_bg',
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
      id: 'contas_icon',
      name: 'Ícone Contas',
      icon: 'receipt_long',
      x: 20,
      y: STATUS,
      w: 28,
      h: BAR,
      size: 18,
      color: '#FFFFFF',
    }),
    {
      id: 'contas_title',
      type: 'text',
      name: 'Título',
      x: 52,
      y: STATUS,
      w: 160,
      h: BAR,
      text: 'Contas',
      fontSize: 17,
      fontWeight: 700,
      color: '#FFFFFF',
      align: 'left',
    },
  ],
};

const monthSel = {
  id: 'grp_contas_month',
  type: 'group',
  name: 'Seletor mês',
  children: [
    matIcon({
      id: 'month_prev',
      name: 'Anterior',
      icon: 'chevron_left',
      x: 80,
      y,
      w: 36,
      h: 36,
      size: 24,
      color: '#3B82F6',
    }),
    {
      id: 'month_label',
      type: 'text',
      name: 'Julho 2026',
      x: 110,
      y,
      w: 170,
      h: 36,
      text: 'Julho 2026',
      fontSize: 16,
      fontWeight: 700,
      color: '#1E293B',
      align: 'center',
    },
    matIcon({
      id: 'month_next',
      name: 'Próximo',
      icon: 'chevron_right',
      x: 274,
      y,
      w: 36,
      h: 36,
      size: 24,
      color: '#3B82F6',
    }),
  ],
};
y += 36 + 12;

const summary = {
  id: 'grp_contas_summary',
  type: 'group',
  name: 'Resumo',
  children: [
    {
      id: 'summary_bg',
      type: 'rect',
      name: 'Card resumo',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 72,
      fill: '#3B82F6',
      cornerRadius: 16,
      opacity: 1,
    },
    {
      id: 'sum_rec_l',
      type: 'text',
      name: 'Label receitas',
      x: PAD + 8,
      y: y + 14,
      w: 110,
      h: 14,
      text: 'RECEITAS',
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.7)',
      align: 'center',
    },
    {
      id: 'sum_rec_v',
      type: 'text',
      name: 'Valor receitas',
      x: PAD + 8,
      y: y + 32,
      w: 110,
      h: 22,
      text: 'R$ 4.200,00',
      fontSize: 14,
      fontWeight: 800,
      color: '#9CCFA9',
      align: 'center',
    },
    {
      id: 'sum_desp_l',
      type: 'text',
      name: 'Label despesas',
      x: PAD + 118,
      y: y + 14,
      w: 110,
      h: 14,
      text: 'DESPESAS',
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.7)',
      align: 'center',
    },
    {
      id: 'sum_desp_v',
      type: 'text',
      name: 'Valor despesas',
      x: PAD + 118,
      y: y + 32,
      w: 110,
      h: 22,
      text: 'R$ 1.845,00',
      fontSize: 14,
      fontWeight: 800,
      color: '#E8A29A',
      align: 'center',
    },
    {
      id: 'sum_sal_l',
      type: 'text',
      name: 'Label saldo',
      x: PAD + 228,
      y: y + 14,
      w: 110,
      h: 14,
      text: 'SALDO',
      fontSize: 10,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.7)',
      align: 'center',
    },
    {
      id: 'sum_sal_v',
      type: 'text',
      name: 'Valor saldo',
      x: PAD + 228,
      y: y + 32,
      w: 110,
      h: 22,
      text: 'R$ 2.355,00',
      fontSize: 14,
      fontWeight: 800,
      color: '#FFFFFF',
      align: 'center',
    },
  ],
};
y += 72 + 12;

const split = {
  id: 'grp_contas_split',
  type: 'group',
  name: 'Divisão',
  children: [
    {
      id: 'split_bg',
      type: 'rect',
      name: 'Card divisão',
      x: PAD,
      y,
      w: W - PAD * 2,
      h: 88,
      fill: '#FFFFFF',
      cornerRadius: 16,
      opacity: 1,
    },
    {
      id: 'split_title',
      type: 'text',
      name: 'Título divisão',
      x: PAD + 16,
      y: y + 12,
      w: W - PAD * 2 - 32,
      h: 16,
      text: 'DIVISÃO DA CASA · R$ 615,00 cada',
      fontSize: 11,
      fontWeight: 700,
      color: '#6B7280',
      align: 'left',
    },
    {
      id: 'split_b',
      type: 'text',
      name: 'Bradley',
      x: PAD + 16,
      y: y + 38,
      w: 100,
      h: 36,
      text: 'B  Bradley\nem dia',
      fontSize: 12,
      fontWeight: 600,
      color: '#2E7D4F',
      align: 'left',
    },
    {
      id: 'split_n',
      type: 'text',
      name: 'Natália',
      x: PAD + 130,
      y: y + 38,
      w: 100,
      h: 36,
      text: 'N  Natália\nem dia',
      fontSize: 12,
      fontWeight: 600,
      color: '#2E7D4F',
      align: 'left',
    },
    {
      id: 'split_r',
      type: 'text',
      name: 'Rafael',
      x: PAD + 244,
      y: y + 38,
      w: 100,
      h: 36,
      text: 'R  Rafael\npendente',
      fontSize: 12,
      fontWeight: 600,
      color: '#B8860B',
      align: 'left',
    },
  ],
};
y += 88 + 16;

const billsHeader = {
  id: 'sec_bills',
  type: 'text',
  name: 'Contas fixas',
  x: PAD + 4,
  y,
  w: 200,
  h: 20,
  text: 'CONTAS FIXAS (3)',
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7280',
  align: 'left',
};
y += 28;

const billLuz = billTile({
  id: 'bill_luz',
  name: 'Luz',
  icon: 'lightbulb',
  subtitle: 'Venceu dia 10 · R$ 93/cada',
  subtitleColor: '#C0392B',
  y,
  paid: false,
  badge: true,
});
y += 80;

const billNet = billTile({
  id: 'bill_net',
  name: 'Internet',
  icon: 'wifi',
  subtitle: 'Vence dia 20 · R$ 40/cada',
  y,
  paid: false,
  badge: true,
});
y += 80;

const billAluguel = billTile({
  id: 'bill_aluguel',
  name: 'Aluguel',
  icon: 'home',
  subtitle: 'Vence dia 5 · R$ 600/cada',
  y,
  paid: true,
  badge: false,
});
y += 80 + 8;

const txHeader = {
  id: 'sec_tx',
  type: 'text',
  name: 'Lançamentos',
  x: PAD + 4,
  y,
  w: 220,
  h: 20,
  text: 'LANÇAMENTOS (2)',
  fontSize: 11,
  fontWeight: 700,
  color: '#6B7280',
  align: 'left',
};
y += 28;

const txIncome = txTile({
  id: 'tx_salario',
  name: 'Salário',
  amount: '+ R$ 4.200',
  color: '#16A34A',
  icon: 'south',
  y,
});
y += 72;

const txExpense = txTile({
  id: 'tx_mercado',
  name: 'Mercado semanal',
  amount: '- R$ 186,40',
  color: '#DC2626',
  icon: 'north',
  y,
});

const fab = {
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

const nav = bottomNav('contas');

const contasNodes = [
  header,
  monthSel,
  summary,
  split,
  {
    id: 'grp_contas_bills',
    type: 'group',
    name: 'Contas fixas',
    children: [billsHeader, billLuz, billNet, billAluguel],
  },
  {
    id: 'grp_contas_tx',
    type: 'group',
    name: 'Lançamentos',
    children: [txHeader, txIncome, txExpense],
  },
  fab,
  nav,
];

const raw = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
let screen = raw.screens.find((s) => s.id === 'contas');
if (!screen) {
  screen = createScreen({
    id: 'contas',
    name: '04 — Contas',
    width: W,
    height: H,
    background: '#EEF5FC',
    board: { screens: raw.screens },
  });
  raw.screens.push(screen);
}

screen.name = '04 — Contas';
screen.background = '#EEF5FC';
screen.width = W;
screen.height = H;
screen.nodes = contasNodes;

const board = normalizeBoard(raw);
writeBoard(board, boardPath);

const c = board.screens.find((s) => s.id === 'contas');
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
