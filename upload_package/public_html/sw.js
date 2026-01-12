const CACHE_NAME = 'ikimon-v2-shell';
const ASSETS_TO_CACHE = [
    './',
    'index.php',
    'post.php',
    'explore.php',
    'ranking.php',
    'profile.php',
    'js/OfflineManager.js',
    'js/ToastManager.js'
];

// Install Event: Cache Core Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Cleanup Old Caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch Event: Network First, then Cache (for dynamic content), Cache First for static
self.addEventListener('fetch', (event) => {
    // Navigation requests (HTML) -> Network First, Fallback to Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    return caches.match(event.request)
                        .then(res => res || caches.match('index.php')); // Fallback to index if specific page missing
                })
        );
        return;
    }

    // Static Assets -> Cache First
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
