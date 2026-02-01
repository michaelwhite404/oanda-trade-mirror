/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache and route assets
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const { title, body, icon, badge, tag, data: notificationData } = data;

    const options = {
      body,
      icon: icon || '/icon-192.png',
      badge: badge || '/icon-192.png',
      tag,
      data: notificationData,
      requireInteraction: false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('[SW] Failed to show push notification:', error);
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Skip waiting and claim clients immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
