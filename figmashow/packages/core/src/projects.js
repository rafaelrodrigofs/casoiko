import fs from 'node:fs';
import {
  createScreen,
  cryptoRandomId,
  emptyBoard,
  normalizeBoard,
} from './schema.js';
import { writeBoard } from './board.js';
import {
  resolveActiveMetaPath,
  resolveDataDir,
  resolveLegacyBoardPath,
  resolveProjectBoardPath,
  resolveProjectIndexPath,
  resolveProjectsDir,
} from './paths.js';

/**
 * @typedef {Object} ProjectMeta
 * @property {string} id
 * @property {string} name
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} [trashed]
 * @property {string|null} [thumbColor]
 */

/**
 * @typedef {Object} ProjectIndex
 * @property {number} version
 * @property {ProjectMeta[]} projects
 */

/** @returns {ProjectIndex} */
export function emptyProjectIndex() {
  return { version: 1, projects: [] };
}

/** @param {unknown} data @returns {ProjectIndex} */
export function normalizeProjectIndex(data) {
  if (!data || typeof data !== 'object') return emptyProjectIndex();
  const raw = /** @type {Record<string, unknown>} */ (data);
  const projects = Array.isArray(raw.projects) ? raw.projects : [];
  return {
    version: 1,
    projects: projects
      .map((entry) => {
        const p = /** @type {Record<string, unknown>} */ (entry);
        const id = String(p.id || '').trim();
        if (!id) return null;
        const createdAt =
          typeof p.createdAt === 'string'
            ? p.createdAt
            : new Date().toISOString();
        return {
          id,
          name: String(p.name || 'Untitled').trim() || 'Untitled',
          createdAt,
          updatedAt:
            typeof p.updatedAt === 'string' ? p.updatedAt : createdAt,
          trashed: Boolean(p.trashed),
          thumbColor:
            typeof p.thumbColor === 'string' ? p.thumbColor : null,
        };
      })
      .filter(Boolean),
  };
}

/** @returns {ProjectIndex} */
export function readProjectIndex() {
  migrateLegacyBoardIfNeeded();
  const indexPath = resolveProjectIndexPath();
  if (!fs.existsSync(indexPath)) {
    return writeProjectIndex(emptyProjectIndex());
  }
  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  return normalizeProjectIndex(raw);
}

/** @param {ProjectIndex} index @returns {ProjectIndex} */
export function writeProjectIndex(index) {
  const next = normalizeProjectIndex(index);
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  fs.writeFileSync(
    resolveProjectIndexPath(),
    JSON.stringify(next, null, 2) + '\n',
    'utf8',
  );
  return next;
}

/** @returns {boolean} */
export function migrateLegacyBoardIfNeeded() {
  const indexPath = resolveProjectIndexPath();
  if (fs.existsSync(indexPath)) return false;

  const legacyPath = resolveLegacyBoardPath();
  fs.mkdirSync(resolveProjectsDir(), { recursive: true });

  /** @type {import('./schema.js').Board} */
  let board = emptyBoard();
  let defaultName = 'Untitled';

  if (fs.existsSync(legacyPath)) {
    board = normalizeBoard(
      JSON.parse(fs.readFileSync(legacyPath, 'utf8')),
    );
    const firstScreen = board.screens?.[0];
    if (firstScreen?.name) {
      defaultName =
        String(firstScreen.name)
          .replace(/^\d+\s*[—–-]\s*/, '')
          .trim() || 'Casoiko - App UI';
    } else {
      defaultName = 'Casoiko - App UI';
    }
  }

  const id = cryptoRandomId();
  const now = new Date().toISOString();
  writeBoard(board, resolveProjectBoardPath(id));

  const thumbColor = board.screens?.[0]?.background || '#1E293B';

  writeProjectIndex({
    version: 1,
    projects: [
      {
        id,
        name: defaultName,
        createdAt: now,
        updatedAt: now,
        trashed: false,
        thumbColor,
      },
    ],
  });

  fs.writeFileSync(
    resolveActiveMetaPath(),
    JSON.stringify({ projectId: id }, null, 2) + '\n',
    'utf8',
  );

  if (fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, `${legacyPath}.bak`);
  }

  return true;
}

