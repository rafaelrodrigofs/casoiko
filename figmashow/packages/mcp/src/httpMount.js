import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createFigmashowMcpServer } from './createServer.js';

/**
 * Origens permitidas para o conector Claude (+ extras via env).
 * @returns {Set<string>}
 */
function allowedOrigins() {
  const set = new Set([
    'https://claude.ai',
    'https://www.claude.ai',
    'https://claude.com',
    'https://www.claude.com',
  ]);
  const extra = (process.env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of extra) set.add(o);
  return set;
}

/**
 * Hosts permitidos (DNS rebinding). Inclui Host do request se MCP_PUBLIC_HOST estiver setado.
 * @returns {Set<string>}
 */
function allowedHosts() {
  const set = new Set(['127.0.0.1', 'localhost']);
  const pub = (process.env.MCP_PUBLIC_HOST || '').trim().toLowerCase();
  if (pub) set.add(pub.replace(/:\d+$/, ''));
  const extra = (process.env.MCP_ALLOWED_HOSTS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const h of extra) set.add(h);
  return set;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function mcpOriginGuard(req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
    const allowed = allowedOrigins();
    if (!allowed.has(origin)) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: `Origin não permitida: ${origin}` },
        id: null,
      });
      return;
    }
  }

  const hostRaw = String(req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const host = hostRaw.replace(/:\d+$/, '');
  if (host) {
    const hosts = allowedHosts();
    // Se lista só tem localhost e não há MCP_PUBLIC_HOST, aceita qualquer host
    // (atrás do Coolify/Traefik o Host é o domínio público).
    const onlyLocal =
      [...hosts].every((h) => h === '127.0.0.1' || h === 'localhost') &&
      !process.env.MCP_PUBLIC_HOST &&
      !process.env.MCP_ALLOWED_HOSTS;
    if (!onlyLocal && !hosts.has(host)) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: `Host não permitido: ${host}` },
        id: null,
      });
      return;
    }
  }

  next();
}

/**
 * Monta POST/GET/DELETE /mcp (Streamable HTTP) no app Express.
 * Chamar DEPOIS do basicAuth e ANTES do api-handler (body raw).
 * Usa express.json só nestas rotas.
 *
 * @param {import('express').Express} app
 * @param {{ jsonParser?: import('express').RequestHandler }} [opts]
 */
export function mountMcpHttp(app, opts = {}) {
  /** @type {Record<string, StreamableHTTPServerTransport>} */
  const transports = Object.create(null);

  const jsonParser =
    opts.jsonParser ||
    // lazy require avoided — caller should pass express.json()
    ((req, _res, next) => next());

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async function handlePost(req, res) {
    const sessionId = /** @type {string|undefined} */ (
      req.headers['mcp-session-id']
    );

    try {
      let transport;
      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableDnsRebindingProtection: false,
          onsessioninitialized: (sid) => {
            transports[sid] = transport;
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        const server = createFigmashowMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'error',
          msg: 'mcp_post',
          error: String(err?.message || err),
        }),
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async function handleGet(req, res) {
    const sessionId = /** @type {string|undefined} */ (
      req.headers['mcp-session-id']
    );
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  }

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async function handleDelete(req, res) {
    const sessionId = /** @type {string|undefined} */ (
      req.headers['mcp-session-id']
    );
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
    await transport.close();
    delete transports[sessionId];
  }

  app.post('/mcp', mcpOriginGuard, jsonParser, (req, res) => {
    void handlePost(req, res);
  });
  app.get('/mcp', mcpOriginGuard, (req, res) => {
    void handleGet(req, res);
  });
  app.delete('/mcp', mcpOriginGuard, (req, res) => {
    void handleDelete(req, res);
  });

  return {
    sessionCount: () => Object.keys(transports).length,
  };
}
