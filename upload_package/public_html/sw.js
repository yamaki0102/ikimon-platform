// Temporary service worker reset.
// The previous worker cached dynamic HTML and could keep stale logged-in pages alive.
// This worker clears old caches, unregisters itself, and lets the network serve pages directly.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();

        const clients = await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true,
        });

        await Promise.all(clients.map((client) => client.navigate(client.url)));
    })());
});
