/**
 * Smoke MCP Streamable HTTP: initialize + tools/list + tools/call(list_projects).
 * Uso: node scripts/smoke-mcp-http.mjs [baseUrl]
 * Local sem auth: MCP_ALLOW_INSECURE=1
 * Com auth: BASIC_AUTH_USER=… BASIC_AUTH_PASS=…
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

/**
 * @param {string} sessionId
 * @param {number} id
 * @param {string} method
 * @param {Record<string, unknown>} [params]
 */
async function mcpPost(sessionId, id, method, params = {}) {
  const res = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }),
  });
  if (!res.ok) {
    throw new Error(`${method} HTTP ${res.status}: ${await res.text()}`);
  }
  return { res, json: await readJsonRpc(res) };
}

async function main() {
  const initRes = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'figmashow-smoke', version: '1.0.0' },
      },
    }),
  });

  if (initRes.status === 401) {
    throw new Error(
      '401 Unauthorized — defina BASIC_AUTH_USER/PASS (obrigatório para /mcp)',
    );
  }
  if (initRes.status === 503) {
    throw new Error(
      `503: ${await initRes.text()} — defina BASIC_AUTH_* ou MCP_ALLOW_INSECURE=1`,
    );
  }
  if (!initRes.ok) {
    throw new Error(`initialize HTTP ${initRes.status}: ${await initRes.text()}`);
  }

  const sessionId = initRes.headers.get('mcp-session-id');
  const initJson = await readJsonRpc(initRes);
  if (initJson.error) {
    throw new Error(`initialize RPC error: ${JSON.stringify(initJson.error)}`);
  }

  const { json: listJson } = await mcpPost(sessionId, 2, 'tools/list', {});
  const tools = listJson?.result?.tools || [];
  const names = tools.map((t) => t.name);
  if (!names.includes('list_projects')) {
    throw new Error(
      `tools/list sem list_projects: ${names.slice(0, 10).join(',')}`,
    );
  }
  for (const required of [
    'batch_operations',
    'create_version',
    'restore_version',
    'delete_screen',
  ]) {
    if (!names.includes(required)) {
      throw new Error(`tools/list sem ${required}`);
    }
  }

  const { json: callJson } = await mcpPost(sessionId, 3, 'tools/call', {
    name: 'list_projects',
    arguments: {},
  });
  if (callJson.error) {
    throw new Error(`tools/call error: ${JSON.stringify(callJson.error)}`);
  }
  const callText = callJson?.result?.content?.[0]?.text || '';
  if (!callText || callJson?.result?.isError) {
    throw new Error(`tools/call list_projects falhou: ${callText.slice(0, 200)}`);
  }

  // Encerrar sessão
  if (sessionId) {
    await fetch(`${base}/mcp`, {
      method: 'DELETE',
      headers: {
        ...authHeaders(),
        'mcp-session-id': sessionId,
      },
    }).catch(() => {});
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base,
        sessionId,
        toolCount: names.length,
        toolsCall: 'list_projects',
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
