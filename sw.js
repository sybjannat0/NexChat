// NexChat Service Worker - Advanced PWA Caching Strategy
const CACHE_NAME = 'nexchat-v2.0.0';
const RUNTIME_CACHE = 'nexchat-runtime-v2';

// Assets to cache on install (static shell)
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js'
];

// External resources to cache dynamically
const EXTERNAL_ASSETS = [
    'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
    'https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js',
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - precache essential assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching app shell');
                // Cache local assets
                return cache.addAll(PRECACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Precache failed:', err);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch strategy: Network First, fallback to Cache, then offline page
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (POST, etc.)
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other protocols
    if (!url.protocol.startsWith('http')) {
        return;
    }

    event.respondWith(
        networkFirstWithCacheFallback(request)
    );
});

// Network first strategy with cache fallback
async function networkFirstWithCacheFallback(request) {
    const cache = await caches.open(RUNTIME_CACHE);

    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
            // Clone the response since it can only be used once
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('[SW] Serving from cache:', request.url);
            return cachedResponse;
        }

        // If it's a navigation request and we have no cache, serve the app shell
        if (request.mode === 'navigate') {
            const shellCache = await caches.open(CACHE_NAME);
            const shell = await shellCache.match('/index.html');
            if (shell) return shell;
        }

        // Return offline response for other requests
        return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
        });
    }
}

// Handle background sync for messages (advanced PWA feature)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-messages') {
        console.log('[SW] Background sync: sync-messages');
        event.waitUntil(syncPendingMessages());
    }
});

// Sync pending messages when back online
async function syncPendingMessages() {
    // This would sync any pending messages stored in IndexedDB
    console.log('[SW] Syncing pending messages...');
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New message received',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'open', title: 'Open Chat' },
            { action: 'close', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('NexChat', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

console.log('[SW] NexChat Service Worker loaded');
