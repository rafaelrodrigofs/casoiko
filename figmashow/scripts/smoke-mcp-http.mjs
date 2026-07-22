/**
 * Smoke MCP Streamable HTTP: initialize + tools/list.
 * Uso: node scripts/smoke-mcp-http.mjs [baseUrl]
 * Ex.: FIGMASHOW_DATA=./data PORT=18081 node apps/server/server.js &
 *      node scripts/smoke-mcp-http.mjs http://127.0.0.1:18081
 */
const base = (process.argv[2] || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const user = process.env.BASIC_AUTH_USER || '';
const pass = process.env.BASIC_AUTH_PASS || '';

/** @returns {Record<string, string>} */
function authHeaders() {
  /** @type {Record<string, string>} */
  const h = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  if (user && pass) {
    h.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }
  return h;
}

/**
 * @param {Response} res
 */
async function readJsonRpc(res) {
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    const last = dataLines[dataLines.length - 1];
    if (!last) throw new Error(`SSE sem data: ${text.slice(0, 200)}`);
    return JSON.parse(last);
  }
  return JSON.parse(text);
}

async function main() {
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'figmashow-smoke', version: '1.0.0' },
    },
  };

  const initRes = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(initBody),
  });

  if (initRes.status === 401) {
    throw new Error('401 Unauthorized — defina BASIC_AUTH_USER/PASS se a app exige auth');
  }
  if (!initRes.ok) {
    throw new Error(`initialize HTTP ${initRes.status}: ${await initRes.text()}`);
  }

  const sessionId = initRes.headers.get('mcp-session-id');
  const initJson = await readJsonRpc(initRes);
  if (initJson.error) {
    throw new Error(`initialize RPC error: ${JSON.stringify(initJson.error)}`);
  }

  const listRes = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }),
  });

  if (!listRes.ok) {
    throw new Error(`tools/list HTTP ${listRes.status}: ${await listRes.text()}`);
  }
  const listJson = await readJsonRpc(listRes);
  const tools = listJson?.result?.tools || [];
  const names = tools.map((t) => t.name);
  if (!names.includes('list_projects')) {
    throw new Error(`tools/list sem list_projects: ${names.slice(0, 10).join(',')}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base,
        sessionId,
        toolCount: names.length,
        sample: names.slice(0, 8),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
