import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createBoardApiHandler } from '../web/api-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.FIGMASHOW_DATA
  ? path.resolve(process.env.FIGMASHOW_DATA)
  : '/data';
const BASIC_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_PASS = process.env.BASIC_AUTH_PASS || '';
const DIST_DIR = path.resolve(__dirname, '../web/dist');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function basicAuth(req, res, next) {
  const pathOnly = (req.url || '').split('?')[0] || '';
  if (pathOnly === '/api/health') {
    next();
    return;
  }

  if (!BASIC_USER || !BASIC_PASS) {
    next();
    return;
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="FigmaShow"');
    res.status(401).send('Authentication required');
    return;
  }

  let decoded = '';
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    res.setHeader('WWW-Authenticate', 'Basic realm="FigmaShow"');
    res.status(401).send('Invalid credentials');
    return;
  }

  const sep = decoded.indexOf(':');
  const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const pass = sep >= 0 ? decoded.slice(sep + 1) : '';

  if (user !== BASIC_USER || pass !== BASIC_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="FigmaShow"');
    res.status(401).send('Invalid credentials');
    return;
  }

  next();
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'figmashow' });
});
app.use(basicAuth);
app.use(createBoardApiHandler(DATA_DIR));

if (!fs.existsSync(DIST_DIR)) {
  console.error(
    `[figmashow] dist não encontrado em ${DIST_DIR}. Rode: npm run build -w @figmashow/web`,
  );
} else {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.error(`[figmashow] listening on :${PORT}`);
  console.error(`[figmashow] data: ${DATA_DIR}`);
  if (!BASIC_USER || !BASIC_PASS) {
    console.error(
      '[figmashow] AVISO: BASIC_AUTH_USER/BASIC_AUTH_PASS não definidos — app pública',
    );
  } else {
    console.error('[figmashow] Basic Auth ativo');
  }
});

function shutdown(signal) {
  console.error(`[figmashow] ${signal} — encerrando…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
