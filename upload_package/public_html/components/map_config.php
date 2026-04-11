<?php
/**
 * Map Configuration Component — PMTiles Self-hosted Base Map
 *
 * Includes: MapLibre GL JS 4.7.1 + PMTiles + Protomaps Basemaps
 *
 * Usage: Replace individual MapLibre script/css tags with this single include.
 *   <?php include __DIR__ . '/components/map_config.php'; ?>
 *
 * Then in JS:
 *   const map = new maplibregl.Map({
 *       container: 'map',
 *       style: IKIMON_MAP.style('light'),  // 'light', 'dark', 'white', 'grayscale'
 *       center: [137.7, 34.7],
 *       zoom: 12
 *   });
 *   // Style switching:
 *   map.setStyle(IKIMON_MAP.satellite());
 *   map.setStyle(IKIMON_MAP.terrain());
 */
require_once __DIR__ . '/../../libs/CspNonce.php';
?>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/pmtiles@4/dist/pmtiles.js"></script>
<script src="https://unpkg.com/@protomaps/basemaps@5/dist/basemaps.js" crossorigin="anonymous"></script>
<script nonce="<?= CspNonce::attr() ?>">
(function() {
    const protocol = new pmtiles.Protocol({metadata: true});
    maplibregl.addProtocol("pmtiles", protocol.tile);

    window.IKIMON_MAP = {
        TILES_URL: 'pmtiles://https://ikimon.life/tiles/japan.pmtiles',

        style(flavor) {
            flavor = flavor || 'light';
            return {
                version: 8,
                glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
                sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/' + flavor,
                sources: {
                    protomaps: {
                        type: 'vector',
                        url: this.TILES_URL,
                        attribution: '\u00a9 <a href="https://openstreetmap.org">OpenStreetMap</a>'
                    }
                },
                layers: basemaps.layers('protomaps', basemaps.namedFlavor(flavor), {lang: 'ja'})
            };
        },

        satellite() {
            return {
                version: 8,
                sources: {
                    'gsi-satellite': {
                        type: 'raster',
                        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'],
                        tileSize: 256,
                        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">\u56fd\u571f\u5730\u7406\u9662</a>'
                    }
                },
                layers: [{id: 'gsi-satellite', type: 'raster', source: 'gsi-satellite'}]
            };
        },

        terrain() {
            return {
                version: 8,
                sources: {
                    'gsi-pale': {
                        type: 'raster',
                        tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">\u56fd\u571f\u5730\u7406\u9662</a>'
                    }
                },
                layers: [{id: 'gsi-pale', type: 'raster', source: 'gsi-pale'}]
            };
        }
    };
})();
</script>
