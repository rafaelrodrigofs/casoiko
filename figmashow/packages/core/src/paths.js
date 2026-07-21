import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @returns {string} */
export function resolveDataDir() {
  if (process.env.FIGMASHOW_DATA) {
    return path.resolve(process.env.FIGMASHOW_DATA);
  }
  return path.resolve(__dirname, '../../../data');
}

/** @returns {string} */
export function resolveLegacyBoardPath() {
  return path.join(resolveDataDir(), 'board.json');
}

/** @returns {string} */
export function resolveProjectIndexPath() {
  return path.join(resolveDataDir(), 'index.json');
}

/** @returns {string} */
export function resolveProjectsDir() {
  return path.join(resolveDataDir(), 'projects');
}

/** @returns {string} */
export function resolveActiveMetaPath() {
  return path.join(resolveDataDir(), 'active.json');
}

/** @param {string} projectId @returns {string} */
export function resolveProjectThumbPath(projectId) {
  return path.join(resolveDataDir(), 'thumbs', `${projectId}.png`);
}

/** @returns {string} */
export function resolveThumbsDir() {
  return path.join(resolveDataDir(), 'thumbs');
}

/** @param {string} projectId @returns {string} */
export function resolveProjectBoardPath(projectId) {
  return path.join(resolveProjectsDir(), `${projectId}.json`);
}

/**
 * Caminho padrão do board quando FIGMASHOW_BOARD não está definido.
 * @returns {string}
 */
export function resolveDefaultBoardPath() {
  const indexPath = resolveProjectIndexPath();
  if (fs.existsSync(indexPath)) {
    const activePath = resolveActiveMetaPath();
    let projectId = null;
    if (fs.existsSync(activePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(activePath, 'utf8'));
        projectId = raw?.projectId || null;
      } catch {
        /* ignore */
      }
    }
    if (!projectId) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const projects = (Array.isArray(index.projects) ? index.projects : [])
          .filter((p) => p && !p.trashed)
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() -
              new Date(a.updatedAt || 0).getTime(),
          );
        projectId = projects[0]?.id || null;
      } catch {
        /* ignore */
      }
    }
    if (projectId) {
      return resolveProjectBoardPath(projectId);
    }
  }
  return resolveLegacyBoardPath();
}
