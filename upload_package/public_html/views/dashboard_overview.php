<?php
// Dashboard Overview (Map-First Design) - Light Theme & Mobile Optimized
// Integrating the 3D Map directly as the background/main context
require_once __DIR__ . '/../../libs/DataStore.php';
// Use global $site variable from showcase.php if available, otherwise fallback
if (!isset($site)) {
    $site = [
        'name' => 'Demo Site',
        'owner' => 'Demo Company',
        'location' => [137.726, 34.710],
        'stats' => ['species' => 0, 'obs' => 0, 'users' => 0]
    ];
}
$obsData = DataStore::fetchAll('observations');
$latestObs = is_array($obsData) ? array_slice(array_reverse($obsData), 0, 6) : [];
?>
<div class="relative w-full h-full flex flex-row overflow-hidden text-sans" x-data="{ showObservations: window.innerWidth > 768, showBasis: false }">

    <!-- Pass Site Data to JS Scope for Components -->
    <script nonce="<?= CspNonce::attr() ?>">
        window.siteData = <?php echo json_encode($site); ?>;
        // Trigger re-render of components if they are watching (or just for init)
        if (typeof renderSidebarInfo === 'function') renderSidebarInfo();
    </script>

    <!-- Custom Animations -->
    <style>
        @keyframes float {
            0% {
                transform: translateY(0px);
            }

            50% {
                transform: translateY(-5px);
            }

            100% {
                transform: translateY(0px);
            }
        }

        /* Light Theme Glass */
        .glass-panel-premium {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
        }
    </style>

    <!-- Main Content Area (Map lives here) -->
    <div class="flex-1 relative flex flex-col min-w-0 transition-all duration-300">

        <!-- Map Background & Loading -->
        <div id="map" class="absolute inset-0 bg-gray-50"></div>
        <div id="map-loading" class="absolute inset-0 flex items-center justify-center bg-white z-50 transition-opacity duration-1000 pointer-events-none">
            <div class="flex flex-col items-center gap-4">
                <div class="relative w-16 h-16">
                    <div class="absolute inset-0 border-t-2 border-green-500 rounded-full animate-spin"></div>
                    <div class="absolute inset-2 border-r-2 border-blue-500 rounded-full animate-spin reverse"></div>
                </div>
                <div class="text-xs font-mono text-green-600 animate-pulse tracking-widest font-bold">LOADING DIGITAL TWIN...</div>
            </div>
        </div>

        <!-- Dashboard UI Overlay (Z-Index 10) -->
        <div class="relative z-10 flex-1 flex flex-col pointer-events-none">

            <!-- Top Stats Row (White Gradient Backdrop) -->
            <div class="p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 bg-gradient-to-b from-white/95 via-white/80 to-transparent pb-12">
                <!-- Stat 1 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.1s;">
                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Species</div>
                    <div class="text-2xl md:text-3xl font-black text-gray-800 font-display flex items-baseline gap-1">
                        <?= number_format($site['stats']['species'] ?? 0) ?> <span class="text-xs text-green-600 font-bold">▲ 12</span>
                    </div>
                </div>
                <!-- Stat 2 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.2s;">
                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Observations</div>
                    <div class="text-2xl md:text-3xl font-black text-gray-800 font-display flex items-baseline gap-1">
                        <?= number_format($site['stats']['obs'] ?? 0) ?> <span class="text-xs text-blue-600 font-bold">new</span>
                    </div>
                </div>
                <!-- Stat 3 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.3s;">
                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Active Users</div>
                    <div class="text-2xl md:text-3xl font-black text-gray-800 font-display flex items-baseline gap-1">
                        <?= number_format($site['stats']['users'] ?? 0) ?> <span class="text-xs text-green-600 font-bold">▲ 5%</span>
                    </div>
                </div>
                <!-- Stat 4 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.4s;">
                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Health Score</div>
                    <div class="text-lg md:text-xl font-bold text-gray-800 font-mono flex items-center gap-2 h-full">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <?= $site['stats']['score'] ?? 'A' ?> / 100
                    </div>
                </div>
            </div>

            <!-- Bottom Insights Row -->
            <div class="p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] origin-bottom"
                :class="{'translate-y-4 opacity-80': !showObservations}">

                <!-- Insight Card 1: Monitoring Progress -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-xl group border-l-4 border-green-500 relative">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-green-100 rounded-lg text-green-600 group-hover:scale-110 transition-transform"><i data-lucide="leaf" class="w-5 h-5"></i></div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ECO-SERVICE</div>
                        </div>
                        <!-- Info Toggle -->
                        <button @click="showBasis = true" class="flex items-center gap-1 text-[10px] bg-white/50 hover:bg-white px-2 py-1 rounded-lg text-gray-500 transition border border-gray-200 shadow-sm">
                            <i data-lucide="info" class="w-3 h-3 text-green-500"></i>
                            <span>根拠・詳細</span>
                        </button>
                    </div>

                    <h3 class="text-2xl font-black text-gray-800 mb-2 font-display">CO2吸収: 12.5t<span class="text-sm font-normal text-gray-500">/年</span></h3>
                    <p class="text-sm text-gray-600 leading-relaxed mb-4 font-medium">
                        敷地内の植栽（高木・低木）による推定吸収量。スギ人工林 約1.5ha相当の貢献度です。
                    </p>

                    <!-- Mini Chart/Bar -->
                    <div class="space-y-3">
                        <div>
                            <div class="flex justify-between text-xs mb-1.5 font-bold">
                                <span class="text-gray-400">年間目標 (Target)</span>
                                <span class="text-green-600">100% 達成</span>
                            </div>
                            <div class="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-green-500 to-green-400 w-full"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Calculation Basis Modal -->
                    <template x-teleport="body">
                        <div x-show="showBasis"
                            x-transition:enter="transition ease-out duration-300"
                            x-transition:enter-start="opacity-0 scale-95"
                            x-transition:enter-end="opacity-100 scale-100"
                            x-transition:leave="transition ease-in duration-200"
                            x-transition:leave-start="opacity-100 scale-100"
                            x-transition:leave-end="opacity-0 scale-95"
                            class="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm"
                            @click.self="showBasis = false">

                            <div class="bg-white max-w-2xl w-full p-6 md:p-8 rounded-2xl relative shadow-2xl overflow-y-auto max-h-full">
                                <button @click="showBasis = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition">
                                    <i data-lucide="x" class="w-6 h-6"></i>
                                </button>

                                <h3 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <i data-lucide="database" class="w-5 h-5 text-green-600"></i> システム構成と算出根拠
                                </h3>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <!-- Left: Logic -->
                                    <div class="space-y-4">
                                        <h4 class="text-sm font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2">CO2 算出ロジック</h4>
                                        <div class="bg-gray-50 p-4 rounded-lg border border-gray-100 font-mono text-xs">
                                            <div class="text-gray-400 mb-1">【環境省・林野庁方式準拠】</div>
                                            <div class="text-gray-800 font-bold leading-relaxed">
                                                吸収量(t-CO2)<br>
                                                = <span class="text-green-600">植栽面積</span> × <span class="text-blue-600">吸収係数</span>
                                            </div>
                                        </div>
                                        <ul class="text-xs text-gray-500 space-y-2">
                                            <li><span class="text-green-600 font-bold">● 植栽面積</span>: ikimonで収集・マッピングした植生データより自動算出</li>
                                            <li><span class="text-blue-600 font-bold">● 吸収係数</span>: 樹種ごとの公表値（例: 広葉樹 8.5t）をデータベースから適用</li>
                                        </ul>
                                    </div>
                                    <!-- Right: Diagram -->
                                    <div class="space-y-4">
                                        <h4 class="text-sm font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2">データ連携フロー</h4>
                                        <div class="flex flex-col gap-2 text-center text-xs font-bold text-gray-700 relative">
                                            <div class="grid grid-cols-2 gap-2">
                                                <div class="p-3 bg-blue-50 border border-blue-100 rounded-lg">Open Data</div>
                                                <div class="p-3 bg-purple-50 border border-purple-100 rounded-lg text-purple-700 shadow-sm">3D Scanner</div>
                                            </div>
                                            <i data-lucide="arrow-down" class="w-4 h-4 mx-auto text-gray-300"></i>
                                            <div class="p-4 bg-gray-800 text-white rounded-xl shadow-lg">ikimon Engine</div>
                                            <i data-lucide="arrow-down" class="w-4 h-4 mx-auto text-gray-300"></i>
                                            <div class="p-3 bg-green-500 text-white rounded-lg shadow-md">Dashboard Output</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Insight Card 2: Report Readiness -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-xl group border-l-4 border-blue-500">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:scale-110 transition-transform"><i data-lucide="file-check" class="w-5 h-5"></i></div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">COMPLIANCE</div>
                        </div>
                    </div>
                    <h3 class="text-2xl font-black text-gray-800 mb-2 font-display">レポート作成可</h3>
                    <p class="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
                        TNFD / OECM認定更新に必要なデータセットが揃いました。即時出力可能です。
                    </p>
                    <a href="?view=reports" class="inline-flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition w-full justify-center group-hover:shadow-lg shadow-blue-200">
                        <i data-lucide="download" class="w-4 h-4"></i> レポートを出力する
                    </a>
                </div>

                <!-- Insight Card 3: Community Engagement -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-xl group border-l-4 border-yellow-500">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-yellow-100 rounded-lg text-yellow-600 group-hover:scale-110 transition-transform"><i data-lucide="users" class="w-5 h-5"></i></div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ENGAGEMENT</div>
                        </div>
                        <span class="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded animate-pulse">HOT</span>
                    </div>
                    <h3 class="text-2xl font-black text-gray-800 mb-2 font-display">イベント好機</h3>
                    <p class="text-sm text-gray-600 leading-relaxed mb-6 font-medium">
                        Bゾーンにて<span class="text-gray-900 border-b border-yellow-400 font-bold">アゲハチョウ類</span>の活性化を検知。自然観察会の開催に最適です。
                    </p>
                    <a href="?view=events" class="inline-flex items-center gap-3 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-xl transition w-full justify-center group-hover:shadow-lg shadow-yellow-200">
                        <i data-lucide="calendar-plus" class="w-4 h-4"></i> イベントを企画する
                    </a>
                </div>

            </div>
        </div>
    </div>

    <!-- Observation List Side Panel (Overlay, Animated) -->
    <div class="absolute inset-y-0 right-0 z-20 flex flex-col bg-white/95 backdrop-blur-2xl border-l border-gray-200 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
        :class="showObservations ? 'translate-x-0 w-full md:w-[420px]' : 'translate-x-full w-full md:w-[420px]'">

        <!-- Header -->
        <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-white/50 backdrop-blur-md pt-20 md:pt-6">
            <div>
                <h2 class="text-xl font-black text-gray-900 flex items-center gap-2 font-heading tracking-wide">
                    <span class="text-green-600">LIVE</span> FEED
                </h2>
                <p class="text-xs text-gray-500 font-mono mt-1">REAL-TIME BIODIVERSITY DATA</p>
            </div>
            <!-- Close Button (Always visible since it's an overlay now) -->
            <button @click="showObservations = false" class="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
        </div>

        <!-- Scrollable List -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            <?php foreach ($latestObs as $obs):
                $taxon = $obs['taxon']['name'] ?? '未同定';
                $type = $obs['taxon']['rank'] ?? 'species';
                $img = $obs['photos'][0] ?? 'assets/img/icon-192.png';
                $user = $obs['user_name'] ?? 'Observer';
                $time = $obs['observed_at'] ?? '';
                $tagClass = 'bg-green-100 text-green-700';
            ?>
                <div class="bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer flex gap-4 items-center">
                    <div class="w-20 h-20 rounded-lg overflow-hidden relative border border-gray-100 flex-shrink-0 group-hover:ring-2 ring-green-500 transition-all">
                        <img src="<?= htmlspecialchars($img) ?>" alt="<?= htmlspecialchars($taxon) ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-700">
                    </div>
                    <div class="flex-1 min-w-0 py-1">
                        <div class="flex justify-between items-start mb-1">
                            <h4 class="font-bold text-gray-800 text-base truncate group-hover:text-green-600 transition"><?= htmlspecialchars($taxon) ?></h4>
                            <span class="text-[10px] <?= $tagClass ?> px-2 py-0.5 rounded-full font-bold tracking-wider"><?= htmlspecialchars($type) ?></span>
                        </div>
                        <div class="flex items-center gap-2 mb-2">
                            <div class="w-4 h-4 rounded-full bg-gray-200"></div>
                            <span class="text-xs text-gray-500 group-hover:text-gray-900 transition"><?= htmlspecialchars($user) ?></span>
                        </div>
                    </div>
                    <div class="pr-2 text-gray-300 group-hover:text-green-500 transition-colors">
                        <i data-lucide="chevron-right"></i>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Footer Action -->
        <div class="p-6 border-t border-gray-100 bg-white/80 backdrop-blur-md z-30">
            <button class="w-full py-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition shadow-lg flex items-center justify-center gap-2 group">
                全てのデータへアクセス
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </button>
        </div>
    </div>

    <!-- Mobile FAB to open Feed (Visible only if closed and on mobile) -->
    <button
        x-show="!showObservations"
        @click="showObservations = true"
        class="md:hidden fixed bottom-6 right-6 z-40 p-4 bg-green-600 text-white rounded-full shadow-xl shadow-green-900/20 hover:scale-110 transition-transform"
        x-transition:enter="transition ease-out duration-300 transform"
        x-transition:enter-start="translate-y-20 opacity-0"
        x-transition:enter-end="translate-y-0 opacity-100">
        <i data-lucide="list" class="w-6 h-6"></i>
    </button>

</div>

<!-- Map Logic Integration -->
<?php include __DIR__ . '/../components/map_config.php'; ?>
<script nonce="<?= CspNonce::attr() ?>">
    (function() {
        let map;

        // Init on load
        initMap();

        function initMap() {
            if (map) return;
            // White Theme Map (Positron)
            const styleUrl = IKIMON_MAP.style('light');

            try {
                // Default center if no site data
                let center = [137.726, 34.710];
                if (window.siteData && window.siteData.location) {
                    center = window.siteData.location;
                }

                map = new maplibregl.Map({
                    container: 'map',
                    style: styleUrl,
                    center: center,
                    zoom: 16.2,
                    pitch: 45,
                    bearing: -25,
                    attributionControl: false,
                    antialias: true,
                    interactive: true
                });

                map.on('load', () => {
                    setTimeout(() => {
                        const loader = document.getElementById('map-loading');
                        loader.style.opacity = '0';
                        setTimeout(() => loader.remove(), 1000);
                    }, 1500);

                    addProceduralBuildings();
                    addGreenery();
                    startDrift();
                });

            } catch (e) {
                console.error(e);
            }
        }

        function addProceduralBuildings() {
            if (!map.getLayer('virtual-buildings')) {
                const center = map.getCenter().toArray();
                const features = [];
                for (let i = 0; i < 60; i++) {
                    const lng = center[0] + (Math.random() - 0.5) * 0.012;
                    const lat = center[1] + (Math.random() - 0.5) * 0.012;
                    const s = 0.00015;
                    features.push({
                        type: 'Feature',
                        properties: {
                            height: Math.random() * 50 + 10,
                            color: '#e2e8f0'
                        },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [
                                [
                                    [lng - s, lat - s],
                                    [lng + s, lat - s],
                                    [lng + s, lat + s],
                                    [lng - s, lat + s],
                                    [lng - s, lat - s]
                                ]
                            ]
                        }
                    });
                }
                map.addSource('virtual-city', {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: features
                    }
                });
                map.addLayer({
                    'id': 'virtual-buildings',
                    'source': 'virtual-city',
                    'type': 'fill-extrusion',
                    'paint': {
                        'fill-extrusion-color': '#e2e8f0', // Slate 200
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-opacity': 0.8,
                        'fill-extrusion-vertical-gradient': true
                    }
                });
            }
        }

        function addGreenery() {
            const center = map.getCenter().toArray();
            const trees = [];
            for (let i = 0; i < 300; i++) {
                trees.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [center[0] + (Math.random() - 0.5) * 0.018, center[1] + (Math.random() - 0.5) * 0.018]
                    }
                });
            }
            map.addSource('trees', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: trees
                }
            });

            // Tree Glow (Green)
            map.addLayer({
                'id': 'tree-glow',
                'type': 'circle',
                'source': 'trees',
                'paint': {
                    'circle-radius': 10,
                    'circle-color': '#22c55e', // Green 500
                    'circle-opacity': 0.2,
                    'circle-blur': 0.8
                }
            });

            // Core point
            map.addLayer({
                'id': 'tree-points',
                'type': 'circle',
                'source': 'trees',
                'paint': {
                    'circle-radius': 4,
                    'circle-color': '#16a34a', // Green 600
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                    'circle-opacity': 1
                }
            });
        }

        function startDrift() {
            let t = 0;

            function frame() {
                t += 0.001;
                const bearing = -25 + Math.sin(t) * 3;
                const pitch = 45 + Math.cos(t * 0.5) * 2;
                map.easeTo({
                    bearing: bearing,
                    pitch: pitch,
                    duration: 0,
                    easing: x => x
                });
                requestAnimationFrame(frame);
            }
            requestAnimationFrame(frame);
        }

        window.resetCamera = () => map.flyTo({
            center: window.siteData?.location || [137.726, 34.710],
            zoom: 16.2,
            pitch: 45,
            bearing: -25,
            duration: 2000
        });
    })();
</script>