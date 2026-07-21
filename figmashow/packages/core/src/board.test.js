import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, afterEach } from 'node:test';
import { writeFileAtomic } from './atomic.js';
import {
  readBoard,
  readBoardRevision,
  writeBoard,
  writeBoardIfRevision,
} from './board.js';
import { emptyBoard } from './schema.js';

describe('writeFileAtomic', () => {
  /** @type {string|null} */
  let tmpDir = null;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = null;
  });

  it('grava conteúdo completo sem arquivo parcial', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figmashow-atomic-'));
    const target = path.join(tmpDir, 'nested', 'file.json');
    writeFileAtomic(target, '{"ok":true}\n');
    assert.equal(fs.readFileSync(target, 'utf8'), '{"ok":true}\n');
  });
});

describe('writeBoardIfRevision (CAS)', () => {
  /** @type {string|null} */
  let tmpDir = null;
  /** @type {string|null} */
  let boardPath = null;

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = null;
    boardPath = null;
    delete process.env.FIGMASHOW_BOARD;
  });

  function setupBoard(initialRevision = 0) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figmashow-board-'));
    boardPath = path.join(tmpDir, 'board.json');
    process.env.FIGMASHOW_BOARD = boardPath;
    const board = { ...emptyBoard(), revision: initialRevision };
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(boardPath, JSON.stringify(board, null, 2) + '\n', 'utf8');
  }

  it('incrementa revision quando expectedRevision coincide', () => {
    setupBoard(3);
    const payload = readBoard(boardPath);
    const result = writeBoardIfRevision(payload, boardPath, 3);
    assert.equal(result.ok, true);
    assert.equal(result.board.revision, 4);
    assert.equal(readBoardRevision(boardPath), 4);
  });

  it('rejeita com conflito quando expectedRevision diverge', () => {
    setupBoard(5);
    const payload = readBoard(boardPath);
    const result = writeBoardIfRevision(payload, boardPath, 4);
    assert.equal(result.ok, false);
    assert.equal(result.conflict, true);
    assert.equal(result.currentRevision, 5);
    assert.equal(readBoardRevision(boardPath), 5);
  });

  it('writeBoard sempre incrementa a partir do disco', () => {
    setupBoard(2);
    const saved = writeBoard(readBoard(boardPath), boardPath);
    assert.equal(saved.revision, 3);
  });
});
