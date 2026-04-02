const CACHE_NAME = 'ikimon-v17-shell';
const PHOTO_CACHE = 'ikimon-v17-photos';
const ASSETS_TO_CACHE = [
    'offline.html',
    'js/OfflineManager.js',
    'js/ToastManager.js',
    'js/HapticEngine.js',
    'js/SoundManager.js',
    'js/MotionEngine.js',
    'assets/css/tokens.css',
    'assets/css/style.css',
    'assets/css/skeleton.css',
    'assets/css/input.css',
    'assets/img/icon-192.png',
    'manifest.json'
];

// Install Event: Cache Shell + Specific Assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
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
                if (key !== CACHE_NAME && key !== PHOTO_CACHE) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Fetch Event: Smart Strategy per resource type
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests (POST for form submission etc.)
    if (event.request.method !== 'GET') return;

    // Skip API calls — always fetch fresh (except taxon_suggest)
    if (url.pathname.includes('/api/')) {
        // taxon_suggest: NetworkFirst with short cache for offline autocomplete
        if (url.pathname.includes('taxon_suggest')) {
            event.respondWith(
                fetch(event.request)
                    .then(response => {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                        return response;
                    })
                    .catch(() => caches.match(event.request).then(res => res || new Response('{"results":[]}', { headers: { 'Content-Type': 'application/json' } })))
            );
            return;
        }
        return;
    }

    // Audio voice guide files → SW完全バイパス（Rangeリクエスト/ストリーミングはSWキャッシュと非互換）
    if (url.pathname.includes('/uploads/audio/')) {
        return;
    }

    // User-uploaded photos → Cache First (immutable content)
    if (url.pathname.includes('/uploads/photos/')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(PHOTO_CACHE).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 404 }));
            })
        );
        return;
    }

    // Post flow should always prefer fresh assets/html to avoid stale UI on mobile
    if (
        url.pathname.endsWith('/post.php') || url.pathname === '/post.php' ||
        url.pathname.endsWith('/explore.php') || url.pathname === '/explore.php' ||
        url.pathname.endsWith('/map.php') || url.pathname === '/map.php'
    ) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request).then(res => res || caches.match('offline.html')))
        );
        return;
    }

    // Navigation requests (HTML) → Network First, Fallback to Cache/Offline
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(res => res || caches.match('offline.html'));
                })
        );
        return;
    }

    // JS/CSS assets → Network First (prevents stale UI after deploy)
    if (url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Other Static Assets → Stale While Revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => cached);

            return cached || fetched;
        })
    );
});

