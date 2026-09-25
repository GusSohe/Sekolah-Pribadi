// Service Worker — Sekolah Pribadi
// Cache-first untuk app shell, network-first untuk API

const CACHE = 'sp-v1.1';
const SHELL = [
  '/Sekolah-Pribadi/',
  '/Sekolah-Pribadi/index.html',
  '/Sekolah-Pribadi/manifest.json',
  '/Sekolah-Pribadi/icon-192.png',
  '/Sekolah-Pribadi/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(SHELL.map(url => c.add(url)));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Selalu network untuk Apps Script API
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: kembalikan index.html
        if (e.request.destination === 'document') {
          return caches.match('/Sekolah-Pribadi/index.html');
        }
      });
    })
  );
});
