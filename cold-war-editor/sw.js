/* Offline support for The Editor's Desk. Scope: this folder only.
   Network first for every file: when a device is online it always gets the latest game
   code and manuscripts, so updates appear on the next visit. The cache is only used when
   the device is offline. Bump VERSION when you change the list of files. */
var VERSION = 'cwe-v3';
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
    caches.open(VERSION).then(function (cache) {
      // Bypass the browser's HTTP cache so the offline copy is the current version.
      return cache.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
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

  event.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) {
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
});
