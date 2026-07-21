import fs from 'node:fs';
import {
  createProject,
  deleteProjectPermanent,
  findScreen,
  getProjectMeta,
  listProjects,
  migrateLegacyBoardIfNeeded,
  moveNodeBy,
  normalizeBoard,
  readBoard,
  readActiveProjectId,
  resolveBoardPath,
  resolveProjectBoardPath,
  resolveProjectThumbPath,
  resolveThumbsDir,
  restoreProject,
  setActiveProjectId,
  syncProjectMetaFromBoard,
  trashProject,
  touchProject,
  updateBoard,
  writeBoardIfRevision,
} from '@figmashow/core';

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * @param {import('http').IncomingMessage} req
 * @param {number} [maxBytes]
 * @returns {Promise<any>}
 */
function readJson(req, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error(`Body excede ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
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

/**
 * @param {import('http').ServerResponse} res
 * @param {number} status
 * @param {unknown} data
 */
function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

/**
 * @param {string} filePath
 * @returns {import('@figmashow/core').Board}
 */
function readBoardLogical(filePath) {
  return readBoard(filePath);
}

/**
 * @param {string} filePath
 * @param {import('@figmashow/core').Board} board
 * @param {number|null|undefined} expectedRevision
 */
function saveBoardWithCas(filePath, board, expectedRevision) {
  return writeBoardIfRevision(board, filePath, expectedRevision);
}

/** @param {string} url */
function matchProjectRoute(url) {
  const m = /^\/api\/projects\/([^/]+)(?:\/(activate|restore|trash|thumb))?$/.exec(
    url,
  );
  if (!m) return null;
  return { projectId: decodeURIComponent(m[1]), action: m[2] || null };
}

/**
 * Middleware Connect/Express-compatible para as rotas /api/* do FigmaShow.
 * @param {string} dataDir
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse, next: () => void) => Promise<void>}
 */
export function createBoardApiHandler(dataDir) {
  process.env.FIGMASHOW_DATA = dataDir;
  migrateLegacyBoardIfNeeded();
  const maxBodyBytes =
    Number(process.env.MAX_BODY_BYTES) || DEFAULT_MAX_BODY_BYTES;

  return async function boardApiHandler(req, res, next) {
    const url = (req.url || '').split('?')[0] || '';

    if (url === '/api/projects' && req.method === 'GET') {
      try {
        const trashed = (req.url || '').includes('trashed=1');
        sendJson(res, 200, { projects: listProjects({ trashed }) });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
      return;
    }

    if (url === '/api/projects' && req.method === 'POST') {
      try {
        const body = await readJson(req, maxBodyBytes);
        const meta = createProject(body?.name || 'Untitled');
        sendJson(res, 201, { ok: true, project: meta });
      } catch (err) {
        const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
        sendJson(res, status, { error: String(err?.message || err) });
      }
      return;
    }

    const projectRoute = matchProjectRoute(url);
    if (projectRoute) {
      const { projectId, action } = projectRoute;
      const meta = getProjectMeta(projectId);
      if (!meta) {
        sendJson(res, 404, { error: `Projeto não encontrado: ${projectId}` });
        return;
      }
      const boardPath = resolveProjectBoardPath(projectId);

      if (action === 'activate' && req.method === 'POST') {
        setActiveProjectId(projectId);
        sendJson(res, 200, { ok: true, projectId });
        return;
      }

      if (action === 'trash' && req.method === 'POST') {
        trashProject(projectId);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (action === 'restore' && req.method === 'POST') {
        restoreProject(projectId);
        sendJson(res, 200, { ok: true });
        return;
      }

      if (action === 'thumb' && req.method === 'GET') {
        const thumbPath = resolveProjectThumbPath(projectId);
        if (!fs.existsSync(thumbPath)) {
          sendJson(res, 404, { error: 'Sem miniatura' });
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(thumbPath).pipe(res);
        return;
      }

      if (action === 'thumb' && req.method === 'POST') {
        try {
          const body = await readJson(req, maxBodyBytes);
          const dataUrl = String(body?.dataUrl || '');
          const match = /^data:image\/png;base64,(.+)$/s.exec(dataUrl);
          if (!match) {
            sendJson(res, 400, { error: 'dataUrl PNG inválido' });
            return;
          }
          fs.mkdirSync(resolveThumbsDir(), { recursive: true });
          fs.writeFileSync(
            resolveProjectThumbPath(projectId),
            Buffer.from(match[1], 'base64'),
          );
          sendJson(res, 200, { ok: true });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
          sendJson(res, status, { error: String(err?.message || err) });
        }
        return;
      }

      if (!action && req.method === 'GET') {
        try {
          const board = readBoardLogical(boardPath);
          sendJson(res, 200, { project: meta, board });
        } catch (err) {
          sendJson(res, 500, { error: String(err) });
        }
        return;
      }

      if (!action && req.method === 'PUT') {
        try {
          const body = await readJson(req, maxBodyBytes);
          const board = normalizeBoard(body?.board || body || {});
          const expectedRevision =
            body?.expectedRevision ?? body?.board?.revision ?? null;
          const result = saveBoardWithCas(
            boardPath,
            board,
            expectedRevision,
          );
          if (!result.ok) {
            sendJson(res, 409, {
              error: 'Conflito de revisão — recarregue e tente de novo',
              revision: result.currentRevision,
              board: result.board,
            });
            return;
          }
          syncProjectMetaFromBoard(projectId, result.board);
          setActiveProjectId(projectId);
          const project = getProjectMeta(projectId);
          sendJson(res, 200, {
            ok: true,
            revision: result.board.revision,
            board: result.board,
            project,
          });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
          sendJson(res, status, { error: String(err?.message || err) });
        }
        return;
      }

      if (!action && req.method === 'PATCH') {
        try {
          const body = await readJson(req, maxBodyBytes);
          if (body?.name) touchProject(projectId, { name: body.name });
          sendJson(res, 200, {
            ok: true,
            project: getProjectMeta(projectId),
          });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
          sendJson(res, status, { error: String(err?.message || err) });
        }
        return;
      }

      if (!action && req.method === 'DELETE') {
        try {
          deleteProjectPermanent(projectId);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          sendJson(res, 500, { error: String(err?.message || err) });
        }
        return;
      }
    }

    if (url === '/api/board' && req.method === 'GET') {
      try {
        const activeId = readActiveProjectId();
        const boardPath = resolveBoardPath();
        const board = readBoardLogical(boardPath);
        sendJson(res, 200, {
          ...board,
          projectId: activeId,
        });
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
      return;
    }

    if (url === '/api/board' && req.method === 'PUT') {
      try {
        const body = await readJson(req, maxBodyBytes);
        const board = normalizeBoard(body?.board || body || {});
        const expectedRevision =
          body?.expectedRevision ?? body?.revision ?? null;
        const boardPath = resolveBoardPath();
        const result = saveBoardWithCas(boardPath, board, expectedRevision);
        if (!result.ok) {
          sendJson(res, 409, {
            error: 'Conflito de revisão — recarregue e tente de novo',
            revision: result.currentRevision,
            board: result.board,
          });
          return;
        }
        const activeId = readActiveProjectId();
        if (activeId) syncProjectMetaFromBoard(activeId, result.board);
        sendJson(res, 200, {
          ok: true,
          revision: result.board.revision,
          board: result.board,
        });
      } catch (err) {
        const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
        sendJson(res, status, { error: String(err?.message || err) });
      }
      return;
    }

    if (url === '/api/board/move' && req.method === 'POST') {
      try {
        const body = await readJson(req, maxBodyBytes);
        const { screenId, nodeId, dx, dy } = body || {};
        if (!screenId || !nodeId) {
          sendJson(res, 400, {
            error: 'screenId e nodeId são obrigatórios',
          });
          return;
        }
        const deltaX = Number(dx) || 0;
        const deltaY = Number(dy) || 0;
        let updatedNode = null;
        const boardPath = resolveBoardPath();
        updateBoard((board) => {
          const screen = findScreen(board, screenId);
          if (!screen) throw new Error(`Tela não encontrada: ${screenId}`);
          const result = moveNodeBy(screen.nodes, nodeId, deltaX, deltaY);
          if (!result.updated) {
            throw new Error(`Nó não encontrado: ${nodeId}`);
          }
          screen.nodes = result.nodes;
          updatedNode = result.updated;
        }, boardPath);
        sendJson(res, 200, { ok: true, node: updatedNode });
      } catch (err) {
        if (err?.code === 'REVISION_CONFLICT') {
          sendJson(res, 409, {
            error: String(err.message),
            revision: err.currentRevision,
            board: err.board,
          });
          return;
        }
        const status = String(err?.message || '').includes('Body excede') ? 413 : 500;
        sendJson(res, status, { error: String(err?.message || err) });
      }
      return;
    }

    if (typeof next === 'function') next();
  };
}
