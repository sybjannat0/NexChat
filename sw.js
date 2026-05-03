const APP_VERSION = 'v3.0.0';
const CACHE_NAME = `nexchat-${APP_VERSION}`;
const RUNTIME_CACHE = `nexchat-runtime-${APP_VERSION}`;

// Core assets to pre-cache for offline use
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './manifest.webmanifest',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&family=Noto+Sans+Bengali:wght@300;400;500;600;700&display=swap'
];

// ────────── INSTALL ──────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching core assets');
        return Promise.allSettled(CORE_ASSETS.map(url => 
          cache.add(url).catch(err => console.warn('[SW] Failed to cache:', url, err))
        ));
      })
      .then(() => self.skipWaiting())
  );
});

// ────────── ACTIVATE ──────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', APP_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_ACTIVATED', version: APP_VERSION }));
        });
      })
  );
});

// ────────── FETCH STRATEGIES ──────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Supabase API: network first, no cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Navigation requests: network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Static assets (CSS, JS, fonts, images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
        }
        return networkResponse;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ────────── PUSH NOTIFICATIONS ──────────
self.addEventListener('push', (event) => {
  let data = { title: 'NexChat', body: 'You have a new message' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || 'New message',
    icon: data.icon || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="%236366f1"/><path d="M58 67c0-5 4-9 9-9h58c5 0 9 4 9 9v52c0 5-4 9-9 9H88l-20 17v-17h-9c-5 0-9-4-9-9V67z" fill="white"/></svg>',
    badge: data.badge || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%236366f1"/></svg>',
    vibrate: [200, 100, 200],
    tag: data.tag || 'nexchat-msg',
    requireInteraction: false,
    data: { url: data.url || './', dateOfArrival: Date.now() },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.title || 'NexChat', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsArr => {
      for (const client of clientsArr) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ────────── BACKGROUND SYNC ──────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(Promise.resolve());
  }
});

// ────────── PERIODIC SYNC ──────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-messages') {
    event.waitUntil(Promise.resolve());
  }
});

// ────────── MESSAGE FROM CLIENT ──────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});