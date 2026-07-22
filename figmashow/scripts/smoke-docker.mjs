#!/usr/bin/env node
/**
 * Smoke mínimo pós-build (sem Docker obrigatório).
 * Sobe o server em porta efêmera, checa health + projects + SPA.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'apps/web/dist');

if (!fs.existsSync(dist)) {
  console.error('Rode npm run build antes do smoke');
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-smoke-'));
const port = 18181 + Math.floor(Math.random() * 200);
const child = spawn(process.execPath, ['apps/server/server.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    FIGMASHOW_DATA: dataDir,
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return res.json();
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('health timeout');
}

try {
  const health = await waitHealth();
  if (!health.ok || !health.version) throw new Error('health inválido');
  const projects = await fetch(`http://127.0.0.1:${port}/api/projects`).then(
    (r) => r.json(),
  );
  if (!Array.isArray(projects.projects)) throw new Error('projects inválido');
  const spa = await fetch(`http://127.0.0.1:${port}/`);
  if (!spa.ok) throw new Error('SPA falhou');
  console.log(JSON.stringify({ ok: true, version: health.version, port }));
  process.exitCode = 0;
} catch (err) {
  console.error(String(err?.message || err));
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
}
