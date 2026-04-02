// sw.js is deprecated. Use /sw.php instead (registered via meta.php on all pages).
// This file self-unregisters to clean up browsers that still have it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('ikimon-v')).map(k => caches.delete(k))))
            .then(() => self.registration.unregister())
    );
});
