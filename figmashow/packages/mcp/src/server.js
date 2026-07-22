#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readActiveProjectId } from '../../core/src/index.js';
import { createFigmashowMcpServer } from './createServer.js';
import { isRemoteMode } from './remote.js';

async function main() {
  if (isRemoteMode()) {
    console.error(`[figmashow] remote API: ${process.env.FIGMASHOW_API_URL}`);
  } else {
    console.error(
      `[figmashow] active project: ${readActiveProjectId() ?? '(nenhum)'}`,
    );
  }
  const server = createFigmashowMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[figmashow] MCP stdio ready');
}

main().catch((err) => {
  console.error('[figmashow] fatal', err);
  process.exit(1);
});
