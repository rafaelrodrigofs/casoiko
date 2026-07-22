import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(os.tmpdir(), 'figmashow-e2e-data');
fs.mkdirSync(dataDir, { recursive: true });

const port = process.env.PORT || '18080';
const child = spawn(process.execPath, ['apps/server/server.js'], {
  cwd: root,
  env: {
    ...process.env,
    FIGMASHOW_DATA: dataDir,
    PORT: String(port),
    // E2E sem auth (não herdar BASIC_AUTH_* do shell do usuário)
    BASIC_AUTH_USER: '',
    BASIC_AUTH_PASS: '',
  },
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 1));
