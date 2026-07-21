#!/usr/bin/env node
/**
 * Launcher estável para o Cursor MCP (cwd-independente).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.FIGMASHOW_DATA =
  process.env.FIGMASHOW_DATA || path.join(root, 'data');
// FIGMASHOW_BOARD opcional: se omitido, usa projeto ativo em data/active.json

await import(pathToFileURL(path.join(root, 'packages/mcp/src/server.js')).href);
