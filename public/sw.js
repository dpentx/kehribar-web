// Minimal service worker: cache-first for static assets (fonts, icons, CSS,
// JS chunks Astro emits), network-first for HTML pages so content updates
// show up on next visit without needing a hard refresh.
const CACHE_NAME = 'kehribar-static-v1';
const STATIC_EXTENSIONS = ['.css', '.js', '.woff', '.woff2', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isStaticAsset(url) {
  return STATIC_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests; let everything else (fonts CDN,
  // GitHub, jsdelivr icons, API calls) pass through untouched.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML/pages: network-first, fall back to cache when offline.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
