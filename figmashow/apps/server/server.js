import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createBoardApiHandler } from '../web/api-handler.js';
import { boardEvents, gcOrphanTempFiles } from '@figmashow/core';
import { mountMcpHttp } from '@figmashow/mcp/http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8080;
const DATA_DIR = process.env.FIGMASHOW_DATA
  ? path.resolve(process.env.FIGMASHOW_DATA)
  : '/data';
const BASIC_USER = process.env.BASIC_AUTH_USER || '';
const BASIC_PASS = process.env.BASIC_AUTH_PASS || '';
const DIST_DIR = path.resolve(__dirname, '../web/dist');

const PKG = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'),
);
const VERSION = PKG.version || '1.0.1';
const COMMIT =
  process.env.SOURCE_COMMIT ||
  process.env.COOLIFY_CONTAINER_NAME ||
  process.env.GIT_COMMIT ||
  '';

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
process.env.FIGMASHOW_DATA = DATA_DIR;
// MCP in-process deve usar disco local — não FIGMASHOW_API_URL (loop).
delete process.env.FIGMASHOW_API_URL;
const gcCount = gcOrphanTempFiles(DATA_DIR, { maxAgeMs: 60_000 });

const app = express();
app.disable('x-powered-by');
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'figmashow',
    version: VERSION,
    commit: COMMIT || null,
    mcp: '/mcp',
  });
});
app.use(basicAuth);

app.get('/api/projects/:projectId/events', (req, res) => {
  const projectId = req.params.projectId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ projectId })}\n\n`);

  const onBoard = (payload) => {
    if (payload?.projectId && payload.projectId !== projectId) return;
    res.write(
      `event: board\ndata: ${JSON.stringify({
        projectId,
        revision: payload.revision,
        reason: payload.reason || null,
      })}\n\n`,
    );
  };
  boardEvents.on(`board:${projectId}`, onBoard);
  boardEvents.on('board', onBoard);

  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    boardEvents.off(`board:${projectId}`, onBoard);
    boardEvents.off('board', onBoard);
  });
});

// Streamable HTTP MCP (Claude.ai) — json só em /mcp, antes do api-handler raw.
mountMcpHttp(app, {
  jsonParser: express.json({ limit: '4mb' }),
});

app.use(createBoardApiHandler(DATA_DIR));

const assetsDir = path.join(DATA_DIR, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
app.use('/assets', express.static(assetsDir, { maxAge: '1d', index: false }));

if (!fs.existsSync(DIST_DIR)) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      msg: 'dist_missing',
      path: DIST_DIR,
    }),
  );
} else {
  app.use(express.static(DIST_DIR, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api') || req.path === '/mcp') {
      next();
      return;
    }
    res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

const server = app.listen(PORT, '0.0.0.0', () => {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      msg: 'startup',
      port: PORT,
      data: DATA_DIR,
      version: VERSION,
      gcTmp: gcCount,
      basicAuth: Boolean(BASIC_USER && BASIC_PASS),
      mcpHttp: '/mcp',
    }),
  );
});

function shutdown(signal) {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      msg: 'shutdown',
      signal,
    }),
  );
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
