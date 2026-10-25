// Service worker: guarda la app en el teléfono para que abra al instante y sin internet.
// Estrategia "stale-while-revalidate": responde con lo guardado y en paralelo baja la
// versión nueva. Consecuencia: cuando publicás un cambio, aparece en la SEGUNDA apertura.
// Subí CACHE (gym-v2, v3…) si cambiás la lista de archivos.

const CACHE = 'gym-v4';
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/progression.js', 'js/claude.js', 'js/running.js', 'js/strava.js', 'strava.html',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Los planes publicados se piden siempre a la red: lo que importa es ver el último.
  if (url.pathname.includes('/planes/')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request)
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
