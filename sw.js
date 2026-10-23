// Relo service worker: keeps the app shell available offline.
// Workspace data lives in IndexedDB and is never cached here.
const VERSION = 'relo-v1';
const SHELL = [
  './', './index.html', './landing.css', './landing.js',
  './app/', './app/index.html', './app/app.css',
  './app/js/app.js', './app/js/store.js', './app/js/db.js', './app/js/ui.js', './app/js/dnd.js', './app/js/icons.js', './app/js/templates.js',
  './assets/tokens.css', './assets/icon.svg', './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for our own files (so updates land), falling back to cache offline.
// Fonts are cached on first use.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  if (isFont) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match(req.mode === 'navigate' && url.pathname.includes('/app') ? './app/index.html' : './index.html'))));
});
