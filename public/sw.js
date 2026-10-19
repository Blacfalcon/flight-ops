/* Flight Ops — service worker
 * - Pages: network first, then the last copy seen, then the offline page.
 * - Read-only API data pilots need on the flight line: network first, then the last copy.
 * - Built app files: cache first (their names change with every release).
 * Forms are not handled here: the app keeps an outbox and sends it when the connection returns.
 */
const VERSION = 'v3';
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
const PRECACHE = ['/offline', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];

const CACHEABLE_API = [
  /^\/api\/v1\/me$/,
  /^\/api\/v1\/missions(\?.*)?$/,
  /^\/api\/v1\/missions\/[^/]+$/,
  /^\/api\/v1\/missions\/[^/]+\/risk-assessments$/,
  /^\/api\/v1\/weather$/,
  /^\/api\/v1\/aircraft$/,
  /^\/api\/v1\/dashboards\/pilot$/,
  /^\/api\/v1\/attachments\/[^/]+$/,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  // Signing out clears everything stored on this device
  if (event.data === 'clear-user-data') {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]));
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set('X-From-Cache', '1');
      return new Response(await hit.blob(), { status: hit.status, headers });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/api/branding/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname + url.search;
    if (CACHEABLE_API.some((re) => re.test(path))) event.respondWith(networkFirst(req, DATA));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      networkFirst(req, PAGES).catch(async () => (await caches.match('/offline')) || new Response('Offline', { status: 503 })),
    );
  }
});


// ── Phone notifications (Web Push) ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  let m = { title: 'New item', body: 'Tap to open.', link: '/notifications', tag: 'ops' };
  try {
    if (event.data) m = { ...m, ...event.data.json() };
  } catch (e) {
    // keep the generic message
  }
  event.waitUntil(
    self.registration.showNotification(m.title, {
      body: m.body || 'Tap to open.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: m.tag,
      renotify: true,
      data: { link: m.link },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/notifications';
  const target = new URL(link, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.navigate(target).then((c) => (c || w).focus());
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
