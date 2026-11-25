/* Secret Santa — service worker
 * - Shell cacheado para arrancar sin red.
 * - Push de notas en la bota.
 * - Las páginas privadas (salas, wishlist, perfil) nunca se guardan en caché.
 */
const CACHE_NAME = 'secret-santa-v2';

const SHELL = [
  '/',
  '/login',
  '/register',
  '/manifest.webmanifest',
  '/favicon.png',
  '/offline.html',
  '/icons/icon-192.png?v=2',
  '/icons/icon-512.png?v=2',
  '/icons/icon-maskable-512.png?v=2',
  '/icons/apple-touch-icon.png?v=2',
  '/icons/icon.svg',
];

const PRIVADAS = ['/rooms', '/wishlist', '/profile', '/api/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  // API: siempre red, sin caché
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  // Estáticos: caché primero, refresco en segundo plano
  if (
    url.pathname.startsWith('/_astro/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const red = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copia = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copia));
            }
            return res;
          })
          .catch(() => cached);
        return cached || red;
      })
    );
    return;
  }

  // Navegación
  const esPrivada = PRIVADAS.some((p) => url.pathname.startsWith(p));
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (!esPrivada && res && res.status === 200) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copia));
        }
        return res;
      })
      .catch(async () => {
        if (esPrivada) {
          const offline = await caches.match('/offline.html');
          if (offline) return offline;
        }
        const cached = await caches.match(req);
        if (cached) return cached;
        const offline = await caches.match('/offline.html');
        if (offline) return offline;
        return new Response('Estás desconectado', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});

/* ---------- Notificaciones push ---------- */
self.addEventListener('push', (event) => {
  let datos = { title: 'Secret Santa', body: 'Tienes una nota nueva en la bota.', url: '/' };

  if (event.data) {
    try {
      datos = Object.assign(datos, event.data.json());
    } catch {
      datos.body = event.data.text();
    }
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(datos.title, {
        body: datos.body,
        icon: '/icons/icon-192.png?v=2',
        badge: '/icons/badge-72.png?v=2',
        tag: datos.tag || 'nota-bota',
        renotify: true,
        data: { url: datos.url || '/' },
        vibrate: [90, 40, 90],
      });

      try {
        if (self.navigator.setAppBadge) await self.navigator.setAppBadge(1);
      } catch {}
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clientes) {
        if (c.url.includes(new URL(destino, self.location.origin).pathname)) {
          c.focus();
          return;
        }
      }
      for (const c of clientes) {
        if ('focus' in c) {
          c.navigate(destino);
          return c.focus();
        }
      }
      return self.clients.openWindow(destino);
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'limpiar-badge' && self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge();
  }
});
