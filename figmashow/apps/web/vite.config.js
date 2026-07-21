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
