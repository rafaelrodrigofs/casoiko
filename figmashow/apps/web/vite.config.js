import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBoardApiHandler } from './api-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');

function boardApiPlugin() {
  return {
    name: 'figmashow-board-api',
    configureServer(server) {
      try {
        fs.watch(dataDir, { persistent: false }, () => {});
      } catch {
        /* data ainda não existe */
      }

      const assetsDir = path.join(dataDir, 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });
      server.middlewares.use('/assets', (req, res, next) => {
        const urlPath = decodeURIComponent((req.url || '').split('?')[0] || '');
        const filePath = path.normalize(path.join(assetsDir, urlPath));
        if (!filePath.startsWith(assetsDir)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.readFile(filePath, (err, buf) => {
          if (err) {
            next();
            return;
          }
          const ext = path.extname(filePath).toLowerCase();
          const types = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
          };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          res.end(buf);
        });
      });

      server.middlewares.use(createBoardApiHandler(dataDir));
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
