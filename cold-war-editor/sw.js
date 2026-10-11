/* Offline support for The Editor's Desk. Scope: this folder only.
   The manuscripts file is fetched network-first so a teacher's edits reach students
   as soon as they are online; everything else is served from the cache and refreshed
   in the background. Bump VERSION when you change the code files. */
var VERSION = 'cwe-v1';
var SHELL = [
  './',
  'index.html',
  'css/style.css',
  'js/store.js',
  'js/audio.js',
  'js/pixelfont.js',
  'js/art.js',
  'js/validate.js',
  'js/game.js',
  'js/app.js',
  'data/manuscripts.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) { return cache.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('cwe-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function cacheKey(request) {
  // Ignore query strings so './?source=pwa' and './' share a cache entry.
  var url = new URL(request.url);
  url.search = '';
  return url.toString();
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var scope = new URL('./', self.location).pathname;
  if (url.pathname.indexOf(scope) !== 0) return;

  if (/\/data\/manuscripts\.json$/.test(url.pathname) || req.mode === 'navigate') {
    // Network first, cache fallback.
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(cacheKey(req), copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(cacheKey(req)).then(function (hit) {
          return hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', self.location).toString()) : undefined);
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for the app shell.
  event.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(cacheKey(req)).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(cacheKey(req), res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});
