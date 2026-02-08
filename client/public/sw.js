const CACHE_VERSION = '2';
const CACHE_NAME = `buysidebro-v${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/dashboard',
  '/favicon.png',
  '/manifest.json',
];

// Authenticated API routes that must never be cached
const AUTHENTICATED_API_PATTERNS = [
  '/api/portfolio',
  '/api/credits',
  '/api/conversations',
  '/api/subscription',
  '/api/user',
  '/api/admin',
  '/api/bro-status',
  '/api/usage',
  '/api/chat',
];

function isAuthenticatedApiRoute(url) {
  return AUTHENTICATED_API_PATTERNS.some(pattern => url.includes(pattern));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // For API requests
  if (request.url.includes('/api/')) {
    // Never cache authenticated API routes - always go to network
    if (isAuthenticatedApiRoute(request.url)) {
      return;
    }

    // For public API routes (markets, newsfeed, watchlist/default), use network-first
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For navigation requests, use network-first with app shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/dashboard'))
    );
    return;
  }

  // For static assets, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});
