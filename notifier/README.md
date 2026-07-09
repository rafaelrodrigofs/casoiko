# Casoiko Notifier + API de mídia

Serviço no VPS que:

- envia **push (FCM)** quando chega mensagem, item no mercado ou tarefa concluída
- recebe **upload de fotos do chat** (`POST /api/chat/upload`) e serve em `/uploads/...`

Roda como container Docker no VPS, **sem plano Blaze** do Firebase.

## 1. Chave de conta de serviço

No Firebase Console: **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.

Salve no VPS como:

```
/root/service-account.json
```
(or `/opt/casoiko/service-account.json` — use o caminho real no VPS)

## 2. DNS (HTTPS)

Crie um registro **A** apontando para o IP do VPS, por exemplo:

```
api.seudominio.com  →  31.97.255.115
```

Use esse domínio em `PUBLIC_BASE_URL` e no app (`media_api_config.dart`).

## 3. Build da imagem

Copie a pasta `notifier/` para o VPS:

```bash
scp -r notifier/ root@SEU_VPS:~/notifier
```

No VPS:

```bash
cd ~/notifier
docker build -t casoiko-notifier .
```

## 4. Rodar o container

```bash
mkdir -p /var/casoiko/uploads

docker run -d \
  --name casoiko-notifier \
  --restart unless-stopped \
  -p 127.0.0.1:3000:3000 \
  -e PUBLIC_BASE_URL=https://api.SEU_DOMINIO \
  -v /opt/casoiko/service-account.json:/app/service-account.json:ro \
  -v /var/casoiko/uploads:/data/uploads \
  casoiko-notifier
```

## 5. HTTPS com nginx

Exemplo `/etc/nginx/sites-available/casoiko-api`:

```nginx
server {
  server_name api.SEU_DOMINIO;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 6M;
  }
}
```

Ative o site e gere certificado:

```bash
sudo ln -s /etc/nginx/sites-available/casoiko-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.SEU_DOMINIO
```

Libere as portas **80** e **443** no firewall se necessário.

## 6. Ver logs

```bash
docker logs -f casoiko-notifier
```

Deve aparecer:

```
HTTP escutando na porta 3000
Casoiko Notifier iniciado.
Escutando colecao: messages
Escutando colecao: market_items
Escutando colecao: task_checks
```

## 7. Teste rápido

```bash
curl https://api.SEU_DOMINIO/
# {"ok":true,"service":"casoiko-notifier"}
```

Upload exige token Firebase no app; teste completo pelo celular após ajustar o domínio no Flutter.

## API de upload

`POST /api/chat/upload`

| Campo | Onde |
|-------|------|
| `Authorization` | Header: `Bearer <firebase_id_token>` |
| `image` | Arquivo multipart (JPEG/PNG, máx. 5 MB) |
| `house_id` | Campo do formulário |

Resposta: `{ "url": "https://api.SEU_DOMINIO/uploads/chat/..." }`

## Atualizar após mudanças no código

```bash
cd ~/notifier
docker build -t casoiko-notifier .
docker stop casoiko-notifier && docker rm casoiko-notifier
# rodar docker run novamente (mesmo comando da seção 4)
```

## Observações

- `PUBLIC_BASE_URL` **obrigatória** para gerar URLs públicas das fotos.
- Uploads ficam em `/var/casoiko/uploads` no host (volume Docker).
- Push continua data-only; mensagens de imagem enviam texto `Foto` no FCM.
- Excluir mensagem no app remove só o Firestore; arquivo no disco permanece (limpeza futura).
