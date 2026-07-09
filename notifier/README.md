# Casoiko Notifier

Serviço que escuta o Firestore e envia push (FCM) para os moradores da casa quando:

- chega uma nova mensagem no chat (`messages`)
- alguém adiciona um item no mercado (`market_items`)
- alguém conclui uma tarefa (`task_checks`)

Roda como container Docker no VPS, sem custo do plano Blaze.

## 1. Chave de conta de serviço

No Firebase Console: **Configurações do projeto → Contas de serviço → Gerar nova chave privada**.

Isso baixa um JSON. Ele é secreto — não versionar. No VPS, salve como, por exemplo:

```
/opt/casoiko/service-account.json
```

## 2. Build da imagem

Copie a pasta `notifier/` para o VPS e rode:

```bash
cd notifier
docker build -t casoiko-notifier .
```

## 3. Rodar o container

```bash
docker run -d \
  --name casoiko-notifier \
  --restart unless-stopped \
  -v /opt/casoiko/service-account.json:/app/service-account.json:ro \
  casoiko-notifier
```

## 4. Ver logs

```bash
docker logs -f casoiko-notifier
```

Deve aparecer:

```
Casoiko Notifier iniciado.
Escutando colecao: messages
Escutando colecao: market_items
Escutando colecao: task_checks
```

## Como funciona

- O serviço só reage a eventos que acontecem **depois** que ele sobe (ignora dados antigos).
- Para cada evento, busca os moradores da casa (`users` com o mesmo `house_id`), pega os `fcm_tokens` de todos menos o autor e envia a notificação.
- Tokens inválidos (app desinstalado etc.) são removidos automaticamente do Firestore.

## Observações

- Requer que o app salve `fcm_tokens` em `users/{uid}` (já implementado no `PushService` do app).
- Se você mudar as regras do Firestore, garanta que a conta de serviço continua com acesso (a conta de serviço ignora as regras de segurança por padrão).
