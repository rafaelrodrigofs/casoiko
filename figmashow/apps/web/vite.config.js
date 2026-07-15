import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readBoard, resolveBoardPath } from '@figmashow/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const boardPath =
  process.env.FIGMASHOW_BOARD ||
  path.resolve(__dirname, '../../data/board.json');

process.env.FIGMASHOW_BOARD = boardPath;

function boardApiPlugin() {
  return {
    name: 'figmashow-board-api',
    configureServer(server) {
      server.middlewares.use('/api/board', (req, res, next) => {
        if (req.method !== 'GET') return next();
        try {
          const board = readBoard(resolveBoardPath());
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(board));
        } catch (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(err) }));
        }
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
