<?php

/**
 * Site Editor - Draw & Save Site Boundaries
 * 
 * Features:
 * - MapLibre GL JS + mapbox-gl-draw for polygon drawing
 * - Multiple polygon support (飛び地対応 → MultiPolygon)
 * - Form for site metadata (name, description, address)
 * - Save to GeoJSON via API
 * - Edit existing site boundaries
 * 
 * Usage: 
 *   site_editor.php          → New site
 *   site_editor.php?site=xxx → Edit existing site
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SiteManager.php';

Auth::init();
$currentUser = Auth::user();

// Redirect if not logged in
if (!$currentUser) {
    header('Location: login.php');
    exit;
}

// Load existing site for editing
$editSiteId = $_GET['site'] ?? '';
$editSite = null;
$editGeojson = null;
if ($editSiteId) {
    $editSite = SiteManager::load($editSiteId);
    $editGeojson = SiteManager::getGeoJSON($editSiteId);
}

$meta_title = $editSite ? $editSite['name'] . ' を編集' : '新しいサイトを作成';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />

    <!-- MapLibre GL Draw (Mapbox GL Draw fork for MapLibre) -->
    <script src="https://unpkg.com/@mapbox/mapbox-gl-draw@1.4.3/dist/mapbox-gl-draw.js"></script>
    <link href="https://unpkg.com/@mapbox/mapbox-gl-draw@1.4.3/dist/mapbox-gl-draw.css" rel="stylesheet" />

    <style>
        nav {
            background-color: #05070a !important;
            backdrop-filter: none !important;
        }

        .glass-card {
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 1rem;
        }

        /* Draw mode indicator */
        .draw-active {
            animation: draw-pulse 1.5s ease-in-out infinite;
        }

        @keyframes draw-pulse {

            0%,
            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
            }

            50% {
                box-shadow: 0 0 0 12px rgba(16, 185, 129, 0);
            }
        }

        /* Override mapbox-gl-draw controls styling */
        .mapboxgl-ctrl-group {
            background: rgba(15, 23, 42, 0.9) !important;
            border: 1px solid rgba(255, 255, 255, 0.1) !important;
            border-radius: 12px !important;
            overflow: hidden;
        }

        .mapboxgl-ctrl-group button {
            background-color: transparent !important;
            border-color: rgba(255, 255, 255, 0.05) !important;
        }

        .mapboxgl-ctrl-group button:hover {
            background-color: rgba(16, 185, 129, 0.2) !important;
        }

        .mapboxgl-ctrl-group button.active {
            background-color: rgba(16, 185, 129, 0.3) !important;
        }

        /* Input styling */
        .form-input {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.75rem;
            padding: 0.75rem 1rem;
            color: white;
            width: 100%;
            transition: border-color 0.2s;
        }

        .form-input:focus {
            outline: none;
            border-color: rgba(16, 185, 129, 0.5);
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .form-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
        }

        /* Step indicator */
        .step-dot {
            transition: all 0.3s;
        }

        .step-dot.active {
            background: #10b981;
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
        }

        .step-dot.done {
            background: #06b6d4;
        }
    </style>
</head>

