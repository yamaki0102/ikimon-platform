<?php
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
Auth::init();
Auth::requireRole('Analyst'); // Should be 'Client' role in future, using Analyst for demo

// Mock Client Data
$clientName = "Hamamatsu Photonics Corp.";
$siteName = "Miyakoda Factory Forest";
$targetSpecies = ["Japanese Rhinoceros Beetle", "Swallowtail Butterfly"];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php $adminTitle = 'TNFD Reporting Dashboard';
    include __DIR__ . '/components/head.php'; ?>
    <!-- MapLibre for Polygon Visualization -->
    <script src="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
</head>

<body class="flex h-screen overflow-hidden">

    <!-- Sidebar -->
    <aside class="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div class="p-6 flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">C</div>
            <span class="font-bold text-sm tracking-tight">Corporate Portal<br><span class="text-xs text-slate-500 font-normal">TNFD Edition</span></span>
        </div>

        <nav class="flex-1 px-4 space-y-2">
            <a href="corporate.php" class="flex items-center gap-3 px-4 py-3 bg-blue-600/10 text-blue-400 border border-blue-600/20 rounded-xl font-bold transition">
                <i data-lucide="pie-chart" class="w-5 h-5"></i>
                Impact Report
            </a>
            <a href="#" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="file-text" class="w-5 h-5"></i>
                Export Data (CSV)
            </a>
            <a href="#" class="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl font-bold transition">
                <i data-lucide="settings" class="w-5 h-5"></i>
                Site Settings
            </a>
        </nav>

        <div class="p-4">
            <a href="index.php" class="text-xs text-slate-500 hover:text-white flex items-center gap-2">
                <i data-lucide="arrow-left" class="w-3 h-3"></i> Back to Admin
            </a>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-8 relative">
        <header class="flex justify-between items-center mb-8">
            <div>
                <h1 class="text-2xl font-bold mb-1"><?php echo $clientName; ?></h1>
                <p class="text-slate-400 text-sm flex items-center gap-2">
                    <i data-lucide="map-pin" class="w-3 h-3"></i> <?php echo $siteName; ?> (Site ID: HP-001)
                </p>
            </div>
            <button class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-sm shadow-lg shadow-blue-900/50 flex items-center gap-2 transition">
                <i data-lucide="download" class="w-4 h-4"></i> Download TNFD Report
            </button>
        </header>

        <!-- Scorecards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <!-- Biodiversity Integirty Score -->
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700 relative overflow-hidden group">
                <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition">
                    <i data-lucide="leaf" class="w-24 h-24 text-emerald-500"></i>
                </div>
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Biodiversity Integrity Score (BIS)</p>
                <div class="flex items-baseline gap-2">
                    <p class="text-4xl font-black text-white">84.2</p>
                    <span class="text-emerald-400 text-sm font-bold flex items-center">
                        <i data-lucide="trending-up" class="w-3 h-3 mr-1"></i> +2.4%
                    </span>
                </div>
                <p class="text-xs text-slate-500 mt-2">Comparable to: Primary Forest (Ref)</p>
            </div>

            <!-- Species Richness -->
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Species Richness</p>
                <p class="text-4xl font-black text-white">128 <span class="text-sm font-normal text-slate-500">spp.</span></p>

                <div class="mt-4 flex gap-2">
                    <span class="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-bold rounded">Red List: 3</span>
                    <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded">Invasive: 12</span>
                </div>
            </div>

            <!-- Community Engagement -->
            <div class="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <p class="text-slate-400 text-xs font-bold uppercase mb-2">Citizen Engagement</p>
                <p class="text-4xl font-black text-white">1,450 <span class="text-sm font-normal text-slate-500">obs.</span></p>
                <p class="text-xs text-slate-500 mt-2">By 120 local employees & residents</p>
            </div>
        </div>

        <!-- Map & Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96 mb-8">
            <!-- Map -->
            <div class="lg:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden relative">
                <div id="map" class="w-full h-full"></div>
                <div class="absolute top-4 left-4 bg-slate-900/90 backdrop-blur p-3 rounded-xl border border-slate-700 text-xs shadow-xl">
                    <p class="font-bold text-slate-300 mb-1">Overlay Layers</p>
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked class="accent-blue-500"> Factory Boundary
                    </label>
                    <label class="flex items-center gap-2 cursor-pointer mt-1">
                        <input type="checkbox" checked class="accent-emerald-500"> Observation Heatmap
                    </label>
                </div>
            </div>

            <!-- Indicator Species List -->
            <div class="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col">
                <h3 class="font-bold text-sm mb-4">Target Species Monitoring</h3>
                <div class="space-y-4 overflow-y-auto">
                    <?php foreach ($targetSpecies as $sp): ?>
                        <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50">
                            <div class="w-10 h-10 bg-slate-600 rounded-lg shrink-0"></div> <!-- Placeholder Img -->
                            <div>
                                <p class="font-bold text-sm"><?php echo $sp; ?></p>
                                <p class="text-xs text-emerald-400 font-bold">Detected 12 times</p>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-700/50 opacity-50">
                        <div class="w-10 h-10 bg-slate-600 rounded-lg shrink-0"></div>
                        <div>
                            <p class="font-bold text-sm">Target C</p>
                            <p class="text-xs text-slate-400">Not detected yet</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();

        // Initialize Map
        const map = new maplibregl.Map({
            container: 'map',
            style: 'https://demotiles.maplibre.org/style.json', // Free style for demo
            center: [137.726, 34.710], // Hamamatsu
            zoom: 13,
            attributionControl: false
        });

        map.on('load', () => {
            // Add Factory Polygon (Mock)
            map.addSource('factory', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [
                            [
                                [137.720, 34.715],
                                [137.730, 34.715],
                                [137.730, 34.705],
                                [137.720, 34.705],
                                [137.720, 34.715]
                            ]
                        ]
                    }
                }
            });

            map.addLayer({
                'id': 'factory-fill',
                'type': 'fill',
                'source': 'factory',
                'layout': {},
                'paint': {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.1
                }
            });

            map.addLayer({
                'id': 'factory-outline',
                'type': 'line',
                'source': 'factory',
                'layout': {},
                'paint': {
                    'line-color': '#3b82f6',
                    'line-width': 2,
                    'line-dasharray': [2, 2]
                }
            });
        });
    </script>
</body>

</html>