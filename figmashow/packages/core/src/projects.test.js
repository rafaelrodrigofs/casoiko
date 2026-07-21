import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, afterEach } from 'node:test';
import {
  createProject,
  deleteProjectPermanent,
  readProjectIndex,
} from './projects.js';
import { resolveProjectBoardPath, resolveProjectThumbPath } from './paths.js';

describe('deleteProjectPermanent', () => {
  /** @type {string|null} */
  let dataDir = null;

  afterEach(() => {
    if (dataDir && fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    dataDir = null;
    delete process.env.FIGMASHOW_DATA;
  });

  it('remove board e thumbnail do projeto', () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figmashow-proj-'));
    process.env.FIGMASHOW_DATA = dataDir;
    const meta = createProject('Apagar');
    const boardPath = resolveProjectBoardPath(meta.id);
    const thumbPath = resolveProjectThumbPath(meta.id);
    fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
    fs.writeFileSync(thumbPath, Buffer.from('png'));
    assert.ok(fs.existsSync(boardPath));
    assert.ok(fs.existsSync(thumbPath));

    deleteProjectPermanent(meta.id);
    assert.equal(readProjectIndex().projects.some((p) => p.id === meta.id), false);
    assert.equal(fs.existsSync(boardPath), false);
    assert.equal(fs.existsSync(thumbPath), false);
  });
});
