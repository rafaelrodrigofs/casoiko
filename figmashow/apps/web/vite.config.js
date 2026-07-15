import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findScreen,
  moveNodeBy,
  normalizeBoard,
  readBoard,
  resolveBoardPath,
  updateBoard,
  writeBoard,
} from '@figmashow/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath =
  process.env.FIGMASHOW_BOARD ||
  path.resolve(__dirname, '../../data/board.json');

process.env.FIGMASHOW_BOARD = boardPath;

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<any>}
 */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/** Token de sync: max(revision do JSON, mtime do arquivo). */
function readBoardWithSyncToken(filePath = resolveBoardPath()) {
  const board = readBoard(filePath);
  let mtime = Date.now();
  try {
    mtime = fs.statSync(filePath).mtimeMs;
  } catch {
    /* arquivo recém-criado */
  }
  const revision = Math.max(Number(board.revision) || 0, Math.floor(mtime));
  return { ...board, revision };
}

function boardApiPlugin() {
  return {
    name: 'figmashow-board-api',
    configureServer(server) {
      // Watch: o SO atualiza mtime; o poll lê no próximo GET
      try {
        fs.watch(boardPath, { persistent: false }, () => {});
      } catch {
        /* board ainda não existe */
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] || '';

        if (url === '/api/board' && req.method === 'GET') {
          try {
            const board = readBoardWithSyncToken(resolveBoardPath());
            sendJson(res, 200, board);
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        if (url === '/api/board' && req.method === 'PUT') {
          try {
            const body = await readJson(req);
            const board = normalizeBoard(body || {});
            board.revision =
              Number(body?.revision) || board.revision || 0;
            writeBoard(board, resolveBoardPath());
            const saved = readBoardWithSyncToken(resolveBoardPath());
            sendJson(res, 200, {
              ok: true,
              revision: saved.revision,
              board: saved,
            });
          } catch (err) {
            sendJson(res, 500, { error: String(err?.message || err) });
          }
          return;
        }

        if (url === '/api/board/move' && req.method === 'POST') {
          try {
            const body = await readJson(req);
            const { screenId, nodeId, dx, dy } = body || {};
            if (!screenId || !nodeId) {
              sendJson(res, 400, { error: 'screenId e nodeId são obrigatórios' });
              return;
            }
            const deltaX = Number(dx) || 0;
            const deltaY = Number(dy) || 0;
            let updatedNode = null;
            updateBoard((board) => {
              const screen = findScreen(board, screenId);
              if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
              const result = moveNodeBy(screen.nodes, nodeId, deltaX, deltaY);
              if (!result.updated) {
                throw new Error(`Nó não encontrado: ${nodeId}`);
              }
              screen.nodes = result.nodes;
              updatedNode = result.updated;
            }, resolveBoardPath());
            sendJson(res, 200, { ok: true, node: updatedNode });
          } catch (err) {
            sendJson(res, 500, { error: String(err?.message || err) });
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), boardApiPlugin()],
  server: {
    port: 5177,
    open: false,
  },
});
