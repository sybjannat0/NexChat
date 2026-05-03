const CACHE_NAME = 'nexchat-v4';
const RUNTIME_CACHE = 'nexchat-runtime-v4';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ────────── ICON GENERATION (canvas in SW context via OffscreenCanvas) ──────────
function generateIcon(size) {
  // Build a simple colored square SVG → but we return it as image/svg+xml
  // This works for manifest icons
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#6366f1"/>
<stop offset="256" stop-color="#8b5cf6"/>
<stop offset="512" stop-color="#d946ef"/>
</linearGradient></defs>
<rect width="512" height="512" rx="112" fill="url(#bg)"/>
<path d="M156 178c0-13 11-24 24-24h152c13 0 24 11 24 24v138c0 13-11 24-24 24h-100l-52 44v-44h-24c-13 0-24-11-24-24V178z" fill="white" opacity="0.95"/>
<circle cx="220" cy="248" r="14" fill="#6366f1"/>
<circle cx="256" cy="248" r="14" fill="#8b5cf6"/>
<circle cx="292" cy="248" r="14" fill="#d946ef"/>
</svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(CORE_ASSETS.map(url =>
        cache.add(url).catch(() => {})
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Serve icon requests dynamically from service worker
  if (url.pathname === '/icon.png' || url.pathname === '/icon.svg' || url.pathname === '/icon-192.png' || url.pathname === '/icon-512.png') {
    event.respondWith(generateIcon(url.pathname.includes('512') ? 512 : 192));
    return;
  }

  if (url.pathname === '/manifest.json' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match('./manifest.json')
        .then(r => r || fetch(event.request))
        .catch(() => generateManifest())
    );
    return;
  }

  // Supabase: network only
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Navigation: network first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static: cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

function generateManifest() {
  const origin = self.location.origin;
  const manifest = {
    name: 'NexChat',
    short_name: 'NexChat',
    description: 'Secure messenger',
    start_url: './index.html',
    scope: './',
    id: './index.html',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#090d16',
    theme_color: '#6366f1',
    lang: 'en',
    icons: [
      { src: origin + '/icon.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: origin + '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ]
  };
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json' }
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'NexChat', body: 'New message' };
  try { if (event.data) data = event.data.json(); } catch (e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'NexChat', {
    body: data.body || '',
    icon: './icon.png',
    badge: './icon.png',
    vibrate: [200, 100, 200],
    data: { url: './index.html' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow('./index.html');
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});