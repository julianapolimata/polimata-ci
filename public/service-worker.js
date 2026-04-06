// public/service-worker.js
const CACHE_VERSION = 'v1';
const CACHE_NAME = `polimata-ci-${CACHE_VERSION}`;

// Lista de URLs que devem ser cacheadas (apenas assets, não HTML)
const STATIC_ASSETS = [
  '/',
  '/logotipo-2cores.png',
  '/icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Erro ao adicionar assets ao cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`[SW] Limpando cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // HTML sempre vai pro servidor (nunca cache)
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Não cachear HTML
          return response;
        })
        .catch(() => {
          // Se offline e não tem cache, tenta voltar da cache se existir
          return caches.match(event.request);
        })
    );
    return;
  }

  // Assets: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
