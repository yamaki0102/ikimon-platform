<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Asset.php';

$version = Asset::pwaVersion();

header('Content-Type: application/javascript; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
?>
const CACHE_NAME = 'ikimon-pwa-shell-v<?= $version ?>';
const PHOTO_CACHE = 'ikimon-pwa-photos-v<?= $version ?>';
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
    'assets/img/pwa-icon-192.png',
    'manifest.php'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME && key !== PHOTO_CACHE) {
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (event.request.method !== 'GET') return;

    // 音声ファイルはSWをバイパス（Rangeリクエスト互換性問題回避）
    if (url.pathname.includes('/uploads/audio/') || url.pathname.includes('/assets/audio/')) {
        return;
    }

    if (url.pathname.includes('/api/')) {
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

    if (
        url.pathname.endsWith('/post.php') || url.pathname === '/post.php' ||
        url.pathname.endsWith('/explore.php') || url.pathname === '/explore.php' ||
        url.pathname.endsWith('/map.php') || url.pathname === '/map.php'
    ) {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request).then(res => res || caches.match('offline.html')))
        );
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => caches.match(event.request).then(res => res || caches.match('offline.html')))
        );
        return;
    }

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
