// Wird vom generierten Service-Worker per importScripts geladen (vite.config.ts).
// Nachrichten kommen von api/gesuche.ts: { titel, text, url }.

self.addEventListener('push', event => {
  const daten = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(daten.titel || 'SØRGEL-design', {
      body: daten.text || '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: daten.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const ziel = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(fenster => {
      const offen = fenster.find(f => f.url.startsWith(self.location.origin));
      if (offen) return offen.navigate(ziel).then(f => (f || offen).focus());
      return self.clients.openWindow(ziel);
    }),
  );
});
