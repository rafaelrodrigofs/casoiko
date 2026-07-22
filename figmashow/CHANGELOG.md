# Changelog

## 1.0.2 — 2026-07-22

### Hotfix / paridade
- `create_version` remoto envia `expectedRevision`; snapshot unificado `{ board: {...} }`
- Tool MCP `restore_version` + restore via `POST .../versions` com `{ restore }`
- Retry 409 em `batch_operations` / `add_nodes` / `set_tokens`
- SSE de board em `api-handler` (dev = prod); listener único `board:projectId`
- `/mcp` exige `BASIC_AUTH_*` (503 sem credencial); `MCP_ALLOW_INSECURE=1` só local
- Smoke MCP com `tools/call` (`list_projects`)
- Upload de assets `POST .../assets`; UI DesignPanel (tokens, versões, assets)
- Auto-layout no painel de grupo; PhoneFrame usa helpers de `BoardNodeView`
- E2E: add node + 409 + create/restore version

## 1.0.1 — 2026-07-21

### Persistência
- Mutex in-process por board/index/active (CAS sem TOCTOU no mesmo processo)
- `expectedRevision` obrigatório em PUT de board (400 se ausente)
- Thumbs gravados com `writeFileAtomic`
- GC de `*.tmp` órfãos no startup
- `normalizeComponents` na gravação do board

### API
- `GET /api/projects/:id/revision` (+ ETag)
- `POST /api/projects/:id/operations` (ops atômicas + CAS)
- `GET|POST /api/projects/:id/versions` (snapshots)
- `GET /api/projects/:id/events` (SSE)
- `/api/health` expõe `version` e `commit`
- Logs estruturados JSON (startup, save, conflito, shutdown)
- **`POST/GET/DELETE /mcp`** — MCP Streamable HTTP para Claude.ai (Basic Auth)

### MCP
- Tools: `delete_screen`, `rename_project`, `trash_project`, `restore_project`
- Tools: `batch_operations`, `add_nodes`, `list_versions`, `create_version`, `set_tokens`
- Retry 1× em 409 no modo remoto
- `batch_operations` via API remota
- Factory `createFigmashowMcpServer()` (pin por sessão); stdio + HTTP compartilham tools
- Smoke: `npm run smoke:mcp`

### Editor
- Dirty sem auto-clear por timeout; `beforeunload` se save pendente
- Modal de conflito 409 (manter / aceitar remoto)
- Poll leve via `/revision` + SSE
- Hooks `useBoardSync` / `useHistory` / `useSelection`
- Renderer único `BoardNodeView` (home + protótipo)
- Rename na home; confirm ao apagar tela
- Export CSS/React resolve instâncias
- Transições de protótipo: dissolve, slide, push
- Assets locais em `/assets`
- Playwright E2E smoke

### Ops
- Scripts `backup` e smoke Docker
- CI GitHub Actions (`npm test` + build + e2e)
- Documentação de backup/restore em DEPLOY.md

## 1.0.0 — 2026-07-21

- Deploy Coolify (Docker + Express + volume `/data`)
- MCP remoto via `FIGMASHOW_API_URL`
- Escrita atômica temp+rename
- CAS otimista com HTTP 409
