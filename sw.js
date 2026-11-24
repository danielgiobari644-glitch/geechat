/* GeeChat — app shell service worker.
   Caches only static application assets. Never caches conversations,
   messages or any authenticated API responses. */
const VERSION = 'geechat-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './app.js',
  './firebase.js',
  './auth.js',
  './database.js',
  './chat.js',
  './groups.js',
  './friends.js',
  './media.js',
  './klipy.js',
  './notifications.js',
  './polls.js',
  './quizzes.js',
  './profile.js',
  './settings.js',
  './ui.js',
  './icon-96.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon.svg',
  './favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET navigation/static requests.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never cache anything that looks like a data or auth request.
  if (url.pathname.startsWith('/firebase') || url.pathname.startsWith('/__')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
