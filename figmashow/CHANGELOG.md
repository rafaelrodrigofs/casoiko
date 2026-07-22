# Changelog

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

### MCP
- Tools: `delete_screen`, `rename_project`, `trash_project`, `restore_project`
- Tools: `batch_operations`, `add_nodes`, `list_versions`, `create_version`, `set_tokens`
- Retry 1× em 409 no modo remoto
- `batch_operations` via API remota

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
