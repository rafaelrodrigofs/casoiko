import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { describe, it, afterEach } from 'node:test';
import { createBoardApiHandler } from '../../../apps/web/api-handler.js';

/**
 * @param {string} url
 * @param {import('http').RequestOptions & { body?: unknown }} opts
 */
function request(baseUrl, url, opts = {}) {
  const parsed = new URL(url, baseUrl);
  const body = opts.body != null ? JSON.stringify(opts.body) : null;
  return new Promise((resolve, reject) => {
    const req = http.request(
      parsed,
      {
        method: opts.method || 'GET',
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          resolve({ status: res.statusCode || 0, json });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('createBoardApiHandler', () => {
  /** @type {import('http').Server|null} */
  let server = null;
  /** @type {string|null} */
  let baseUrl = null;
  /** @type {string|null} */
  let dataDir = null;

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    server = null;
    baseUrl = null;
    if (dataDir && fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
    dataDir = null;
  });

  async function startServer() {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'figmashow-api-'));
    const handler = createBoardApiHandler(dataDir);
    server = http.createServer((req, res) => {
      handler(req, res, () => {
        res.statusCode = 404;
        res.end('not found');
      });
    });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  it('PUT com expectedRevision incorreta retorna 409', async () => {
    await startServer();
    const created = await request(baseUrl, '/api/projects', {
      method: 'POST',
      body: { name: 'Teste CAS' },
    });
    assert.equal(created.status, 201);
    const projectId = created.json.project.id;

    const loaded = await request(
      baseUrl,
      `/api/projects/${encodeURIComponent(projectId)}`,
    );
    assert.equal(loaded.status, 200);
    const board = loaded.json.board;
    assert.equal(board.revision, 1);

    const conflict = await request(
      baseUrl,
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: 'PUT',
        body: { board, expectedRevision: 0 },
      },
    );
    assert.equal(conflict.status, 409);
    assert.equal(conflict.json.revision, 1);
    assert.ok(conflict.json.board);

    const ok = await request(
      baseUrl,
      `/api/projects/${encodeURIComponent(projectId)}`,
      {
        method: 'PUT',
        body: { board, expectedRevision: 1 },
      },
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.json.revision, 2);
  });
});
