<?php
// Dashboard Overview (Map-First Design)
// Integrating the 3D Map directly as the background/main context
require_once __DIR__ . '/../../libs/DataStore.php';
$latestObs = DataStore::getLatest('observations', 6);
?>
<div class="relative w-full h-full flex flex-row overflow-hidden text-sans" x-data="{ showObservations: true, showBasis: false }">
    
    <!-- Custom Animations -->
    <style>
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
        /* ... existing styles ... */
        .glass-panel-premium {
            background: rgba(10, 10, 10, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
    </style>

    <!-- Main Content Area (Flex-1) -->
    <div class="flex-1 relative flex flex-col min-w-0 transition-all duration-300">
        
        <!-- Map Background & Loading -->
        <div id="map" class="absolute inset-0 bg-[var(--color-bg-base)]"></div>
        <div id="map-loading" class="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-50 transition-opacity duration-1000 pointer-events-none">
            <div class="flex flex-col items-center gap-4">
                <div class="relative w-16 h-16">
                    <div class="absolute inset-0 border-t-2 border-green-500 rounded-full animate-spin"></div>
                    <div class="absolute inset-2 border-r-2 border-blue-500 rounded-full animate-spin reverse"></div>
                </div>
                <div class="text-xs font-mono text-green-500 animate-pulse tracking-widest">LOADING DIGITAL TWIN...</div>
            </div>
        </div>

        <!-- Dashboard UI Overlay (Z-Index 10) -->
        <div class="relative z-10 flex-1 flex flex-col pointer-events-none">
            
            <!-- Top Stats Row -->
            <div class="p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 bg-gradient-to-b from-black/80 to-transparent">
                <!-- Stat 1 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.1s;">
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Species</div>
                    <div class="text-3xl font-black text-white font-display flex items-baseline gap-1">
                        1,208 <span class="text-xs text-green-500 font-bold">▲ 12</span>
                    </div>
                </div>
                <!-- Stat 2 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.2s;">
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">CO2 Absorption</div>
                    <div class="text-3xl font-black text-white font-display flex items-baseline gap-1">
                        12.5t <span class="text-xs text-gray-500 font-bold">/ yr</span>
                    </div>
                </div>
                <!-- Stat 3 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.3s;">
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Active Users</div>
                    <div class="text-3xl font-black text-white font-display flex items-baseline gap-1">
                        842 <span class="text-xs text-blue-500 font-bold">▲ 5%</span>
                    </div>
                </div>
                <!-- Stat 4 -->
                <div class="animate-fade-in-down" style="animation-delay: 0.4s;">
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Last Update</div>
                    <div class="text-xl font-bold text-white font-mono flex items-center gap-2 h-full">
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Just now
                    </div>
                </div>
            </div>

            <!-- Bottom Insights Row -->
            <div class="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 pointer-events-none transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
                 :class="{'translate-y-[10px]': !showObservations}"> 
                 <!-- Removed the translate-y-[150%] hiding logic. Changed to subtle movement or removal of class entirely. Let's just remove the class logic or keep a subtle effect. -->
                
                <!-- Insight Card 1: Monitoring Progress -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-[0_20px_40px_-10px_rgba(74,222,128,0.2)] group border-l-4 border-green-500 relative">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-green-500/20 rounded-lg text-green-400 group-hover:scale-110 transition-transform"><i data-lucide="leaf" class="w-5 h-5"></i></div> <!-- Changed icon to leaf for CO2 context -->
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ECO-SERVICE</div>
                        </div>
                        <!-- Info Toggle -->
                        <a href="?view=system" class="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-white transition border border-white/10 shadow-sm group-hover:border-green-500/50">
                            <i data-lucide="info" class="w-3 h-3 text-green-400"></i>
                            <span>算出根拠・システム詳細はここ</span>
                        </a>
                    </div>
                    
                    <h3 class="text-2xl font-black text-white mb-2 font-display">CO2吸収: 12.5t<span class="text-sm font-normal text-gray-400">/年</span></h3>
                    <p class="text-sm text-gray-300 leading-relaxed mb-4 font-medium">
                        敷地内の植栽（高木・低木）による推定吸収量。スギ人工林 約1.5ha相当の貢献度です。
                    </p>

                    <!-- Mini Chart/Bar -->
                    <div class="space-y-3">
                        <div>
                            <div class="flex justify-between text-xs mb-1.5 font-bold">
                                <span class="text-gray-400">年間目標 (Target)</span>
                                <span class="text-green-400">100% 達成</span>
                            </div>
                            <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div class="h-full bg-gradient-to-r from-green-600 to-green-400 w-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
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
                             class="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
                             @click.self="showBasis = false">
                            
                            <div class="glass-panel-premium max-w-2xl w-full p-8 rounded-2xl relative border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                                <button @click="showBasis = false" class="absolute top-4 right-4 text-gray-400 hover:text-white transition">
                                    <i data-lucide="x" class="w-6 h-6"></i>
                                </button>
                                
                                <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <i data-lucide="database" class="w-5 h-5 text-green-500"></i> システム構成と算出根拠
                                </h3>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <!-- Left: Logic -->
                                    <div class="space-y-4">
                                        <h4 class="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">CO2 算出ロジック</h4>
                                        <div class="bg-white/5 p-4 rounded-lg border border-white/10 font-mono text-xs">
                                            <div class="text-gray-500 mb-1">【環境省・林野庁方式準拠】</div>
                                            <div class="text-white font-bold leading-relaxed">
                                                吸収量(t-CO2)<br>
                                                = <span class="text-green-400">植栽面積</span> × <span class="text-blue-400">吸収係数</span>
                                            </div>
                                        </div>
                                        <ul class="text-xs text-gray-400 space-y-2">
                                            <li><span class="text-green-400 font-bold">● 植栽面積</span>: ikimonで収集・マッピングした植生データより自動算出</li>
                                            <li><span class="text-blue-400 font-bold">● 吸収係数</span>: 樹種ごとの公表値（例: 広葉樹 8.5t）をデータベースから適用</li>
                                        </ul>
                                    </div>

                                    <!-- Right: Architecture Diagram -->
                                    <div class="space-y-4">
                                        <h4 class="text-sm font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2">データ連携フロー</h4>
                                        <div class="flex flex-col gap-2 text-center text-xs font-bold text-white relative">
                                            
                                            <div class="grid grid-cols-2 gap-2">
                                                <!-- Standard Data -->
                                                <div class="p-3 bg-blue-900/40 border border-blue-500/30 rounded-lg flex flex-col items-center justify-center gap-1 opacity-60">
                                                    <span class="text-[9px] text-blue-300">STANDARD</span>
                                                    Open Data<br>(地形/OSM)
                                                </div>
                                                <!-- Pro Data (User's Scanner) -->
                                                <div class="p-3 bg-purple-900/40 border border-purple-500 rounded-lg flex flex-col items-center justify-center gap-1 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                                    <div class="flex items-center gap-1 text-purple-300">
                                                        <i data-lucide="scan" class="w-3 h-3"></i> <span class="text-[9px]">PRO</span>
                                                    </div>
                                                    3D Scanner<br>(点群データ)
                                                </div>
                                            </div>

                                            <div class="flex justify-center text-gray-500 my-1"><i data-lucide="arrow-down" class="w-4 h-4"></i></div>

                                            <!-- Core Engine -->
                                            <div class="p-4 bg-gray-800 border border-white/20 rounded-xl shadow-lg relative overflow-hidden">
                                                <div class="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                                                <div class="relative z-10 flex flex-col gap-2">
                                                    <div class="flex items-center justify-center gap-2">
                                                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                        ikimon Analysis Engine
                                                    </div>
                                                    <div class="text-[10px] text-gray-400 font-normal">
                                                        生物データ × <span class="text-purple-400 font-bold">実測3D空間</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="h-4 border-l border-green-500 mx-auto"></div>
                                            
                                            <!-- Output -->
                                            <div class="p-3 bg-gradient-to-r from-green-600 to-green-500 rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center justify-center gap-2">
                                                <i data-lucide="monitor" class="w-4 h-4"></i>
                                                Digital Twin Dashboard
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-6 pt-4 border-t border-white/10 text-xs text-gray-500 leading-relaxed">
                                    お手持ちの<strong class="text-purple-400">3Dスキャナー（LiDAR/フォトグラメトリ）</strong>で取得した点群データを統合することで、植生体積を正確に把握し、CO2吸収量の算出精度を飛躍的に向上させることが可能です。（標準ではオープンデータによる推定値を使用）
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- Insight Card 2: Report Readiness -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-[0_20px_40px_-10px_rgba(59,130,246,0.2)] group border-l-4 border-blue-500">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform"><i data-lucide="file-check" class="w-5 h-5"></i></div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">COMPLIANCE</div>
                        </div>
                    </div>
                    <h3 class="text-2xl font-black text-white mb-2 font-display">レポート作成可</h3>
                    <p class="text-sm text-gray-300 leading-relaxed mb-6 font-medium">
                        TNFD / OECM認定更新に必要なデータセットが揃いました。即時出力可能です。
                    </p>
                    <a href="?view=reports" class="inline-flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition w-full justify-center group-hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                        <i data-lucide="download" class="w-4 h-4"></i> レポートを出力する
                    </a>
                </div>

                <!-- Insight Card 3: Community Engagement -->
                <div class="glass-panel-premium p-6 rounded-2xl pointer-events-auto transform hover:-translate-y-2 transition duration-500 hover:shadow-[0_20px_40px_-10px_rgba(234,179,8,0.2)] group border-l-4 border-yellow-500">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-2">
                            <div class="p-2 bg-yellow-500/20 rounded-lg text-yellow-400 group-hover:scale-110 transition-transform"><i data-lucide="users" class="w-5 h-5"></i></div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">ENGAGEMENT</div>
                        </div>
                        <span class="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded animate-pulse">HOT</span>
                    </div>
                    <h3 class="text-2xl font-black text-white mb-2 font-display">イベント好機</h3>
                    <p class="text-sm text-gray-300 leading-relaxed mb-6 font-medium">
                        Bゾーンにて<span class="text-white border-b border-yellow-500">アゲハチョウ類</span>の活性化を検知。市民向け「自然観察会」の開催に最適な時期です。
                    </p>
                    <a href="?view=events" class="inline-flex items-center gap-3 px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition w-full justify-center group-hover:shadow-[0_0_20px_rgba(202,138,4,0.4)]">
                        <i data-lucide="calendar-plus" class="w-4 h-4"></i> イベントを企画する
                    </a>
                </div>

            </div>
        </div>
    </div>

    <!-- Observation List Side Panel (Flex Item, Premium Slide-in) -->
    <div class="relative bg-[var(--color-bg-base)]/95 backdrop-blur-2xl border-l border-white/10 z-20 transition-all duration-500 cubic-bezier(0.23, 1, 0.32, 1) flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)] h-full"
         :class="showObservations ? 'w-[420px] translate-x-0' : 'w-0 translate-x-full opacity-0 overflow-hidden'">
        
        <!-- Header -->
        <div class="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 backdrop-blur-md">
            <div>
                <h2 class="text-xl font-black text-white flex items-center gap-2 font-heading tracking-wide">
                    <span class="text-green-500">LIVE</span> FEED
                </h2>
                <p class="text-xs text-gray-500 font-mono mt-1">REAL-TIME BIODIVERSITY DATA</p>
            </div>
            <button @click="showObservations = false" class="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition">
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
                $tagClass = 'bg-green-500/20 text-green-400';
            ?>
            <div class="observation-item glass-panel p-3 rounded-xl border border-white/5 transition-all duration-300 group cursor-pointer flex gap-4 items-center">
                <div class="w-20 h-20 rounded-lg overflow-hidden relative shadow-lg flex-shrink-0 group-hover:ring-2 ring-green-500 transition-all">
                     <img src="<?= htmlspecialchars($img) ?>" alt="<?= htmlspecialchars($taxon) ?>" class="w-full h-full object-cover group-hover:scale-110 transition duration-700">
                </div>
                <div class="flex-1 min-w-0 py-1">
                    <div class="flex justify-between items-start mb-1">
                        <h4 class="font-bold text-white text-base truncate group-hover:text-green-400 transition"><?= htmlspecialchars($taxon) ?></h4>
                        <span class="text-[10px] <?= $tagClass ?> px-2 py-0.5 rounded-full font-bold tracking-wider"><?= htmlspecialchars($type) ?></span>
                    </div>
                    <div class="flex items-center gap-2 mb-2">
                        <div class="w-4 h-4 rounded-full bg-gradient-to-tr from-gray-600 to-gray-400"></div>
                        <span class="text-xs text-gray-400 hover:text-white transition"><?= htmlspecialchars($user) ?></span>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                        <i data-lucide="clock" class="w-3 h-3"></i> <?= htmlspecialchars($time) ?>
                    </div>
                </div>
                <div class="pr-2 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
                    <i data-lucide="chevron-right" class="text-white"></i>
                </div>
            </div>
            <?php endforeach; ?>
        </div>
        
        <!-- Footer Action -->
        <div class="p-6 border-t border-white/10 bg-white/5 backdrop-blur-md z-30">
             <button class="w-full py-4 rounded-xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold transition shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 group">
                全てのデータへアクセス
                <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </button>
        </div>
    </div>
</div>

<!-- Map Logic Integration -->
<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
(function() {
    let map;
    
    // Init on load
    initMap();

    function initMap() {
        if (map) return;
        const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

        try {
            map = new maplibregl.Map({
                container: 'map',
                style: styleUrl,
                center: [137.726, 34.710],
                zoom: 16.2,
                pitch: 55,
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
                }, 1500); // Artificial delay to ensure sleek transition

                addProceduralBuildings();
                addGreenery();
                startDrift();
                
                // Add sky layer for realism
                map.setSky({
                    'sky-color': '#0a0a0a',
                    'sky-horizon-blend': 0.5,
                    'horizon-color': '#1a1a1a'
                });
            });

        } catch (e) { console.error(e); }
    }

    function addProceduralBuildings() {
        // ... (Same Procedural Buildings Logic, maybe tweaked opacity)
        const center = [137.726, 34.710];
        const features = [];
        for(let i=0; i<60; i++) {
            const lng = center[0] + (Math.random()-0.5) * 0.012;
            const lat = center[1] + (Math.random()-0.5) * 0.012;
            const s = 0.00015;
            features.push({
                type: 'Feature',
                properties: { height: Math.random() * 50 + 10, color: '#334155' },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[ [lng-s, lat-s], [lng+s, lat-s], [lng+s, lat+s], [lng-s, lat+s], [lng-s, lat-s] ]]
                }
            });
        }
        map.addSource('virtual-city', { type: 'geojson', data: { type: 'FeatureCollection', features: features } });
        map.addLayer({
            'id': 'virtual-buildings',
            'source': 'virtual-city',
            'type': 'fill-extrusion',
            'paint': {
                'fill-extrusion-color': '#1f2937', 
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-opacity': 0.95,
                'fill-extrusion-vertical-gradient': true 
            }
        });
    }

    function addGreenery() {
        const center = [137.726, 34.710];
        const trees = [];
        for(let i=0; i<300; i++) {
            trees.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [ center[0] + (Math.random()-0.5) * 0.018, center[1] + (Math.random()-0.5) * 0.018 ] }
            });
        }
        map.addSource('trees', { type: 'geojson', data: { type: 'FeatureCollection', features: trees } });
        
        // Glow effect
        map.addLayer({
            'id': 'tree-glow',
            'type': 'circle',
            'source': 'trees',
            'paint': {
                'circle-radius': 12,
                'circle-color': '#4ade80',
                'circle-opacity': 0.15,
                'circle-blur': 0.8
            }
        });
        
        // Core point
        map.addLayer({
            'id': 'tree-points',
            'type': 'circle',
            'source': 'trees',
            'paint': {
                'circle-radius': 3,
                'circle-color': '#86efac', 
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.9
            }
        });
    }
    
    function startDrift() {
        let t = 0;
        function frame() {
            t += 0.001;
            const bearing = -25 + Math.sin(t) * 3;
            const pitch = 55 + Math.cos(t * 0.5) * 2;
            map.easeTo({ bearing: bearing, pitch: pitch, duration: 0, easing: x=>x });
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // Global Controls
    window.resetCamera = () => map.flyTo({ center: [137.726, 34.710], zoom: 16.2, pitch: 55, bearing: -25, duration: 2000 });
    window.toggleTrees = () => alert("観測データレイヤーは表示中です");

})();
</script>
