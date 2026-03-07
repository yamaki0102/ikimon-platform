/**
 * ExplorationMap — Fog of War Overlay for Exploration Map
 *
 * Manages three layers on a MapLibre GL map:
 *   1. Fog layer — semi-transparent overlay with holes for explored cells
 *   2. Trail layer — polylines of GPS tracks (color-coded by recency)
 *   3. Observation layer — markers for observation points
 *
 * Uses a "reverse polygon" approach: a viewport-covering rectangle
 * with explored cells cut out as holes.
 */
class ExplorationMap {
    constructor(map, options = {}) {
        this.map = map;
        this.apiUrl = options.apiUrl || 'api/get_fog_data.php';
        this.gridM = options.gridM || 100;
        this.period = options.period || 'all';
        this.layers = { fog: true, trails: true, observations: true };
        this.stats = {};
        this._debounceTimer = null;
        this._lastBounds = null;
        this._loading = false;

        // Callbacks
        this.onStatsUpdate = options.onStatsUpdate || null;
        this.onLoadStart = options.onLoadStart || null;
        this.onLoadEnd = options.onLoadEnd || null;

        // Setup layers once map is loaded
        if (this.map.loaded()) {
            this._setupLayers();
            this._loadData();
        } else {
            this.map.on('load', () => {
                this._setupLayers();
                this._loadData();
            });
        }

        // Reload on viewport change
        this.map.on('moveend', () => this._debouncedLoad());
    }

    // ── Public API ──

    setPeriod(period) {
        this.period = period;
        this._loadData();
    }

    setLayer(layer, visible) {
        this.layers[layer] = visible;
        this._applyLayerVisibility();
    }

    toggleLayer(layer) {
        this.layers[layer] = !this.layers[layer];
        this._applyLayerVisibility();
    }

    /**
     * Add a single explored cell in real-time (during recording).
     * @param {number} lat
     * @param {number} lng
     * @param {number|null} speedKmh — speed in km/h for tier determination
     */
    addExploredPoint(lat, lng, speedKmh = null) {
        const cellCenter = this._snapToGrid(lat, lng);
        const key = `${cellCenter.lat.toFixed(6)}:${cellCenter.lng.toFixed(6)}`;
        const tier = this._speedToTier(speedKmh);

        if (!this._cellSet) this._cellSet = new Set();
        if (!this._cellTiers) this._cellTiers = {};

        // Keep slowest tier for each cell
        const P = { walk: 0, bike: 1, vehicle: 2, fast: 3 };
        const prevTier = this._cellTiers[key];
        if (!prevTier || P[tier] < P[prevTier]) {
            this._cellTiers[key] = tier;
        }

        const isNew = !this._cellSet.has(key);
        if (isNew) this._cellSet.add(key);

        // Only update if cell is new or tier changed
        const tierChanged = prevTier && this._cellTiers[key] !== prevTier;
        if (!isNew && !tierChanged) return;

        if (this._currentCells) {
            if (isNew) {
                this._currentCells.push({
                    lat: cellCenter.lat, lng: cellCenter.lng,
                    has_obs: false, count: 0,
                    tier: this._cellTiers[key]
                });
            } else {
                const cell = this._currentCells.find(c =>
                    c.lat.toFixed(6) === cellCenter.lat.toFixed(6) &&
                    c.lng.toFixed(6) === cellCenter.lng.toFixed(6)
                );
                if (cell) cell.tier = this._cellTiers[key];
            }

            this._updateFogPolygon(this._currentCells);
            this._updateThinFog(this._currentCells);

            // Update stats — area counts walk+bike only
            if (this.stats.explored_cells !== undefined) {
                if (isNew) this.stats.explored_cells++;
                const walkBike = this._currentCells.filter(c => c.tier === 'walk' || c.tier === 'bike').length;
                this.stats.explored_area_m2 = walkBike * this.gridM * this.gridM;
                if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
            }
        }
    }

    refresh() {
        this._loadData();
    }

    // ── Layer Setup ──

