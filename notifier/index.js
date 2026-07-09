'use strict';

/**
 * Casoiko Notifier
 *
 * Escuta o Firestore e envia push (FCM) para os moradores da casa quando:
 *  - chega uma nova mensagem no chat (`messages`)
 *  - alguem adiciona um item no mercado (`market_items`)
 *  - alguem conclui uma tarefa (`task_checks`)
 *
 * Roda como container no VPS, usando uma chave de conta de servico do Firebase.
 */

const admin = require('firebase-admin');

// -------------------------------------------------------------------------
// Inicializacao
// -------------------------------------------------------------------------

// A credencial vem de GOOGLE_APPLICATION_CREDENTIALS (caminho do JSON) ou do
// arquivo padrao montado em /app/service-account.json.
const credentialPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || '/app/service-account.json';

admin.initializeApp({
  credential: admin.credential.cert(require(credentialPath)),
});

const db = admin.firestore();
const messaging = admin.messaging();

// So reage a eventos que acontecem depois que o servico sobe.
const startedAt = Date.now();

// Evita processar o mesmo documento duas vezes (serverTimestamp resolve em 2 etapas).
const processed = {
  messages: new Set(),
  market_items: new Set(),
  task_checks: new Set(),
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function millisOf(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

/**
 * Coleta os tokens FCM dos moradores da casa, exceto o autor do evento.
 */
async function recipientTokens(houseId, excludeUid) {
  if (!houseId) return [];
  const snap = await db
    .collection('users')
    .where('house_id', '==', houseId)
    .get();

  const tokens = [];
  snap.forEach((doc) => {
    if (doc.id === excludeUid) return;
    const data = doc.data();
    const list = Array.isArray(data.fcm_tokens) ? data.fcm_tokens : [];
    for (const t of list) {
      if (typeof t === 'string' && t.length > 0) tokens.push(t);
    }
  });
  return [...new Set(tokens)];
}

/**
 * Envia a notificacao e limpa tokens invalidos do Firestore.
 *
 * Envia SOMENTE `data` (data-only), sem o campo `notification`. Assim o app
 * constroi a notificacao no dispositivo com MessagingStyle/InboxStyle e agrupa
 * por contexto (chat, mercado, tarefas), em vez de o Android desenhar uma
 * notificacao solta por evento.
 */
async function sendToTokens(tokens, data) {
  if (tokens.length === 0) return;

  const res = await messaging.sendEachForMulticast({
    tokens,
    data: data || {},
    android: { priority: 'high' },
  });

  const invalid = [];
  res.responses.forEach((r, i) => {
    if (
      !r.success &&
      r.error &&
      (r.error.code === 'messaging/registration-token-not-registered' ||
        r.error.code === 'messaging/invalid-registration-token')
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length > 0) {
    await cleanupTokens(invalid);
  }

  console.log(
    `Enviado: ${res.successCount} ok, ${res.failureCount} falhas, ${invalid.length} tokens invalidos.`
  );
}

async function cleanupTokens(invalidTokens) {
  const snap = await db.collection('users').get();
  const batch = db.batch();
  let dirty = false;
  snap.forEach((doc) => {
    const list = Array.isArray(doc.data().fcm_tokens)
      ? doc.data().fcm_tokens
      : [];
    const toRemove = list.filter((t) => invalidTokens.includes(t));
    if (toRemove.length > 0) {
      batch.update(doc.ref, {
        fcm_tokens: admin.firestore.FieldValue.arrayRemove(...toRemove),
      });
      dirty = true;
    }
  });
  if (dirty) await batch.commit();
}

/**
 * Registra um listener em uma colecao e chama [handler] para cada documento novo.
 */
function listen(collection, timeField, handler) {
  db.collection(collection).onSnapshot(
    (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;

        const doc = change.doc;
        if (processed[collection].has(doc.id)) return;

        const data = doc.data();
        const ts = millisOf(data[timeField]);
        // Ignora docs antigos e docs sem timestamp resolvido ainda.
        if (ts === null || ts < startedAt) return;

        processed[collection].add(doc.id);
        try {
          await handler(doc.id, data);
        } catch (err) {
          console.error(`Erro processando ${collection}/${doc.id}:`, err);
        }
      });
    },
    (err) => console.error(`Listener ${collection} falhou:`, err)
  );
  console.log(`Escutando colecao: ${collection}`);
}

// -------------------------------------------------------------------------
// Handlers de cada evento
// -------------------------------------------------------------------------

async function onNewMessage(id, data) {
  const tokens = await recipientTokens(data.house_id, data.sent_by);
  const name = (data.sent_by_name || 'Alguem').split(' ')[0];
  await sendToTokens(tokens, {
    type: 'chat',
    senderName: name,
    text: data.text || '',
    route: 'chat',
  });
}

async function onNewMarketItem(id, data) {
  const tokens = await recipientTokens(data.house_id, data.added_by);
  const name = (data.added_by_name || 'Alguem').split(' ')[0];
  await sendToTokens(tokens, {
    type: 'market',
    itemName: data.name || '',
    addedByName: name,
    route: 'mercado',
  });
}

async function onTaskCheck(id, data) {
  const tokens = await recipientTokens(data.house_id, data.done_by);
  const name = (data.done_by_name || 'Alguem').split(' ')[0];

  let taskTitle = 'uma tarefa';
  if (data.task_id) {
    const taskDoc = await db.collection('tasks').doc(data.task_id).get();
    if (taskDoc.exists) taskTitle = taskDoc.data().title || taskTitle;
  }

  await sendToTokens(tokens, {
    type: 'task',
    taskTitle,
    doneByName: name,
    route: 'casa',
  });
}

// -------------------------------------------------------------------------
// Start
// -------------------------------------------------------------------------

console.log('Casoiko Notifier iniciado.');
listen('messages', 'sent_at', onNewMessage);
listen('market_items', 'created_at', onNewMarketItem);
listen('task_checks', 'done_at', onTaskCheck);
