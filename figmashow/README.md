# FigmaShow

Editor local de telas mobile + **MCP** para o Cursor. Sem Figma Pro, sem VPS.

## O que tem

- `data/board.json` — documento das telas (`revision` sobe a cada gravação)
- `packages/core` — schema + leitura/gravação + testes
- `packages/mcp` — servidor MCP (stdio)
- `apps/web` — editor React (seleção, move, resize, create, props, camadas)

## Requisitos

- Node.js 18+

## Setup

```bash
cd figmashow
npm install
```

### Preview / editor

```bash
npm run web
```

Abre em [http://localhost:5177](http://localhost:5177) — **página inicial** com projetos recentes; clique em um arquivo ou em **Design file** para abrir o editor.

### Projetos

- `data/index.json` — catálogo (nome, datas, lixeira)
- `data/projects/{id}.json` — board de cada projeto
- `data/active.json` — projeto aberto no editor / MCP
- Na primeira execução, `data/board.json` legado é migrado automaticamente para um projeto

### Testes do core

```bash
npm test
```

### Atalhos principais

| Atalho | Ação |
|--------|------|
| V | Ferramenta mover |
| H | Mão (pan) |
| R | Criar retângulo (click/arraste no frame) |
| T | Criar texto |
| B | Criar botão |
| I | Criar imagem |
| F4 | Focar a tela selecionada |
| Esc | Sair da tool create / limpar seleção |
| Duplo clique (texto) | Editar texto no canvas |
| Shift+clique | Multi-seleção |
| Ctrl+clique | Seleção profunda |
| Delete / Backspace | Apagar |
| Setas / Shift+setas | Nudge |
| Ctrl+G / Ctrl+U | Agrupar / desagrupar |
| Ctrl+D | Duplicar |
| Ctrl+C / Ctrl+V | Copiar / colar |
| Ctrl+Z / Ctrl+Y | Desfazer / refazer |

O poll só aplica mudanças do disco se a `revision` remota avançou e o editor **não** tem edição local pendente (`dirty`).

### MCP no Cursor

Adicione em `%USERPROFILE%\.cursor\mcp.json` (Windows), ajustando o path:

```json
"figmashow": {
  "command": "node",
  "args": [
    "C:/wamp64/www/_ideias/figmashow/bin/mcp.mjs"
  ],
  "env": {
    "FIGMASHOW_DATA": "C:/wamp64/www/_ideias/figmashow/data"
  }
}
```

O MCP edita o **projeto ativo** (`data/active.json`), definido ao abrir um arquivo no editor ou via `open_project`.

**Recomendado:** use `FIGMASHOW_DATA` apontando para `figmashow/data`.

**Evite** definir `FIGMASHOW_BOARD` junto com multi-projeto — o MCP avisa em `mcpHints` se detectar conflito. Com multi-projeto, o board ativo vem de `data/active.json` + `data/projects/{id}.json`.

Reinicie o MCP / o Cursor. Tools disponíveis:

| Tool | Descrição |
|------|-----------|
| `list_projects` | Lista design files; indica o projeto **ativo** |
| `create_project` | Novo design file + torna ativo |
| `open_project` | Troca o projeto ativo para edição via MCP |
| `list_screens` | Lista telas |
| `get_screen` | JSON completo de uma tela |
| `list_nodes` | Árvore resumida (id, type, name, box) |
| `create_screen` | Nova tela 390×844 |
| `update_screen` | Nome / tamanho / fundo (W/H aplica constraints) |
| `add_node` | rect / text / button / image / group (`parentId` = group ou component) |
| `update_node` | Patch de props (+ sync de componentes) |
| `batch_update` | Vários patches numa revision |
| `duplicate_node` | Duplica nó; **principal → instância** |
| `group_nodes` | Agrupa irmãos |
| `move_node` | dx/dy, reparent (group/component), z-order |
| `delete_node` | Remove nó |
| `clear_screen` | Esvazia a tela |
| `set_constraints` | Pins L/R/T/B em nó raiz |
| `list_components` | Lista defs na biblioteca |
| `create_component` | Seleção → **principal no canvas** + def |
| `add_component_variant` | Nova variante |
| `instantiate_component` | Insere instância |
| `set_instance_variant` | Troca variante da instância |
| `detach_instance` | Desanexa em árvore editável |
| `add_prototype_link` / `delete_prototype_link` | Links de protótipo |
| `list_comments` / `add_comment` / `resolve_comment` | Comentários |
| `export_screen_css` / `export_screen_react` | Export texto (PNG só na UI) |

**Componentes (igual à UI):** criar deixa o `type: component` (principal) editável no canvas; duplicar o principal gera `instance`; editar o principal sincroniza cor, radius, tamanho etc. nas instâncias. A resposta de `create_component` inclui `mainNodeId` e `idMap` — use `mainNodeId` em `add_prototype_link`.

### Gotchas do MCP (para agentes)

| Situação | O que fazer |
|----------|-------------|
| `group_nodes` falha | Nós precisam ser **irmãos** (mesmo pai). Erro lista onde cada ID está. Use `move_node` com `parentId=null` ou o id do grupo alvo. |
| `set_constraints` falha | Só funciona em nós **na raiz da tela**. `move_node` com `parentId=null` antes de agrupar. |
| `move_node` / reparent | Grupos vazios são **removidos automaticamente** após tirar o último filho. |
| Hero com base arredondada | `add_node` type=rect aceita `bottomRadius` (não só `update_node`). |
| Depois de `create_component` | Protótipo deve usar `mainNodeId` da resposta, não o id do botão original. |
| Projeto errado no MCP | Prefira `FIGMASHOW_DATA`; veja `mcpHints` em `list_projects` / `open_project`. |

## Fluxo

1. `npm run web` — abre a **home** com projetos recentes
2. **Design file** cria um projeto; clique no card para abrir o editor
3. Edite no canvas **ou** peça mudanças via MCP no Cursor (projeto ativo)
4. **← Projetos** no editor volta à home; status “Atualizado do disco” quando o MCP grava

## Como montar uma tela Casoiko (prompt para o agente)

Use este fluxo no Cursor com o MCP FigmaShow ativo e o editor web aberto:

0. `list_projects` — veja projetos; `create_project` ou `open_project` para escolher o arquivo ativo.
1. `list_screens` — veja se já existe uma tela; senão `create_screen` com nome ex. `"Login"`.
2. `list_nodes` na tela — inspecione a árvore **antes** de editar (evite `get_screen` no início; é pesado).
3. Monte de cima para baixo com `add_node`:
   - Header/imagem: `type=image`, `src` em `/assets/…`, `fit=cover`
   - Blocos: `type=rect` com `fill` soft blue (`#EEF5FC` / `#93C5FD`) e `cornerRadius`
   - Textos: `type=text`, `color=#1E293B`, pesos 400/600
   - CTAs: `type=button`, `fill=#3B82F6`, `textColor=#FFFFFF`, `cornerRadius` ~12–27
4. Agrupe seções relacionadas com `group_nodes` (só irmãos).
5. Ajuste posição/tamanho com `batch_update` (vários patches de uma vez) ou `move_node`.
6. Confira no editor: poll deve mostrar “Atualizado do disco”.

### Tokens Casoiko (preview soft blue)

- Primary: `#3B82F6`
- Primary dark / mid: `#2563EB` / `#60A5FA`
- Background app: `#EEF5FC`
- Texto: `#1E293B`

### Exemplo mínimo (login)

```
create_screen name="Login Casoiko"
add_node rect banner 0,0 390×280 fill=#3B82F6
add_node text título ~36,320 "Entrar" fontSize=28 fontWeight=700
add_node button CTA ~36,520 318×54 label="Continuar" fill=#3B82F6
group_nodes dos blocos de formulário
list_nodes para validar a árvore
```
