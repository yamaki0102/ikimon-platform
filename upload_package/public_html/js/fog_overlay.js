/**
 * fog_overlay.js — Fog of War Overlay for Strand Map
 *
 * Adds a fog-of-war grid overlay to the StrandMap.
 * Unexplored cells are covered by semi-transparent fog,
 * explored cells are clear. Creates a game-like exploration feel.
 *
 * Depends on StrandMap instance and MapLibre GL JS.
 */

class FogOverlay {
    constructor(strandMap, options = {}) {
        this.strandMap = strandMap;
        this.map = strandMap.map;
        this.options = {
            gridM: 1000,
            fogColor: 'rgba(30, 41, 59, 0.6)',  // slate-800
            showCoverage: true,
            userId: null,
            ...options
        };
        this.coverageEl = null;
        this.data = null;
    }

    /**
     * Initialize fog overlay
     */
    async init() {
        if (!this.map) {
            console.error('[FogOverlay] Map not ready');
            return;
        }

        // Create coverage indicator
        if (this.options.showCoverage) {
            this.createCoverageIndicator();
        }

        // Load initial data
        await this.loadFogData();

        // Update on map move
        this.map.on('moveend', () => this.loadFogData());
    }

    /**
     * Load fog data from API
     */
    async loadFogData() {
        try {
            const bounds = this.map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();

            let url = `api/get_fog_data.php?bounds=${sw.lat},${sw.lng},${ne.lat},${ne.lng}&grid_m=${this.options.gridM}`;
            if (this.options.userId) {
                url += `&user_id=${encodeURIComponent(this.options.userId)}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            this.data = await response.json();
            this.renderFog();
            this.updateCoverage();
        } catch (err) {
            console.error('[FogOverlay] Failed to load fog data:', err);
        }
    }

    /**
     * Render fog cells on map
     */
    renderFog() {
        if (!this.data || !this.data.cells) return;

        // Convert cells to GeoJSON polygons
        const features = this.data.cells
            .filter(cell => !cell.explored)
            .map(cell => {
                const halfLat = (this.options.gridM / 111320) / 2;
                const halfLng = (this.options.gridM / (111320 * Math.cos(cell.lat * Math.PI / 180))) / 2;

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [cell.lng - halfLng, cell.lat - halfLat],
                            [cell.lng + halfLng, cell.lat - halfLat],
                            [cell.lng + halfLng, cell.lat + halfLat],
                            [cell.lng - halfLng, cell.lat + halfLat],
                            [cell.lng - halfLng, cell.lat - halfLat],
                        ]]
                    },
                    properties: { level: cell.level }
                };
            });

        const fogGeoJson = {
            type: 'FeatureCollection',
            features
        };

        // Update or create source
        const source = this.map.getSource('fog-data');
        if (source) {
            source.setData(fogGeoJson);
        } else {
            this.map.addSource('fog-data', {
                type: 'geojson',
                data: fogGeoJson
            });

            this.map.addLayer({
                id: 'fog-layer',
                type: 'fill',
                source: 'fog-data',
                paint: {
                    'fill-color': this.options.fogColor,
                    'fill-opacity': [
                        'interpolate', ['linear'], ['zoom'],
                        8, 0.7,
                        14, 0.4,
                        18, 0.15
                    ]
                }
            });

            // Fog border
            this.map.addLayer({
                id: 'fog-border',
                type: 'line',
                source: 'fog-data',
                paint: {
                    'line-color': 'rgba(148, 163, 184, 0.3)',
                    'line-width': 0.5
                }
            });
        }
    }

    /**
     * Create coverage percentage indicator
     */
    createCoverageIndicator() {
        this.coverageEl = document.createElement('div');
        this.coverageEl.className = 'fog-coverage-indicator';
        this.coverageEl.innerHTML = `
            <div style="
                position: absolute; top: 10px; right: 10px; z-index: 10;
                background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
                border-radius: 12px; padding: 10px 14px;
                border: 1px solid rgba(0,0,0,0.08);
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                font-family: system-ui, sans-serif;
            ">
                <div style="font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                    探索率
                </div>
                <div style="font-size: 24px; font-weight: 900; color: #059669; line-height: 1.2;" id="fog-coverage-value">
                    --%
                </div>
                <div style="width: 80px; height: 4px; background: #e5e7eb; border-radius: 9999px; margin-top: 4px;">
                    <div id="fog-coverage-bar" style="height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 9999px; transition: width 0.5s ease; width: 0%;"></div>
                </div>
            </div>
        `;

        const container = document.getElementById(this.strandMap.containerId);
        if (container) {
            container.style.position = 'relative';
            container.appendChild(this.coverageEl);
        }
    }

    /**
     * Update coverage indicator
     */
    updateCoverage() {
        if (!this.data?.stats || !this.coverageEl) return;

        const pct = this.data.stats.coverage_percent;
        const valueEl = document.getElementById('fog-coverage-value');
        const barEl = document.getElementById('fog-coverage-bar');

        if (valueEl) valueEl.textContent = `${pct}%`;
        if (barEl) barEl.style.width = `${pct}%`;
    }

    /**
     * Toggle fog visibility
     */
    toggle() {
        const layer = this.map.getLayer('fog-layer');
        if (layer) {
            const visibility = this.map.getLayoutProperty('fog-layer', 'visibility');
            this.map.setLayoutProperty('fog-layer', 'visibility',
                visibility === 'visible' ? 'none' : 'visible');
            this.map.setLayoutProperty('fog-border', 'visibility',
                visibility === 'visible' ? 'none' : 'visible');
        }
    }

    /**
     * Destroy overlay
     */
    destroy() {
        if (this.map.getLayer('fog-layer')) this.map.removeLayer('fog-layer');
        if (this.map.getLayer('fog-border')) this.map.removeLayer('fog-border');
        if (this.map.getSource('fog-data')) this.map.removeSource('fog-data');
        if (this.coverageEl) this.coverageEl.remove();
    }
}

window.FogOverlay = FogOverlay;
