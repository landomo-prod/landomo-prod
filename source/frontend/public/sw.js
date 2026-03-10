// Landomo Push Notification Service Worker

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.message || 'New property alert',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: data.url || 'https://landomo.cz' },
    tag: data.property_id || 'landomo-alert',
    renotify: true,
    actions: [
      { action: 'open', title: 'View Property' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  // Add image if available
  if (data.image) {
    options.image = data.image;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Landomo', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || 'https://landomo.cz';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url);
    })
  );
});
