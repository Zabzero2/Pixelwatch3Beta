const CACHE_NAME = 'pixel-waechter-v2-cache-v5';
const urlsToCache = [
  './',
  './index.html',
  './Pixelwatch2.html',
  './manifest.json',
  './src/styles.css',
  './src/main.js',
  './src/dom.js',
  './src/state.js',
  './src/ui.js',
  './src/storage.js',
  './src/audio.js',
  './src/weather.js',
  './src/telegram.js',
  './src/babyphone.js',
  './src/analyzer.js',
  './src/camera.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Network-First Strategie: Holt immer die aktuellsten Dateien vom Server
// und nutzt den Cache nur als Offline-Fallback. Verhindert veraltete/zerschossene UI-Stände!
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
