import fs from 'node:fs';
import path from 'node:path';

/**
 * Grava um arquivo de forma atômica (temp + rename).
 * @param {string} filePath
 * @param {string} content
 */
export function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}
