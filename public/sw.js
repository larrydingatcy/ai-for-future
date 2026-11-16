/* AI for Future service worker — offline support under any basePath (e.g. /ai-for-future/). */
const VERSION = 'aiff-v1';
const SCOPE = new URL(self.registration.scope).pathname; // e.g. "/ai-for-future/"
const CORE = [SCOPE, `${SCOPE}manifest.webmanifest`, `${SCOPE}icons/icon-192.png`, `${SCOPE}icons/apple-touch-icon.png`];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch LLM / STT calls or anything outside our scope.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;

  if (req.mode === 'navigate') {
    // Network first so new deploys show up; fall back to the cached app shell offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(SCOPE, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE)),
    );
    return;
  }

  // Static assets: cache first (Next.js file names are content-hashed).
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/_next/static/') || url.pathname.includes('/icons/'))) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
