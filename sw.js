/* Strategos PWA — Service Worker v2 */
const CACHE = 'strategos-v2';
const SHELL = ['./mobile.html', './supabase-adapter.js', './manifest.json', './icon.svg', './logo.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Supabase, CDN e outros requests externos — NÃO interceptar,
     deixar o browser lidar directamente (evita SW devolver null) */
  if (url.hostname !== self.location.hostname) {
    return;
  }

  /* App shell (ficheiros locais) — cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
