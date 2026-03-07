<?php

/**
 * Exploration Map — たんけんマップ
 * Full-screen fog-of-war map showing explored areas, trails, and observations.
 * GPS recording with real-time fog reveal.
 */
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';

Auth::init();
$currentUser = Auth::user();

if (!$currentUser) {
    header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php
    $meta_title = "たんけんマップ";
    include __DIR__ . '/components/meta.php';
    ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
    <script src="https://unpkg.com/idb@7/build/iife/index-min.js"></script>

    <style>
        *, *::before, *::after { box-sizing: border-box; }
        body, html { height: 100%; margin: 0; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        #map { width: 100%; height: 100%; }

        /* ── Glass Panel ── */
        .glass {
            background: rgba(255,255,255,0.88);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 14px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        }

        /* ── Top Bar ── */
        .top-bar {
            position: absolute; top: 0; left: 0; right: 0; z-index: 20;
            background: rgba(255,255,255,0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(0,0,0,0.06);
            padding: 10px 16px;
            display: flex; align-items: center; justify-content: space-between;
        }
        .top-bar a { color: #10b981; text-decoration: none; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
        .top-bar-title { font-size: 15px; font-weight: 800; color: #1e293b; }

        /* ── Stats Panel (top-left) ── */
        .stats-panel {
            position: absolute; top: 56px; left: 12px; z-index: 15;
            padding: 10px 14px;
            display: flex; flex-direction: column; gap: 2px;
            min-width: 130px;
        }
        .stats-panel .stat-row { display: flex; align-items: baseline; gap: 6px; }
        .stats-panel .stat-value { font-family: 'SF Mono', monospace; font-size: 1.1rem; font-weight: 800; color: #1e293b; }
        .stats-panel .stat-label { font-size: 0.65rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .stats-panel .stat-value.highlight { color: #10b981; }

        /* ── Period Filter (below stats) ── */
        .period-bar {
            position: absolute; top: 56px; left: 160px; z-index: 15;
            padding: 6px;
            display: flex; gap: 2px;
        }
        .period-btn {
            border: none; background: none; padding: 5px 10px; border-radius: 8px;
            font-size: 11px; font-weight: 700; color: #64748b; cursor: pointer;
            transition: all 0.15s;
        }
        .period-btn:hover { background: rgba(16,185,129,0.1); }
        .period-btn.active { background: #10b981; color: #fff; }

        /* ── Bottom Action Bar ── */
        .bottom-bar {
            position: absolute; bottom: max(24px, env(safe-area-inset-bottom, 16px)); left: 50%; transform: translateX(-50%); z-index: 20;
            display: flex; gap: 12px; align-items: center;
            padding: 8px 12px;
        }
        .action-btn {
            width: 56px; height: 56px; border-radius: 50%; border: none;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-size: 0.7rem; font-weight: 700; cursor: pointer;
            box-shadow: 0 3px 12px rgba(0,0,0,0.15);
            transition: all 0.15s;
            text-decoration: none;
        }
        .action-btn:active { transform: scale(0.93); }
        .action-btn i { margin-bottom: 2px; }

        .btn-observe { background: #f59e0b; color: #fff; }
        .btn-locate { background: #fff; color: #3b82f6; border: 1px solid rgba(0,0,0,0.08); width: 44px; height: 44px; }

        /* ── GPS Status Indicator ── */
        .gps-dot {
            width: 8px; height: 8px; border-radius: 50%;
            animation: gps-pulse 2s ease-in-out infinite;
        }
        .gps-dot.good { background: #22c55e; }
        .gps-dot.fair { background: #f59e0b; }
        .gps-dot.poor { background: #ef4444; }
        .gps-dot.off  { background: #d1d5db; animation: none; }
        @keyframes gps-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* ── Layer Toggle Button ── */
        .layer-btn {
            position: absolute; top: 56px; right: 12px; z-index: 15;
            width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
        }

        /* ── Layer Sheet ── */
        .layer-sheet {
            position: absolute; top: 100px; right: 12px; z-index: 15;
            padding: 12px 16px; min-width: 200px;
        }
        .layer-sheet h4 { margin: 0 0 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
        .layer-item {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.04);
            font-size: 13px; font-weight: 600; color: #1e293b; cursor: pointer;
        }
        .layer-item:last-child { border-bottom: none; }
        .layer-toggle {
            width: 36px; height: 20px; border-radius: 10px; border: none;
            position: relative; cursor: pointer; transition: background 0.2s;
        }
        .layer-toggle.on { background: #10b981; }
        .layer-toggle.off { background: #d1d5db; }
        .layer-toggle::after {
            content: ''; position: absolute; top: 2px; width: 16px; height: 16px;
            border-radius: 50%; background: #fff; transition: left 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .layer-toggle.on::after { left: 18px; }
        .layer-toggle.off::after { left: 2px; }

        /* Loading indicator */
        .loading-bar {
            position: absolute; top: 46px; left: 0; right: 0; height: 3px; z-index: 30;
            background: linear-gradient(90deg, transparent, #10b981, transparent);
            animation: loading-slide 1s ease-in-out infinite;
        }
        @keyframes loading-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

        /* Mobile adjustments */
        @media (max-width: 640px) {
            .period-bar { top: auto; bottom: max(90px, calc(env(safe-area-inset-bottom, 16px) + 72px)); left: 50%; transform: translateX(-50%); }
            .stats-panel { top: 52px; left: 8px; padding: 8px 10px; }
            .stats-panel .stat-value { font-size: 0.95rem; }
        }
    </style>
</head>

<body x-data="explorationApp()" x-init="init()">

    <!-- Loading Bar -->
    <div class="loading-bar" x-show="loading" x-cloak></div>

    <!-- Top Bar -->
    <div class="top-bar">
        <a href="ikimon_walk.php">
            <i data-lucide="chevron-left" style="width:16px;height:16px;"></i>
            さんぽ記録
        </a>
        <span class="top-bar-title">たんけんマップ</span>
        <div style="width:60px;"></div>
    </div>

    <!-- Map -->
    <div id="map"></div>

    <!-- Stats Panel -->
    <div class="stats-panel glass">
        <div class="stat-row">
            <span class="stat-value highlight" x-text="formatArea(stats.explored_area_m2 || 0)"></span>
        </div>
        <div class="stat-label">探索面積</div>
        <div class="stat-row" style="margin-top:4px;">
            <span class="stat-value" x-text="(stats.explored_cells || 0).toLocaleString()"></span>
            <span class="stat-label">セル</span>
        </div>
        <div class="stat-row">
            <span class="stat-value" x-text="(stats.observation_count || 0).toLocaleString()"></span>
            <span class="stat-label">観察</span>
        </div>
        <div class="stat-row">
            <span class="stat-value" x-text="formatDistance(stats.total_distance_m || 0)"></span>
            <span class="stat-label">総距離</span>
        </div>
        <div class="stat-row" style="margin-top:2px;">
            <div class="gps-dot" :class="gpsAccuracy ? (gpsAccuracy <= 10 ? 'good' : gpsAccuracy <= 30 ? 'fair' : 'poor') : 'off'" style="margin-right:4px;"></div>
            <span class="stat-value" x-text="gpsAccuracy ? gpsAccuracy + ' m' : '--'" style="font-size:0.85rem;"></span>
            <span class="stat-label">GPS</span>
        </div>
    </div>

    <!-- Period Filter (desktop: top, mobile: bottom) -->
    <div class="period-bar glass">
        <template x-for="p in periods" :key="p.value">
            <button class="period-btn"
                :class="{ active: period === p.value }"
                @click="setPeriod(p.value)"
                x-text="p.label"></button>
        </template>
    </div>

    <!-- Layer Toggle -->
    <button class="layer-btn glass" @click="showLayers = !showLayers">
        <i data-lucide="layers" style="width:18px;height:18px;opacity:0.7;"></i>
    </button>

    <!-- Layer Sheet -->
    <div class="layer-sheet glass" x-show="showLayers" x-cloak @click.outside="showLayers = false">
        <h4>レイヤー</h4>
        <div class="layer-item" @click="toggleLayer('fog')">
            <button class="layer-toggle" :class="layerFlags.fog ? 'on' : 'off'"></button>
            <span>霧（Fog of War）</span>
        </div>
        <div class="layer-item" @click="toggleLayer('trails')">
            <button class="layer-toggle" :class="layerFlags.trails ? 'on' : 'off'"></button>
            <span>移動軌跡</span>
        </div>
        <div class="layer-item" @click="toggleLayer('observations')">
            <button class="layer-toggle" :class="layerFlags.observations ? 'on' : 'off'"></button>
            <span>観察ポイント</span>
        </div>
    </div>

    <!-- Bottom Action Bar -->
    <div class="bottom-bar glass">
        <!-- Locate -->
        <button class="action-btn btn-locate" @click="flyToCurrentLocation()">
            <i data-lucide="locate" style="width:20px;height:20px;"></i>
        </button>

        <!-- Observe -->
        <a :href="'post.php?return=field_research.php&field_session=' + encodeURIComponent(recorder?.sessionId || '')"
           class="action-btn btn-observe">
            <i data-lucide="camera" style="width:20px;height:20px;"></i>
            <span>投稿</span>
        </a>
    </div>

    <!-- Scripts -->
    <script src="js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/OfflineMapManager.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/FieldRecorder.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script src="js/ExplorationMap.js" nonce="<?= CspNonce::attr() ?>"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        function explorationApp() {
            return {
                // State
                period: 'all',
                periods: [
                    { value: 'today', label: '今日' },
                    { value: 'week',  label: '今週' },
                    { value: 'month', label: '今月' },
                    { value: 'year',  label: '今年' },
                    { value: 'all',   label: 'すべて' },
                ],
                stats: {},
                showLayers: false,
                loading: false,
                layerFlags: { fog: true, trails: true, observations: true },
                gpsAccuracy: null,

                // Refs
                map: null,
                explorationMap: null,
                recorder: null,
                wakeLock: null,
                _prevPosition: null,

                init() {
                    lucide.createIcons();

                    // Init map
                    this.map = new maplibregl.Map({
                        container: 'map',
                        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                        center: [137.73, 34.71],
                        zoom: 14
                    });

                    // Fly to current location
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(pos => {
                            this.map.flyTo({
                                center: [pos.coords.longitude, pos.coords.latitude],
                                zoom: 15, duration: 1500
                            });
                        }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                    }

                    // Init ExplorationMap (fog overlay)
                    this.explorationMap = new ExplorationMap(this.map, {
                        gridM: 100,
                        period: this.period,
                        onStatsUpdate: (s) => { this.stats = s; },
                        onLoadStart: () => { this.loading = true; },
                        onLoadEnd: () => { this.loading = false; },
                    });

                    // Init FieldRecorder (GPS tracking)
                    this.recorder = new FieldRecorder(this.map, null);

                    // Step Counter
                    if (typeof StepCounter !== 'undefined' && StepCounter.isSupported()) {
                        window._stepCounter = new StepCounter();
                    }

                    // Auto-start passive GPS tracking
                    this._startPassiveTracking();

                    // Wake Lock
                    document.addEventListener('click', () => this._requestWakeLock(), { once: true });
                    document.addEventListener('visibilitychange', () => {
                        if (document.visibilityState === 'visible' && !this.wakeLock) {
                            this._requestWakeLock();
                        }
                    });

                    // Stop recording on page unload
                    window.addEventListener('beforeunload', () => {
                        if (this.recorder?.isRecording) {
                            this.recorder.stopRecording();
                        }
                    });
                },

                // ── Passive Tracking ──

                _startPassiveTracking() {
                    // Request motion permission for step counter
                    if (window._stepCounter) {
                        window._stepCounter.requestPermission().catch(() => {});
                    }

                    // Start recording if not already restored from previous session
                    if (!this.recorder.isRecording) {
                        this.recorder.startRecording();
                    }

                    // Hook into recorder for real-time fog updates with speed
                    const origProcess = this.recorder.processPosition.bind(this.recorder);
                    this.recorder.processPosition = (pos) => {
                        origProcess(pos);

                        // Update GPS accuracy display
                        this.gpsAccuracy = Math.round(pos.coords.accuracy);

                        if (pos.coords.accuracy > 50) return;

                        // Calculate speed (km/h)
                        let speedKmh = null;
                        if (pos.coords.speed != null && pos.coords.speed >= 0) {
                            speedKmh = pos.coords.speed * 3.6;
                        } else if (this._prevPosition) {
                            const d = this.recorder.calcDistance(
                                this._prevPosition.lat, this._prevPosition.lng,
                                pos.coords.latitude, pos.coords.longitude
                            );
                            const dt = (pos.timestamp - this._prevPosition.timestamp) / 1000;
                            if (dt > 0) speedKmh = (d / dt) * 3.6;
                        }

                        // Update fog with speed tier
                        if (this.explorationMap) {
                            this.explorationMap.addExploredPoint(
                                pos.coords.latitude, pos.coords.longitude, speedKmh
                            );
                        }

                        this._prevPosition = {
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                            timestamp: pos.timestamp
                        };
                    };
                },

                // ── Actions ──

                setPeriod(p) {
                    this.period = p;
                    this.explorationMap.setPeriod(p);
                },

                toggleLayer(layer) {
                    this.layerFlags[layer] = !this.layerFlags[layer];
                    this.explorationMap.setLayer(layer, this.layerFlags[layer]);
                },

                flyToCurrentLocation() {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(pos => {
                        this.map.flyTo({
                            center: [pos.coords.longitude, pos.coords.latitude],
                            zoom: 16, duration: 1000
                        });
                    }, () => {}, { enableHighAccuracy: true, timeout: 5000 });
                },

                // ── Format Helpers ──

                formatArea(m2) {
                    if (m2 >= 1_000_000) return (m2 / 1_000_000).toFixed(1) + ' km\u00B2';
                    return m2.toLocaleString() + ' m\u00B2';
                },

                formatDistance(m) {
                    if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
                    return Math.round(m) + ' m';
                },

                // ── Wake Lock ──

                async _requestWakeLock() {
                    try {
                        this.wakeLock = await navigator.wakeLock.request('screen');
                        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
                    } catch (e) { /* not supported or denied */ }
                }
            };
        }
    </script>
</body>

</html>
