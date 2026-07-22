import fs from 'node:fs';
import path from 'node:path';
import {
  applyBoardOperations,
  createProject,
  deleteProjectPermanent,
  emitBoardChanged,
  boardEvents,
  findScreen,
  gcOrphanTempFiles,
  getProjectMeta,
  listProjects,
  migrateLegacyBoardIfNeeded,
  moveNodeBy,
  normalizeBoard,
  readBoard,
  readBoardRevision,
  readActiveProjectId,
  resolveAssetsDir,
  resolveBoardPath,
  resolveDataDir,
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
  writeFileAtomic,
} from '@figmashow/core';

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [extra]
 */
function log(level, message, extra = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...extra,
  });
  if (level === 'error') console.error(line);
  else console.error(line);
}

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

/** @param {string} url */
function matchProjectRoute(url) {
  const m =
    /^\/api\/projects\/([^/]+)(?:\/(activate|restore|trash|thumb|revision|operations|versions|events|assets))?$/.exec(
      url,
    );
  if (!m) return null;
  return { projectId: decodeURIComponent(m[1]), action: m[2] || null };
}

/**
 * Extrai payload de board de um snapshot (API nested ou legado flat).
 * @param {any} snap
 */
function versionBoardPayload(snap) {
  if (snap?.board && typeof snap.board === 'object') return snap.board;
  return {
    screens: snap?.screens,
    components: snap?.components,
    prototypes: snap?.prototypes,
    comments: snap?.comments,
    tokens: snap?.tokens,
  };
}

/**
 * SSE: envia eventos de board para o cliente.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} projectId
 */
