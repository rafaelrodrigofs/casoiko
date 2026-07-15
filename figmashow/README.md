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

Abre em [http://localhost:5177](http://localhost:5177).

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
    "FIGMASHOW_BOARD": "C:/wamp64/www/_ideias/figmashow/data/board.json"
  }
}
```

Reinicie o MCP / o Cursor. Tools disponíveis:

| Tool | Descrição |
|------|-----------|
| `list_screens` | Lista telas |
| `get_screen` | JSON de uma tela |
| `create_screen` | Nova tela 390×844 |
| `add_node` | rect / text / button / image / group (`parentId` opcional) |
| `update_node` | Patch de props |
| `delete_node` | Remove nó |
| `clear_screen` | Esvazia a tela |

## Fluxo

1. `npm run web` — deixa o editor aberto
2. Edite no canvas **ou** peça mudanças via MCP no Cursor
3. Status “Atualizado do disco” aparece quando o MCP grava o board

## Tokens Casoiko (preview soft blue)

- Primary: `#3B82F6`
- Primary dark / mid: `#2563EB` / `#60A5FA`
- Background app: `#EEF5FC`
- Texto: `#1E293B`
