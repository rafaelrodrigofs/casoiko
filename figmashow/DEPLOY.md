# Deploy FigmaShow no Coolify

Guia para publicar o FigmaShow numa VPS com Coolify (Docker + volume + Basic Auth + TLS).

## Pré-requisitos

- Coolify instalado na VPS
- Domínio apontando para o IP da VPS (A/AAAA)
- Repositório git com a pasta `figmashow/` (Dockerfile na raiz do contexto)

## 1. Criar a aplicação no Coolify

1. **New Resource** → **Application**
2. Conecte o repositório Git
3. **Build Pack**: Dockerfile
4. **Base Directory / Docker Context**: `figmashow`
5. **Dockerfile Location**: `Dockerfile` (relativo ao contexto)
6. **Port**: `8080`

## 2. Volume persistente (obrigatório)

Sem volume, os projetos somem a cada deploy.

| Mount | Path no container |
|-------|-------------------|
| volume `figmashow-data` | `/data` |

A app usa `FIGMASHOW_DATA=/data` (já definido no Dockerfile).

### Seed opcional (dados locais)

Se quiser começar com os projetos que já tem no PC:

```bash
# na VPS, com o volume montado ou via coolify exec
# copie o conteúdo de figmashow/data/ (index.json, active.json, projects/, thumbs/)
```

Ou faça upload/rsync do diretório `figmashow/data/` para o volume antes do primeiro acesso.

## 3. Variáveis de ambiente

| Nome | Exemplo | Obrigatório |
|------|---------|-------------|
| `BASIC_AUTH_USER` | `rafa` | Não (opcional) |
| `BASIC_AUTH_PASS` | senha forte | Não (opcional) |
| `PORT` | `8080` | Não (default 8080) |
| `FIGMASHOW_DATA` | `/data` | Não (default no Docker) |
| `MAX_BODY_BYTES` | `10485760` | Não (default 10 MiB) |
| `NODE_ENV` | `production` | Sim no Docker (já no Dockerfile) |

Sem `BASIC_AUTH_*` a app sobe **pública** (aviso no log). Defina as duas variáveis quando quiser proteger o acesso.

## 4. Domínio e TLS

1. Em **Domains**, adicione p.ex. `figmashow.seudominio.com`
2. Deixe o Coolify/Traefik emitir o certificado Let's Encrypt
3. Force HTTPS

## 5. Healthcheck

Rota **sem** Basic Auth (para Docker/Coolify):

```
GET /api/health  →  { "ok": true, "service": "figmashow" }
```

O Dockerfile já usa esse path no `HEALTHCHECK`. No Coolify, se configurar manualmente, use `/api/health` na porta **8080** — **não** exige autenticação (diferente das rotas `/api/*` de dados).

## 6. Deploy

1. Commit + push das mudanças (Dockerfile, server, etc.)
2. No Coolify: **Deploy**
3. Abra o domínio → o browser pede usuário/senha
4. Crie um projeto, recarregue a página → deve persistir
5. Redeploy → os dados em `/data` devem continuar

## 7. MCP local apontando para a VPS

No `mcp.json` do Cursor (Settings → MCP):

```json
{
  "mcpServers": {
    "figmashow": {
      "command": "node",
      "args": [
        "C:/Users/rafae/AndroidStudioProjects/aplicativoCasa/figmashow/bin/mcp.mjs"
      ],
      "env": {
        "FIGMASHOW_API_URL": "https://figmashow.seudominio.com",
        "BASIC_AUTH_USER": "rafa",
        "BASIC_AUTH_PASS": "sua-senha"
      }
    }
  }
}
```

- Com `FIGMASHOW_API_URL`, o MCP edita o board **remoto** via HTTP (projeto fixado após `open_project`).
- Timeout padrão: 30s (`FIGMASHOW_API_TIMEOUT_MS`).
- Sem essa env, o MCP continua no modo local (`FIGMASHOW_DATA`).

Reinicie o MCP no Cursor após salvar.

## 8. Checklist pós-deploy

- [ ] HTTPS abre a home
- [ ] (Opcional) Com BASIC_AUTH_* definido, o browser pede usuário/senha
- [ ] Login com as credenciais funciona (se auth ativo)
- [ ] Criar/abrir projeto na UI
- [ ] Recarregar: projeto ainda existe
- [ ] Redeploy Coolify: dados intactos
- [ ] MCP: `list_projects` retorna projetos da VPS
- [ ] MCP: `create_screen` / `add_node` aparecem na UI remota

## Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| UI carrega, API 404 | Context/Dockerfile errado; dist não gerado |
| Projetos somem após deploy | Volume `/data` não montado |
| 401 em `/api/projects` etc. | Basic Auth — use credenciais; `/api/health` não pede auth |
| 409 ao salvar (UI/MCP) | Conflito de `revision` — recarregue / `open_project` e repita |
| MCP não vê projetos remotos | `FIGMASHOW_API_URL` ausente ou URL/credenciais erradas |
| CORS / rede | Front e API são same-origin; não precisa CORS |

## Backup e restore de `/data`

### Backup

```bash
cd figmashow
FIGMASHOW_DATA=./data npm run backup
# gera backups/figmashow-data-<timestamp>.tar
```

Na VPS (volume `/data`):

```bash
tar -cf /tmp/figmashow-data.tar -C /data .
```

### Restore

1. Pare a app
2. Esvazie `/data` (ou monte volume novo)
3. `tar -xf figmashow-data.tar -C /data`
4. Suba a app e valide `GET /api/projects`

### Segurança (decisões 1.0.1)

- Basic Auth é **opcional** (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`).
- Container roda como root (compatível com volume Coolify).
- MCP remoto reutiliza a mesma Basic Auth no cliente.
