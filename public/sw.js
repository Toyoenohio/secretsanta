const CACHE_NAME = 'secret-santa-v1';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg',
  '/offline.html',
];

// Install: Cache essential shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests and http/https schemes (ignore websockets or chrome extensions)
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // API calls & WebSocket chats: always Network First, don't store sensitive responses in public cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', message: 'Sin conexión a internet' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // Static assets (scripts, styles, fonts, images, icons): Cache First with background refresh
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('fontshare.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Fetch updated version in background
          fetch(req)
            .then((res) => {
              if (res && res.status === 200) {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML navigation: Network First, fallback to cached page or /offline.html
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const offlinePage = await caches.match('/offline.html');
        if (offlinePage) return offlinePage;
        return new Response('Estás desconectado', {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          status: 503,
        });
      })
  );
});
