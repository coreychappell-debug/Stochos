// sw.js (v3) — cache app shell, cleanly update between versions
const CACHE_NAME = 'fy-planner-v3';
const URLS = [
  '.',                 // start_url
  'index.html',
  'Style.css',         // NOTE: matches actual filename casing
  'app.js',
  'icon-192.png',
  'icon-512.png',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first for same-origin GET; network fallback; offline HTML fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        // opportunistically cache same-origin GETs
        try {
          const url = new URL(request.url);
          if (url.origin === self.location.origin) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, copy));
          }
        } catch {}
        return resp;
      }).catch(() => {
        // If navigating and offline, serve the app shell
        if (request.mode === 'navigate') return caches.match('index.html');
      })
    })
  );
});
