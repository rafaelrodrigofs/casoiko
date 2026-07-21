#!/usr/bin/env node
/**
 * Enriquecimento pós-build — espelha operações MCP (variante, grupo, export, meta).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  addComponentVariant,
  cryptoRandomId,
  findScreen,
  readBoard,
  resolveProjectBoardPath,
  screenToCss,
  screenToReact,
  scrubBoardRefs,
  syncAllComponentDefs,
  syncProjectMetaFromBoard,
  touchProject,
  writeBoard,
} from '../packages/core/src/index.js';

const PROJECT_ID = 'id_8aa2a1ba';
const boardPath = resolveProjectBoardPath(PROJECT_ID);
let board = readBoard(boardPath);

const welcome = findScreen(board, 'nat_welcome');
const about = findScreen(board, 'nat_about');
const contact = findScreen(board, 'nat_contact');
const comp = board.components?.[0];

if (!comp) throw new Error('Componente Button / Primary não encontrado');

// add_component_variant — Outline
const outlineRoot = {
  ...comp.variants[0].root,
  id: cryptoRandomId('button'),
  label: 'Agendar consulta',
  fill: '#FFFFFF',
  textColor: '#5C7C6F',
  stroke: '#5C7C6F',
  strokeWidth: 1.5,
};
board.components[0] = addComponentVariant(comp, outlineRoot, 'Outline');

// group_nodes — credenciais ficam para organize-natalia.mjs

// add_prototype_link — WhatsApp → Agendar
board.prototypes.push({
  id: cryptoRandomId('proto'),
  fromScreenId: 'nat_contact',
  triggerNodeId: 'c_wa',
  toScreenId: 'nat_book',
  transition: 'dissolve',
});

// resolve_comment — foto profissional (design aprovado placeholder)
board.comments = board.comments.map((c) =>
  c.text.includes('foto profissional')
    ? { ...c, resolved: true }
    : c,
);

// add_comment — nova nota de revisão
board.comments.push({
  id: cryptoRandomId('comment'),
  screenId: 'nat_services',
  x: 24,
  y: 120,
  text: 'Destacar TCC e abordagem humanista no card Terapia individual',
  resolved: false,
  createdAt: new Date().toISOString(),
});

board = syncAllComponentDefs(scrubBoardRefs(board));
writeBoard(board, boardPath);

touchProject(PROJECT_ID, {
  name: 'Natalia Farias — Psicologia',
  thumbColor: '#5C7C6F',
});

syncProjectMetaFromBoard(PROJECT_ID, board);

const outDir = path.resolve('exports/natalia-farias');
fs.mkdirSync(outDir, { recursive: true });

for (const screen of [welcome, findScreen(board, 'nat_home')]) {
  const slug = screen.name.replace(/[^\w]+/g, '-').toLowerCase();
  fs.writeFileSync(path.join(outDir, `${slug}.css`), screenToCss(screen), 'utf8');
  fs.writeFileSync(
    path.join(outDir, `${slug}.jsx`),
    screenToReact(screen),
    'utf8',
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      projectId: PROJECT_ID,
      components: board.components.length,
      variantCount: board.components[0]?.variants?.length,
      prototypes: board.prototypes.length,
      comments: board.comments.length,
      exports: outDir,
    },
    null,
    2,
  ),
);
