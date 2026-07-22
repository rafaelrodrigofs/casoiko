#!/usr/bin/env node
/**
 * Snapshot compactado de FIGMASHOW_DATA (ou ./data).
 * Uso: node scripts/backup-data.mjs [destino.tar]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = process.env.FIGMASHOW_DATA
  ? path.resolve(process.env.FIGMASHOW_DATA)
  : path.join(root, 'data');

if (!fs.existsSync(dataDir)) {
  console.error(`Data dir não existe: ${dataDir}`);
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out =
  process.argv[2] ||
  path.join(root, 'backups', `figmashow-data-${stamp}.tar`);

fs.mkdirSync(path.dirname(out), { recursive: true });

const result = spawnSync(
  'tar',
  ['-cf', out, '-C', dataDir, '.'],
  { encoding: 'utf8' },
);

if (result.status !== 0) {
  console.error(result.stderr || 'tar falhou');
  process.exit(result.status || 1);
}

console.log(JSON.stringify({ ok: true, archive: out, source: dataDir }));
