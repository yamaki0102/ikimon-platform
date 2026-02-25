<?php

/**
 * Field Research Mode — Phase 16A (My Field Integration)
 * Full-screen map with GPS tracking, recording, and field boundary display.
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/MyFieldManager.php';

Auth::init();
$currentUser = Auth::user();

// Authentication required — save_track.php requires login.
// Without this guard, users can record GPS but data silently fails to save.
if (!$currentUser) {
    header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
    exit;
}

// Load linked My Field data if ?field=xxx
$linkedField = null;
$fieldId = $_GET['field'] ?? null;
if ($fieldId) {
    $linkedField = MyFieldManager::get($fieldId);
    // Verify ownership
    if ($linkedField && ($linkedField['user_id'] ?? '') !== ($currentUser['id'] ?? '')) {
        $linkedField = null; // Don't show someone else's field
    }
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "調査モード";
    include __DIR__ . '/components/meta.php';
    ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />

    <!-- IndexedDB Wrapper for easier async db operations -->
    <script src="https://unpkg.com/idb@7/build/iife/index-min.js"></script>

    <style>
        /* Fullscreen Map */
        body,
        html {
            height: 100%;
            overflow: hidden;
            background: var(--color-bg-base, #f8fafc);
        }

        #map {
            width: 100%;
            height: 100%;
        }

        /* HUD & Controls */
        .hud-panel {
            position: absolute;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 12px;
            padding: 12px;
            color: var(--color-text, #1e293b);
            z-index: 10;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .top-left {
            top: 16px;
            left: 16px;
        }

        .top-right {
            top: 16px;
            right: 16px;
        }

        .bottom-center {
            bottom: 32px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 12px;
        }

        .stat-value {
            font-family: monospace;
            font-size: 1.2rem;
            font-weight: bold;
        }

        .stat-label {
            font-size: 0.7rem;
            color: var(--color-text-muted, #64748b);
            text-transform: uppercase;
        }

        .btn-control {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            border: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 0.8rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            transition: all 0.2s;
        }

        .btn-control:active {
            transform: scale(0.95);
        }

        .btn-rec {
            background: #ef4444;
            color: white;
        }

        .btn-rec.recording {
            background: #ffffff;
            color: #ef4444;
            animation: pulse 2s infinite;
        }

        .btn-cache {
            background: #3b82f6;
            color: white;
        }

        .btn-grid {
            background: #10b981;
            color: white;
        }

        @keyframes pulse {
            0% {
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
            }

            70% {
                box-shadow: 0 0 0 10px rgba(255, 255, 255, 0);
            }

            100% {
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
            }
        }

        /* ── Top Bar (Back + Mode) ── */
        .top-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            z-index: 20;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .back-link {
            color: var(--color-primary, #10b981);
            text-decoration: none;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .mode-badge {
            font-size: 12px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 999px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        /* ── Camera Button ── */
        .btn-observe {
            background: #f59e0b;
            color: white;
        }

        /* ── Replay Panel ── */
        .replay-panel {
            position: absolute;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 25;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 12px;
            padding: 12px 16px;
            color: var(--color-text, #1e293b);
            font-size: 12px;
            min-width: 300px;
            max-width: 90vw;
            display: none;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }

        .replay-panel.active {
            display: block;
        }

        .replay-slider {
            width: 100%;
            accent-color: #34d399;
            margin: 8px 0;
        }

        .replay-controls {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: center;
        }

        .replay-controls button {
            background: rgba(52, 211, 153, 0.15);
            border: 1px solid rgba(52, 211, 153, 0.3);
            color: #34d399;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
        }

        .replay-controls button:hover {
            background: rgba(52, 211, 153, 0.25);
        }

        .replay-controls button.active {
            background: rgba(52, 211, 153, 0.4);
        }

        .replay-session-list {
            max-height: 120px;
            overflow-y: auto;
            margin-bottom: 8px;
        }

        .replay-session-item {
            padding: 6px 8px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: background 0.15s;
        }

        .replay-session-item:hover {
            background: rgba(52, 211, 153, 0.1);
        }

        /* ── Tools Sub-menu ── */
        .tools-submenu {
            position: absolute;
            top: 120px;
            right: 48px;
            z-index: 15;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 12px;
            padding: 8px;
            display: none;
            flex-direction: column;
            gap: 4px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            min-width: 200px;
        }

        .tools-submenu.active {
            display: flex;
        }

        .tools-submenu__item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border: none;
            background: none;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: var(--color-text, #1e293b);
            cursor: pointer;
            transition: background 0.15s;
        }

        .tools-submenu__item:hover {
            background: rgba(0, 0, 0, 0.05);
        }
    </style>
</head>

<body class="bg-base">

    <!-- Top Bar: Back Link + Mode Badge -->
    <div class="top-bar">
        <a href="ikimon_walk.php" class="back-link">
            ← さんぽ記録に戻る
        </a>
        <?php if ($linkedField): ?>
            <div class="mode-badge" style="background:rgba(52,211,153,0.2);color:#34d399;border:1px solid rgba(52,211,153,0.3);">
                🌿 <?php echo htmlspecialchars($linkedField['name']); ?>
            </div>
        <?php else: ?>
            <div class="mode-badge" style="background:rgba(148,163,184,0.15);color:#94a3b8;border:1px solid rgba(148,163,184,0.2);">
                👣 自由探索
            </div>
        <?php endif; ?>
    </div>

    <div id="map"></div>

    <!-- HUD: Stats -->
    <div class="hud-panel top-left space-y-2" style="top:60px;">
        <div>
            <div class="stat-value" id="hud-dist">0.00 km</div>
            <div class="stat-label">歩行距離</div>
        </div>
        <div>
            <div class="stat-value" id="hud-acc">-- m</div>
            <div class="stat-label">GPS精度</div>
        </div>
        <div>
            <div class="stat-value" id="hud-points">0</div>
            <div class="stat-label">記録ポイント</div>
        </div>
    </div>

    <!-- HUD: Status -->
    <div class="hud-panel top-right text-right" style="top:60px;">
        <div class="flex items-center justify-end gap-2 mb-1">
            <div id="status-indicator" class="w-3 h-3 rounded-full bg-gray-500"></div>
            <span class="font-bold text-sm" id="status-text">準備完了</span>
        </div>
        <div class="text-xs text-gray-400" id="debug-info">ストレージ: 確認中...</div>
    </div>

    <!-- Controls: Main (3 buttons) -->
    <div class="hud-panel bottom-center">
        <button id="btn-replay" class="btn-control" style="color:#a78bfa;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);">
            <i data-lucide="play" class="mb-1"></i>
            再生
        </button>

        <button id="btn-record" class="btn-control btn-rec">
            <i data-lucide="circle-dot" class="mb-1"></i>
            記録
        </button>

        <!-- Camera / Observe Button -->
        <a href="post.php?return=field_research.php" id="btn-observe" class="btn-control btn-observe" style="text-decoration:none;">
            <i data-lucide="camera" class="mb-1"></i>
            投稿
        </a>
    </div>

    <!-- Sub-menu toggle (top-right below status) -->
    <div id="tools-toggle" class="hud-panel" style="top:120px;right:16px;padding:8px;cursor:pointer;" onclick="document.getElementById('tools-submenu').classList.toggle('active')">
        <i data-lucide="settings-2" style="width:20px;height:20px;opacity:0.7;"></i>
    </div>
    <div id="tools-submenu" class="tools-submenu">
        <button id="btn-grid" class="tools-submenu__item">
            <i data-lucide="grid" style="width:16px;height:16px;"></i>
            <span>グリッド表示</span>
        </button>
        <button id="btn-cache" class="tools-submenu__item">
            <i data-lucide="download-cloud" style="width:16px;height:16px;"></i>
            <span>地図を保存（オフライン用）</span>
        </button>
    </div>

    <!-- Replay Panel -->
    <div id="replay-panel" class="replay-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:800;color:#a78bfa;">🔄 軌跡リプレイ</span>
            <button id="replay-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;">✕</button>
        </div>
        <div id="replay-session-list" class="replay-session-list">
            <div style="text-align:center;color:#94a3b8;">読み込み中...</div>
        </div>
        <div id="replay-player" style="display:none;">
            <input type="range" id="replay-slider" class="replay-slider" min="0" max="100" value="0">
            <div class="replay-controls">
                <button id="replay-play">▶ 再生</button>
                <button id="replay-speed" data-speed="1">×1</button>
                <span id="replay-info" style="color:#94a3b8;font-size:10px;"></span>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="js/OfflineMapManager.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/FieldRecorder.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        // Init Icons
        lucide.createIcons();

        // ── My Field context ──
        const FIELD_DATA = <?php echo json_encode($linkedField); ?>;

        // Determine initial center
        const initialCenter = FIELD_DATA && FIELD_DATA.center ? [FIELD_DATA.center.lng, FIELD_DATA.center.lat] : [137.73, 34.71];
        const initialZoom = FIELD_DATA ? 15 : 14;

        // Prevent screen sleep (Wake Lock API)
        let wakeLock = null;
        async function requestWakeLock() {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
                wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
            } catch (err) {
                console.error(`${err.name}, ${err.message}`);
            }
        }
        document.addEventListener('click', requestWakeLock, {
            once: true
        });
        // Re-acquire Wake Lock on page visibility change (e.g. returning from post.php)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !wakeLock) {
                requestWakeLock();
            }
        });

        // Initialize Map (デフォルト: 浜松。GPS取得後に現在地へ移動)
        const map = new maplibregl.Map({
            container: 'map',
            style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
            center: initialCenter,
            zoom: initialZoom
        });

        // フィールド未指定時は現在地にflyTo
        if (!FIELD_DATA && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                map.flyTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 15,
                    duration: 1500
                });
            }, () => {}, {
                enableHighAccuracy: true,
                timeout: 5000
            });
        }

        // ── Draw field boundary circle ──
        map.on('load', () => {
            if (FIELD_DATA && FIELD_DATA.center) {
                const lat = FIELD_DATA.center.lat;
                const lng = FIELD_DATA.center.lng;
                const radius = FIELD_DATA.radius || 500;

                // Generate circle polygon
                const points = 64;
                const coords = [];
                for (let i = 0; i <= points; i++) {
                    const angle = (i / points) * Math.PI * 2;
                    const dx = (radius / 111320) * Math.cos(angle);
                    const dy = (radius / (111320 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
                    coords.push([lng + dy, lat + dx]);
                }

                map.addSource('my-field-boundary', {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [coords]
                        }
                    }
                });
                map.addLayer({
                    id: 'my-field-fill',
                    type: 'fill',
                    source: 'my-field-boundary',
                    paint: {
                        'fill-color': '#34d399',
                        'fill-opacity': 0.08
                    }
                });
                map.addLayer({
                    id: 'my-field-border',
                    type: 'line',
                    source: 'my-field-boundary',
                    paint: {
                        'line-color': '#34d399',
                        'line-width': 2,
                        'line-dasharray': [4, 2],
                        'line-opacity': 0.5
                    }
                });

                // Center marker
                const dot = document.createElement('div');
                dot.style.cssText = 'width:8px;height:8px;background:#34d399;border-radius:50%;box-shadow:0 0 6px rgba(52,211,153,0.5);';
                new maplibregl.Marker({
                    element: dot
                }).setLngLat([lng, lat]).addTo(map);
            }
        });

        // Modules
        const offlineManager = new OfflineMapManager(map);
        const recorder = new FieldRecorder(map, FIELD_DATA?.id ?? null);

        // Bind UI
        document.getElementById('btn-grid').onclick = () => recorder.toggleGrid();
        document.getElementById('btn-record').onclick = () => recorder.toggleRecording();
        document.getElementById('btn-cache').onclick = () => offlineManager.cacheCurrentArea();

        // Update HUD loop
        const btnObserve = document.getElementById('btn-observe');
        const baseObserveHref = btnObserve.getAttribute('href');
        setInterval(() => {
            const stats = recorder.getStats();
            document.getElementById('hud-dist').innerText = (stats.distance / 1000).toFixed(2) + ' km';
            document.getElementById('hud-points').innerText = stats.points;

            const acc = recorder.getCurrentAccuracy();
            document.getElementById('hud-acc').innerText = acc ? Math.round(acc) + ' m' : '-- m';

            document.getElementById('btn-record').classList.toggle('recording', recorder.isRecording);
            document.getElementById('btn-record').innerHTML = recorder.isRecording ?
                '<i data-lucide="square" class="mb-1"></i>停止' :
                '<i data-lucide="circle-dot" class="mb-1"></i>記録';

            // Update observe button with session context
            if (recorder.isRecording && recorder.sessionId) {
                btnObserve.href = baseObserveHref + '&field_session=' + encodeURIComponent(recorder.sessionId);
            } else {
                btnObserve.href = baseObserveHref;
            }

            lucide.createIcons();
        }, 1000);

        // ── Track Replay ──
        (function() {
            const replayBtn = document.getElementById('btn-replay');
            const panel = document.getElementById('replay-panel');
            const sessionList = document.getElementById('replay-session-list');
            const playerDiv = document.getElementById('replay-player');
            const slider = document.getElementById('replay-slider');
            const playBtn = document.getElementById('replay-play');
            const speedBtn = document.getElementById('replay-speed');
            const infoEl = document.getElementById('replay-info');
            const closeBtn = document.getElementById('replay-close');

            let replayData = null;
            let replayAnim = null;
            let replayIdx = 0;
            let replaySpeed = 1;
            let isPlaying = false;

            replayBtn.onclick = () => {
                panel.classList.toggle('active');
                if (panel.classList.contains('active')) loadSessions();
            };
            closeBtn.onclick = () => {
                panel.classList.remove('active');
                stopReplay();
            };

            async function loadSessions() {
                try {
                    // If field_id is present, filter. If not, get all (Free Roam)
                    const url = FIELD_DATA ?
                        `api/get_tracks.php?field_id=${encodeURIComponent(FIELD_DATA.id)}` :
                        `api/get_tracks.php`;

                    const resp = await fetch(url);
                    const data = await resp.json();
                    if (!data.success || !data.sessions.length) {
                        sessionList.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:12px;">まだ軌跡がありません<br><span style="font-size:10px;">「記録」ボタンで調査を開始しよう！</span></div>';
                        return;
                    }
                    sessionList.innerHTML = data.sessions.map(s => `
                        <div class="replay-session-item" data-session="${s.session_id}">
                            <span>${s.started_at ? new Date(s.started_at).toLocaleDateString('ja') : '---'}</span>
                            <span style="color:#a78bfa;font-weight:700;">${(s.total_distance/1000).toFixed(1)} km · ${s.point_count} ポイント</span>
                        </div>
                    `).join('');

                    sessionList.querySelectorAll('.replay-session-item').forEach(el => {
                        el.onclick = () => loadTrack(el.dataset.session);
                    });
                } catch (e) {
                    sessionList.innerHTML = '<div style="text-align:center;color:#f87171;">読み込みに失敗しました</div>';
                }
            }

            async function loadTrack(sessionId) {
                stopReplay();
                try {
                    // Fetch track points
                    let url = `api/get_tracks.php?session_id=${encodeURIComponent(sessionId)}`;
                    if (FIELD_DATA) {
                        url += `&field_id=${encodeURIComponent(FIELD_DATA.id)}`;
                    }
                    const resp = await fetch(url);
                    const data = await resp.json();
                    if (!data.success || !data.track?.points?.length) return;

                    replayData = data.track.points;
                    slider.max = replayData.length - 1;
                    slider.value = 0;
                    replayIdx = 0;
                    playerDiv.style.display = 'block';
                    infoEl.textContent = `${replayData.length} ポイント`;

                    // Draw full ghost track
                    const coords = replayData.map(p => [p.lng, p.lat]);
                    if (map.getSource('replay-ghost')) {
                        map.getSource('replay-ghost').setData({
                            type: 'Feature',
                            geometry: {
                                type: 'LineString',
                                coordinates: coords
                            }
                        });
                    } else {
                        map.addSource('replay-ghost', {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: coords
                                }
                            }
                        });
                        map.addLayer({
                            id: 'replay-ghost-line',
                            type: 'line',
                            source: 'replay-ghost',
                            paint: {
                                'line-color': '#a78bfa',
                                'line-width': 2,
                                'line-opacity': 0.3,
                                'line-dasharray': [4, 2]
                            }
                        });
                    }
                    if (!map.getSource('replay-active')) {
                        map.addSource('replay-active', {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: []
                                }
                            }
                        });
                        map.addLayer({
                            id: 'replay-active-line',
                            type: 'line',
                            source: 'replay-active',
                            paint: {
                                'line-color': '#a78bfa',
                                'line-width': 4
                            }
                        });
                    }

                    // Fit bounds
                    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
                    map.fitBounds(bounds, {
                        padding: 60
                    });
                } catch (e) {
                    console.error('[Replay] Load failed:', e);
                }
            }

            slider.oninput = () => {
                replayIdx = parseInt(slider.value);
                renderReplayFrame();
            };

            playBtn.onclick = () => {
                if (isPlaying) {
                    stopReplay();
                    return;
                }
                if (!replayData) return;
                isPlaying = true;
                playBtn.textContent = '⏸ 停止';
                playBtn.classList.add('active');
                animateReplay();
            };

            speedBtn.onclick = () => {
                const speeds = [1, 2, 5, 10];
                const idx = speeds.indexOf(replaySpeed);
                replaySpeed = speeds[(idx + 1) % speeds.length];
                speedBtn.textContent = `×${replaySpeed}`;
            };

            function animateReplay() {
                if (!isPlaying || !replayData) return;
                replayIdx += replaySpeed;
                if (replayIdx >= replayData.length) {
                    replayIdx = replayData.length - 1;
                    stopReplay();
                    return;
                }
                slider.value = replayIdx;
                renderReplayFrame();
                replayAnim = requestAnimationFrame(animateReplay);
            }

            function renderReplayFrame() {
                if (!replayData) return;
                const slice = replayData.slice(0, replayIdx + 1).map(p => [p.lng, p.lat]);
                if (map.getSource('replay-active')) {
                    map.getSource('replay-active').setData({
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: slice
                        }
                    });
                }
                const last = slice[slice.length - 1];
                if (last) map.panTo(last, {
                    animate: false
                });
                infoEl.textContent = `${replayIdx + 1} / ${replayData.length}`;
            }

            function stopReplay() {
                isPlaying = false;
                if (replayAnim) cancelAnimationFrame(replayAnim);
                playBtn.textContent = '▶ 再生';
                playBtn.classList.remove('active');
            }
        })();
    </script>
</body>

</html>