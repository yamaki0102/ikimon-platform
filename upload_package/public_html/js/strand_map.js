/**
 * strand_map.js — Strand Map (Heatmap Visualization)
 *
 * Uses MapLibre GL JS to render anonymized observation data
 * as a heatmap layer ("strands" of biodiversity presence).
 *
 * Dependencies: MapLibre GL JS (loaded via CDN in parent page)
 */

class StrandMap {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            center: [138.383, 34.977], // Shizuoka default
            zoom: 10,
            days: 30,
            siteId: null,
            style: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            ...options
        };
        this.map = null;
        this.data = null;
    }

    /**
     * Initialize the map
     */
    async init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`[StrandMap] Container #${this.containerId} not found`);
            return;
        }

        // Initialize MapLibre GL
        this.map = new maplibregl.Map({
            container: this.containerId,
            style: {
                version: 8,
                sources: {
                    'osm-tiles': {
                        type: 'raster',
                        tiles: [this.options.style],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap contributors'
                    }
                },
                layers: [{
                    id: 'osm-layer',
                    type: 'raster',
                    source: 'osm-tiles',
                    minzoom: 0,
                    maxzoom: 19
                }]
            },
            center: this.options.center,
            zoom: this.options.zoom,
            maxZoom: 18,
            attributionControl: true
        });

        this.map.on('load', async () => {
            await this.loadData();
            this.addHeatmapLayer();
            this.addClickInteraction();
        });
    }

    /**
     * Fetch strand data from API
     */
    async loadData() {
        try {
            let url = `api/get_strand_data.php?days=${this.options.days}`;
            if (this.options.siteId) {
                url += `&site_id=${encodeURIComponent(this.options.siteId)}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            this.data = await response.json();
            console.log(`[StrandMap] Loaded ${this.data.meta?.count ?? 0} strands`);
        } catch (err) {
            console.error('[StrandMap] Failed to load data:', err);
            this.data = { type: 'FeatureCollection', features: [] };
        }
    }

    /**
     * Add heatmap layer to map
     */
    addHeatmapLayer() {
        if (!this.data || this.data.features.length === 0) {
            console.warn('[StrandMap] No data to display');
            return;
        }

        // Add source
        this.map.addSource('strand-data', {
            type: 'geojson',
            data: this.data
        });

        // Heatmap layer (zoomed out view)
        this.map.addLayer({
            id: 'strand-heat',
            type: 'heatmap',
            source: 'strand-data',
            maxzoom: 14,
            paint: {
                // Intensity ramp
                'heatmap-intensity': [
                    'interpolate', ['linear'], ['zoom'],
                    0, 1,
                    14, 3
                ],
                // Color ramp: emerald theme
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(236, 253, 245, 0)',
                    0.2, 'rgba(167, 243, 208, 0.6)',
                    0.4, 'rgba(52, 211, 153, 0.7)',
                    0.6, 'rgba(16, 185, 129, 0.8)',
                    0.8, 'rgba(5, 150, 105, 0.9)',
                    1, 'rgba(4, 120, 87, 1)'
                ],
                // Radius
                'heatmap-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    0, 8,
                    14, 30
                ],
                // Fade out as you zoom in
                'heatmap-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 0.8,
                    14, 0
                ]
            }
        });

        // Circle layer for zoomed in view
        this.map.addLayer({
            id: 'strand-circles',
            type: 'circle',
            source: 'strand-data',
            minzoom: 12,
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 4,
                    16, 12
                ],
                'circle-color': [
                    'case',
                    ['get', 'protected'], '#ef4444',  // red for protected
                    ['==', ['get', 'status'], 'identified'], '#10b981', // emerald
                    '#f59e0b'  // amber for pending
                ],
                'circle-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    12, 0,
                    14, 0.7
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
            }
        });
    }

    /**
     * Add click interaction for circle layer
     */
    addClickInteraction() {
        // Cursor style
        this.map.on('mouseenter', 'strand-circles', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'strand-circles', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Click popup
        this.map.on('click', 'strand-circles', (e) => {
            const props = e.features[0].properties;
            const coords = e.features[0].geometry.coordinates.slice();

            const statusLabel = props.status === 'identified'
                ? `<span class="text-emerald-600">✓ ${props.taxon || '同定済み'}</span>`
                : '<span class="text-amber-600">🔍 同定待ち</span>';

            const protectedBadge = props.protected
                ? '<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold ml-1">保護種</span>'
                : '';

            const html = `
                <div class="text-sm leading-relaxed">
                    <p class="font-bold text-gray-800">${statusLabel}${protectedBadge}</p>
                    <p class="text-xs text-gray-400 mt-1">📅 ${props.date || '不明'}</p>
                    <p class="text-[10px] text-gray-300 mt-0.5">Grid: ${props.grid_m}m</p>
                </div>
            `;

            new maplibregl.Popup({ maxWidth: '240px' })
                .setLngLat(coords)
                .setHTML(html)
                .addTo(this.map);
        });
    }

    /**
     * Update days filter and reload
     */
    async setDays(days) {
        this.options.days = days;
        await this.loadData();
        const source = this.map.getSource('strand-data');
        if (source) {
            source.setData(this.data);
        }
    }

    /**
     * Fly to a site
     */
    flyTo(lng, lat, zoom = 13) {
        this.map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
    }

    /**
     * Destroy the map
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

// Export for use
window.StrandMap = StrandMap;
