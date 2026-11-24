// GeeChat — notifications: in-app centre, sounds, and web push registration.
import { store, subscribeNotifications, markNotificationsRead, markNotificationRead, saveDeviceToken, removeDeviceToken } from './database.js';
import { VAPID_PUBLIC_KEY } from './firebase.js';
import { el, qs, icon, avatarEl, toast, playChime, timeAgo, hydrateIcons } from './ui.js';

let currentToken = null;
let lastNotifId = null;

export function initNotifications({ onUnreadChange, go } = {}) {
  subscribeNotifications(list => {
    const unread = list.filter(n => !n.read).length;
    onUnreadChange?.(unread);
    // Foreground alert for genuinely new items
    const newest = list[0];
    if (newest && lastNotifId && newest.id !== lastNotifId && newest.createdAt?.toMillis() > Date.now() - 20000) {
      if (shouldChimeFor(newest.type)) playChime('pop');
      if (document.visibilityState === 'visible') {
        toast(newest.title, newest.body, { icon: notifIcon(newest.type), timeout: 5000 });
      }
    }
    lastNotifId = newest?.id || lastNotifId;
  });
}

function shouldChimeFor(type) {
  const s = store.settings;
  if (type === 'friend-request' || type === 'friend-accepted') return s.notifRequests !== false;
  if (type === 'group-invite' || type === 'group-added' || type === 'group-removed') return s.notifGroups !== false;
  return true;
}

export function notifIcon(type) {
  return {
    'friend-request': 'user-plus',
    'friend-accepted': 'user-check',
    'group-invite': 'users-round',
    'group-added': 'users-round',
    'group-removed': 'users-round',
    'group-joined': 'users-round',
    'quiz-attempt': 'clipboard-check',
    'poll-vote': 'bar-chart',
  }[type] || 'bell';
}

// ---------- panel ----------
export function renderNotificationsPanel() {
  const panel = qs('#panelContent');
  panel.innerHTML = '';
  const list = el('div', { class: 'notif-list scroll-y' });
  const head = el('div', { class: 'panel-head', style: 'display:flex;align-items:center;' },
    el('div', {},
      el('h1', { text: 'Notifications' }),
      el('div', { class: 'head-sub', text: 'Requests, invitations and activity' })),
    el('button', { class: 'btn-ghost', style: 'margin-left:auto;', onclick: async () => {
      await markNotificationsRead();
      toast('All caught up', 'Every notification is marked as read.');
    } }, icon('check-check', 'ic-16'), 'Mark all read'),
  );
  panel.append(head, list);

  if (!store.notifications.length) {
    list.append(el('div', { class: 'empty-state' },
      el('div', { class: 'es-icon' }, icon('bell')),
      el('h3', { text: 'No notifications yet' }),
      el('p', { text: 'Friend requests, group invitations and activity will appear here.' }),
    ));
    hydrateIcons(list);
    return;
  }
  for (const n of store.notifications) {
    const row = el('div', { class: `notif-row${n.read ? '' : ' unread'}` },
      el('span', { class: `notif-ic${n.type === 'friend-request' ? ' red' : ''}` }, icon(notifIcon(n.type))),
      el('div', { class: 'notif-mid' },
        el('b', { text: n.title }),
        el('p', { text: store.settings.notifPreview === false ? 'Content hidden in previews' : n.body }),
      ),
      el('span', { class: 'notif-time', text: timeAgo(n.createdAt) }),
    );
    row.addEventListener('click', async () => {
      if (!n.read) await markNotificationRead(n.id);
      if (n.conversationId && window.__gcOpenConv) window.__gcOpenConv(n.conversationId);
      else if (n.link && window.__gcGo) window.__gcGo(n.link);
    });
    list.append(row);
  }
  hydrateIcons(list);
}

// ---------- web push ----------
export async function enablePush() {
  if (!('Notification' in window)) {
    toast('Not supported', 'This browser does not support notifications.', { error: true });
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    toast('Permission not granted', 'Enable notifications in your browser settings to receive alerts.', { error: true });
    return false;
  }
  if (!VAPID_PUBLIC_KEY) {
    toast('Foreground alerts enabled',
      'Background push requires a Web Push certificate configured by the administrator — see the deployment guide.',
      { icon: 'bell', timeout: 6500 });
    return true;
  }
  try {
    const { isSupported, getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
    if (!(await isSupported())) throw new Error('not supported');
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: reg,
    });
    if (token) {
      currentToken = token;
      await saveDeviceToken(token, navigator.userAgent.includes('Mobile') ? 'web-mobile' : 'web');
      onMessage(messaging, payload => {
        const n = payload.notification || {};
        toast(n.title || 'New message', store.settings.notifPreview ? (n.body || '') : 'Open GeeChat to read it', { icon: 'bell' });
        playChime('pop');
      });
      toast('Push notifications on', 'You will be alerted even when GeeChat is in the background.');
      return true;
    }
  } catch (err) {
    console.warn('push registration failed', err);
    toast('Push unavailable', 'Foreground alerts will still work while the app is open.', { icon: 'info' });
    return true;
  }
  return false;
}

export async function disablePush() {
  try {
    if (currentToken) await removeDeviceToken(currentToken);
    if (currentToken) {
      const { getMessaging, deleteToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
      await deleteToken(getMessaging());
    }
  } catch { /* ignore */ }
  currentToken = null;
  toast('Push notifications off');
}

export function pushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}
export function pushPermission() {
  return 'Notification' in window ? Notification.permission : 'denied';
}
