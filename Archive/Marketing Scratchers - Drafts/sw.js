/* ==========================================================================
 * MARKETING CONTRACT & FY PLANNING TOOL — sw.js (v4)
 * --------------------------------------------------------------------------
 * App Shell (cache-first) + offline navigation fallback.
 * IMPORTANT: Filenames/casing must match exactly (e.g., "Style.css").
 * Bump CACHE_NAME any time you ship changes to HTML/CSS/JS.
 * ========================================================================== */

const CACHE_NAME = 'fy-planner-v4';
const APP_SHELL = [
  '.',               // origin root
  'index.html',
  'Style.css',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];

/* Install: pre-cache app shell */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

/* Activate: clear old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Fetch: 
   - HTML navigations → network first, fallback to cached index.html (offline)
   - App shell/static (same-origin GET) → cache-first, then network (and cache)
*/
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GETs
  if (request.method !== 'GET') return;

  const acceptsHTML =
    request.headers.get('accept')?.includes('text/html') ||
    request.mode === 'navigate';

  // Handle navigations (HTML documents)
  if (acceptsHTML) {
    event.respondWith(
      (async () => {
        try {
          // Try network (fresh HTML)
          const net = await fetch(request);
          return net;
        } catch (err) {
          // Offline fallback
          const cachedShell = await caches.match('index.html');
          return cachedShell || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Static assets: cache-first, then network (and cache it)
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const resp = await fetch(request);
        // Only cache same-origin GETs
        const url = new URL(request.url);
        if (url.origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, resp.clone());
        }
        return resp;
      } catch (err) {
        // If we fail here and it wasn't pre-cached, just error through.
        return new Response('Network error', { status: 502, statusText: 'Bad Gateway' });
      }
    })()
  );
});
