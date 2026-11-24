// GeeChat — server-side Cloud Functions source.
//
// DEPLOYMENT: create a `functions/` folder in your Firebase project directory:
//   functions/index.js      ← copy THIS file
//   functions/package.json  ← see the package.json content in README.md ("Cloud Functions" section)
// then run `firebase deploy --only functions`.
//
// What runs here (none of this is required for the app to function, but it
// enables background push delivery and trusted quiz scoring):
//   1. onMessageCreated      — new chat message → web push to recipient devices
//   2. onNotificationCreated — social notification → web push to recipient devices
//   3. onQuizAttemptCreated  — re-scores attempts against trusted quiz data

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const db = admin.firestore();
const fcm = admin.messaging();

// ---------- helpers ----------
async function tokensFor(uid) {
  const snap = await db.collection('deviceTokens').where('uid', '==', uid).get();
  return snap.docs.map((d) => d.id);
}

async function pushToUser(uid, payload) {
  // Respect the recipient's notification preferences.
  const user = await db.collection('users').doc(uid).get();
  const settings = user.exists ? (user.data().settings || {}) : {};
  if (settings.pushEnabled === false) return;

  const { title, body, link, tag, conversationId } = payload;
  const tokens = await tokensFor(uid);
  if (!tokens.length) return;

  const message = {
    notification: { title, body },
    webpush: {
      fcmOptions: { link: link || '/' },
      notification: {
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: tag || conversationId || undefined,
      },
    },
    tokens,
  };
  try {
    const res = await fcm.sendEachForWebPush(message);
    const dead = res.responses
      .map((r, i) => (r.error ? tokens[i] : null))
      .filter(Boolean);
    // Clean up tokens that are no longer registered.
    await Promise.all(dead.map((t) => db.collection('deviceTokens').doc(t).delete().catch(() => {})));
  } catch (err) {
    logger.warn('push failed', err);
  }
}

// ---------- 1. chat message → push ----------
exports.onMessageCreated = onDocumentCreated('conversations/{cid}/messages/{mid}', async (event) => {
  const msg = event.data?.data();
  if (!msg || msg.type === 'system') return;
  const cid = event.params.cid;
  try {
    const conv = await db.collection('conversations').doc(cid).get();
    const participants = conv.data()?.participants || [];
    const recipients = participants.filter((p) => p !== msg.senderId);

    const sender = await db.collection('users').doc(msg.senderId).get();
    const senderName = sender.data()?.displayName || 'Someone';
    const isGroup = conv.data()?.type === 'group';

    const previews = {
      text: msg.text,
      image: '📷 sent a photo',
      video: '🎬 sent a video',
      voice: '🎤 sent a voice message',
      audio: '🎵 sent an audio clip',
      file: `📎 sent ${msg.media?.name || 'a file'}`,
      gif: 'sent a GIF',
      poll: '📊 created a poll',
      quiz: '📝 shared a quiz',
    };
    const bodyPreview = msg.deleted ? 'message deleted' : (previews[msg.type] || msg.text || '').slice(0, 180);

    for (const uid of recipients) {
      const recipient = await db.collection('users').doc(uid).get();
      const settings = recipient.exists ? (recipient.data().settings || {}) : {};
      const allowed = isGroup ? settings.notifGroups !== false : settings.notifMessages !== false;
      if (!allowed) continue;
      const previewOk = settings.notifPreview !== false;
      await pushToUser(uid, {
        title: isGroup ? `${senderName} · ${conv.data()?.group?.name || 'Group'}` : senderName,
        body: previewOk ? bodyPreview : 'New message — open GeeChat to read it',
        link: '/',
        conversationId: cid,
      });
    }
  } catch (err) {
    logger.warn('onMessageCreated error', err);
  }
});

// ---------- 2. social notification → push ----------
exports.onNotificationCreated = onDocumentCreated('notifications/{nid}', async (event) => {
  const n = event.data?.data();
  if (!n) return;
  try {
    const actor = n.actorUid ? await db.collection('users').doc(n.actorUid).get() : null;
    const actorName = actor?.exists ? actor.data().displayName : '';
    const body = n.body || '';
    await pushToUser(n.uid, {
      title: n.title || actorName || 'GeeChat',
      body,
      link: '/',
      tag: n.type,
    });
  } catch (err) {
    logger.warn('onNotificationCreated error', err);
  }
});

// ---------- 3. trusted quiz scoring ----------
exports.onQuizAttemptCreated = onDocumentCreated('quizAttempts/{aid}', async (event) => {
  const attempt = event.data?.data();
  if (!attempt) return;
  try {
    const quiz = await db.collection('quizzes').doc(attempt.quizId).get();
    if (!quiz.exists) return;
    const questions = quiz.data().questions || [];
    const answers = attempt.answers || [];
    let score = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) score += 1;
    });
    if (score !== attempt.score) {
      await event.data.ref.update({ score, total: questions.length, verified: true });
      logger.info(`attempt ${event.params.aid} re-scored ${attempt.score} → ${score}`);
    } else {
      await event.data.ref.update({ verified: true });
    }
  } catch (err) {
    logger.warn('onQuizAttemptCreated error', err);
  }
});
