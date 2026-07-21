/**
 * Cliente HTTP do MCP para editar o FigmaShow remoto (VPS / Coolify).
 * Ativa quando FIGMASHOW_API_URL está definido.
 */

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
  const res = await fetch(url, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
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
    throw new Error(String(msg));
  }
  return data;
}

/** @returns {Promise<{ projects: any[], activeProjectId: string | null }>} */
export async function listProjectsRemote({ trashed = false } = {}) {
  const data = await apiFetch(`/api/projects?trashed=${trashed ? 1 : 0}`);
  const boardMeta = await apiFetch('/api/board').catch(() => null);
  return {
    projects: data?.projects || [],
    activeProjectId: boardMeta?.projectId ?? null,
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
 * Lê o board do projeto ativo (ou do projectId).
 * @param {string} [projectId]
 * @returns {Promise<{ board: any, projectId: string | null, project?: any }>}
 */
export async function getBoardRemote(projectId) {
  if (projectId) {
    const data = await getProjectRemote(projectId);
    return {
      board: data.board,
      projectId,
      project: data.project,
    };
  }
  const data = await apiFetch('/api/board');
  const { projectId: activeId, ...board } = data;
  return {
    board,
    projectId: activeId ?? null,
  };
}

/**
 * Grava o board no projeto ativo ou no projectId.
 * @param {any} board
 * @param {string | null} [projectId]
 */
export async function putBoardRemote(board, projectId = null) {
  if (projectId) {
    const data = await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      body: JSON.stringify({ board }),
    });
    return data.board || board;
  }
  const data = await apiFetch('/api/board', {
    method: 'PUT',
    body: JSON.stringify(board),
  });
  return data.board || board;
}
