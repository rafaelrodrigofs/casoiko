'use strict';

/**
 * Casoiko Notifier + API de midia
 *
 * - HTTP: upload de fotos do chat (`POST /api/chat/upload`)
 * - Firestore listeners: push FCM para mensagens, mercado e tarefas
 */

const admin = require('firebase-admin');
const { createAuthMiddleware } = require('./auth');
const { createServer } = require('./server');

// -------------------------------------------------------------------------
// Inicializacao Firebase
// -------------------------------------------------------------------------

const credentialPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS || '/app/service-account.json';

admin.initializeApp({
  credential: admin.credential.cert(require(credentialPath)),
});

const db = admin.firestore();
const messaging = admin.messaging();

const startedAt = Date.now();

const processed = {
  messages: new Set(),
  market_items: new Set(),
  task_checks: new Set(),
};

// -------------------------------------------------------------------------
// HTTP
// -------------------------------------------------------------------------

const requireAuth = createAuthMiddleware(admin);
const app = createServer({ requireAuth });
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`HTTP escutando na porta ${port}`);
});

// -------------------------------------------------------------------------
// Helpers push
// -------------------------------------------------------------------------

function millisOf(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

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

function listen(collection, timeField, handler) {
  db.collection(collection).onSnapshot(
    (snap) => {
      snap.docChanges().forEach(async (change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;

        const doc = change.doc;
        if (processed[collection].has(doc.id)) return;

        const data = doc.data();
        const ts = millisOf(data[timeField]);
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
// Handlers
// -------------------------------------------------------------------------

async function onNewMessage(id, data) {
  const tokens = await recipientTokens(data.house_id, data.sent_by);
  const name = (data.sent_by_name || 'Alguem').split(' ')[0];
  const isImage = data.type === 'image';
  await sendToTokens(tokens, {
    type: 'chat',
    senderName: name,
    text: isImage ? 'Foto' : (data.text || ''),
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
// Start listeners
// -------------------------------------------------------------------------

console.log('Casoiko Notifier iniciado.');
listen('messages', 'sent_at', onNewMessage);
listen('market_items', 'created_at', onNewMarketItem);
listen('task_checks', 'done_at', onTaskCheck);
