import fs from 'node:fs';
import path from 'node:path';

/**
 * Grava um arquivo de forma atômica (temp + rename).
 * @param {string} filePath
 * @param {string | Buffer} content
 * @param {{ encoding?: BufferEncoding | null }} [opts]
 */
export function writeFileAtomic(filePath, content, opts = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  if (Buffer.isBuffer(content)) {
    fs.writeFileSync(tmp, content);
  } else {
    fs.writeFileSync(tmp, content, opts.encoding || 'utf8');
  }
  fs.renameSync(tmp, filePath);
}

/**
 * Remove arquivos `*.tmp` órfãos sob um diretório (recursivo).
 * @param {string} rootDir
 * @param {{ maxAgeMs?: number }} [opts]
 * @returns {number} quantidade removida
 */
export function gcOrphanTempFiles(rootDir, opts = {}) {
  const maxAgeMs = opts.maxAgeMs ?? 60_000;
  const now = Date.now();
  let removed = 0;
  if (!fs.existsSync(rootDir)) return 0;

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.name.endsWith('.tmp')) continue;
      try {
        const st = fs.statSync(full);
        if (now - st.mtimeMs >= maxAgeMs) {
          fs.unlinkSync(full);
          removed += 1;
        }
      } catch {
        /* ignore */
      }
    }
  }

  walk(rootDir);
  return removed;
}
