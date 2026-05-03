const VERSION = 'nexchat-v3';
const APP_CACHE = 'nexchat-app-' + VERSION;
const DYNAMIC_CACHE = 'nexchat-dyn-' + VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== APP_CACHE && key !== DYNAMIC_CACHE)
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - network first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // HTML: network first, cache fallback
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(APP_CACHE).then(c => c.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetching = fetch(event.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data.json(); } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'NexChat', {
      body: data.body || 'New message',
      icon: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 512 512%27%3E%3Crect width=%27512%27 height=%27512%27 rx=%2796%27 fill=%27%236366f1%27/%3E%3C/svg%3E',
      badge: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 512 512%27%3E%3Crect width=%27512%27 height=%27512%27 rx=%2796%27 fill=%27%236366f1%27/%3E%3C/svg%3E',
      vibrate: [200, 100, 200],
      tag: data.tag || 'msg'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});