    _setupLayers() {
        // --- Fog Layer ---
        this.map.addSource('exploration-fog', {
            type: 'geojson',
            data: this._emptyPolygon()
        });
        this.map.addLayer({
            id: 'exploration-fog-fill',
            type: 'fill',
            source: 'exploration-fog',
            paint: {
                'fill-color': '#1a1a2e',
                'fill-opacity': 0.55
            }
        });

        // --- Thin Fog (bike cells — partially explored) ---
        this.map.addSource('exploration-thin-fog', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        this.map.addLayer({
            id: 'exploration-thin-fog-fill',
            type: 'fill',
            source: 'exploration-thin-fog',
            paint: {
                'fill-color': '#1a1a2e',
                'fill-opacity': 0.15
            }
        });

        // --- Observation Cells (brighter glow) ---
        this.map.addSource('exploration-obs-cells', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        this.map.addLayer({
            id: 'exploration-obs-cells-fill',
            type: 'fill',
            source: 'exploration-obs-cells',
            paint: {
                'fill-color': '#34d399',
                'fill-opacity': 0.25
            }
        });

        // --- Trail Lines ---
        this.map.addSource('exploration-trails', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        this.map.addLayer({
            id: 'exploration-trails-line',
            type: 'line',
            source: 'exploration-trails',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': ['get', 'color'],
                'line-width': ['coalesce', ['get', 'width'], 2.5],
                'line-opacity': 0.7
            }
        });

        // --- Observation Markers ---
        this.map.addSource('exploration-observations', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        this.map.addLayer({
            id: 'exploration-observations-circle',
            type: 'circle',
            source: 'exploration-observations',
            paint: {
                'circle-radius': 5,
                'circle-color': '#f59e0b',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1.5,
                'circle-opacity': 0.9
            }
        });

        // Observation click popup (low zoom — high zoom uses photo markers)
        this.map.on('click', 'exploration-observations-circle', (e) => {
            if (this.map.getZoom() >= 15) return;
            if (!e.features || !e.features.length) return;
            const f = e.features[0].properties;
            const coords = e.features[0].geometry.coordinates;
            const html = `
                <div style="font-size:13px;max-width:200px;">
                    <strong>${f.name || '名前なし'}</strong>
                    <div style="color:#64748b;font-size:11px;">${f.date || ''}</div>
                    ${f.photo ? `<img src="${f.photo}" style="width:100%;border-radius:6px;margin-top:4px;" onerror="this.style.display='none'">` : ''}
                </div>
            `;
            new maplibregl.Popup({ offset: 10, maxWidth: '220px' })
                .setLngLat(coords)
                .setHTML(html)
                .addTo(this.map);
        });

        // Cursor change on hover
        this.map.on('mouseenter', 'exploration-observations-circle', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'exploration-observations-circle', () => {
            this.map.getCanvas().style.cursor = '';
        });

        // Photo markers on zoom change
        this.map.on('zoomend', () => this._updatePhotoMarkers());
    }

    // ── Data Loading ──

    _debouncedLoad() {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this._loadData(), 300);
    }

    async _loadData() {
        if (this._loading) return;

        const bounds = this.map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Skip if bounds haven't changed significantly
        const boundsStr = `${sw.lat.toFixed(4)},${sw.lng.toFixed(4)},${ne.lat.toFixed(4)},${ne.lng.toFixed(4)}`;
        if (boundsStr === this._lastBounds) return;
        this._lastBounds = boundsStr;

        // Auto-adjust grid size based on zoom
        const zoom = this.map.getZoom();
        let effectiveGrid = this.gridM;
        if (zoom < 11) effectiveGrid = Math.max(effectiveGrid, 500);
        else if (zoom < 13) effectiveGrid = Math.max(effectiveGrid, 200);

        this._loading = true;
        if (this.onLoadStart) this.onLoadStart();

        try {
            const url = `${this.apiUrl}?bounds=${sw.lat},${sw.lng},${ne.lat},${ne.lng}&grid_m=${effectiveGrid}&period=${this.period}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (data.error) {
                console.warn('[ExplorationMap] API error:', data.error);
                return;
            }

            // Update fog
            this._currentCells = data.cells || [];
            this._cellSet = new Set(this._currentCells.map(c => `${c.lat.toFixed(6)}:${c.lng.toFixed(6)}`));
            this._cellTiers = {};
            for (const c of this._currentCells) {
                this._cellTiers[`${c.lat.toFixed(6)}:${c.lng.toFixed(6)}`] = c.tier || 'walk';
            }
            this._updateFogPolygon(this._currentCells);
            this._updateThinFog(this._currentCells);

            // Update observation cell highlights
            this._updateObsCells(this._currentCells.filter(c => c.has_obs), effectiveGrid);

            // Update trails
            this._updateTrails(data.trails || []);

            // Update observation markers
            this._updateObservations(data.observations || []);

            // Update stats
            this.stats = data.stats || {};
            if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
        } catch (err) {
            console.error('[ExplorationMap] Load failed:', err);
        } finally {
            this._loading = false;
            if (this.onLoadEnd) this.onLoadEnd();
        }
    }

    // ── Fog Polygon (reverse polygon with holes) ──

    _updateFogPolygon(cells) {
        if (!this.map.getSource('exploration-fog')) return;

        const bounds = this.map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Expand outer ring well beyond viewport
        const pad = 2; // degrees padding
        const outer = [
            [sw.lng - pad, sw.lat - pad],
            [ne.lng + pad, sw.lat - pad],
            [ne.lng + pad, ne.lat + pad],
            [sw.lng - pad, ne.lat + pad],
            [sw.lng - pad, sw.lat - pad], // close ring
        ];

        const coordinates = [outer];

        // Each walk/bike cell becomes a hole (inner ring, counter-clockwise)
        const gridM = this.gridM;
        for (const cell of cells) {
            // Only cut holes for walk and bike tiers
            if (cell.tier && cell.tier !== 'walk' && cell.tier !== 'bike') continue;
            const halfLat = (gridM / 111320) / 2;
            const halfLng = (gridM / (111320 * Math.cos(cell.lat * Math.PI / 180))) / 2;
            // CCW hole
            coordinates.push([
                [cell.lng - halfLng, cell.lat - halfLat],
                [cell.lng - halfLng, cell.lat + halfLat],
                [cell.lng + halfLng, cell.lat + halfLat],
                [cell.lng + halfLng, cell.lat - halfLat],
                [cell.lng - halfLng, cell.lat - halfLat], // close
            ]);
        }

        this.map.getSource('exploration-fog').setData({
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: coordinates
            }
        });
    }

    // ── Thin Fog (bike cells — partial exploration) ──

    _updateThinFog(cells) {
        if (!this.map.getSource('exploration-thin-fog')) return;

        const gridM = this.gridM;
        const bikeCells = cells.filter(c => c.tier === 'bike');

        const features = bikeCells.map(cell => {
            const halfLat = (gridM / 111320) / 2;
            const halfLng = (gridM / (111320 * Math.cos(cell.lat * Math.PI / 180))) / 2;
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
                }
            };
        });

        this.map.getSource('exploration-thin-fog').setData({
            type: 'FeatureCollection', features
        });
    }

    // ── Observation Cell Highlights ──

    _updateObsCells(obsCells, gridM) {
        if (!this.map.getSource('exploration-obs-cells')) return;

        const features = obsCells.map(cell => {
            const halfLat = (gridM / 111320) / 2;
            const halfLng = (gridM / (111320 * Math.cos(cell.lat * Math.PI / 180))) / 2;
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
                properties: { count: cell.count }
            };
        });

        this.map.getSource('exploration-obs-cells').setData({
            type: 'FeatureCollection', features
        });
    }

    // ── Trail Lines ──

    _updateTrails(trails) {
        if (!this.map.getSource('exploration-trails')) return;

        const TIER_COLORS = { walk: '#22c55e', bike: '#3b82f6', vehicle: '#f59e0b', fast: '#94a3b8' };
        const TIER_WIDTHS = { walk: 2.5, bike: 2.5, vehicle: 2, fast: 1.5 };
        const features = [];

        for (const trail of trails) {
            if (!trail.coords || trail.coords.length < 2) continue;
            const tiers = trail.tiers || [];

            // Segment trail by speed tier for per-segment coloring
            let segStart = 0;
            for (let i = 1; i <= trail.coords.length; i++) {
                const prevTier = tiers[i - 1] || 'walk';
                const curTier = i < trail.coords.length ? (tiers[i] || 'walk') : null;

                if (curTier !== prevTier || i === trail.coords.length) {
                    const segCoords = trail.coords.slice(segStart, i);
                    if (segCoords.length >= 2) {
                        features.push({
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: segCoords },
                            properties: {
                                session_id: trail.session_id,
                                date: trail.date,
                                color: TIER_COLORS[prevTier] || TIER_COLORS.walk,
                                width: TIER_WIDTHS[prevTier] || 2.5,
                                tier: prevTier,
                                distance: trail.distance_m
                            }
                        });
                    }
                    segStart = Math.max(0, i - 1); // overlap by 1 for continuity
                }
            }
        }

        this.map.getSource('exploration-trails').setData({
            type: 'FeatureCollection', features
        });
    }

    // ── Observation Markers ──

    _updateObservations(observations) {
        if (!this.map.getSource('exploration-observations')) return;

        const features = observations.map(obs => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [obs.lng, obs.lat]
            },
            properties: {
                id: obs.id,
                name: obs.name,
                photo: obs.photo,
                date: obs.date,
            }
        }));

        this.map.getSource('exploration-observations').setData({
            type: 'FeatureCollection', features
        });

        // Store for photo markers
        this._observations = observations;
        this._updatePhotoMarkers();
    }

    // ── Photo Markers (zoom ≥ 15) ──

    _updatePhotoMarkers() {
        // Clean up existing
        if (this._photoMarkers) {
            this._photoMarkers.forEach(m => m.remove());
        }
        this._photoMarkers = [];

        const zoom = this.map.getZoom();
        if (zoom < 15 || !this._observations || !this.layers.observations) return;

        const size = zoom >= 17 ? 48 : 36;
        const radius = zoom >= 17 ? 10 : 8;

        for (const obs of this._observations) {
            if (!obs.photo) continue;

            const el = document.createElement('div');
            el.style.cssText = `
                width:${size}px; height:${size}px; border-radius:${radius}px;
                border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.25);
                background:url('${obs.photo}') center/cover no-repeat #e5e7eb;
                cursor:pointer; transition:transform 0.15s;
            `;
            el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.15)');
            el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');

            const popup = new maplibregl.Popup({ offset: size / 2 + 8, maxWidth: '220px' })
                .setHTML(`
                    <div style="font-size:13px;max-width:200px;">
                        <strong>${obs.name || '名前なし'}</strong>
                        <div style="color:#64748b;font-size:11px;">${obs.date || ''}</div>
                        <img src="${obs.photo}" style="width:100%;border-radius:6px;margin-top:4px;" onerror="this.style.display='none'">
                    </div>
                `);

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([obs.lng, obs.lat])
                .setPopup(popup)
                .addTo(this.map);

            this._photoMarkers.push(marker);
        }
    }

    // ── Layer Visibility ──

    _applyLayerVisibility() {
        const setVis = (id, visible) => {
            if (this.map.getLayer(id)) {
                this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
            }
        };
        setVis('exploration-fog-fill', this.layers.fog);
        setVis('exploration-thin-fog-fill', this.layers.fog);
        setVis('exploration-obs-cells-fill', this.layers.fog);
        setVis('exploration-trails-line', this.layers.trails);
        setVis('exploration-observations-circle', this.layers.observations);

        // Photo markers
        if (this._photoMarkers) {
            const show = this.layers.observations;
            this._photoMarkers.forEach(m => {
                m.getElement().style.display = show ? '' : 'none';
            });
        }
    }

    // ── Grid Snap (client-side, matches server logic) ──

    _snapToGrid(lat, lng) {
        const latDeg = this.gridM / 111320;
        const lngDeg = this.gridM / (111320 * Math.cos(lat * Math.PI / 180));
        return {
            lat: Math.floor(lat / latDeg) * latDeg + latDeg / 2,
            lng: Math.floor(lng / lngDeg) * lngDeg + lngDeg / 2,
        };
    }

    // ── Speed Tier ──

    _speedToTier(speedKmh) {
        if (speedKmh == null || speedKmh < 7) return 'walk';
        if (speedKmh < 25) return 'bike';
        if (speedKmh < 100) return 'vehicle';
        return 'fast';
    }

    // ── Helpers ──

    _emptyPolygon() {
        return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[]] }
        };
    }
}
