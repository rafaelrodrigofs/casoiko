# FigmaShow — Manual de Reconstrução

> Documento gerado por análise completa do código em julho/2026 (v1.0.3).
> Objetivo: permitir reconstruir o projeto do zero, com a mesma arquitetura,
> modelo de dados, comportamentos e decisões de design — sem depender do código atual.

---

## Índice

1. [O que é o FigmaShow](#1-o-que-é-o-figmashow)
2. [Arquitetura do monorepo](#2-arquitetura-do-monorepo)
3. [Modelo de dados completo](#3-modelo-de-dados-completo)
4. [Modelo semântico: Interaction → Workflow (camada Lógico)](#4-modelo-semântico-interaction--workflow)
5. [`packages/core` — módulo a módulo](#5-packagescore--módulo-a-módulo)
6. [Persistência e concorrência (atomic + mutex + CAS)](#6-persistência-e-concorrência)
7. [API HTTP (`api-handler.js` + `apps/server`)](#7-api-http)
8. [MCP — 3 modos de operação e 48 tools](#8-mcp)
9. [App web React (`apps/web`)](#9-app-web-react)
10. [Camada Protótipo (conceitual)](#10-camada-protótipo)
11. [Camada Lógico (UX e implementação)](#11-camada-lógico)
12. [Sincronização, histórico e conflitos](#12-sincronização-histórico-e-conflitos)
13. [Export, thumbnails e smart guides](#13-export-thumbnails-e-smart-guides)
14. [Setup de desenvolvimento](#14-setup-de-desenvolvimento)
15. [Build, Docker e deploy no Coolify](#15-build-docker-e-deploy-no-coolify)
16. [Testes e smokes](#16-testes-e-smokes)
17. [Scripts utilitários e seeds](#17-scripts-utilitários-e-seeds)
18. [Configuração MCP no Cursor e Claude](#18-configuração-mcp-no-cursor-e-claude)
19. [Ordem recomendada de reconstrução](#19-ordem-recomendada-de-reconstrução)
20. [Armadilhas conhecidas (gotchas)](#20-armadilhas-conhecidas)

---

## 1. O que é o FigmaShow

Editor de telas mobile estilo Figma, **local-first**, com três diferenciais:

1. **Canvas infinito** com frames (artboards), nós (rect/text/button/image/group),
   componentes com variantes e instâncias, protótipo navegável ("Apresentar").
2. **Camada Lógico**: modelo semântico por cima do protótipo — cada ligação de
   protótipo pode ganhar um *workflow* (Validar → API → Condição → Navegar…)
   renderizado como círculos sobre a própria linha da ligação, e simulável no
   modo Apresentar.
3. **MCP (Model Context Protocol)**: agentes de IA (Cursor, Claude) editam o
   board diretamente via 48 tools — criar telas, nós, componentes, protótipos,
   passos lógicos, versões, etc. Funciona local (stdio → disco) ou remoto
   (stdio → API HTTPS da VPS, ou Streamable HTTP `/mcp` para Claude.ai).

Persistência: **arquivos JSON em disco** (sem banco). Concorrência: CAS por
`revision` + escrita atômica + mutex. Multi-projeto com lixeira e thumbnails.

---

## 2. Arquitetura do monorepo

npm workspaces (Node ≥ 18, tudo ESM):

```
figmashow/
├── package.json            # workspaces: packages/*, apps/*
├── packages/
│   ├── core/               # @figmashow/core — schema, domínio, I/O, operações (zero deps)
│   └── mcp/                # @figmashow/mcp — 48 tools (deps: MCP SDK, zod, core)
├── apps/
│   ├── web/                # @figmashow/web — React + Vite (deps: react, react-router-dom, html-to-image, core)
│   │   └── api-handler.js  # handler REST compartilhado (Vite middleware E servidor prod)
│   └── server/             # @figmashow/server — Express: SPA + API + /mcp (deps: express, core, mcp)
├── bin/mcp.mjs             # launcher MCP estável para o Cursor (cwd-independente)
├── data/                   # persistência local (NUNCA vai na imagem Docker)
├── scripts/                # seeds, smokes, backup, e2e-server
├── e2e/                    # Playwright
├── Dockerfile              # multi-stage (build web → runtime node:20-alpine)
└── DEPLOY.md / README.md / CHANGELOG.md
```

Dependências entre camadas (sempre nessa direção):

```
apps/web ──┐
apps/server ─┼──► packages/core (puro, sem deps)
packages/mcp ┘
```

`packages/core/package.json` expõe **subpath exports** — importante para o
bundle do browser (ver [gotcha 20.1](#20-armadilhas-conhecidas)):

| Subpath | Conteúdo |
|---------|----------|
| `@figmashow/core` | barrel completo (inclui módulos Node-only!) |
| `@figmashow/core/schema` | árvore de nós, normalização |
| `@figmashow/core/domain` | workflows, interactions + re-exporta geometria |
| `@figmashow/core/prototypePath` | bezier/amostragem |
| `@figmashow/core/components` | componentes/instâncias |
| `@figmashow/core/autoLayout`, `/framePresets`, `/export` | utilitários |

---

## 3. Modelo de dados completo

### 3.1 Board (arquivo `data/projects/{id}.json`)

```ts
Board = {
  version: number,      // schema; normalização força ≥ 2
  revision: number,     // CAS: +1 a cada write bem-sucedido
  screens: Screen[],
  components: ComponentDef[],
  prototypes: PrototypeLink[],
  comments: BoardComment[],
  tokens: Record<string, unknown>,   // design tokens livres (key/value)
  versions: VersionSnapshot[],       // snapshots, máx. 30
  domain: Domain,                    // semântica (ver §4)
  domainViews: DomainViews,          // layout visual dos workflows
}
```

### 3.2 Screen

```ts
Screen = {
  id: string,          // "screen_xxxxxxxx"
  name: string,
  width: number,       // default 390
  height: number,      // default 844
  background: string,  // default "#FFFFFF"
  x: number, y: number,  // posição no canvas infinito
  nodes: BoardNode[],  // árvore — coordenadas ABSOLUTAS na tela
}
```

Se `x/y` faltarem, o layout automático enfileira horizontalmente com gap 80.

### 3.3 BoardNode (união discriminada por `type`)

Campos comuns: `id`, `type`, `x, y, w, h` (**absolutos na tela**, não relativos
ao pai — decisão de design central), `name?`, `locked?`, `hidden?`,
`rotation?` (graus [0,360), pivô no centro),
`constraints? {left,right,top,bottom}` (default left+top; omitido se default).

| type | Campos específicos |
|------|--------------------|
| `rect` | `fill`, `fillOpacity`, `cornerRadius`, `bottomRadius?`, `stroke?`, `strokeWidth?`, `strokeOpacity?`, `opacity` |
| `text` | `text`, `fontSize`, `fontWeight`, `color`, `align`, `icon?` (Material Icons) |
| `button` | `label`, `fill`, `fillOpacity`, `textColor`, `cornerRadius`, `fontSize`, `fontWeight`, `iconSrc?` |
| `image` | `src`, `fit` (`cover\|contain\|fill`) |
| `group` | `children: BoardNode[]` |
| `component` | `componentId`, `variantId`, `children[]` — **main editável no canvas** |
| `instance` | `componentId`, `variantId` — SEM children; resolve pela biblioteca |

IDs: `crypto.randomUUID()` truncado com prefixo semântico (`node_`, `group_`,
`screen_`, `proto_`, `ix_`, `wf_`, `wn_`, `we_`, `api_`, `ver_`, `id_`…).

### 3.4 PrototypeLink

```ts
PrototypeLink = {
  id: string,
  fromScreenId: string,
  triggerNodeId: string,     // nó gatilho na tela de origem
  toScreenId: string,
  transition: 'instant'|'dissolve'|'slide_left'|'slide_right'|'push',
  trigger: 'onClick',        // fixo
  action: 'navigate',        // fixo
  fromSide: 'right'|'left'|'top'|'bottom',
}
```

### 3.5 BoardComment

```ts
{ id, screenId, x, y, text, resolved: boolean, createdAt: epochMs }
```

### 3.6 ComponentDef

```ts
ComponentDef = { id, name, variants: ComponentVariant[] }
ComponentVariant = { id, name, root: BoardNode }  // árvore em coords LOCAIS (origem ~0,0)
```

Regras: main no canvas (type `component`) é a fonte; `syncComponentDefFromMain`
propaga edições para a def; duplicar um main gera uma `instance`; detach
converte instance em árvore editável; instance sem def renderiza placeholder cinza.

### 3.7 VersionSnapshot

```ts
{ id, name, createdAt: ISO, revision, board: { screens, components, prototypes, comments, tokens, domain?, domainViews? } }
```

### 3.8 Arquivos de projeto (fora do board)

```
data/
  index.json    → { version: 1, projects: [{ id, name, createdAt, updatedAt, trashed?, thumbColor? }] }
  active.json   → { projectId }          // projeto "aberto" (MCP local, rotas legadas)
  projects/     → id_xxx.json            // um board por projeto
  thumbs/       → id_xxx.png             // miniaturas para a home
  assets/       → imagens uploadadas     // servidas em /assets/*
  board.json    → legado single-board (migração automática na 1ª execução)
```

---

## 4. Modelo semântico: Interaction → Workflow

### 4.1 Entidades

```ts
Domain = {
  version: ≥2, dialectHints: { sql: 'mariadb' },
  entities: [], relationships: [],       // stubs para futuro (ERD)
  interactions: Interaction[],
  workflows: Workflow[],
  apis: ApiDef[],
  rules: [], functions: [], bindings: [],  // stubs
}

Interaction = {
  id: string,                  // IDENTIDADE primária
  name: string,
  trigger: { type: 'uiEvent', event: 'onClick', screenId, nodeId },
  prototypeLinkId: string|null,   // FACETA opcional (seta visual)
  workflowId: string|null,
}

Workflow = {
  id, name, interactionId, entryNodeId,
  nodes: [{ id, kind, name, config }],
  edges: [{ id, from, to, when? }],      // when: 'success' | 'error' | undefined
}

ApiDef = { id, name, method: 'GET|POST|PUT|PATCH|DELETE', path, physicalBindingId: null }

DomainViews = { entities: [], workflows: [{ workflowId, nodes: [{ nodeId, x, y }] }] }
```

**Decisão-chave**: a Interaction é a identidade; o PrototypeLink é só uma faceta.
A seta visual pode existir sem lógica, e a lógica pode existir sem seta.
Um gatilho UI `(screenId, nodeId)` tem no máximo uma Interaction
(`findInteractionByTrigger`).

### 4.2 Kinds de nó de workflow

| kind | config | Semântica |
|------|--------|-----------|
| `validate` | `{ simulate: 'success'\|'error' }` | Checa campos/regras |
| `apiCall` | `{ apiId, simulate }` | Chama endpoint lógico (mock no Apresentar) |
| `branch` | — | Bifurca pela aresta `when === lastBranch` |
| `setState` | `{ key, value }` | Grava chave/valor no estado do fluxo |
| `navigate` | `{ toScreenId, transition }` | Vai para outra tela (terminal do caminho) |
| `showMessage` | `{ message, tone }` | Toast de feedback |

### 4.3 Algoritmos centrais (em `domain.js`)

- **`classifyWorkflowPathNodes(workflow)`** → `{ onPath: string[], side: [{nodeId, nearId}] }`
  Percorre de `entryNodeId` seguindo `when==='success'` → sem when → primeira
  aresta. `onPath` = todos exceto `navigate`. `side` = alvos de arestas `error` + órfãos.
- **`insertStepOnMainPath(workflow, kind, config)`** — insere o novo nó
  **antes do navigate** (`pred → novo → nav`). Se entry era navigate, o novo
  vira entry. Sem navigate, anexa ao fim.
- **`expandInteraction(opts)`** — cria (ou reusa) Interaction + Workflow stub:
  com `toScreenId` → um nó `navigate`; sem → um `showMessage`. Retorna
  `{ domain, domainViews, interaction, workflow, created }`.
- **`insertLogicStepOnPrototype`** — pipeline completo: resolve link →
  `expandInteraction` → `insertStepOnMainPath` → cria ApiDef se `apiCall` →
  `relayoutWorkflowOnPrototype` (reposiciona nós na curva).
- **`simulateWorkflow(workflow, { forceOutcome? })`** — interpretador mock
  (máx. 64 passos). validate/apiCall setam `lastBranch` via `config.simulate`;
  branch segue `when === lastBranch`; setState acumula `statePatches`;
  navigate/showMessage são terminais. Outcomes: `navigate|message|state|done`.
- **`seedLoginWorkflow`** — demo rica: validate → apiCall → branch →
  (success) navigate | (error) showMessage + API `POST /api/auth/login`.

### 4.4 Geometria da linha (`prototypePath.js`)

A "noodle" é uma bezier cúbica do nó gatilho até a tela destino:

1. `getPrototypeLinkEndpoints(screens, link)` — box mundo do trigger
   (`screen.x + node.x`, …); `start = edgePoint(box, fromSide)`;
   `end` = meio da borda esquerda da tela destino. `null` se algo sumiu ou `hidden`.
2. `bezierControls(x1,y1,x2,y2,fromSide)` — controles empurrados na direção do
   lado, `dist = clamp(40..180, (dx+dy)*0.35)`.
3. `bezierPath(...)` → string SVG `M … C …`.
4. `sampleCubicBezier(ctrl, t)` — ponto Bernstein.
5. `samplePointsAlongPrototypeLink(screens, link, count)` — para i=0..count-1,
   `t = (i+1)/(count+1)` (evita endpoints). É assim que os círculos do Lógico
   ficam distribuídos NO MEIO da linha.

---

## 5. `packages/core` — módulo a módulo

| Módulo | Responsabilidade | Exports principais |
|--------|------------------|--------------------|
| `schema.js` | Schema canônico + árvore de nós | `emptyBoard`, `normalizeBoard`, `normalizeNode`, `createScreen`, `cryptoRandomId`, `findNodeById`, `updateNodeInTree`, `moveNodeBy`, `resizeNodeBox`, `insertNodeInTree`, `removeNodeFromTree`, `groupSiblingNodes`, `ungroupNode`, `duplicateSiblingNodes`, `reorderSiblingNode`, `reparentNode`, `alignSelection`, `distributeSelection`, `resizeScreenWithConstraints`, `scrubBoardRefs`, `summarizeNodeTree`, `flattenVisibleLeaves` |
| `domain.js` | Semântica Interaction→Workflow | ver §4 + `WORKFLOW_KINDS`, `WORKFLOW_KIND_LABEL`, `normalizeDomain`, `scrubDomainRefs`, `ensureWorkflowView`, `layoutWorkflowAlongPath`, `relayoutWorkflowOnPrototype` |
| `prototypePath.js` | Geometria bezier | ver §4.4 |
| `board.js` | I/O do board com CAS | `readBoard`, `writeBoard`, `writeBoardIfRevision`, `updateBoard` (mutex+CAS, lança `REVISION_CONFLICT`), `readBoardRevision`, `resolveBoardPath` |
| `projects.js` | Multi-projeto | `listProjects`, `createProject`, `renameProject`, `trashProject`, `restoreProject`, `deleteProjectPermanent`, `readActiveProjectId`, `setActiveProjectId`, `migrateLegacyBoardIfNeeded`, `syncProjectMetaFromBoard`, `touchProject` |
| `operations.js` | Ops em lote (memória) | `applyBoardOperations(board, ops)` — tipos: `create_screen`, `delete_screen`, `update_screen`, `clear_screen`, `add_node`, `update_node`, `delete_node`, `move_node`, `batch_update`, `group_nodes`, `duplicate_node`, `set_constraints`, `auto_layout`, `set_tokens` |
| `components.js` | Biblioteca de componentes | `createComponentFromNodes`, `addComponentVariant`, `createInstance`, `switchInstanceVariant`, `detachInstance`, `resolveInstanceTree`, `syncComponentDefFromMain`, `syncAllComponentDefs`, `replaceDuplicatedMainsWithInstances`, `normalizeComponents` |
| `autoLayout.js` | Stack V/H absoluto | `applyAutoLayout(children, { direction, gap, padding, align, originX, originY })` |
| `framePresets.js` | Tamanhos de frame | `FRAME_PRESET_CATEGORIES`, `findFramePreset`, `listFramePresets` (iphone-14, ipad, desktop, ig-story…) |
| `export.js` | Screen → código | `screenToCss`, `screenToReact`, `sanitizeDownloadName` (absolute positioning, resolve instances, hex+opacity→rgba, ignora hidden) |
| `events.js` | Notificação in-process | `boardEvents`, `emitBoardChanged(projectId, { revision })` — alimenta SSE |
| `atomic.js` | Escrita atômica | `writeFileAtomic` (temp `{path}.{pid}.{ts}.tmp` → `renameSync`), `gcOrphanTempFiles` |
| `mutex.js` | Lock por chave | `withMutex(key, fn)` async, `withMutexSync` (reentrante) — só intra-processo |
| `paths.js` | Resolução sob `FIGMASHOW_DATA` | `resolveDataDir`, `resolveProjectIndexPath`, `resolveProjectsDir`, `resolveProjectBoardPath`, `resolveProjectThumbPath`, `resolveThumbsDir`, `resolveAssetsDir`, `resolveDefaultBoardPath`, `resolveActiveMetaPath` |
| `index.js` | Barrel de tudo | ⚠️ inclui módulos Node-only — browser deve importar subpaths |

Ciclo leve tolerado: `schema.js` ↔ `domain.js` (normalize/scrub vs findNodeById).

---

## 6. Persistência e concorrência

Três camadas que juntas substituem um banco de dados:

1. **`writeFileAtomic`** — escreve em `{path}.{pid}.{timestamp}.tmp` e faz
   `renameSync` (atômico no mesmo filesystem). Nunca há JSON pela metade.
2. **`withMutexSync(path, fn)`** — serializa read-check-write no mesmo processo.
3. **CAS por `revision`** — `writeBoardIfRevision(board, path, expectedRevision)`:
   lê a revision do disco; se `expected !== atual` → conflito
   (`REVISION_CONFLICT` / HTTP 409); senão grava com `revision = atual + 1`.

Fluxo `updateBoard(mutator)`: mutex → read → mutate → CAS. Entre processos
(UI + MCP simultâneos), o CAS resolve: MCP remoto faz 1 retry automático em
409; a UI abre um diálogo de conflito para escolha manual.

Normalização acontece **na borda**: todo read/write passa por `normalizeBoard`
(dados corrompidos viram defaults seguros) + `scrubBoardRefs` (remove
prototypes/comments/interactions órfãos em cascata).

---

## 7. API HTTP

### 7.1 `apps/web/api-handler.js` — `createBoardApiHandler(dataDir)`

Mesmo handler usado no middleware do Vite (dev) e no Express (prod).

| Método | Path | Corpo | Resposta |
|--------|------|-------|----------|
| GET | `/api/projects?trashed=0\|1` | — | `{ projects }` |
| POST | `/api/projects` | `{ name? }` | 201 `{ ok, project }` |
| GET | `/api/projects/:id` | — | `{ project, board }` + ETag revision |
| PUT | `/api/projects/:id` | `{ board, expectedRevision }` | 200 `{ ok, revision, board, project }` ou **409** `{ error, revision, board }` |
| PATCH | `/api/projects/:id` | `{ name }` | `{ ok, project }` |
| DELETE | `/api/projects/:id` | — | `{ ok }` (permanente: json + thumb + active) |
| POST | `/api/projects/:id/activate` | — | grava `active.json` |
| POST | `/api/projects/:id/trash` / `restore` | — | soft-delete / restaura |
| GET | `/api/projects/:id/revision` | — | `{ projectId, revision }` (poll leve) |
| GET | `/api/projects/:id/events` | — | **SSE**: `ready`, `board {revision}`, ping 25s |
| GET/POST | `/api/projects/:id/assets` | POST: `{ dataUrl, name? }` | lista / upload de imagem |
| GET/POST | `/api/projects/:id/thumb` | POST: `{ dataUrl }` PNG | miniatura |
| POST | `/api/projects/:id/operations` | `{ operations[], expectedRevision }` | aplica `applyBoardOperations` com CAS |
| GET/POST | `/api/projects/:id/versions` | criar `{ name?, expectedRevision }` ou restaurar `{ restore: versionId, expectedRevision }` | snapshots (máx. 30) |
| GET/PUT | `/api/board` (+ `/api/board/move`) | — | legado single-board, `deprecated: true` |

Regras: PUT/operations/versions exigem `expectedRevision` (exceto first-write
com rev 0). Toda escrita emite `emitBoardChanged` → SSE para outros clientes.

### 7.2 `apps/server/server.js`

Ordem dos middlewares:

1. `GET /api/health` → `{ ok, service: 'figmashow', version, commit, mcp: '/mcp' }` — **sem auth** (healthcheck)
2. Basic Auth global (se `BASIC_AUTH_USER/PASS` setados; senão aberto)
3. Auth obrigatória em `/mcp` (ou `MCP_ALLOW_INSECURE=1` local)
4. `mountMcpHttp(app)` → POST/GET/DELETE `/mcp` (Streamable HTTP, sessão por UUID)
5. `createBoardApiHandler(DATA_DIR)` → `/api/*`
6. Static `/assets/*` (de `{DATA}/assets`) + SPA `apps/web/dist` com fallback `index.html`

Envs: `PORT` (8080), `FIGMASHOW_DATA` (`/data` no Docker), `MAX_BODY_BYTES`
(10 MB), `BASIC_AUTH_*`, `MCP_ALLOWED_ORIGINS`, `MCP_PUBLIC_HOST`.

⚠️ O server **apaga `FIGMASHOW_API_URL` do próprio processo** no boot — senão
o MCP HTTP in-process entraria em loop chamando a própria API.

---

## 8. MCP

### 8.1 Três modos

```
1) LOCAL (stdio → disco):
   Cursor ──stdio──► bin/mcp.mjs ──► createFigmashowMcpServer ──► @figmashow/core ──► data/

2) REMOTO (stdio → HTTPS):   [FIGMASHOW_API_URL setado no env do mcp.json]
   Cursor ──stdio──► mcp.mjs ──► remote.js (fetch + Basic Auth) ──► /api/projects/... na VPS

3) HTTP (Claude.ai connector):
   Claude ──POST /mcp──► apps/server ──► createFigmashowMcpServer in-process ──► /data
```

- `bin/mcp.mjs`: resolve a raiz do repo, seta `FIGMASHOW_DATA` default, importa `server.js`.
- `server.js` (stdio): logs em **stderr** (stdout é o protocolo MCP).
- `remote.js`: encapsula todas as chamadas HTTP; timeout `FIGMASHOW_API_TIMEOUT_MS`
  (30s); 409 → `err.code = 'REVISION_CONFLICT'`; `commitBoard` remoto faz
  GET → mutate → PUT com **1 retry** em 409.
- **Pin de projeto**: em remoto, é obrigatório `open_project`/`create_project`
  na sessão (variável `pinnedProjectId` em memória); sem pin, mutações falham
  com "Nenhum projeto aberto". Em local o fallback é o `active.json`.
- `httpMount.js`: valida Origin (`claude.ai`/`claude.com` + `MCP_ALLOWED_ORIGINS`)
  e Host; cada sessão HTTP cria servidor MCP próprio + transport com session id.

### 8.2 As 48 tools

**Projetos**: `list_projects`, `create_project`, `open_project`,
`rename_project`, `trash_project`, `restore_project`

**Screens**: `list_screens`, `get_screen`, `create_screen` (aceita `presetId`),
`delete_screen`, `clear_screen`, `update_screen`

**Nodes**: `add_node`, `add_nodes`, `update_node` (patch com `null` = remove
campo), `delete_node`, `list_nodes` (árvore resumida), `duplicate_node`,
`group_nodes`, `move_node` (dx/dy/parentId/zDelta), `set_constraints` (só nós
raiz), `batch_update`, `batch_operations` (lista de ops crua)

**Versões/tokens**: `list_versions`, `create_version`, `restore_version`, `set_tokens`

**Componentes**: `list_components`, `create_component` (irmãos → main + def,
retorna idMap), `add_component_variant`, `instantiate_component`,
`set_instance_variant`, `detach_instance`

**Protótipo**: `add_prototype_link`, `update_prototype_link`,
`delete_prototype_link`, `list_prototype_links`

**Lógica**: `list_interactions`, `list_workflows`, `get_workflow` (inclui
classificação onPath/side), `ensure_logic_on_prototype` (= expandInteraction),
`insert_logic_step` (kind + prototypeLinkId ou workflowId),
`simulate_workflow` (read-only, com `forceOutcome`)

**Comments/export**: `list_comments`, `add_comment`, `resolve_comment`,
`export_screen_css`, `export_screen_react`

Convenções: resposta `{ content: [{ type: 'text', text: JSON }] }`;
erros com `isError: true`; schemas de parâmetros em zod; toda mutação passa
por `commitBoard` (sync de componentes + scrub) ou operations.

---

## 9. App web React

### 9.1 Rotas

```
main.jsx → BrowserRouter → App.jsx
  /               → HomePage      (lista de projetos, lixeira, criar)
  /file/:projectId → EditorView   (o editor)
  *               → Navigate /
```

### 9.2 Árvore do editor

```
EditorView (~3100 linhas — orquestrador central)
├─ InfiniteCanvas (ref imperativa)
│  ├─ artboard[] → PhoneFrame (nós, gestos, edição de texto, smart guides)
│  ├─ PrototypeOverlay   (tool P, camada conceitual)
│  └─ LogicLayerOverlay  (camada lógico)
├─ LayersPanel | PropertiesPanel (+DesignPanel) | ToolsBar | FramePickerPanel
├─ PrototypePreview (modal "Apresentar")
├─ InteractionPopup (config do link)
├─ WorkflowEditor (drawer lateral do Lógico)
└─ conflict-dialog (CAS 409)
```

### 9.3 Hooks

- **`useBoardSelection`** — `selectedScreenId`, `selectedNodeIds[]`,
  `hoveredNodeId`, `selectedCommentId` + refs espelho (para atalhos sem stale
  closure). API: `selectNode(screenId, nodeId, {additive, preserve})`,
  `selectScreen`, `clearSelection`, `hoverNode`.
- **`useBoardHistory`** — stacks undo/redo em ref (máx. 50); cada entrada =
  `{ board, selectedScreenId, selectedNodeIds }`; `pushHistory()` ANTES de cada
  mutação; undo/redo restauram board+seleção e persistem.
- **`useBoardSync`** — NÃO baixa o board; só detecta mudança de `revision`
  (poll 1,5s em `/revision` + `EventSource /events`). Bloqueado enquanto
  `dirty`, `putInFlight` ou pan ativo. Callback `onRevisionChanged` → o caller
  faz o fetch completo.

### 9.4 EditorView — pipeline de mutação

```
1. pushHistory()                        // snapshot p/ undo
2. mutar a partir de boardRef.current   // nunca do state direto
3. commitBoard(next)                    // scrubBoardRefs + syncAllComponentDefs + ensureBoardExtras
   → setBoard + persistBoard            // PUT com expectedRevision
```

Refs de orquestração: `boardRef`, `dirtyRef`, `knownRevisionRef`,
`persistGenRef` (invalida PUTs obsoletos), `persistInFlightRef`,
`panActiveRef`, `liveGeomSetterRef` (bridge DOM canvas→painel sem re-render),
`clipboardRef`, `thumbTimerRef` (debounce thumb 900ms), `canvasRef`.

Atalhos: Esc (cascata: foco lógico → link proto → tool → comment → nodes →
clear), F4 (focus screen), V/F/R/T/B/I/P/C/H (tools), Del, setas (+Shift),
Ctrl+Z/Y/G/U/D/C/V.

### 9.5 InfiniteCanvas — câmera

- Estado: `pan {x,y}`, `zoom` (0.01–256); **fonte da verdade durante gesto**
  são `panRef`/`zoomRef` — o transform é aplicado direto no DOM via rAF
  (`translate3d(...) scale(...)`, origin 0 0), sem setState. Commit no fim do
  gesto (`commitCamera`).
- CSS var `--canvas-zoom` no viewport escala handles inversamente.
- `clientToWorld(cx, cy) = (client - viewportRect - pan) / zoom`.
- API imperativa via ref: `focusScreen`, `zoomBy`, `fitAll`, `fitScreens(ids)`
  (desconta painéis flutuantes), `getCamera`, `setCameraState`.
- Gestos: pan (space/hand/botão meio), zoom (Ctrl+wheel exponencial; wheel = pan),
  desenhar frame (tool F no fundo), mover/resize frame (label/handles, com
  `frameGesture` live que alimenta `screensForOverlays` para as linhas
  acompanharem o arraste em tempo real).

### 9.6 PhoneFrame

Renderiza uma screen com: seleção/hover de nós, resize com 8 handles + rotate
+ radius, criação por drag (create tool), edição inline de texto, deep select
(duplo clique), Alt-drag duplica, comments, smart guides. Drag roda em ref +
rAF direto no DOM; commit só no pointer up (`onMoveCommit`, `onResizeCommit`).

---

## 10. Camada Protótipo

- **PrototypeOverlay** (ativo com tool P na camada conceitual): nó selecionado
  ganha 4 handles `+` nas bordas; arrastar cria noodle draft; soltar sobre
  outra tela → `onCreateLink({ fromScreenId, triggerNodeId, toScreenId, fromSide })`.
  Links existentes são SVG bezier clicáveis → abre `InteractionPopup`.
- **InteractionPopup**: destino, transição, "Expandir fluxo lógico" (cria
  Interaction+Workflow e vai para a camada Lógico), remover. Gatilho/ação
  fixos (onClick/navigate).
- **PrototypePreview** ("Apresentar"): stage com animações CSS por transição;
  nós renderizados por `BoardNodeView` (estático); botões invisíveis sobre os
  triggers. Ao clicar: se a Interaction tem workflow → `simulateWorkflow`
  (delay ~280ms) → aplica `statePatches`, navega ou mostra toast, registra
  trace de passos. Senão, navega direto pelo PrototypeLink. Esc fecha;
  histórico de navegação com voltar.

---

## 11. Camada Lógico

### 11.1 Modelo de UX (decisões refinadas em uso real)

1. **Toggle no header**: `Conceitual | Lógico` (Lógico desabilitado sem conteúdo).
2. **Ativar o Lógico** (`activateLogicLayer`): para cada PrototypeLink único
   (dedupe por `fromScreenId::triggerNodeId`) roda `expandInteraction`;
   posiciona os nós ao longo das noodles; telas ficam dimmed (overlay
   `artboard--dimmed`; a tela selecionada fica `--logic-active`).
3. **Nós como círculos** (não cards): 40px de diâmetro, fundo escuro
   `#1e1a28`, borda roxa, **ícone SVG por kind** (validate=check,
   apiCall=setas, branch=ramificação, setState=chip, showMessage=balão,
   navigate=seta). Tooltip = `kind · nome (fluxo)`. Hit area 48px.
   Nós `onPath` NÃO são arrastáveis (posição vem da curva);
   nós side/off-path têm drag + handle `+` para conectar.
4. **Realce segue o frame selecionado**: sem seleção → tudo igual;
   frame selecionado → linhas/nós ligados a ele ficam `is-related` (hot),
   resto `is-dimmed`. NÃO usar o workflow do drawer para dimar o mapa
   (isso causava "só aparece quando clica").
5. **Clique na linha** (`selectLogicLink`):
   - destaca a linha (`is-path-selected`: stroke 4, glow), dima as outras;
   - seleciona também o **frame de origem** (mesmo efeito de clicar nele);
   - garante Interaction (expandInteraction se preciso);
   - abre o drawer no modo **"Passos do caminho"**: lista ordenada
     (`classifyWorkflowPathNodes().onPath`) com índice numerado + ícone,
     clique num passo edita, botão "+ Adicionar passo" abre o catálogo.
   - **Não** há zoom/isolamento das duas telas (houve e foi removido — o
     overview permanece).
6. **Adicionar passo**: pelo drawer (catálogo, esconde `navigate` no pathMode);
   internamente chama `insertLogicOnPrototype(linkId, kind)` que usa
   `insertStepOnMainPath` + `relayoutWorkflowOnPrototype`.
7. **Limpar foco**: Esc OU clique no fundo do canvas limpam nó/linha
   selecionados (cascata de Esc definida em §9.4). Clicar num frame também
   limpa o foco isolado de nó/linha (via `selectScreenWithLogic`).
8. **Menus flutuantes** (add-menu no canvas): fecham com Esc e clique fora
   (listeners em capture no window).

### 11.2 Implementação

- **`LogicLayerOverlay.jsx`**: recebe `graphs` (derivados de
  `domain.workflows` + views + interactions), `screens` (com posição live de
  gesto), `prototypes`, seleções. Calcula:
  - `positions`: nós com link → `samplePointsAlongPrototypeLink(screens, link, onPath.length)`
    centrados (`p.x - NODE_R`); nós side → offset abaixo do vizinho; sem link →
    posições de `domainViews`.
  - `axes`: uma bezier por graph com link (`getPrototypeLinkEndpoints` +
    `bezierPath`), com hit path invisível de 18px de stroke.
  - `noodles`: arestas laterais (`when === 'error'`) + fluxos sem protótipo.
- **`WorkflowEditor.jsx`** (drawer `.logic-drawer`): 3 modos —
  `showPathOverview` (pathMode sem nó selecionado), `showCatalog` (busca +
  catálogo por categoria), `showParams` (edição por kind: simulate,
  apiId+method+path, toScreenId+transition, message, key/value; remover passo
  religa as arestas pred→succ).
- **EditorView**: estados `editorLayer`, `selectedLogicNodeId`,
  `selectedLogicLinkId`, `editingInteractionId`; callbacks `selectLogicLink`,
  `insertLogicOnPrototype`, `addLogicNode`, `moveLogicNode`,
  `connectLogicNodes`, `updateWorkflow`, `updateDomainApi`,
  `clearLogicFocus`, `selectScreenWithLogic`, `clearSelectionWithLogic`.
- PropertiesPanel fica oculto na camada Lógico.

---

## 12. Sincronização, histórico e conflitos

```
SAVE:   mutação → PUT { board, expectedRevision: knownRevision }
        409 → dialog de conflito (dirty permanece; sync pausado)
        200 → knownRevision atualizado, dirty=false, thumb agendada (900ms)

POLL:   1,5s GET /revision + SSE /events
        se !dirty && !inFlight && !pan && rev != known → GET board → applyRemoteBoard
        (só aplica se remoteRev > known; filtra seleção inválida)

CONFLITO (3 opções):
        Manter local  → knownRevision = remota, re-PUT do local
        Aceitar remoto → aplica remoteBoard, limpa dirty
        Tentar de novo → reconsulta /revision e retry
```

Modelo mental: otimista local + CAS explícito. Durante edição suja, o remoto
**nunca** sobrescreve. Não há merge automático.

Undo/redo: snapshot completo do board (structuredClone) — simples e correto
para boards deste tamanho; cap de 50 entradas; novo push limpa a pilha redo.

---

## 13. Export, thumbnails e smart guides

- **exporters.js**: PNG via `html-to-image` (filtra chrome de edição);
  CSS/JSX via `screenToCss/screenToReact` do core → download.
- **thumbnailCapture.jsx**: host offscreen 560×336 → renderiza
  `BoardPreviewCanvas` (máx. 8 telas) → `toPng` (pixelRatio 2) →
  `POST /thumb`. Disparada após save (debounce) e pela home se thumb 404.
- **smartGuides.js**: `SNAP_THRESHOLD = 6`; `collectAlignTargets` (bordas e
  centros do frame + folhas visíveis); `snapDrag`/`snapResize` retornam
  `{dx, dy, guides}`; `renderGuidesOverlay` desenha linhas direto no DOM
  (sem React). Desligado quando o nó tem rotação.

---

## 14. Setup de desenvolvimento

```bash
cd figmashow
npm install
npm run web        # Vite em http://localhost:5177 (API embutida via middleware)
npm test           # node --test packages/core/src/*.test.js
npm run test:e2e   # Playwright (porta 18080, data em tmp)
npm run build      # vite build → apps/web/dist
npm start          # Express prod em :8080 (precisa do dist)
npm run backup     # tar de ./data em backups/
```

Em dev, o `vite.config.js` tem um plugin custom `figmashow-board-api` que:
monta `createBoardApiHandler('../../data')` em `/api/*`, serve `/assets/*` de
`data/assets` (com proteção path traversal) e faz `fs.watch` no dataDir.

| Env | Uso |
|-----|-----|
| `FIGMASHOW_DATA` | pasta de dados (default `./data`; Docker `/data`) |
| `FIGMASHOW_API_URL` | SÓ no cliente MCP (modo remoto); nunca no container |
| `BASIC_AUTH_USER/PASS` | auth opcional; obrigatória p/ `/mcp` em prod |
| `PORT` / `MAX_BODY_BYTES` | server (8080 / 10 MB) |
| `MCP_ALLOW_INSECURE=1` | `/mcp` sem auth (só local) |

---

## 15. Build, Docker e deploy no Coolify

### Dockerfile (multi-stage, node:20-alpine)

```dockerfile
# stage build: copia package.json de todos os workspaces → npm ci (cache),
# copia fontes → RUN npm run build -w @figmashow/web
# stage runtime: NODE_ENV=production, PORT=8080, FIGMASHOW_DATA=/data
# copia node_modules + core + mcp + server + apps/web/{package.json,api-handler.js,dist}
# mkdir /data, EXPOSE 8080
# HEALTHCHECK 30s: node fetch http://127.0.0.1:8080/api/health
# CMD ["node", "apps/server/server.js"]
```

`.dockerignore` exclui `node_modules`, `dist`, `.git`, **`data`**, `*.md`,
**`scripts`** — dados e seeds não entram na imagem.

### Coolify

1. Application → Build Pack **Dockerfile**, base directory **`figmashow`**, porta **8080**.
2. **Volume persistente** `figmashow-data` → `/data` (obrigatório — sem ele os
   dados morrem a cada deploy).
3. Domínio + TLS via Traefik/Let's Encrypt.
4. Envs: `BASIC_AUTH_USER/PASS` (recomendado). **Não** setar `FIGMASHOW_API_URL`.
5. Seed inicial: copiar `data/` local para o volume.
6. Health: `GET /api/health` responde sem auth.
7. Deploy = commit + push no repo conectado → Coolify rebuilda.

---

## 16. Testes e smokes

- **Unit** (`npm test`): schema, board, cas, operations, components,
  constraints, projects, export, preview, domain, framePresets, api-handler.
  Não cobertos dedicadamente: events, prototypePath isolado,
  insertLogicStepOnPrototype, migração legada completa.
- **E2E Playwright** (`e2e/smoke.spec.js`, server próprio na 18080 com data
  tmp): home→criar→abrir→reload→trash; operations add_node; PUT 409;
  create/restore version; ferramenta Quadro (create_screen 1440×1024 + move).
- **Smokes**: `smoke-docker` (server tmp + health + SPA), `smoke-mcp-http`
  (initialize → tools/list → tools/call), `smoke-logic-core` (domínio em
  memória), `smoke-mcp-logic-board` (ensure + insert local),
  `smoke-remote-logic` (mesmo via API remota).

---

## 17. Scripts utilitários e seeds

| Script | Função |
|--------|--------|
| `backup-data.mjs` | tar de FIGMASHOW_DATA em `backups/` |
| `e2e-server.mjs` | server 18080 com data tmp para Playwright |
| `shared.mjs` / `tokens.mjs` | helpers de layout mobile + paleta soft blue |
| `build-natalia.mjs` | seed demo "Natalia Farias — Psicologia": 6 telas, componentes, protótipos |
| `mcp-enrich-natalia.mjs` | pós-seed: variantes, links, comments + export CSS/JSX para `exports/` |
| `organize-natalia.mjs` | agrupa nós por seção estilo Figma |
| `rebuild-*.mjs` (casa, mercado, contas, chat, perfil, config, admin, nova-tarefa) | telas do app Casoiko — **escrevem no `board.json` legado** |
| `apply-pinterest-palette` / `apply-floating-nav` / `replace-emojis-with-icons` | migrações visuais em lote |

---

## 18. Configuração MCP no Cursor e Claude

### Cursor — local (disco)

```json
"figmashow": {
  "command": "node",
  "args": ["C:/caminho/figmashow/bin/mcp.mjs"],
  "env": { "FIGMASHOW_DATA": "C:/caminho/figmashow/data" }
}
```

### Cursor — remoto (VPS)

```json
"figmashow": {
  "command": "node",
  "args": ["C:/caminho/figmashow/bin/mcp.mjs"],
  "env": {
    "FIGMASHOW_API_URL": "https://figma.seudominio.com",
    "BASIC_AUTH_USER": "user",
    "BASIC_AUTH_PASS": "senha",
    "FIGMASHOW_API_TIMEOUT_MS": "30000"
  }
}
```

Fluxo obrigatório em remoto: `list_projects` → `open_project` (pina o projeto
na sessão) → editar.

### Claude.ai

Connectors → URL `https://dominio/mcp` + header
`Authorization: Basic base64(user:pass)`. Validar com
`npm run smoke:mcp -- https://dominio`.

---

## 19. Ordem recomendada de reconstrução

1. **Core parte 1 — schema**: Board/Screen/Node + árvore absoluta + normalização
   + `cryptoRandomId`. Testes desde o início (`node --test`).
2. **Core parte 2 — persistência**: `atomic` → `mutex` → `board` (CAS) →
   `paths` → `projects` (index/active/migração).
3. **Core parte 3 — domínio**: `domain` + `prototypePath` (Interaction/Workflow,
   classify/insert/simulate, bezier/amostragem).
4. **Core parte 4**: `components`, `operations`, `autoLayout`, `framePresets`,
   `export`, `events`. Barrel `index.js` + subpath exports.
5. **API**: `api-handler.js` (todas as rotas §7.1) + `apps/server` (§7.2).
6. **Web parte 1**: scaffold Vite+Router, plugin de API no dev server,
   hooks (`useSelection`, `useHistory`, `useBoardSync`), HomePage CRUD.
7. **Web parte 2**: `boardNodeView` → `PhoneFrame` (edição básica) →
   `InfiniteCanvas` (câmera rAF + frames) → LayersPanel/PropertiesPanel/ToolsBar.
8. **Web parte 3**: Protótipo (overlay + popup + preview com simulação).
9. **Web parte 4**: Lógico (overlay círculos + drawer + seleção de linha,
   seguindo as regras de UX do §11.1).
10. **MCP**: `createServer` com as 48 tools + stdio + remote + httpMount +
    `bin/mcp.mjs`.
11. **Infra**: Dockerfile, healthcheck, Coolify com volume `/data`,
    Playwright E2E, smokes.

---

## 20. Armadilhas conhecidas

### 20.1 Import do barrel no browser (quebrou o deploy)

`@figmashow/core` (barrel `index.js`) inclui módulos Node-only (`paths.js` usa
`fileURLToPath`, `node:fs`…). Se qualquer arquivo do `apps/web` importar do
barrel, o `vite build` falha com:

```
"fileURLToPath" is not exported by "__vite-browser-external"
```

**Regra**: no browser, importar SEMPRE dos subpaths —
`@figmashow/core/schema`, `@figmashow/core/domain`, `@figmashow/core/components`, etc.

### 20.2 `FIGMASHOW_API_URL` no container

Se essa env vazar para o processo do `apps/server`, o MCP HTTP in-process
chama a própria API em loop. O server já se defende apagando a env no boot —
manter esse comportamento.

### 20.3 Volume `/data` no Coolify

Sem o volume persistente, cada deploy zera projetos. `.dockerignore` exclui
`data/` de propósito.

### 20.4 CAS obrigatório

`PUT`/`operations`/`versions` sem `expectedRevision` são rejeitados (exceto
first-write). Clientes precisam tratar 409: MCP remoto retry 1x; UI dialog.

### 20.5 stdout do MCP stdio

No transporte stdio, stdout é o protocolo. Qualquer `console.log` no caminho
quebra o handshake — logs sempre em stderr.

### 20.6 Coordenadas absolutas

Filhos de group/component ficam em coordenadas absolutas da tela. Mover um
group = `shiftNodeTree` em toda a subárvore. Recalcular bounds do group ao
mudar filhos (`refreshGroupBounds`).

### 20.7 Camada Lógico — lições de UX

- Não dimar o mapa pelo workflow aberto no drawer (parece bug de visibilidade).
- Realce sempre pelo frame selecionado; sem seleção, tudo igual.
- Nós no caminho não são arrastáveis (posição derivada da curva).
- Clique na linha não deve dar zoom/isolar telas (foi implementado e removido);
  deve selecionar a linha + frame de origem e abrir a lista ordenada de passos.
- Esc e clique fora limpam o foco; menus flutuantes fecham com Esc/clique fora.

### 20.8 Export PNG

`runExport('png')` depende de `canvasRef.getScreenElement(screenId)`, que o
`useImperativeHandle` do InfiniteCanvas não expõe hoje — implementar ao
reconstruir (ex.: query `.phone` dentro do artboard).

### 20.9 Undo por snapshot

Undo/redo clona o board inteiro (structuredClone). Funciona bem no tamanho
atual; se os boards crescerem muito, trocar por patches/inverse-ops.

### 20.10 Scripts legados

Os `rebuild-*.mjs` escrevem no `board.json` single-board (legado). O runtime é
multi-projeto — esses scripts precisariam de adaptação para
`projects/{id}.json` se forem reaproveitados.
