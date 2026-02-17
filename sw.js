// Service Worker for Qualité de l'Eau PWA
// Handles caching for offline support

const CACHE_NAME = 'qualito-v6';
const ASSETS_TO_CACHE = [
    './',
    './eau-qualite.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Activate immediately, don't wait for old SW to finish
                return self.skipWaiting();
            })
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // For API requests (Hub'Eau), use network-first strategy
    // This ensures fresh data when online, cached data when offline
    if (requestUrl.hostname === 'hubeau.eaufrance.fr') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone the response before caching
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Network failed, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // For app assets, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Not in cache, fetch from network
                return fetch(event.request).then((response) => {
                    // Don't cache non-successful responses or non-GET requests
                    if (!response || response.status !== 200 || event.request.method !== 'GET') {
                        return response;
                    }
                    // Cache the new resource
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
    );
});
