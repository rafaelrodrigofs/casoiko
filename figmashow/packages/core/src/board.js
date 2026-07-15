import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PHONE,
  cryptoRandomId,
  emptyBoard,
  normalizeBoard,
} from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @returns {string}
 */
export function resolveBoardPath() {
  if (process.env.FIGMASHOW_BOARD) {
    return path.resolve(process.env.FIGMASHOW_BOARD);
  }
  // figmashow/packages/core/src -> figmashow/data/board.json
  return path.resolve(__dirname, '../../../data/board.json');
}

/**
 * @param {string} [boardPath]
 * @returns {import('./schema.js').Board}
 */
export function readBoard(boardPath = resolveBoardPath()) {
  if (!fs.existsSync(boardPath)) {
    return writeBoard(emptyBoard(), boardPath);
  }
  const raw = fs.readFileSync(boardPath, 'utf8');
  return normalizeBoard(JSON.parse(raw));
}

/**
 * @param {import('./schema.js').Board} board
 * @param {string} [boardPath]
 * @returns {import('./schema.js').Board}
 */
export function writeBoard(board, boardPath = resolveBoardPath()) {
  const base =
    board && typeof board === 'object' ? board : emptyBoard();
  const next = {
    ...base,
    version: typeof base.version === 'number' ? base.version : 1,
    screens: Array.isArray(base.screens) ? base.screens : [],
    revision: (Number(base.revision) || 0) + 1,
  };
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(boardPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/**
 * @param {(board: import('./schema.js').Board) => import('./schema.js').Board | void} mutator
 * @param {string} [boardPath]
 */
export function updateBoard(mutator, boardPath = resolveBoardPath()) {
  const board = readBoard(boardPath);
  const next = mutator(board) || board;
  return writeBoard(next, boardPath);
}

/**
 * @param {import('./schema.js').Board} board
 * @param {string} screenId
 */
export function findScreen(board, screenId) {
  return board.screens.find((s) => s.id === screenId) || null;
}

/**
 * @param {object} opts
 * @param {string} [opts.id]
 * @param {string} [opts.name]
 * @param {number} [opts.width]
 * @param {number} [opts.height]
 * @param {string} [opts.background]
 * @param {number} [opts.x]
 * @param {number} [opts.y]
 * @param {import('./schema.js').Board} [opts.board] board atual para auto-posição
 */
export function createScreen(opts = {}) {
  const width = opts.width || DEFAULT_PHONE.width;
  const height = opts.height || DEFAULT_PHONE.height;
  let x = opts.x;
  let y = opts.y;
  if (x === undefined || y === undefined) {
    const screens = opts.board?.screens || [];
    x =
      x ??
      screens.reduce(
        (acc, s) => Math.max(acc, (Number.isFinite(s.x) ? s.x : 0) + s.width + 80),
        0,
      );
    y = y ?? 0;
  }
  return {
    id: opts.id || cryptoRandomId('screen'),
    name: opts.name || 'Nova tela',
    width,
    height,
    background: opts.background || '#FFFFFF',
    x,
    y,
    nodes: [],
  };
}
