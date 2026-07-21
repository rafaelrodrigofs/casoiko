/**
 * Cliente HTTP do MCP para editar o FigmaShow remoto (VPS / Coolify).
 * Ativa quando FIGMASHOW_API_URL está definido.
 */

const DEFAULT_TIMEOUT_MS = 30_000;

/** @returns {boolean} */
export function isRemoteMode() {
  return Boolean(process.env.FIGMASHOW_API_URL?.trim());
}

/** @returns {string} */
function apiBase() {
  const raw = (process.env.FIGMASHOW_API_URL || '').trim().replace(/\/+$/, '');
  if (!raw) throw new Error('FIGMASHOW_API_URL não definido');
  return raw;
}

/** @returns {number} */
function requestTimeoutMs() {
  const raw = Number(process.env.FIGMASHOW_API_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** @returns {Record<string, string>} */
function authHeaders() {
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' };
  const user = process.env.BASIC_AUTH_USER || '';
  const pass = process.env.BASIC_AUTH_PASS || '';
  if (user && pass) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  return headers;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function apiFetch(path, init = {}) {
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs());
  let res;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...authHeaders(),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Timeout após ${requestTimeoutMs()}ms em ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) ||
      `HTTP ${res.status} ${res.statusText}`;
    const err = new Error(String(msg));
    err.status = res.status;
    err.data = data;
    if (res.status === 409) err.code = 'REVISION_CONFLICT';
    throw err;
  }
  return data;
}

/** @returns {Promise<{ projects: any[], activeProjectId: string | null }>} */
export async function listProjectsRemote({ trashed = false } = {}) {
  const data = await apiFetch(`/api/projects?trashed=${trashed ? 1 : 0}`);
  return {
    projects: data?.projects || [],
    activeProjectId: null,
  };
}

/** @param {string} [name] */
export async function createProjectRemote(name = 'Untitled') {
  const data = await apiFetch('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.project;
}

/** @param {string} projectId */
export async function activateProjectRemote(projectId) {
  return apiFetch(`/api/projects/${encodeURIComponent(projectId)}/activate`, {
    method: 'POST',
    body: '{}',
  });
}

/**
 * @param {string} projectId
 * @returns {Promise<{ project: any, board: any }>}
 */
export async function getProjectRemote(projectId) {
  return apiFetch(`/api/projects/${encodeURIComponent(projectId)}`);
}

/**
 * Lê o board de um projeto (projectId obrigatório em modo remoto pinado).
 * @param {string} projectId
 * @returns {Promise<{ board: any, projectId: string, project?: any }>}
 */
export async function getBoardRemote(projectId) {
  if (!projectId) {
    throw new Error(
      'projectId obrigatório no modo remoto — use open_project primeiro',
    );
  }
  const data = await getProjectRemote(projectId);
  return {
    board: data.board,
    projectId,
    project: data.project,
  };
}

/**
 * Grava o board com CAS otimista (expectedRevision).
 * @param {any} board
 * @param {string} projectId
 * @param {number|null|undefined} [expectedRevision]
 */
export async function putBoardRemote(board, projectId, expectedRevision) {
  if (!projectId) {
    throw new Error(
      'projectId obrigatório no modo remoto — use open_project primeiro',
    );
  }
  const payload = {
    board,
    expectedRevision:
      expectedRevision ?? board?.revision ?? null,
  };
  const data = await apiFetch(
    `/api/projects/${encodeURIComponent(projectId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
  return data.board || board;
}