function handleProjectEvents(req, res, projectId) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ projectId })}\n\n`);

  const onBoard = (payload) => {
    const pid = payload?.projectId || projectId;
    if (pid !== projectId) return;
    res.write(
      `event: board\ndata: ${JSON.stringify({
        projectId,
        revision: payload.revision,
        reason: payload.reason || null,
      })}\n\n`,
    );
  };

  // Só escuta o canal específico — evita duplicar com o evento global `board`.
  boardEvents.on(`board:${projectId}`, onBoard);

  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25000);

  const cleanup = () => {
    clearInterval(heartbeat);
    boardEvents.off(`board:${projectId}`, onBoard);
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
}

/**
 * @param {string} filePath
 * @param {import('@figmashow/core').Board} board
 * @param {number|null|undefined} expectedRevision
 * @param {{ requireExpected?: boolean, allowMissingForEmpty?: boolean }} [opts]
 */
function saveBoardWithCas(filePath, board, expectedRevision, opts = {}) {
  const requireExpected = opts.requireExpected !== false;
  const exists = fs.existsSync(filePath);
  const currentRev = exists ? readBoardRevision(filePath) : 0;
  const isInitialEmpty =
    opts.allowMissingForEmpty &&
    !exists &&
    (expectedRevision === null ||
      expectedRevision === undefined ||
      Number(expectedRevision) === 0);

  if (requireExpected && !isInitialEmpty) {
    if (expectedRevision === null || expectedRevision === undefined) {
      return { ok: false, missingExpected: true };
    }
  }

  return writeBoardIfRevision(board, filePath, expectedRevision, {
    requireExpected: requireExpected && !isInitialEmpty,
  });
}

/**
 * Middleware Connect/Express-compatible para as rotas /api/* do FigmaShow.
 * @param {string} dataDir
 */
export function createBoardApiHandler(dataDir) {
  process.env.FIGMASHOW_DATA = dataDir;
  migrateLegacyBoardIfNeeded();
  const removed = gcOrphanTempFiles(resolveDataDir(), { maxAgeMs: 60_000 });
  if (removed > 0) {
    log('info', 'gc_tmp', { removed });
  }
  const maxBodyBytes =
    Number(process.env.MAX_BODY_BYTES) || DEFAULT_MAX_BODY_BYTES;

  return async function boardApiHandler(req, res, next) {
    const url = (req.url || '').split('?')[0] || '';

    if (url === '/api/projects' && req.method === 'GET') {
      try {
        const trashed = (req.url || '').includes('trashed=1');
        sendJson(res, 200, { projects: listProjects({ trashed }) });
      } catch (err) {
        log('error', 'list_projects', { error: String(err) });
        sendJson(res, 500, { error: String(err) });
      }
      return;
    }

    if (url === '/api/projects' && req.method === 'POST') {
      try {
        const body = await readJson(req, maxBodyBytes);
        const meta = createProject(body?.name || 'Untitled');
        log('info', 'create_project', { projectId: meta.id });
        sendJson(res, 201, { ok: true, project: meta });
      } catch (err) {
        const status = String(err?.message || '').includes('Body excede')
          ? 413
          : 500;
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

      if (action === 'revision' && req.method === 'GET') {
        const revision = readBoardRevision(boardPath);
        res.setHeader('ETag', `"${revision}"`);
        sendJson(res, 200, { projectId, revision });
        return;
      }

      if (action === 'events' && req.method === 'GET') {
        handleProjectEvents(req, res, projectId);
        return;
      }

      if (action === 'assets' && req.method === 'GET') {
        const assetsDir = resolveAssetsDir();
        fs.mkdirSync(assetsDir, { recursive: true });
        const files = fs
          .readdirSync(assetsDir)
          .filter((f) => !f.startsWith('.') && f !== 'README.md')
          .map((name) => ({
            name,
            url: `/assets/${encodeURIComponent(name)}`,
          }));
        sendJson(res, 200, { assets: files });
        return;
      }

      if (action === 'assets' && req.method === 'POST') {
        try {
          const body = await readJson(req, maxBodyBytes);
          const dataUrl = String(body?.dataUrl || '');
          const match =
            /^data:(image\/(?:png|jpeg|jpg|gif|webp|svg\+xml));base64,(.+)$/s.exec(
              dataUrl,
            );
          if (!match) {
            sendJson(res, 400, {
              error: 'dataUrl de imagem (base64) inválido',
            });
            return;
          }
          const mime = match[1];
          const extMap = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
          };
          const ext = extMap[mime] || 'bin';
          const safeBase = String(body?.name || `asset_${Date.now()}`)
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\.[^.]+$/, '')
            .slice(0, 64);
          const fileName = `${safeBase || 'asset'}.${ext}`;
          const assetsDir = resolveAssetsDir();
          fs.mkdirSync(assetsDir, { recursive: true });
          const filePath = path.join(assetsDir, fileName);
          writeFileAtomic(filePath, Buffer.from(match[2], 'base64'));
          sendJson(res, 201, {
            ok: true,
            name: fileName,
            url: `/assets/${encodeURIComponent(fileName)}`,
          });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede')
            ? 413
            : 500;
          sendJson(res, status, { error: String(err?.message || err) });
        }
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
          writeFileAtomic(
            resolveProjectThumbPath(projectId),
            Buffer.from(match[1], 'base64'),
          );
          sendJson(res, 200, { ok: true });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede')
            ? 413
            : 500;
          sendJson(res, status, { error: String(err?.message || err) });
        }
        return;
      }

      if (action === 'operations' && req.method === 'POST') {
        try {
          const body = await readJson(req, maxBodyBytes);
          const expectedRevision = body?.expectedRevision;
          if (expectedRevision === null || expectedRevision === undefined) {
            sendJson(res, 400, {
              error: 'expectedRevision é obrigatório',
            });
            return;
          }
          const board = readBoard(boardPath);
          const next = applyBoardOperations(board, body?.operations || []);
          const result = saveBoardWithCas(boardPath, next, expectedRevision);
          if (result.missingExpected) {
            sendJson(res, 400, { error: 'expectedRevision é obrigatório' });
            return;
          }
          if (!result.ok) {
            log('warn', 'conflict', {
              projectId,
              expected: expectedRevision,
              current: result.currentRevision,
            });
            sendJson(res, 409, {
              error: 'Conflito de revisão — recarregue e tente de novo',
              revision: result.currentRevision,
              board: result.board,
            });
            return;
          }
          syncProjectMetaFromBoard(projectId, result.board);
          setActiveProjectId(projectId);
          emitBoardChanged(projectId, {
            revision: result.board.revision,
            reason: 'operations',
          });
          log('info', 'operations', {
            projectId,
            count: (body?.operations || []).length,
            revision: result.board.revision,
          });
          sendJson(res, 200, {
            ok: true,
            revision: result.board.revision,
            board: result.board,
            project: getProjectMeta(projectId),
          });
        } catch (err) {
          const status = String(err?.message || '').includes('Body excede')
            ? 413
            : 400;
          sendJson(res, status, { error: String(err?.message || err) });
        }
        return;
      }

      if (action === 'versions' && req.method === 'GET') {
        const board = readBoard(boardPath);
        sendJson(res, 200, { versions: board.versions || [] });
        return;
      }

      if (action === 'versions' && req.method === 'POST') {
        try {
          const body = await readJson(req, maxBodyBytes);
          const expectedRevision = body?.expectedRevision;
          if (expectedRevision === null || expectedRevision === undefined) {
            sendJson(res, 400, { error: 'expectedRevision é obrigatório' });
            return;
          }
          const board = readBoard(boardPath);

          const restoreId = body?.restore;
          if (restoreId) {
            const snap = (board.versions || []).find((v) => v.id === restoreId);
            if (!snap) {
              sendJson(res, 404, { error: `Versão não encontrada: ${restoreId}` });
              return;
            }
            const payload = versionBoardPayload(snap);
            const next = {
              ...board,
              screens: Array.isArray(payload.screens)
                ? payload.screens
                : board.screens,
              components: Array.isArray(payload.components)
                ? payload.components
                : board.components,
              prototypes: Array.isArray(payload.prototypes)
                ? payload.prototypes
                : board.prototypes,
              comments: Array.isArray(payload.comments)
                ? payload.comments
                : board.comments,
              tokens:
                payload.tokens && typeof payload.tokens === 'object'
                  ? payload.tokens
                  : board.tokens,
            };
            const result = saveBoardWithCas(boardPath, next, expectedRevision);
            if (!result.ok) {
              sendJson(res, 409, {
                error: 'Conflito de revisão',
                revision: result.currentRevision,
                board: result.board,
              });
              return;
            }
            syncProjectMetaFromBoard(projectId, result.board);
            emitBoardChanged(projectId, {
              revision: result.board.revision,
              reason: 'restore_version',
            });
            sendJson(res, 200, {
              ok: true,
              restored: restoreId,
              revision: result.board.revision,
              board: result.board,
            });
            return;
          }

          const snap = {
            id: `ver_${Date.now().toString(36)}`,
            name: String(body?.name || `Snapshot ${new Date().toISOString()}`),
            createdAt: new Date().toISOString(),
            revision: board.revision,
            board: {
              screens: board.screens,
              components: board.components,
              prototypes: board.prototypes,
              comments: board.comments,
              tokens: board.tokens,
            },
          };
          const next = {
            ...board,
            versions: [...(board.versions || []), snap].slice(-30),
          };
          const result = saveBoardWithCas(boardPath, next, expectedRevision);
          if (!result.ok) {
            sendJson(res, 409, {
              error: 'Conflito de revisão',
              revision: result.currentRevision,
              board: result.board,
            });
            return;
          }
          emitBoardChanged(projectId, {
            revision: result.board.revision,
            reason: 'version',
          });
          sendJson(res, 201, {
            ok: true,
            version: snap,
            revision: result.board.revision,
            board: result.board,
          });
        } catch (err) {
          sendJson(res, 500, { error: String(err?.message || err) });
        }
        return;
      }

      if (!action && req.method === 'GET') {
        try {
          const board = readBoard(boardPath);
          res.setHeader('ETag', `"${board.revision}"`);
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
          const result = saveBoardWithCas(boardPath, board, expectedRevision, {
            requireExpected: true,
            allowMissingForEmpty: true,
          });
          if (result.missingExpected) {
            sendJson(res, 400, {
              error: 'expectedRevision é obrigatório no PUT',
            });
            return;
          }
          if (!result.ok) {
            log('warn', 'conflict', {
              projectId,
              expected: expectedRevision,
              current: result.currentRevision,
            });
            sendJson(res, 409, {
              error: 'Conflito de revisão — recarregue e tente de novo',
              revision: result.currentRevision,
              board: result.board,
            });
            return;
          }
          syncProjectMetaFromBoard(projectId, result.board);
          setActiveProjectId(projectId);
          emitBoardChanged(projectId, {
            revision: result.board.revision,
            reason: 'put',
          });
          log('info', 'save_board', {
            projectId,
            revision: result.board.revision,
          });
          sendJson(res, 200, {
            ok: true,
            revision: result.board.revision,
            board: result.board,
            project: getProjectMeta(projectId),
          });
        } catch (err) {
          log('error', 'save_board', { error: String(err?.message || err) });
          const status = String(err?.message || '').includes('Body excede')
            ? 413
            : 500;
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
          const status = String(err?.message || '').includes('Body excede')
            ? 413
            : 500;
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
        const board = readBoard(boardPath);
        sendJson(res, 200, {
          ...board,
          projectId: activeId,
          deprecated: true,
          hint: 'Use GET /api/projects/:id',
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
        const result = saveBoardWithCas(boardPath, board, expectedRevision, {
          requireExpected: true,
          allowMissingForEmpty: true,
        });
        if (result.missingExpected) {
          sendJson(res, 400, { error: 'expectedRevision é obrigatório' });
          return;
        }
        if (!result.ok) {
          sendJson(res, 409, {
            error: 'Conflito de revisão — recarregue e tente de novo',
            revision: result.currentRevision,
            board: result.board,
          });
          return;
        }
        const activeId = readActiveProjectId();
        if (activeId) {
          syncProjectMetaFromBoard(activeId, result.board);
          emitBoardChanged(activeId, {
            revision: result.board.revision,
            reason: 'put_legacy',
          });
        }
        sendJson(res, 200, {
          ok: true,
          revision: result.board.revision,
          board: result.board,
          deprecated: true,
        });
      } catch (err) {
        const status = String(err?.message || '').includes('Body excede')
          ? 413
          : 500;
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
        const status = String(err?.message || '').includes('Body excede')
          ? 413
          : 500;
        sendJson(res, status, { error: String(err?.message || err) });
      }
      return;
    }

    if (typeof next === 'function') next();
  };
}
