/* GeeChat — background push service worker (messaging).
   Displays push notifications when the app is closed or backgrounded. */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCN3C3s7c37-o-9XoV0CcM72RgydcpbTFk",
  authDomain: "geechat-com.firebaseapp.com",
  projectId: "geechat-com",
  storageBucket: "geechat-com.firebasestorage.app",
  messagingSenderId: "792018335741",
  appId: "1:792018335741:web:3b43c1f823aba32a50cb94",
  measurementId: "G-493C40NG2Q"
});

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
