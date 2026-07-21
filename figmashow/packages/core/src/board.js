import fs from 'node:fs';
import path from 'node:path';
import {
  emptyBoard,
  normalizeBoard,
} from './schema.js';
import { resolveDefaultBoardPath } from './paths.js';

/**
 * @returns {string}
 */
export function resolveBoardPath() {
  if (process.env.FIGMASHOW_BOARD) {
    return path.resolve(process.env.FIGMASHOW_BOARD);
  }
  return resolveDefaultBoardPath();
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

