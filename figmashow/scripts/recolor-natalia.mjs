/**
 * Recoloração wellness (#5DB075) no projeto Natalia.
 * Uso: node scripts/recolor-natalia.mjs
 */
const API = 'https://figma.rafaelrodrigofs.cloud';
const PROJECT_ID = 'id_ef22ac7e';

const COLOR_MAP = {
  '#F7F5F2': '#FFFFFF',
  '#f7f5f2': '#FFFFFF',
  '#355B50': '#5DB075',
  '#355b50': '#5DB075',
  '#4D7C6F': '#5DB075',
  '#4d7c6f': '#5DB075',
  '#253B35': '#1A1F1C',
  '#253b35': '#1A1F1C',
  '#788780': '#6B736E',
  '#60766E': '#6B736E',
  '#60766e': '#6B736E',
  '#8B9691': '#9AA39C',
  '#8b9691': '#9AA39C',
  '#DCE9E4': '#E8F5EA',
  '#dce9e4': '#E8F5EA',
  '#E6B8A2': '#CDE9D4',
  '#e6b8a2': '#CDE9D4',
  '#5B3A2E': '#3F9558',
  '#5b3a2e': '#3F9558',
  '#E7E2DC': '#E3EBE4',
  '#e7e2dc': '#E3EBE4',
  '#E6F2ED': '#E8F5EA',
  '#e6f2ed': '#E8F5EA',
  '#E8F1ED': '#E8F5EA',
  '#e8f1ed': '#E8F5EA',
  '#FFF0E8': '#FFF6EB',
  '#fff0e8': '#FFF6EB',
  '#CAD8D3': '#CDE9D4',
  '#cad8d3': '#CDE9D4',
  '#A75D43': '#3F9558',
  '#a75d43': '#3F9558',
  '#967063': '#6B736E',
  '#C97958': '#D4924A',
  '#c97958': '#D4924A',
};

function mapColor(c) {
  if (typeof c !== 'string') return c;
  const key = c.trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];
  const lower = key.toLowerCase();
  for (const [from, to] of Object.entries(COLOR_MAP)) {
    if (from.toLowerCase() === lower) return to;
  }
  return c;
}

function walk(node, stats) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, stats);
    return;
  }
  for (const key of ['fill', 'color', 'textColor', 'stroke', 'background']) {
    if (typeof node[key] === 'string') {
      const next = mapColor(node[key]);
      if (next !== node[key]) {
        node[key] = next;
        stats.changed += 1;
      }
    }
  }
  // Soften dark heroes: primary dark greens on large rects → soft mint header look
  if (
    node.type === 'rect' &&
    node.fill === '#5DB075' &&
    typeof node.w === 'number' &&
    node.w >= 300 &&
    typeof node.h === 'number' &&
    node.h >= 120 &&
    node.h <= 280
  ) {
    // keep brand green for true CTAs; hero bars become soft
    if (node.name && /fundo|header|hero|barra/i.test(node.name)) {
      node.fill = '#E8F5EA';
      if (node.bottomRadius == null) node.bottomRadius = 28;
      stats.heroes += 1;
    }
  }
  if (node.type === 'button' && node.fill === '#5DB075') {
    node.cornerRadius = Math.max(Number(node.cornerRadius) || 0, 28);
    stats.buttons += 1;
  }
  if (node.type === 'rect' && typeof node.cornerRadius === 'number' && node.cornerRadius >= 14 && node.cornerRadius < 20) {
    node.cornerRadius = 20;
  }
  if (Array.isArray(node.children)) walk(node.children, stats);
  if (Array.isArray(node.nodes)) walk(node.nodes, stats);
  if (Array.isArray(node.screens)) {
    for (const s of node.screens) {
      if (s.id === 'screen_login_00') continue; // já redesenhada
      if (typeof s.background === 'string') {
        const nb = mapColor(s.background);
        if (nb !== s.background || s.background === '#F7F5F2') {
          s.background = '#FFFFFF';
          stats.screens += 1;
        }
      } else {
        s.background = '#FFFFFF';
        stats.screens += 1;
      }
      walk(s.nodes || [], stats);
      // After color map: text that was white on dark hero may need darkening if hero softened
      fixTextOnSoftHero(s.nodes || [], stats);
    }
  }
}

function fixTextOnSoftHero(nodes, stats) {
  for (const n of nodes || []) {
    if (n.type === 'text' && (n.color === '#FFFFFF' || n.color === '#E8F5EA' || n.color === '#DCE9E4')) {
      // if sitting in top soft header zone and was light, flip to dark
      if (typeof n.y === 'number' && n.y < 220) {
        if (n.color === '#FFFFFF') {
          n.color = '#1A1F1C';
          stats.textFix += 1;
        } else if (n.color === '#E8F5EA') {
          n.color = '#6B736E';
          stats.textFix += 1;
        }
      }
    }
    if (n.children) fixTextOnSoftHero(n.children, stats);
  }
}

const res = await fetch(`${API}/api/projects/${PROJECT_ID}`);
if (!res.ok) throw new Error(`GET ${res.status}`);
const data = await res.json();
const board = data.board || data;
const expectedRevision = board.revision;

const stats = { changed: 0, heroes: 0, buttons: 0, screens: 0, textFix: 0 };
walk(board, stats);

board.tokens = {
  ...(board.tokens || {}),
  color: {
    bg: '#FFFFFF',
    bgSoft: '#F4F9F5',
    primary: '#5DB075',
    primaryDark: '#3F9558',
    primarySoft: '#E8F5EA',
    primaryMute: '#CDE9D4',
    text: '#1A1F1C',
    textSecondary: '#6B736E',
    textMuted: '#9AA39C',
    border: '#E3EBE4',
    card: '#FFFFFF',
    warningSoft: '#FFF6EB',
    warning: '#D4924A',
    onPrimary: '#FFFFFF',
  },
};

const put = await fetch(`${API}/api/projects/${PROJECT_ID}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...board, expectedRevision }),
});
const putBody = await put.text();
if (!put.ok) {
  console.error(put.status, putBody.slice(0, 500));
  process.exit(1);
}
console.log('ok', stats, 'revision', JSON.parse(putBody).revision || JSON.parse(putBody).board?.revision);
