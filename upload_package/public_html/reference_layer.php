<?php
require_once __DIR__ . '/../config/config.php';
$meta_title = 'REFERENCE LAYER';
$meta_robots = 'noindex, nofollow, noarchive';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <!-- 2026 STANDARD: IMPORT MAPS -->
    <script type="importmap" nonce="<?= CspNonce::attr() ?>">
        {
        "imports": {
            "firebase/app": "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js",
            "firebase/firestore": "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js"
        }
    }
    </script>

    <!-- Leaflet Ecosystem -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="" nonce="<?= CspNonce::attr() ?>"></script>

    <!-- Leaflet MarkerCluster -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css" />
    <script src="https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js" nonce="<?= CspNonce::attr() ?>"></script>

    <!-- CUSTOM FONTS -->
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Share+Tech+Mono&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');

        body {
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: 'Noto Sans JP', 'Inter', sans-serif;
            overflow: hidden;
            /* App-like feel */
        }

        .font-mono {
            font-family: 'Share+Tech+Mono', monospace;
        }

        /* FULLSCREEN MAP */
        #map {
            position: absolute;
            inset: 0;
            z-index: 1;
            background: #0d1117;
        }

        /* GLASSMORPHISM PANELS */
        .hud-panel {
            background: rgba(13, 17, 23, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(88, 166, 255, 0.1);
            box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
        }

        .text-cyan-glow {
            color: #58a6ff;
            text-shadow: 0 0 8px rgba(88, 166, 255, 0.3);
        }

        /* FILTER CHIPS */
        .filter-chip.active {
            background-color: rgba(56, 139, 253, 0.2);
            color: #58a6ff;
            border-color: #58a6ff;
            box-shadow: 0 0 10px rgba(88, 166, 255, 0.15);
        }

        /* UTILS */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }

        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }

        /* --- CYBER-NATURAL ANIMATIONS (WAKUWAKU) --- */

        /* 1. Living Pulse (For Markers) */
        @keyframes pulse-ring {
            0% {
                transform: scale(0.8);
                opacity: 0.5;
            }

            50% {
                opacity: 0.0;
            }

            100% {
                transform: scale(2.5);
                opacity: 0.0;
            }
        }

        .living-marker {
            position: relative;
        }

        .living-marker::before {
            content: '';
            position: absolute;
            left: -5px;
            top: -5px;
            right: -5px;
            bottom: -5px;
            border: 1px solid #58a6ff;
            border-radius: 50%;
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }

        /* 2. Scanner Sweep (Global Ambience) */
        .scan-overlay {
            position: pointer-events-none;
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(88, 166, 255, 0) 0%, rgba(88, 166, 255, 0.1) 50%, rgba(88, 166, 255, 0) 100%);
            background-size: 100% 200%;
            animation: scan-sweep 3s linear infinite;
            z-index: 2;
            pointer-events: none;
        }

        @keyframes scan-sweep {
            0% {
                background-position: 0% -100%;
            }

            100% {
                background-position: 0% 200%;
            }
        }

        /* 3. Neon Text */
        .neon-text {
            text-shadow: 0 0 5px #58a6ff, 0 0 10px #58a6ff, 0 0 20px #58a6ff;
        }
    </style>
</head>

