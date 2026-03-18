const CACHE_NAME = 'gota-a-gota-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn-icons-png.flaticon.com/512/9438/9438567.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Background Sync for Location
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-location') {
    console.log('Background location update triggered');
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  self.registration.showNotification('Gota a Gota Control', {
    body: data.message || 'Alerta de Seguridad Activa',
    icon: 'https://cdn-icons-png.flaticon.com/512/9438/9438567.png'
  });
});
