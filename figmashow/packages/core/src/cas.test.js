import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  emptyBoard,
  gcOrphanTempFiles,
  writeBoard,
  writeBoardIfRevision,
  writeFileAtomic,
} from './index.js';

test('writeBoardIfRevision exige expected quando requireExpected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-cas-'));
  const boardPath = path.join(dir, 'b.json');
  writeBoard(emptyBoard(), boardPath);
  const miss = writeBoardIfRevision(emptyBoard(), boardPath, null, {
    requireExpected: true,
  });
  assert.equal(miss.missingExpected, true);
});

test('CAS: segundo writer perde', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-cas2-'));
  const boardPath = path.join(dir, 'b.json');
  const a = writeBoard(emptyBoard(), boardPath);
  const r1 = writeBoardIfRevision(
    { ...a, screens: [] },
    boardPath,
    a.revision,
  );
  assert.equal(r1.ok, true);
  const r2 = writeBoardIfRevision(
    { ...a, screens: [] },
    boardPath,
    a.revision,
  );
  assert.equal(r2.ok, false);
  assert.equal(r2.conflict, true);
});

test('gcOrphanTempFiles remove tmp antigos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-gc-'));
  const tmp = path.join(dir, 'x.json.1.1.tmp');
  fs.writeFileSync(tmp, 'x');
  const old = Date.now() - 120_000;
  fs.utimesSync(tmp, new Date(old), new Date(old));
  const n = gcOrphanTempFiles(dir, { maxAgeMs: 60_000 });
  assert.equal(n, 1);
  assert.equal(fs.existsSync(tmp), false);
});

test('writeFileAtomic binary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-bin-'));
  const p = path.join(dir, 't.png');
  writeFileAtomic(p, Buffer.from([1, 2, 3, 4]));
  assert.deepEqual(fs.readFileSync(p), Buffer.from([1, 2, 3, 4]));
});
