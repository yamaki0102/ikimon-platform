/**
 * ScanRecommendationLayer — フィールドスキャン推奨エリア MapLibre レイヤー
 *
 * GBIF/iNaturalist の広域データと ikimon ローカルデータのギャップを
 * メッシュセルとして地図上に表示する。
 */

class ScanRecommendationLayer {
    constructor(map, options = {}) {
        this.map = map;
        this.options = {
            visible: false,
            ...options
        };
        this.data = null;
        this.popup = null;
        this._debounceTimer = null;
        this._sourceAdded = false;
    }

    async init() {
        if (!this.map) return;

        this.addLayers();

        this.map.on('moveend', () => {
            if (!this.options.visible) return;
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.loadRecommendations(), 500);
        });

        this.map.on('click', 'scan-rec-fill', (e) => this.showPopup(e));

        this.map.on('mouseenter', 'scan-rec-fill', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', 'scan-rec-fill', () => {
            this.map.getCanvas().style.cursor = '';
        });
    }

    addLayers() {
        this.map.addSource('scan-recommendations', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
        this._sourceAdded = true;

        this.map.addLayer({
            id: 'scan-rec-fill',
            type: 'fill',
            source: 'scan-recommendations',
            paint: {
                'fill-color': [
                    'match', ['get', 'priority'],
                    'high', 'rgba(239, 68, 68, 0.25)',
                    'medium', 'rgba(251, 191, 36, 0.25)',
                    'low', 'rgba(34, 197, 94, 0.15)',
                    'rgba(100, 100, 100, 0.1)'
                ],
                'fill-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    8, 0.6,
                    14, 0.25
                ]
            },
            layout: {
                visibility: this.options.visible ? 'visible' : 'none'
            }
        });

        this.map.addLayer({
            id: 'scan-rec-outline',
            type: 'line',
            source: 'scan-recommendations',
            paint: {
                'line-color': [
                    'match', ['get', 'priority'],
                    'high', 'rgba(239, 68, 68, 0.6)',
                    'medium', 'rgba(251, 191, 36, 0.5)',
                    'low', 'rgba(34, 197, 94, 0.3)',
                    'rgba(100, 100, 100, 0.2)'
                ],
                'line-width': 1.5
            },
            layout: {
                visibility: this.options.visible ? 'visible' : 'none'
            }
        });
    }

    async loadRecommendations(lat, lng) {
        if (!lat || !lng) {
            const center = this.map.getCenter();
            lat = center.lat;
            lng = center.lng;
        }

        try {
            const url = `/api/v2/scan_recommendations.php?lat=${lat}&lng=${lng}&radius=5`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const json = await res.json();
            if (!json.success) return;

            this.data = json.data;
            this.renderCells(json.data.recommendations || []);
        } catch (err) {
            console.error('[ScanRecommendationLayer] Load failed:', err);
        }
    }

    renderCells(recommendations) {
        if (!this._sourceAdded) return;

        const features = recommendations.map(rec => ({
            type: 'Feature',
            properties: {
                mesh_code: rec.mesh_code,
                score: rec.score,
                priority: rec.priority,
                reasons: JSON.stringify(rec.reasons || []),
                external_species: rec.external_species,
                local_species: rec.local_species,
                coverage_gap: rec.coverage_gap,
                env_label: rec.environment?.label || '',
                env_icon: rec.environment?.icon || '📍',
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [rec.bbox[1], rec.bbox[0]],
                    [rec.bbox[3], rec.bbox[0]],
                    [rec.bbox[3], rec.bbox[2]],
                    [rec.bbox[1], rec.bbox[2]],
                    [rec.bbox[1], rec.bbox[0]],
                ]]
            }
        }));

        this.map.getSource('scan-recommendations').setData({
            type: 'FeatureCollection',
            features
        });
    }

    showPopup(e) {
        if (!e.features || !e.features.length) return;

        const props = e.features[0].properties;
        let reasons = [];
        try { reasons = JSON.parse(props.reasons); } catch (_) {}

        const reasonsHtml = reasons.map(r =>
            `<li class="text-xs text-slate-600">${r}</li>`
        ).join('');

        const priorityColors = {
            high: 'bg-red-100 text-red-700',
            medium: 'bg-amber-100 text-amber-700',
            low: 'bg-emerald-100 text-emerald-700'
        };
        const badgeClass = priorityColors[props.priority] || 'bg-slate-100 text-slate-600';

        const html = `
            <div class="p-2 max-w-64">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg">${props.env_icon}</span>
                    <span class="font-semibold text-sm">${props.env_label}</span>
                    <span class="text-xs px-1.5 py-0.5 rounded ${badgeClass}">${props.priority}</span>
                </div>
                <div class="flex gap-3 text-xs text-slate-500 mb-1.5">
                    <span>外部 ${props.external_species}種</span>
                    <span>ikimon ${props.local_species}種</span>
                    <span class="font-semibold text-emerald-600">+${props.coverage_gap}種</span>
                </div>
                <ul class="space-y-0.5 mb-2">${reasonsHtml}</ul>
                <a href="/field_research.php?mode=scan&lat=${e.lngLat.lat}&lng=${e.lngLat.lng}"
                   class="block text-center text-xs bg-emerald-600 text-white rounded px-3 py-1.5 hover:bg-emerald-700">
                    このエリアを調査
                </a>
            </div>
        `;

        if (this.popup) this.popup.remove();
        this.popup = new maplibregl.Popup({ maxWidth: '280px' })
            .setLngLat(e.lngLat)
            .setHTML(html)
            .addTo(this.map);
    }

    toggle(visible) {
        this.options.visible = visible !== undefined ? visible : !this.options.visible;
        const vis = this.options.visible ? 'visible' : 'none';
        this.map.setLayoutProperty('scan-rec-fill', 'visibility', vis);
        this.map.setLayoutProperty('scan-rec-outline', 'visibility', vis);

        if (this.options.visible && !this.data) {
            this.loadRecommendations();
        }
    }

    getSummary() {
        return this.data?.summary || null;
    }
}
