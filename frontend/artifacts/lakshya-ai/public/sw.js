const CACHE_NAME = 'lakshya-ai-shell-v2';
const LOCALE_CACHE = 'lakshya-ai-locales-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== LOCALE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache dynamic locale resources and app assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            const targetCache = url.pathname.includes('/locales/') || url.pathname.endsWith('.json')
              ? LOCALE_CACHE
              : CACHE_NAME;
            caches.open(targetCache).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match('/') || caches.match(event.request));
    })
  );
});

// Listen for message to precache active locale
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PRECACHE_LOCALE' && event.data.url) {
    caches.open(LOCALE_CACHE).then((cache) => {
      fetch(event.data.url)
        .then((resp) => {
          if (resp.ok) cache.put(event.data.url, resp);
        })
        .catch(() => {});
    });
  }
});
