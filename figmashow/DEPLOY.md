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
| `BASIC_AUTH_USER` | `rafa` | Sim (recomendado) |
| `BASIC_AUTH_PASS` | senha forte | Sim (recomendado) |
| `PORT` | `8080` | Não (default 8080) |
| `FIGMASHOW_DATA` | `/data` | Não (default no Docker) |

Sem `BASIC_AUTH_*` a app sobe **pública** (só quem tiver o link). O servidor loga um aviso.

## 4. Domínio e TLS

1. Em **Domains**, adicione p.ex. `figmashow.seudominio.com`
2. Deixe o Coolify/Traefik emitir o certificado Let's Encrypt
3. Force HTTPS

## 5. Healthcheck

Rota pública (sem Basic Auth):

```
GET /api/health  →  { "ok": true, "service": "figmashow" }
```

O Dockerfile já aponta o HEALTHCHECK para essa rota. No Coolify, use o mesmo path se configurar healthcheck manual.

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

- Com `FIGMASHOW_API_URL`, o MCP edita o board **remoto** via HTTP.
- Sem essa env, o MCP continua no modo local (`FIGMASHOW_DATA`).

Reinicie o MCP no Cursor após salvar.

## 8. Checklist pós-deploy

- [ ] HTTPS abre e pede Basic Auth
- [ ] Login com as credenciais funciona
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
| 401 em tudo (incluindo health) | Basic Auth ativo — esperado |
| MCP não vê projetos remotos | `FIGMASHOW_API_URL` ausente ou URL/credenciais erradas |
| CORS / rede | Front e API são same-origin; não precisa CORS |
