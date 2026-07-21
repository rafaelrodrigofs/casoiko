import fs from 'node:fs';
import path from 'node:path';
import {
  emptyBoard,
  normalizeBoard,
} from './schema.js';
import { resolveDefaultBoardPath } from './paths.js';
import { writeFileAtomic } from './atomic.js';

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
 * @param {string} boardPath
 * @returns {number}
 */
export function readBoardRevision(boardPath) {
  if (!fs.existsSync(boardPath)) return 0;
  try {
    const raw = fs.readFileSync(boardPath, 'utf8');
    const board = normalizeBoard(JSON.parse(raw));
    return Number(board.revision) || 0;
  } catch {
    return 0;
  }
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
  const currentRev = fs.existsSync(boardPath)
    ? readBoardRevision(boardPath)
    : 0;
  const next = {
    ...normalizeBoard(base),
    version: typeof base.version === 'number' ? base.version : 1,
    screens: Array.isArray(base.screens) ? base.screens : [],
    revision: currentRev + 1,
  };
  writeFileAtomic(boardPath, JSON.stringify(next, null, 2) + '\n');
  return next;
}

/**
 * Grava o board somente se a revisão atual coincidir (CAS otimista).
 * @param {import('./schema.js').Board} board
 * @param {string} boardPath
 * @param {number|null|undefined} expectedRevision
 * @returns {{ ok: true, board: import('./schema.js').Board } | { ok: false, conflict: true, currentRevision: number, board: import('./schema.js').Board }}
 */
export function writeBoardIfRevision(board, boardPath, expectedRevision) {
  const currentRev = readBoardRevision(boardPath);
  const hasExpected =
    expectedRevision !== undefined && expectedRevision !== null;

  if (hasExpected && Number(expectedRevision) !== currentRev) {
    return {
      ok: false,
      conflict: true,
      currentRevision: currentRev,
      board: fs.existsSync(boardPath)
        ? readBoard(boardPath)
        : emptyBoard(),
    };
  }

  const base =
    board && typeof board === 'object' ? board : emptyBoard();
  const next = {
    ...normalizeBoard(base),
    version: typeof base.version === 'number' ? base.version : 1,
    screens: Array.isArray(base.screens) ? base.screens : [],
    revision: currentRev + 1,
  };
  writeFileAtomic(boardPath, JSON.stringify(next, null, 2) + '\n');
  return { ok: true, board: next };
}

/**
 * @param {(board: import('./schema.js').Board) => import('./schema.js').Board | void} mutator
 * @param {string} [boardPath]
 */
export function updateBoard(mutator, boardPath = resolveBoardPath()) {
  const board = readBoard(boardPath);
  const expectedRevision = Number(board.revision) || 0;
  const next = mutator(board) || board;
  const result = writeBoardIfRevision(next, boardPath, expectedRevision);
  if (!result.ok) {
    const err = new Error(
      `Conflito de revisão (esperada ${expectedRevision}, atual ${result.currentRevision})`,
    );
    err.code = 'REVISION_CONFLICT';
    err.currentRevision = result.currentRevision;
    err.board = result.board;
    throw err;
  }
  return result.board;
}

/**
 * @param {import('./schema.js').Board} board
 * @param {string} screenId
 */
export function findScreen(board, screenId) {
  return board.screens.find((s) => s.id === screenId) || null;
}