<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <?php if (!$currentUser): ?>
        <!-- Login Required -->
        <main class="min-h-screen flex items-center justify-center px-4">
            <div class="glass-card p-8 text-center max-w-sm">
                <div class="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="lock" class="w-8 h-8 text-emerald-500"></i>
                </div>
                <h1 class="text-xl font-bold mb-2">ログインが必要です</h1>
                <p class="text-gray-400 text-sm mb-6">サイトを作成・編集するにはログインしてください。</p>
                <a href="login.php" class="inline-block bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition">
                    ログイン
                </a>
            </div>
        </main>
    <?php else: ?>

        <main class="relative w-full h-screen overflow-hidden" x-data="siteEditor()">

            <!-- Full-Screen Map -->
            <div id="editor-map" class="absolute inset-0 w-full h-full z-0"></div>

            <!-- Top Bar -->
            <div class="absolute top-16 left-4 right-4 z-20 pointer-events-auto">
                <div class="glass-card p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <a href="site_dashboard.php" class="text-gray-400 hover:text-white transition">
                            <i data-lucide="arrow-left" class="w-5 h-5"></i>
                        </a>
                        <div>
                            <h1 class="font-bold text-lg leading-tight" x-text="editMode ? siteName + ' を編集' : '新しいサイトを作成'"></h1>
                            <p class="text-xs text-gray-400">地図上でエリアの境界線を描画してください</p>
                        </div>
                    </div>

                    <!-- Step Indicators -->
                    <div class="hidden md:flex items-center gap-2">
                        <div class="flex items-center gap-1">
                            <div class="step-dot w-3 h-3 rounded-full bg-gray-600" :class="{ 'active': step === 1, 'done': step > 1 }"></div>
                            <span class="text-[10px] text-gray-500">描画</span>
                        </div>
                        <div class="w-6 h-px bg-gray-700"></div>
                        <div class="flex items-center gap-1">
                            <div class="step-dot w-3 h-3 rounded-full bg-gray-600" :class="{ 'active': step === 2, 'done': step > 2 }"></div>
                            <span class="text-[10px] text-gray-500">情報</span>
                        </div>
                        <div class="w-6 h-px bg-gray-700"></div>
                        <div class="flex items-center gap-1">
                            <div class="step-dot w-3 h-3 rounded-full bg-gray-600" :class="{ 'active': step === 3 }"></div>
                            <span class="text-[10px] text-gray-500">保存</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Drawing Tools Help (Step 1) -->
            <div x-show="step === 1 && !hasPolygon"
                x-transition
                class="absolute top-36 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div class="glass-card px-6 py-4 text-center max-w-xs">
                    <div class="text-emerald-400 mb-2">
                        <i data-lucide="pentagon" class="w-8 h-8 mx-auto"></i>
                    </div>
                    <p class="text-sm font-bold mb-1">エリアを描画</p>
                    <p class="text-xs text-gray-400">左のツールで「ポリゴン描画」を選び、<br>地図上をクリックして境界線を描いてください</p>
                    <div class="mt-3 text-[10px] text-gray-500">
                        飛び地がある場合は複数のポリゴンを描けます
                    </div>
                </div>
            </div>

            <!-- Polygon Drawn → Next Step Button (Step 1) -->
            <div x-show="step === 1 && hasPolygon"
                x-transition
                class="absolute bottom-8 left-4 right-4 z-30 pointer-events-auto md:left-auto md:right-8 md:w-80">
                <div class="glass-card p-4">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                            <i data-lucide="check" class="w-5 h-5 text-emerald-400"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm">エリアを描画しました</p>
                            <p class="text-xs text-gray-400" x-text="polygonCount + 'つのポリゴン'"></p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button @click="addAnotherPolygon()" class="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1">
                            <i data-lucide="plus" class="w-4 h-4"></i> 飛び地を追加
                        </button>
                        <button @click="goToStep2()" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-1">
                            次へ <i data-lucide="arrow-right" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Site Info Form (Step 2) -->
            <div x-show="step === 2"
                x-transition:enter="transition ease-out duration-300"
                x-transition:enter-start="translate-y-full opacity-0"
                x-transition:enter-end="translate-y-0 opacity-100"
                class="absolute bottom-0 left-0 right-0 z-30 md:bottom-auto md:top-32 md:right-4 md:left-auto md:w-96 pointer-events-auto">
                <div class="bg-slate-900/95 backdrop-blur-xl border-t md:border border-white/10 md:rounded-2xl p-6 shadow-2xl">
                    <!-- Drag handle (mobile) -->
                    <div class="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4 md:hidden"></div>

                    <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
                        <i data-lucide="file-text" class="w-5 h-5 text-emerald-400"></i> サイト情報
                    </h2>

                    <div class="space-y-3">
                        <div>
                            <label class="text-xs text-gray-400 mb-1 block">サイトID <span class="text-red-400">*</span></label>
                            <input type="text" x-model="siteId" class="form-input"
                                placeholder="例: ikan_hq (英数字・アンダースコア)"
                                :disabled="editMode" :class="{ 'opacity-50': editMode }">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 mb-1 block">サイト名 <span class="text-red-400">*</span></label>
                            <input type="text" x-model="siteName" class="form-input"
                                placeholder="例: 愛管株式会社 本社エリア">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 mb-1 block">住所</label>
                            <input type="text" x-model="siteAddress" class="form-input"
                                placeholder="例: 静岡県浜松市浜名区都田町8501-2">
                        </div>
                        <div>
                            <label class="text-xs text-gray-400 mb-1 block">説明</label>
                            <textarea x-model="siteDescription" class="form-input h-20 resize-none"
                                placeholder="このサイトの特徴や管理情報..."></textarea>
                        </div>
                    </div>

                    <div class="flex gap-2 mt-5">
                        <button @click="step = 1" class="flex-1 bg-white/5 hover:bg-white/10 text-white text-sm font-bold py-3 rounded-xl transition">
                            ← 戻る
                        </button>
                        <button @click="saveSite()"
                            :disabled="saving || !siteId || !siteName"
                            :class="{ 'opacity-50 cursor-not-allowed': saving || !siteId || !siteName }"
                            class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                            <template x-if="saving">
                                <span class="flex items-center gap-2">
                                    <svg class="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" opacity="0.25" />
                                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    保存中...
                                </span>
                            </template>
                            <template x-if="!saving">
                                <span>保存する</span>
                            </template>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Success Screen (Step 3) -->
            <div x-show="step === 3"
                x-transition
                class="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
                <div class="glass-card p-8 text-center max-w-sm w-full">
                    <div class="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="check-circle" class="w-10 h-10 text-emerald-400"></i>
                    </div>
                    <h2 class="text-2xl font-bold mb-2">サイトを登録しました！</h2>
                    <p class="text-gray-400 text-sm mb-6" x-text="siteName + ' のモニタリングが開始されます'"></p>
                    <div class="flex flex-col gap-2">
                        <a :href="'site_dashboard.php?site=' + siteId" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                            <i data-lucide="bar-chart-3" class="w-4 h-4"></i> ダッシュボードを開く
                        </a>
                        <a href="site_editor.php" class="bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition">
                            別のサイトを追加
                        </a>
                    </div>
                </div>
            </div>

        </main>

        <script nonce="<?= CspNonce::attr() ?>">
            function siteEditor() {
                return {
                    map: null,
                    draw: null,
                    step: 1,
                    hasPolygon: false,
                    polygonCount: 0,
                    editMode: <?php echo $editSite ? 'true' : 'false'; ?>,

                    // Form fields
                    siteId: '<?php echo htmlspecialchars($editSiteId); ?>',
                    siteName: '<?php echo htmlspecialchars($editSite['name'] ?? ''); ?>',
                    siteDescription: '<?php echo htmlspecialchars($editSite['description'] ?? ''); ?>',
                    siteAddress: '<?php echo htmlspecialchars($editSite['address'] ?? ''); ?>',

                    saving: false,

                    init() {
                        setTimeout(() => this.initMap(), 100);
                    },

                    initMap() {
                        const editCenter = <?php echo json_encode($editSite['center'] ?? [137.732881, 34.813473]); ?>;

                        this.map = new maplibregl.Map({
                            container: 'editor-map',
                            style: 'https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json',
                            center: editCenter,
                            zoom: <?php echo $editSite ? 15 : 13; ?>,
                            attributionControl: false
                        });

                        this.map.addControl(new maplibregl.AttributionControl({
                            compact: true
                        }));
                        this.map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

                        // Initialize Draw
                        this.draw = new MapboxDraw({
                            displayControlsDefault: false,
                            controls: {
                                polygon: true,
                                trash: true
                            },
                            defaultMode: 'simple_select',
                            styles: [
                                // Active polygon fill
                                {
                                    id: 'gl-draw-polygon-fill-active',
                                    type: 'fill',
                                    filter: ['all', ['==', '$type', 'Polygon']],
                                    paint: {
                                        'fill-color': '#10b981',
                                        'fill-opacity': 0.2
                                    }
                                },
                                // Active polygon outline
                                {
                                    id: 'gl-draw-polygon-stroke-active',
                                    type: 'line',
                                    filter: ['all', ['==', '$type', 'Polygon']],
                                    paint: {
                                        'line-color': '#10b981',
                                        'line-width': 3,
                                        'line-dasharray': [2, 1]
                                    }
                                },
                                // Vertex points
                                {
                                    id: 'gl-draw-point',
                                    type: 'circle',
                                    filter: ['all', ['==', '$type', 'Point']],
                                    paint: {
                                        'circle-radius': 6,
                                        'circle-color': '#10b981',
                                        'circle-stroke-width': 2,
                                        'circle-stroke-color': '#ffffff'
                                    }
                                },
                                // Line 
                                {
                                    id: 'gl-draw-line',
                                    type: 'line',
                                    filter: ['all', ['==', '$type', 'LineString']],
                                    paint: {
                                        'line-color': '#10b981',
                                        'line-width': 2,
                                        'line-dasharray': [3, 2]
                                    }
                                }
                            ]
                        });

                        this.map.addControl(this.draw, 'top-left');

                        // Listen for draw events
                        this.map.on('draw.create', () => this.updatePolygonState());
                        this.map.on('draw.delete', () => this.updatePolygonState());
                        this.map.on('draw.update', () => this.updatePolygonState());

                        // Load existing boundaries for editing
                        this.map.on('load', () => {
                            <?php if ($editGeojson): ?>
                                const existing = <?php echo json_encode($editGeojson); ?>;
                                if (existing && existing.features) {
                                    existing.features.forEach(f => {
                                        if (f.geometry.type === 'Polygon') {
                                            this.draw.add(f);
                                        } else if (f.geometry.type === 'MultiPolygon') {
                                            // Split MultiPolygon into individual Polygons for editing
                                            f.geometry.coordinates.forEach(polyCoords => {
                                                this.draw.add({
                                                    type: 'Feature',
                                                    geometry: {
                                                        type: 'Polygon',
                                                        coordinates: polyCoords
                                                    }
                                                });
                                            });
                                        }
                                    });
                                    this.updatePolygonState();

                                    // Fit to bounds
                                    const bounds = new maplibregl.LngLatBounds();
                                    const allFeats = this.draw.getAll();
                                    allFeats.features.forEach(f => {
                                        const coords = f.geometry.coordinates[0];
                                        coords.forEach(c => bounds.extend(c));
                                    });
                                    this.map.fitBounds(bounds, {
                                        padding: 100
                                    });
                                }
                            <?php endif; ?>
                        });
                    },

                    updatePolygonState() {
                        const all = this.draw.getAll();
                        const polygons = all.features.filter(f => f.geometry.type === 'Polygon');
                        this.polygonCount = polygons.length;
                        this.hasPolygon = this.polygonCount > 0;
                    },

                    addAnotherPolygon() {
                        // Switch to draw polygon mode
                        this.draw.changeMode('draw_polygon');
                    },

                    goToStep2() {
                        this.step = 2;
                    },

                    async saveSite() {
                        if (this.saving) return;

                        const all = this.draw.getAll();
                        const polygons = all.features.filter(f => f.geometry.type === 'Polygon');

                        if (polygons.length === 0) {
                            alert('エリアを描画してください');
                            this.step = 1;
                            return;
                        }

                        // Merge into single geometry
                        let geometry;
                        if (polygons.length === 1) {
                            geometry = polygons[0].geometry;
                        } else {
                            // MultiPolygon (飛び地)
                            geometry = {
                                type: 'MultiPolygon',
                                coordinates: polygons.map(p => p.geometry.coordinates)
                            };
                        }

                        this.saving = true;

                        try {
                            const res = await fetch('api/save_site.php', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    site_id: this.siteId,
                                    name: this.siteName,
                                    description: this.siteDescription,
                                    address: this.siteAddress,
                                    geometry: geometry
                                })
                            });

                            const result = await res.json();

                            if (result.success) {
                                this.step = 3;
                            } else {
                                alert('エラー: ' + (result.error || '保存に失敗しました'));
                            }
                        } catch (e) {
                            console.error(e);
                            alert('通信エラーが発生しました');
                        } finally {
                            this.saving = false;
                        }
                    }
                };
            }
            lucide.createIcons();
        </script>
    <?php endif; ?>
</body>

</html>