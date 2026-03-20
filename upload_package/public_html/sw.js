const CACHE_NAME = 'ikimon-v12-shell';
const PHOTO_CACHE = 'ikimon-v12-photos';
const ASSETS_TO_CACHE = [
    './',
    'index.php',
    'post.php',
    'explore.php',
    'map.php',
    'login.php',
    'ranking.php',
    'profile.php',
    'analytics.php',
    'zukan.php',
    'species.php',
    'id_wizard.php',
    'site_dashboard.php',
    'offline.html',
    'js/OfflineManager.js?v=2.2',
    'js/ToastManager.js',
    'js/HapticEngine.js',
    'js/SoundManager.js',
    'js/MotionEngine.js',
    'assets/css/tokens.css?v=2.1',
    'assets/css/style.css?v=2.1',
    'assets/css/skeleton.css?v=2.1',
    'assets/css/input.css?v=2.1',
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

    // Emergency route switch: stale clients may still POST to the poisoned
    // post_observation.php path, so forward those requests to the safe alias.
    if (event.request.method === 'POST' && url.pathname.endsWith('/api/post_observation.php')) {
        event.respondWith((async () => {
            const body = await event.request.clone().blob();
            const rewrittenRequest = new Request(`${self.location.origin}/api/post_identification.php?_route=observation`, {
                method: event.request.method,
                headers: event.request.headers,
                body,
                credentials: event.request.credentials,
                mode: event.request.mode,
                cache: 'no-store',
                redirect: event.request.redirect,
                referrer: event.request.referrer,
                referrerPolicy: event.request.referrerPolicy,
                integrity: event.request.integrity,
                keepalive: event.request.keepalive,
            });

            return fetch(rewrittenRequest);
        })());
        return;
    }

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

    // CSS files → Network First (prevents stale style flash)
    if (url.pathname.endsWith('.css')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request, { ignoreSearch: true }))
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

