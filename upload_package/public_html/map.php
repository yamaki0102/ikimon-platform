<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php 
    $meta_title = "マップ";
    include __DIR__ . '/components/meta.php'; 
    ?>
    <script src="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.js"></script>
    <link href="https://unpkg.com/maplibre-gl@3.x.x/dist/maplibre-gl.css" rel="stylesheet" />
    <style>
        /* Force Solid Header on Map Page to prevent readability issues */
        nav { background-color: #05070a !important; backdrop-filter: none !important; }
    </style>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>
    <script>document.body.classList.remove('js-loading');</script>

    <main class="relative w-full h-[calc(100vh-theme(spacing.14))] md:h-screen overflow-hidden" x-data="mapExplorer()">
        
        <!-- Map -->
        <div id="map" class="absolute inset-0 w-full h-full z-0"></div>

        <!-- Floating UI: Search & Toggle -->
        <div class="absolute top-16 left-4 right-4 md:left-8 md:right-auto md:w-96 z-30 pointer-events-auto max-w-md md:max-w-none mx-auto md:mx-0 flex flex-col gap-2">
            
            <!-- Search Bar -->
            <div class="relative z-50">
                <div class="bg-gray-900 border border-white/20 rounded-2xl flex items-center shadow-2xl overflow-hidden relative z-10">
                    <i data-lucide="search" class="ml-4 w-5 h-5 text-gray-400"></i>
                    <input type="text" x-model="query" 
                           @input.debounce.300ms="onInput()" 
                           @keydown.enter="onEnter()"
                           @focus="showSuggestions = true"
                           @click.outside="showSuggestions = false"
                           placeholder="場所や種名を検索..." 
                           class="flex-1 bg-transparent border-none text-white placeholder-gray-400 focus:ring-0 text-sm h-12 px-3">
                </div>

                <!-- Autocomplete Dropdown -->
                <div x-show="showSuggestions && suggestions.length > 0" 
                     x-transition
                     class="absolute top-14 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    <template x-for="s in suggestions" :key="s.place_id">
                        <button @click="selectLocation(s)" class="w-full text-left px-4 py-3 hover:bg-white/10 border-b border-white/5 last:border-0 transition flex items-start gap-3">
                            <i data-lucide="map-pin" class="w-4 h-4 text-gray-400 mt-0.5 shrink-0"></i>
                            <div>
                                <p class="text-sm font-bold text-gray-200 line-clamp-1" x-text="s.name"></p>
                                <p class="text-xs text-gray-500 line-clamp-1" x-text="formatAddress(s)"></p>
                            </div>
                        </button>
                    </template>
                </div>
            </div>

        </div>

        <!-- Preview Card (Bottom Sheet) -->
        <div x-show="selectedObs" 
             style="display: none;"
             x-transition:enter="transition ease-out duration-300"
             x-transition:enter-start="translate-y-full opacity-0"
             x-transition:enter-end="translate-y-0 opacity-100"
             x-transition:leave="transition ease-in duration-200"
             x-transition:leave-start="translate-y-0 opacity-100"
             x-transition:leave-end="translate-y-full opacity-0"
             class="absolute bottom-24 left-4 right-4 z-40 md:w-96 md:left-1/2 md:-translate-x-1/2 pointer-events-auto">
            <template x-if="selectedObs">
                <div class="bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-4 shadow-2xl relative">
                    <button @click="selectedObs = null" class="absolute -top-3 -right-3 p-2 bg-gray-800 rounded-full border border-white/20 shadow-lg text-white"><i data-lucide="x" class="w-4 h-4"></i></button>
                    <a :href="'observation_detail.php?id=' + selectedObs.id" class="flex gap-4">
                        <img :src="selectedObs.photos[0]" class="w-20 h-20 rounded-xl object-cover border border-white/10 bg-gray-800">
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1" x-text="selectedObs.status"></p>
                            <h3 class="font-bold text-lg truncate mb-1" x-text="selectedObs.taxon ? selectedObs.taxon.name : 'Unknown'"></h3>
                            <p class="text-xs text-gray-400 truncate flex items-center gap-1">
                                <i data-lucide="map-pin" class="w-3 h-3"></i>
                                <span x-text="selectedObs.location ? selectedObs.location.name : 'Unknown Location'"></span>
                            </p>
                        </div>
                        <div class="flex items-center justify-center">
                            <i data-lucide="chevron-right" class="text-gray-500"></i>
                        </div>
                    </a>
                </div>
            </template>
        </div>

        <!-- My Location FAB -->
        <button @click="locateMe()" class="absolute bottom-32 right-4 z-10 w-12 h-12 rounded-full bg-white text-black shadow-xl flex items-center justify-center active:scale-90 transition group pointer-events-auto">
            <i data-lucide="crosshair" class="group-hover:rotate-45 transition duration-500"></i>
        </button>

        <!-- Signs FAB (Strand System) -->
        <button @click="showSignModal = true" class="absolute bottom-64 right-5 z-10 w-10 h-10 rounded-full bg-black/80 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)] flex items-center justify-center active:scale-90 transition hover:bg-black/90 pointer-events-auto backdrop-blur-sm">
            <i data-lucide="sticker" class="w-5 h-5"></i>
        </button>

        <!-- Sign Modal -->
        <div x-show="showSignModal" 
             style="display: none;"
             class="fixed inset-0 z-[70] flex items-center justify-center px-4 pointer-events-auto bg-black/60 backdrop-blur-sm"
             x-transition.opacity>
            <div @click.away="showSignModal = false" class="bg-black/90 border border-blue-500/30 w-full max-w-xs p-6 rounded-2xl shadow-2xl relative">
                <h3 class="text-white font-bold text-center mb-6 tracking-widest uppercase text-xs flex items-center justify-center gap-2">
                    <i data-lucide="map-pin" class="w-4 h-4 text-blue-500"></i> Leave a Sign
                </h3>
                
                <div class="grid grid-cols-3 gap-4">
                    <button @click="placeSign('view')" class="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition group">
                        <div class="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center bg-white/5 group-hover:bg-blue-500/20 group-hover:border-blue-500 transition">
                            <i data-lucide="camera" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold">View</span>
                    </button>
                    <button @click="placeSign('rest')" class="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition group">
                        <div class="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center bg-white/5 group-hover:bg-green-500/20 group-hover:border-green-500 transition">
                            <i data-lucide="coffee" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold">Rest</span>
                    </button>
                    <button @click="placeSign('danger')" class="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition group">
                        <div class="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center bg-white/5 group-hover:bg-red-500/20 group-hover:border-red-500 transition">
                            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold">Danger</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Add Spot Help FAB -->
        <button @click="showAddSpotModal = true" class="absolute bottom-48 right-5 z-10 w-10 h-10 rounded-full bg-white/90 text-gray-600 shadow-lg flex items-center justify-center active:scale-90 transition hover:bg-white pointer-events-auto backdrop-blur-sm">
            <i data-lucide="map-pin" class="w-5 h-5 relative z-10"></i>
            <i data-lucide="plus" class="w-3 h-3 absolute top-1.5 right-1.5 text-blue-500 bg-white rounded-full z-20"></i>
        </button>

        <!-- Add Spot Modal -->
        <div x-show="showAddSpotModal" 
             style="display: none;"
             class="fixed inset-0 z-[60] flex items-center justify-center px-4 pointer-events-auto">
            
            <!-- Backdrop -->
            <div x-transition:enter="transition ease-out duration-300"
                 x-transition:enter-start="opacity-0"
                 x-transition:enter-end="opacity-100"
                 x-transition:leave="transition ease-in duration-200"
                 x-transition:leave-start="opacity-100"
                 x-transition:leave-end="opacity-0"
                 @click="showAddSpotModal = false"
                 class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <!-- Modal Content -->
            <div x-transition:enter="transition ease-out duration-300"
                 x-transition:enter-start="opacity-0 scale-95 translate-y-4"
                 x-transition:enter-end="opacity-100 scale-100 translate-y-0"
                 x-transition:leave="transition ease-in duration-200"
                 x-transition:leave-start="opacity-100 scale-100 translate-y-0"
                 x-transition:leave-end="opacity-0 scale-95 translate-y-4"
                 class="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm relative text-center shadow-2xl">
                
                <div class="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-400">
                    <i data-lucide="map-pin" class="w-6 h-6"></i>
                </div>
                
                <h3 class="text-xl font-bold mb-2">地図に場所がない？</h3>
                <p class="text-gray-400 text-sm leading-relaxed mb-6">
                    この地図は「OpenStreetMap」を使用しています。<br>
                    もし場所が見つからない場合は、OpenStreetMapの公式サイトから誰でも地図を更新できます。
                </p>

                <div class="flex flex-col gap-3">
                    <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                        OpenStreetMapで追加する
                    </a>
                    <button @click="showAddSpotModal = false" class="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition">
                        閉じる
                    </button>
                </div>
            </div>
        </div>

    </main>

    <script>
        function mapExplorer() {
            return {
                query: '',
                items: [],
                map: null,
                markers: {},
                selectedObs: null,
                showSignModal: false,
                signs: [],
                signMarkers: {},
                showSignModal: false,
                signs: [],
                signMarkers: {},
                loading: false,
                suggestions: [],
                showSuggestions: false,
                showAddSpotModal: false, // Updated state

                init() {
                    this.loadSigns();
                    this.loadObs();
                    setTimeout(() => this.initMap(), 100);
                },

                onInput() {
                    this.loadObs();
                    this.fetchSuggestions();
                },

                onEnter() {
                    this.showSuggestions = false;
                    if (this.suggestions.length > 0) {
                        this.selectLocation(this.suggestions[0]);
                    }
                },

                async fetchSuggestions() {
                    if (this.query.length < 2) {
                        this.suggestions = [];
                        return;
                    }
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.query)}&addressdetails=1&limit=30`);
                        let data = await res.json();
                        
                        // 1. Filter out specific noise (e.g. Taxi stands)
                        data = data.filter(s => {
                           if (s.type === 'taxi') return false;
                           // Allow highways/bus stops but maybe deprioritize them later?
                           // For now, just ban 'taxi' which was the main issue.
                           return true;
                        });

                        // 2. Sort by importance (Ensure major places come first)
                        data.sort((a, b) => (b.importance || 0) - (a.importance || 0));

                        // 3. Deduplicate by Name (If multiple "Hamamatsu", pick top ones but avoid exact dupes)
                        const seen = new Set();
                        this.suggestions = data.filter(s => {
                            const key = s.display_name;
                            if (seen.has(key)) return false;
                            seen.add(key);
                            return true;
                        }).slice(0, 5);

                        this.showSuggestions = this.suggestions.length > 0;
                    } catch (e) {
                         console.error(e);
                    }
                },

                selectLocation(loc) {
                    this.query = loc.name || loc.display_name.split(',')[0];
                    this.showSuggestions = false;
                    
                    if (this.map) {
                        this.map.flyTo({
                            center: [parseFloat(loc.lon), parseFloat(loc.lat)],
                            zoom: 14,
                            speed: 2.0, // Faster animation
                            essential: true
                        });
                    }
                    this.loadObs(); // Reload obs for the new area? 
                },
                
                formatAddress(s) {
                    // Simple formatter: remove name from display_name
                    const name = s.name || '';
                    return s.display_name.replace(name, '').replace(/^,\s*/, '');
                },

                async loadObs() {
                    const res = await fetch(`api/get_observations.php?limit=100&q=${encodeURIComponent(this.query)}`);
                    const result = await res.json();
                    this.items = result.data;
                    this.updateSource(); 
                },

                // Remove old search/geocode methods as they are replaced
                
                initMap() {
                    this.map = new maplibregl.Map({
                        container: 'map',
                        style: 'https://tile.openstreetmap.jp/styles/maptiler-basic-ja/style.json',
                        center: [137.7261, 34.7108],
                        zoom: 12,
                        attributionControl: false
                    });
                    this.map.addControl(new maplibregl.AttributionControl({ compact: true }));
                    
                    this.map.on('load', () => {
                        // Add GeoJSON Source with Clustering
                        this.map.addSource('observations', {
                            type: 'geojson',
                            data: { type: 'FeatureCollection', features: [] },
                            cluster: true,
                            clusterMaxZoom: 14, // Stop clustering at zoom 14 (showing individual photos)
                            clusterRadius: 50
                        });

                        // Strand System: Exploration Traces (Visualizing other researchers)
                        // Mocking some paths around Hamamatsu to simulate "Net Trails"
                        const traces = { type: 'FeatureCollection', features: [] };
                        const base = [137.7261, 34.7108]; // Hamamatsu
                        for(let i=0; i<8; i++) {
                            let path = [];
                            let curr = [base[0] + (Math.random()-0.5)*0.08, base[1] + (Math.random()-0.5)*0.08];
                            path.push([...curr]);
                            for(let j=0; j<15; j++) {
                                curr[0] += (Math.random()-0.5)*0.005;
                                curr[1] += (Math.random()-0.5)*0.005;
                                path.push([...curr]);
                            }
                            traces.features.push({
                                type: 'Feature', 
                                geometry: { type: 'LineString', coordinates: path }
                            });
                        }

                        this.map.addSource('traces', { type: 'geojson', data: traces });
                        
                        // Glow Layer (Holographic effect)
                        this.map.addLayer({
                            'id': 'traces-glow',
                            'type': 'line',
                            'source': 'traces',
                            'layout': {'line-join': 'round', 'line-cap': 'round'},
                            'paint': { 'line-color': '#00ffff', 'line-width': 8, 'line-opacity': 0.2, 'line-blur': 3 }
                        });
                        // Core Layer
                        this.map.addLayer({
                            'id': 'traces-core',
                            'type': 'line',
                            'source': 'traces',
                            'layout': {'line-join': 'round', 'line-cap': 'round'},
                            'paint': { 
                                'line-color': '#00deff', 
                                'line-width': 2, 
                                'line-opacity': 0.7,
                                'line-dasharray': [1, 2] // Dashed look roughly like footprints
                            }
                        });

                        // Cluster Layer (Circles)
                        this.map.addLayer({
                            id: 'clusters',
                            type: 'circle',
                            source: 'observations',
                            filter: ['has', 'point_count'],
                            paint: {
                                'circle-color': '#51bbd6',
                                'circle-radius': 18,
                                'circle-stroke-width': 2,
                                'circle-stroke-color': '#fff'
                            }
                        });

                        // Cluster Count Text
                        this.map.addLayer({
                            id: 'cluster-count',
                            type: 'symbol',
                            source: 'observations',
                            filter: ['has', 'point_count'],
                            layout: {
                                'text-field': '{point_count_abbreviated}',
                                'text-font': ['Noto Sans Regular'], // Ensure valid font or use default if unsure
                                'text-size': 12
                            },
                            paint: {
                                'text-color': '#ffffff'
                            }
                        });

                        // Handle Cluster Clicks (Zoom In)
                        this.map.on('click', 'clusters', (e) => {
                            const features = this.map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
                            const clusterId = features[0].properties.cluster_id;
                            this.map.getSource('observations').getClusterExpansionZoom(clusterId, (err, zoom) => {
                                if (err) return;
                                this.map.flyTo({
                                    center: features[0].geometry.coordinates,
                                    zoom: zoom
                                });
                            });
                        });
                        
                        this.map.on('mouseenter', 'clusters', () => {
                            this.map.getCanvas().style.cursor = 'pointer';
                        });
                        this.map.on('mouseleave', 'clusters', () => {
                            this.map.getCanvas().style.cursor = '';
                        });

                        // Update markers on move
                        this.map.on('render', () => {
                            if (!this.map.isSourceLoaded('observations')) return;
                            this.updateMarkers();
                        });

                        this.updateSource();
                    });

                    this.map.on('click', () => this.selectedObs = null);
                },

                updateSource() {
                    if (!this.map || !this.map.getSource('observations')) return;
                    
                    const geojson = {
                        type: 'FeatureCollection',
                        features: this.items.map(obs => ({
                            type: 'Feature',
                            properties: {
                                id: obs.id,
                                photo: obs.photos[0],
                                // Pass entire obs for preview (serialize roughly or just ID)
                                obsData: obs 
                            },
                            geometry: {
                                type: 'Point',
                                coordinates: [parseFloat(obs.lng), parseFloat(obs.lat)]
                            }
                        }))
                    };
                    
                    this.map.getSource('observations').setData(geojson);
                },

                updateMarkers() {
                    if(!this.map) return;
                    
                    // 1. Get all currently rendered visible points that are NOT clusters
                    const features = this.map.querySourceFeatures('observations', {
                        filter: ['!', ['has', 'point_count']] 
                    });
                    
                    const visibleIds = new Set(features.map(f => f.properties.id));
                    
                    // 2. Remove markers that are no longer visible or valid
                    Object.keys(this.markers).forEach(id => {
                        if (!visibleIds.has(Number(id))) {
                            this.markers[id].remove();
                            delete this.markers[id];
                        }
                    });

                    // 3. Add new markers
                    features.forEach(f => {
                        const id = f.properties.id;
                        if (this.markers[id]) return; // Already exists

                        // Create optimized marker element
                        const el = document.createElement('div');
                        el.className = 'w-8 h-8 rounded-full shadow-xl cursor-pointer'; 
                        
                        const inner = document.createElement('div');
                        inner.className = 'w-full h-full rounded-full border-2 border-white bg-cover bg-center transition-transform duration-300 hover:scale-125';
                        inner.style.backgroundImage = `url(${f.properties.photo})`;
                        
                        el.appendChild(inner);
                        
                        el.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.selectedObs = f.properties.obsData; // Uses the data passed in properties
                            this.map.flyTo({ center: f.geometry.coordinates, zoom: 15, offset: [0, -100] });
                        });

                        const m = new maplibregl.Marker({ element: el })
                            .setLngLat(f.geometry.coordinates)
                            .addTo(this.map);
                        
                        this.markers[id] = m;
                    });
                },

                loadSigns() {
                    const saved = localStorage.getItem('ikimon_signs');
                    if(saved) {
                        try {
                            this.signs = JSON.parse(saved);
                            const now = Date.now();
                            this.signs = this.signs.filter(s => now - s.ts < 86400000);
                        } catch(e) { this.signs = []; }
                    }
                    this.renderSigns();
                },

                placeSign(type) {
                    if(!this.map) return;
                    const center = this.map.getCenter();
                    const sign = {
                        id: 's_' + Date.now(),
                        type: type,
                        lat: center.lat,
                        lng: center.lng,
                        ts: Date.now()
                    };
                    this.signs.push(sign);
                    localStorage.setItem('ikimon_signs', JSON.stringify(this.signs));
                    this.renderSigns();
                    this.showSignModal = false;
                },

                renderSigns() {
                    if(!this.map) return;
                    
                    this.signs.forEach(s => {
                        if(this.signMarkers[s.id]) return;

                        const el = document.createElement('div');
                        let icon = 'map-pin', color = 'text-white border-white';
                        
                        if(s.type === 'view') { icon='camera'; color='text-blue-400 border-blue-500 shadow-[0_0_15px_#3b82f6]'; }
                        if(s.type === 'rest') { icon='coffee'; color='text-green-400 border-green-500 shadow-[0_0_15px_#22c55e]'; }
                        if(s.type === 'danger') { icon='alert-triangle'; color='text-red-400 border-red-500 shadow-[0_0_15px_#ef4444]'; }

                        el.className = `w-10 h-10 rounded-full bg-black/90 border-2 flex items-center justify-center ${color} z-20`;
                        el.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5"></i>`;

                        const m = new maplibregl.Marker({ element: el })
                            .setLngLat([s.lng, s.lat])
                            .addTo(this.map);
                        
                        this.signMarkers[s.id] = m;
                    });
                    lucide.createIcons();
                }
            }
        }
        lucide.createIcons();
    </script>
</body>
</html>
