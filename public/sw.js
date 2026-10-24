/* Cache only the application shell. Private API data belongs in scoped IndexedDB. */
importScripts('/precache.js');
const CACHE = 'vesta-shell-' + self.__VESTA_VERSION;
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(self.__VESTA_PRECACHE))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('vesta-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    req.headers.has('Authorization')
  )
    return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => (response.ok ? response : caches.match('/index.html')))
        .catch(() => caches.match('/index.html')),
    );
    return;
  }
  if (!self.__VESTA_PRECACHE.includes(url.pathname)) return;
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
