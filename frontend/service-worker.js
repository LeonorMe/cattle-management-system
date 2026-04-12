// ── Cattle MS Service Worker ──────────────────────
const CACHE_NAME = 'cattle-ms-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// ── Install: pre-cache static assets ─────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: strategy based on request type ────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: Network-first, fall back to offline response
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() =>
          new Response(
            JSON.stringify({ detail: 'Sem ligação à internet. A operar em modo offline.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
    );
    return;
  }

  // Static assets & CDN: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      const networked = fetch(request)
        .then((res) => {
          if (res.ok && request.method === 'GET') {
            const cloned = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return res;
        })
        .catch(() => cached); // fallback to cache if network fails completely

      return cached || networked;
    })
  );
});