/** @returns {string|null} */
export function readActiveProjectId() {
  migrateLegacyBoardIfNeeded();
  const activePath = resolveActiveMetaPath();
  if (fs.existsSync(activePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(activePath, 'utf8'));
      if (raw?.projectId) return String(raw.projectId);
    } catch {
      /* ignore */
    }
  }
  const recent = listProjects({ trashed: false });
  return recent[0]?.id || null;
}

/** @param {string} projectId */
export function setActiveProjectId(projectId) {
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  fs.writeFileSync(
    resolveActiveMetaPath(),
    JSON.stringify({ projectId }, null, 2) + '\n',
    'utf8',
  );
}

/**
 * @param {{ trashed?: boolean }} [opts]
 * @returns {ProjectMeta[]}
 */
export function listProjects(opts = {}) {
  const trashed = Boolean(opts.trashed);
  const index = readProjectIndex();
  return index.projects
    .filter((p) => Boolean(p.trashed) === trashed)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

/** @param {string} projectId @returns {ProjectMeta|null} */
export function getProjectMeta(projectId) {
  const index = readProjectIndex();
  return index.projects.find((p) => p.id === projectId) || null;
}

/**
 * @param {string} [name]
 * @returns {ProjectMeta}
 */
export function createProject(name = 'Untitled') {
  migrateLegacyBoardIfNeeded();
  const id = cryptoRandomId();
  const now = new Date().toISOString();
  let board = emptyBoard();
  const screen = createScreen({ name: '01 — Frame', board });
  board = { ...board, screens: [screen] };
  writeBoard(board, resolveProjectBoardPath(id));

  const meta = {
    id,
    name: String(name || 'Untitled').trim() || 'Untitled',
    createdAt: now,
    updatedAt: now,
    trashed: false,
    thumbColor: screen.background || '#FFFFFF',
  };

  const index = readProjectIndex();
  index.projects.unshift(meta);
  writeProjectIndex(index);
  setActiveProjectId(id);
  return meta;
}

/**
 * @param {string} projectId
 * @param {Partial<ProjectMeta>} patch
 * @returns {ProjectMeta|null}
 */
export function touchProject(projectId, patch = {}) {
  const index = readProjectIndex();
  const i = index.projects.findIndex((p) => p.id === projectId);
  if (i < 0) return null;
  const now = new Date().toISOString();
  const next = {
    ...index.projects[i],
    ...patch,
    updatedAt: now,
  };
  index.projects.splice(i, 1);
  index.projects.unshift(next);
  writeProjectIndex(index);
  return next;
}

/** @param {string} projectId @returns {ProjectMeta|null} */
export function trashProject(projectId) {
  return touchProject(projectId, { trashed: true });
}

/** @param {string} projectId @returns {ProjectMeta|null} */
export function restoreProject(projectId) {
  return touchProject(projectId, { trashed: false });
}

/** @param {string} projectId */
export function deleteProjectPermanent(projectId) {
  const index = readProjectIndex();
  index.projects = index.projects.filter((p) => p.id !== projectId);
  writeProjectIndex(index);
  const boardPath = resolveProjectBoardPath(projectId);
  if (fs.existsSync(boardPath)) fs.unlinkSync(boardPath);
}

/** @param {string} projectId @param {string} name */
export function renameProject(projectId, name) {
  return touchProject(projectId, {
    name: String(name || 'Untitled').trim() || 'Untitled',
  });
}

/**
 * @param {string} projectId
 * @param {import('./schema.js').Board} board
 */
export function syncProjectMetaFromBoard(projectId, board) {
  const first = board.screens?.[0];
  /** @type {Partial<ProjectMeta>} */
  const patch = {
    thumbColor: first?.background || null,
  };
  const meta = getProjectMeta(projectId);
  if (meta && (meta.name === 'Untitled' || !meta.name) && first?.name) {
    const derived = String(first.name)
      .replace(/^\d+\s*[—–-]\s*/, '')
      .trim();
    if (derived) patch.name = derived;
  }
  touchProject(projectId, patch);
}