<body>
    <!-- MAP CONTAINER -->
    <div id="map"></div>
    <!-- AMBIENCE: SCANNER OVERLAY -->
    <div class="scan-overlay fixed inset-0 pointer-events-none z-10"></div>

    <!-- HUD: HEADER -->
    <div class="fixed top-4 left-4 right-4 z-50 pointer-events-none">
        <div class="flex justify-between items-start mb-3">
            <!-- BRAND -->
            <div class="hud-panel p-3 rounded-lg pointer-events-auto">
                <h1 class="text-xl font-bold tracking-widest text-cyan-glow font-mono">IKIMON<span class="text-white opacity-50">.LIFE</span></h1>
            </div>

            <!-- GBIF LINK (Authenticity) -->
            <div class="hud-panel p-2 rounded-full pointer-events-auto">
                <a href="https://www.gbif.org/" target="_blank" rel="noopener noreferrer" class="w-10 h-10 flex items-center justify-center bg-blue-500/10 text-blue-400 rounded-full border border-blue-400/30 hover:bg-blue-500/20 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                </a>
            </div>
        </div>

        <!-- FILTER CHIPS (Taxonomy System) -->
        <!-- Added data-filter attributes for event delegation if needed, currently inline onclick for simplicity in prototype -->
        <div class="flex space-x-2 overflow-x-auto pb-2 pointer-events-auto no-scrollbar" id="filterContainer">
            <button onclick="window.appLogic.applyFilter('all', this)" class="filter-chip active bg-black/60 text-gray-400 border border-gray-700 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition hover:bg-gray-800">ALL</button>
            <button onclick="window.appLogic.applyFilter('insect', this)" class="filter-chip bg-black/60 text-gray-400 border border-gray-700 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition hover:bg-gray-800">昆虫</button>
            <button onclick="window.appLogic.applyFilter('bird', this)" class="filter-chip bg-black/60 text-gray-400 border border-gray-700 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition hover:bg-gray-800">野鳥</button>
            <button onclick="window.appLogic.applyFilter('mammal', this)" class="filter-chip bg-black/60 text-gray-400 border border-gray-700 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition hover:bg-gray-800">哺乳類</button>
            <button onclick="window.appLogic.applyFilter('plant', this)" class="filter-chip bg-black/60 text-gray-400 border border-gray-700 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition hover:bg-gray-800">植物</button>
        </div>
    </div>

    <!-- HUD: BOTTOM SHEET (Detail View) -->
    <div id="infoPanel" class="fixed bottom-0 left-0 right-0 z-50 transform translate-y-full transition-transform duration-300 pointer-events-none">
        <div class="hud-panel rounded-t-2xl p-6 pb-12 pointer-events-auto max-w-2xl mx-auto border-b-0">
            <!-- Grab Handle -->
            <div class="w-12 h-1 bg-gray-600/50 rounded-full mx-auto mb-6"></div>

            <div class="flex flex-col items-start">
                <!-- SPECIES NAME -->
                <div class="flex items-baseline flex-wrap gap-2 mb-1">
                    <h2 id="speciesName" class="text-2xl font-bold text-white tracking-wide">読み込み中...</h2>
                    <span id="nameSource" class="text-[10px] text-gray-500 border border-gray-600/50 rounded px-1.5 py-0.5">---</span>
                </div>

                <p id="speciesSci" class="text-sm text-gray-400 italic font-mono mb-1">Waiting for selection...</p>

                <!-- DIALECT (Conditional) -->
                <p id="localDialect" class="text-xs text-yellow-500/90 hidden">
                    <span class="text-gray-500 mr-1">地方名:</span><span id="dialectText" class="font-bold">---</span>
                </p>
            </div>

            <!-- METADATA GRID -->
            <div class="grid grid-cols-2 gap-3 mt-6">
                <div class="bg-black/20 p-3 rounded border border-gray-700/50">
                    <div class="text-[10px] text-gray-500 font-mono uppercase">GBIF ID</div>
                    <div id="gbifId" class="text-xs text-blue-400 font-mono overflow-hidden text-ellipsis">---</div>
                </div>
                <div class="bg-black/20 p-3 rounded border border-gray-700/50">
                    <div class="text-[10px] text-gray-500 font-mono uppercase">Date</div>
                    <div id="eventDate" class="text-xs text-gray-300 font-mono">---</div>
                </div>
            </div>

            <!-- FLAVOR TEXT (Authenticity) -->
            <div class="mt-6 p-4 bg-blue-900/5 border-l-2 border-blue-500/30 rounded-r relative overflow-hidden">
                <p class="text-sm text-gray-400 italic font-serif leading-relaxed relative z-10">
                    "この記録は、世界中の研究者や市民科学者によって収集された生命の証です。"
                </p>
                <!-- Watermark Icon -->
                <svg class="absolute -bottom-2 -right-2 w-16 h-16 text-blue-500/5 z-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.22-7.52-1.72 5.25-5.25-5.25 5.25 1.72 7.52-3.22-7.52z" />
                    <circle cx="12" cy="12" r="2" />
                </svg>
            </div>

            <!-- ACTION: GBIF LINK -->
            <button id="externalLinkBtn" class="w-full mt-6 bg-gray-800/40 border border-gray-600/50 text-gray-300 font-mono text-xs py-3.5 rounded hover:bg-gray-700/50 transition uppercase tracking-widest flex items-center justify-center gap-2 group">
                <span class="group-hover:text-white transition">GBIF公式サイトで記録を見る</span>
                <svg class="text-gray-500 group-hover:text-white transition" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </button>
        </div>
    </div>

    <!-- ONBOARDING MODAL -->
    <div id="onboardingOverlay" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md hidden transition-opacity duration-500">
        <div class="hud-panel p-8 rounded-2xl max-w-sm w-full mx-4 border border-cyan-500/20 shadow-2xl">
            <div class="text-center mb-6">
                <div class="inline-block p-3 rounded-full bg-cyan-500/10 mb-4 text-cyan-400">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                    </svg>
                </div>
                <h2 class="text-xl font-bold text-white tracking-widest">生命の記録庫へようこそ</h2>
            </div>

            <div class="space-y-4 text-sm text-gray-400 mb-8 font-mono">
                <p>ここは世界中の生物分布データを閲覧できるアーカイブ層です。</p>
                <ul class="space-y-2 pl-4 border-l border-gray-700">
                    <li>・ 地図上の青い点をタップ</li>
                    <li>・ 詳細情報を確認</li>
                    <li>・ GBIF(一次情報)へアクセス</li>
                </ul>
            </div>

            <button onclick="window.appLogic.closeOnboarding()" class="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-cyan-900/20 transition tracking-widest text-xs">
                EXPLORE DATA
            </button>
        </div>
    </div>

    <!-- LOGIC CORE -->
    <script type="module" nonce="<?= CspNonce::attr() ?>">
        import {
            initializeApp
        } from "firebase/app";
        import {
            getFirestore,
            collection,
            getDocs,
            limit,
            query
        } from "firebase/firestore";

        // --- 1. CONFIGURATION ---
        const firebaseConfig = {
            apiKey: "AIzaSyD_oMnn7upP4PUxme_Ey-DmlDZqYAtBuX4",
            authDomain: "ikimon-life-platform-01.firebaseapp.com",
            projectId: "ikimon-life-platform-01",
            storageBucket: "ikimon-life-platform-01.firebasestorage.app",
            messagingSenderId: "542674944321",
            appId: "1:542674944321:web:d8df538799799480c29188"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // --- 2. TAXONOMY DICTIONARY (Simulated DB) ---
        const wameiDict = {
            "Harmonia axyridis": {
                name: "ナミテントウ",
                source: "日本産甲虫目録",
                type: "insect"
            },
            "Harmonia axyridis (Pallas, 1773)": {
                name: "ナミテントウ",
                source: "日本産甲虫目録",
                type: "insect"
            },
            "Sciurus lis": {
                name: "ニホンリス",
                source: "日本哺乳類図鑑",
                type: "mammal"
            },
            "Felis catus": {
                name: "ネコ",
                source: "一般通称",
                type: "mammal"
            },
            "Canis lupus familiaris": {
                name: "イヌ",
                source: "一般通称",
                type: "mammal"
            },
            "Passer montanus": {
                name: "スズメ",
                source: "日本鳥類目録",
                dialect: "一部地域で『チュンコ』",
                type: "bird"
            },
            "Corvus macrorhynchos": {
                name: "ハシブトガラス",
                source: "日本鳥類目録",
                type: "bird"
            }
        };

        function resolveTaxonomy(sciName) {
            if (!sciName) return {
                name: "名称不明",
                source: "---",
                type: "other"
            };
            const keyExact = sciName;
            const keyBase = sciName.split(' (')[0].trim();
            const hit = wameiDict[keyExact] || wameiDict[keyBase];
            return hit || {
                name: sciName,
                source: "学名(GBIF)",
                type: "other"
            };
        }

        // --- 3. APP STATE ---
        const state = {
            cachedData: [],
            currentFilter: 'all',
            map: null,
            markersGroup: null
        };

        // --- 4. MAP INITIALIZATION ---
        function initMap() {
            state.map = L.map('map', {
                zoomControl: false
            }).setView([36.2048, 138.2529], 5);

            // CartoDB Dark Matter (High Performance)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
            }).addTo(state.map);

            // Leaflet.markercluster configured for Performance
            state.markersGroup = L.markerClusterGroup({
                showCoverageOnHover: false,
                maxClusterRadius: 40, // Tighter clusters
                spiderfyOnMaxZoom: true,
                disableClusteringAtZoom: 17,
                iconCreateFunction: function(cluster) {
                    // Custom Cluster Icon for Sci-Fi Feel
                    const count = cluster.getChildCount();
                    let size = count < 10 ? 'sm' : count < 100 ? 'md' : 'lg';
                    // High-Tech Hexagon or Glowing Orb
                    return L.divIcon({
                        html: `<div class="living-marker flex items-center justify-center w-full h-full bg-cyan-900/90 border border-cyan-400 rounded-full text-cyan-200 font-mono text-xs font-bold shadow-[0_0_15px_rgba(34,211,238,0.5)] backdrop-blur-sm">${count}</div>`,
                        className: 'custom-cluster',
                        iconSize: [40, 40]
                    });
                }
            });
            state.map.addLayer(state.markersGroup);

            // Map Click -> Close HUD
            state.map.on('click', () => {
                document.getElementById('infoPanel').classList.add('translate-y-full');
            });
        }

        // --- 5. DATA LOGIC ---
        // --- 5. DATA LOGIC (Static-First V2) ---
        async function fetchData() {
            const STATIC_URL = 'assets/data/reference_data.json';
            const CACHE_KEY = 'ikimon_radar_data_v2';

            console.log("📡 Bio-Radar: Initializing...");

            // 1. Try Local Storage (Budget Guard)
            const cachedParams = localStorage.getItem(CACHE_KEY);
            if (cachedParams) {
                try {
                    const parsed = JSON.parse(cachedParams);
                    const now = new Date().getTime();
                    // 24h Expiry
                    if (now - parsed.timestamp < 1000 * 60 * 60 * 24) {
                        console.log(`🔋 Bio-Radar: Grid Loaded from Cache. ${parsed.data.length} Signals.`);
                        state.cachedData = parsed.data;
                        renderMarkers('all');
                        checkOnboarding();
                        return;
                    }
                } catch (e) {
                    console.warn("Cache corrupted.");
                }
            }

            // 2. Fetch Static JSON (CDN Mode)
            console.log("🛰️ Bio-Radar: Downloading Satellite Snapshot...");
            try {
                // Add timestamp to bypass CDN cache if needed, or rely on ETag
                const res = await fetch(STATIC_URL + '?t=' + new Date().getHours());
                if (!res.ok) throw new Error("Satellite Link Failed");

                const data = await res.json();
                state.cachedData = data;

                // 3. Save to Local Storage
                try {
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        timestamp: new Date().getTime(),
                        data: data
                    }));
                    console.log("💾 Bio-Radar: Snapshot Saved Local.");
                } catch (e) {
                    console.warn("Storage Quota Exceeded (Ignored).");
                }

                console.log(`🦅 Bio-Radar: ${data.length} Biological Signals Detected.`);
                renderMarkers('all');
                checkOnboarding();

            } catch (e) {
                console.error("Radar Offline:", e);
                // Fallback or Error UI
                document.getElementById('speciesName').innerText = "RADAR OFFLINE";
                document.getElementById('speciesSci').innerText = "Check Connection";
            }
        }

        function renderMarkers(filterType) {
            state.markersGroup.clearLayers();

            const points = [];
            state.cachedData.forEach(data => {
                if (!data.lat || !data.lng) return;

                const tax = resolveTaxonomy(data.name);

                // Client-side Filter
                if (filterType !== 'all' && tax.type !== filterType) return;

                const marker = L.circleMarker([data.lat, data.lng], {
                    radius: 6,
                    fillColor: "#58a6ff",
                    color: "#58a6ff",
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.4
                });

                marker.on('click', (e) => {
                    L.DomEvent.stopPropagation(e);
                    updateHUD(data, tax);
                });

                points.push(marker);
            });

            state.markersGroup.addLayers(points);
        }

        // --- 6. UI LOGIC ---
        function updateHUD(data, tax) {
            document.getElementById('speciesName').innerText = tax.name;
            document.getElementById('nameSource').innerText = tax.source;
            document.getElementById('speciesSci').innerText = data.name || "Unknown";

            // Dialect
            const dEl = document.getElementById('localDialect');
            if (tax.dialect) {
                dEl.classList.remove('hidden');
                document.getElementById('dialectText').innerText = tax.dialect;
            } else {
                dEl.classList.add('hidden');
            }

            // Meta
            document.getElementById('gbifId').innerText = data.id || "---";
            document.getElementById('eventDate').innerText = data.date ? new Date(data.date.seconds * 1000).toLocaleDateString() : "---";

            // Link
            document.getElementById('externalLinkBtn').onclick = () => {
                window.open(`https://www.gbif.org/occurrence/${data.id}`, '_blank');
            };

            // Ani
            document.getElementById('infoPanel').classList.remove('translate-y-full');
        }

        function checkOnboarding() {
            const hasSeen = localStorage.getItem('ikimon_ref_onboarded_v1');
            if (!hasSeen) {
                document.getElementById('onboardingOverlay').classList.remove('hidden');
            }
        }

        // --- 7. EXPOSED API (Window) ---
        // For inline onclick handlers
        window.appLogic = {
            applyFilter: (type, btn) => {
                // UI Toggle
                document.querySelectorAll('.filter-chip').forEach(el => {
                    el.classList.remove('active', 'bg-black/60', 'text-gray-400', 'border-gray-700');
                    el.classList.add('bg-black/60', 'text-gray-400', 'border-gray-700');
                });
                if (btn) {
                    btn.classList.remove('bg-black/60', 'text-gray-400', 'border-gray-700');
                    // btn.classList.add('bg-cyan-900/30', 'text-cyan-400', 'border-cyan-500'); // Clean Toggle
                    btn.classList.add('active'); // Use CSS class
                }
                renderMarkers(type);
            },
            closeOnboarding: () => {
                localStorage.setItem('ikimon_ref_onboarded_v1', 'true');
                document.getElementById('onboardingOverlay').classList.add('opacity-0');
                setTimeout(() => document.getElementById('onboardingOverlay').classList.add('hidden'), 500);
            }
        };

        // --- STARTUP ---
        initMap();
        fetchData();
    </script>
</body>

</html>