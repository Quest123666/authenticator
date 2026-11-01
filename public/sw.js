const VERSION = '1.3.2';
const CACHE = 'lumen-tools-v' + VERSION;
const INDEX = new URL('./index.html', self.location).href;
const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css?v=1.3.2',
  './assets/boot.js?v=1.3.2',
  './assets/core.js?v=1.3.2',
  './assets/data.js?v=1.3.2',
  './assets/app.js?v=1.3.2',
  './data/aa-snapshot.json',
  './data/arena-snapshot.json',
  './data/wise-snapshot.json',
  './data/xe-snapshot.json',
  './assets/icon.svg',
  './assets/icon-32.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(INDEX);
      })
    );
    return;
  }

  if (!url.pathname.includes('/assets/') && !url.pathname.endsWith('manifest.webmanifest')) return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
