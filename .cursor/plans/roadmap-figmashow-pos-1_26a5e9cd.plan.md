---
name: roadmap-figmashow-pos-1
overview: "Auditoria pós-commits 1.0.1 + Claude: o núcleo do roadmap foi entregue. Próximo foco é fechar bugs/dívidas (create_version remoto, SSE no dev, segurança /mcp) antes de empilhar Fase 4 UI."
todos:
  - id: release-operacao-101
    content: "Formalizar release 1.0.1: versão, CHANGELOG, CI/Docker smoke, logs, backup/restore de /data"
    status: completed
  - id: persistencia-cas-101
    content: Mutex por boardPath + index/active, expectedRevision obrigatório, thumbs atômicos, GC tmp, testes concorrência
    status: completed
  - id: editor-hardening-102
    content: "P0 editor: debounce props, dirty seguro, UI 409, export instâncias, rename home, confirm delete screen"
    status: completed
  - id: poll-revision-mcp-parity-102
    content: GET /revision para poll leve; tools delete_screen/rename/trash/restore + retry 409 no MCP
    status: completed
  - id: mcp-transacional-11
    content: API de operações atômicas, fila por projeto, batch_operations, normalizeComponents, deprecar /api/board
    status: completed
  - id: sync-editor-12
    content: SSE/ETag, modularizar EditorView, renderer único, Playwright E2E
    status: completed
  - id: design-productivity-13
    content: Versões, tokens, auto-layout, assets locais, protótipos avançados
    status: completed
  - id: fix-create-version-remote
    content: Corrigir createVersionRemote (enviar expectedRevision) e alinhar formato de snapshot
    status: completed
  - id: sse-dev-parity
    content: Mover SSE para api-handler (dev=prod) e deduplicar listeners no server
    status: completed
  - id: mcp-retry-ops-auth
    content: Retry 409 em batch_operations; Basic Auth obrigatório se /mcp ligado; smoke tools/call
    status: completed
  - id: e2e-canvas-real
    content: "E2E real: editar canvas → reload → conflito 409; unificar PhoneFrame com BoardNodeView"
    status: completed
  - id: design-ui-fase4
    content: UI para tokens/auto-layout/restore_version; upload de assets (hoje só static)
    status: completed
isProject: false
---

# Auditoria FigmaShow pós-1.0.1 + Claude

## Veredito

Os commits `e9a9a46` (1.0.1) e `8f1ae53` (Claude) entregaram **de verdade** o núcleo do roadmap: CAS+mutex, operations, poll `/revision`, hardening do editor, tools MCP novas e **Streamable HTTP** em `/mcp` para Claude.ai. O CHANGELOG descreve o pacote como fechado, mas há itens **parciais** e pelo menos **um bug concreto** (`create_version` remoto sem `expectedRevision` → 400).

```mermaid
flowchart LR
  Cursor[Cursor stdio]
  Claude[Claude.ai HTTP]
  MCP["/mcp Streamable"]
  API[api-handler]
  Core[packages/core]
  Disk["/data"]

  Cursor -->|FIGMASHOW_API_URL| API
  Cursor -->|FIGMASHOW_DATA| Core
  Claude --> MCP
  MCP --> Core
  API --> Core
  Core --> Disk
```

## O que está DONE

- **Persistência:** mutex in-process, `expectedRevision` obrigatório, thumbs atômicos, GC `*.tmp`, `normalizeComponents` na gravação
- **API:** `/revision` + ETag, `POST .../operations`, versions GET/POST, health com version/commit/mcp, logs JSON
- **Editor:** dirty seguro, modal 409, hooks `useBoardSync`/`useHistory`/`useSelection`, debounce props, rename home, confirm delete
- **MCP:** `delete_screen`, lifecycle projeto, `batch_operations`, `add_nodes`, factory `createFigmashowMcpServer()`, HTTP mount + smoke
- **Ops:** CI, backup script, smoke Docker, versão `1.0.1`

## PARTIAL / bugs a fechar (prioridade)

| Item | Problema | Path |
|------|----------|------|
| `create_version` remoto | POST sem `expectedRevision` → 400 | [`remote.js`](figmashow/packages/mcp/src/remote.js) |
| SSE | Só no Express prod; em `npm run web` EventSource falha → só poll | [`server.js`](figmashow/apps/server/server.js) vs [`api-handler.js`](figmashow/apps/web/api-handler.js) |
| Retry 409 | Só no PUT de `commitBoard`; `batch_operations` não retenta | [`createServer.js`](figmashow/packages/mcp/src/createServer.js) |
| `/mcp` auth | Basic Auth opcional; sem credencial = superfície de escrita pública | [`httpMount.js`](figmashow/packages/mcp/src/httpMount.js), [`server.js`](figmashow/apps/server/server.js) |
| Renderer único | Home + protótipo usam `BoardNodeView`; canvas (`PhoneFrame`) ainda duplicado | [`PhoneFrame.jsx`](figmashow/apps/web/src/PhoneFrame.jsx) |
| E2E | Smoke API/navegação; não edita canvas nem protótipo | [`e2e/smoke.spec.js`](figmashow/e2e/smoke.spec.js) |
| Fase 4 UI | Tokens/auto-layout/versions existem em schema/ops/MCP; **sem UI** de editor; assets só static; sem `restore_version` | core + MCP |

## Três modos MCP (sólido)

| Modo | Entrada | Dados |
|------|---------|-------|
| Stdio local | Cursor + `FIGMASHOW_DATA` | Disco |
| Stdio remoto | Cursor + `FIGMASHOW_API_URL` | HTTP → API |
| Streamable HTTP | Claude.ai → `https://dominio/mcp` | Disco no container (anti-loop apaga `FIGMASHOW_API_URL`) |

Documentação boa em [`DEPLOY.md`](figmashow/DEPLOY.md) §7b; README ainda atrasado nas tools novas.

## Próximos movimentos (curtos)

1. **Hotfix:** `createVersionRemote` com `expectedRevision` + smoke `tools/call`.
2. **Paridade dev/prod:** SSE no `api-handler` (ou plugin Vite).
3. **Confiabilidade MCP:** retry 409 em operations; Basic Auth obrigatório quando `/mcp` estiver exposto (ou token dedicado).
4. **Qualidade:** E2E canvas + unificar `PhoneFrame` com `BoardNodeView`.
5. **Só então:** UI de tokens/auto-layout/`restore_version` e upload de assets.
