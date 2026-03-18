/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Persistent notification to keep the process alive
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'START_BACKGROUND_SERVICE') {
    self.registration.showNotification('Gota a Gota Control', {
      body: 'Servicio de Seguridad Activo 24/7',
      icon: 'https://picsum.photos/seed/security/192/192',
      badge: 'https://picsum.photos/seed/security/192/192',
      tag: 'background-service',
      renotify: false,
      silent: true,
      requireInteraction: true,
      sticky: true // For some browsers
    } as any);
  }
  
  if (event.data && event.data.type === 'STOP_BACKGROUND_SERVICE') {
    self.registration.getNotifications({ tag: 'background-service' }).then(notifications => {
      notifications.forEach(notification => notification.close());
    });
  }

  if (event.data && event.data.type === 'WAKE_UP_ALERT') {
    self.registration.showNotification('ALERTA DE SEGURIDAD', {
      body: event.data.message || 'El sistema requiere su atención inmediata.',
      icon: 'https://picsum.photos/seed/alert/192/192',
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      tag: 'wake-up-alert',
      requireInteraction: true
    } as any);
  }
});

// Handle notification click to return to app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
