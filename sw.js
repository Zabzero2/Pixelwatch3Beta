const CACHE_NAME = 'pixel-waechter-v2-cache-v4';
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
