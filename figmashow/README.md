# FigmaShow

Editor local de telas mobile + **MCP** para o Cursor. Sem Figma Pro, sem VPS no MVP.

## O que tem

- `data/board.json` — documento das telas
- `packages/core` — schema + leitura/gravação
- `packages/mcp` — servidor MCP (stdio)
- `apps/web` — preview React (poll a cada 500ms)

## Requisitos

- Node.js 18+

## Setup

```bash
cd figmashow
npm install
```

### Preview web

```bash
npm run web
```

Abre em [http://localhost:5177](http://localhost:5177).

Canvas estilo Figma: telas lado a lado, **pan** (scroll / espaço+arrastar / botão mão / botão do meio) e **zoom** (Ctrl/Cmd + scroll). Botão **Ajustar** enquadra todas as telas.

### MCP no Cursor

Adicione em `%USERPROFILE%\.cursor\mcp.json` (Windows):

```json
"figmashow": {
  "command": "node",
  "args": [
    "C:/Users/rafae/AndroidStudioProjects/aplicativoCasa/figmashow/bin/mcp.mjs"
  ],
  "env": {
    "FIGMASHOW_BOARD": "C:/Users/rafae/AndroidStudioProjects/aplicativoCasa/figmashow/data/board.json"
  }
}
```

Reinicie o MCP / o Cursor. Tools disponíveis:

| Tool | Descrição |
|------|-----------|
| `list_screens` | Lista telas |
| `get_screen` | JSON de uma tela |
| `create_screen` | Nova tela 390×844 |
| `add_node` | rect / text / button |
| `update_node` | Patch de props |
| `delete_node` | Remove nó |
| `clear_screen` | Esvazia a tela |

## Fluxo

1. `npm run web` — deixa o preview aberto
2. No chat do Cursor, peça para criar/editar um nó via FigmaShow MCP
3. O phone frame atualiza sozinho

## Tokens Casoiko (preview soft blue)

- Primary: `#3B82F6`
- Primary dark / mid: `#2563EB` / `#60A5FA`
- Background app: `#EEF5FC`
- Texto: `#1E293B`
