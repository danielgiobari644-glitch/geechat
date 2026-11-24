/* GeeChat — background push service worker (messaging).
   Displays push notifications when the app is closed or backgrounded.
   Configuration is shared with the app through firebase-config.js. */
importScripts('./firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp(self.GEECHAT_CONFIG.firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'GeeChat';
  const body = payload.notification?.body || payload.data?.body || 'You have a new message';
  const link = payload.data?.link || payload.fcmOptions?.link || '/';
  self.registration.showNotification(title, {
    body,
    icon: './icon-192.png',
    badge: './icon-96.png',
    tag: payload.data?.conversationId || undefined,
    data: { link },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.link || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
