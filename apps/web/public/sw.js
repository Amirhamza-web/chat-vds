// Service worker for push notifications.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'ChatVDS', {
        body: payload.body || '',
        icon: '/favicon.ico',
        data: payload.data,
      }),
    );
  } catch {
    // ignore malformed payloads
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  if (data && data.channelId) {
    event.waitUntil(clients.openWindow('/'));
  }
});
