class OfflineMapManager {
    constructor(map) {
        this.map = map;
        this.CACHE_NAME = 'ikimon-offline-maps-v1';
    }

    async cacheCurrentArea() {
        const bounds = this.map.getBounds();
        const minZoom = 12;
        const maxZoom = 16;

        const tilesToFetch = [];

        // Add Style & Assets (simplified list)
        // Ideally we parse style.json to find sprite/glyph URLs.
        // For MVP, we cache the style.json itself.
        tilesToFetch.push('https://demotiles.maplibre.org/style.json');

        // Calculate tiles
        for (let z = minZoom; z <= maxZoom; z++) {
            const minTile = this.long2tile(bounds.getWest(), z);
            const maxTile = this.long2tile(bounds.getEast(), z);
            const minY = this.lat2tile(bounds.getNorth(), z); // North is lower Y in TMS? No, slippy map usually North is 0?
            const maxY = this.lat2tile(bounds.getSouth(), z);

            // Slippy map: x increases West-East, y increases North-South

            for (let x = minTile; x <= maxTile; x++) {
                for (let y = minY; y <= maxY; y++) {
                    // Assuming demo tiles URL pattern
                    // https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf (Example)
                    // We need the ACTUAL source URL from the map style.
                    // But for demo, we might guess or extract from map source.

                    // Lets try to get Source URL from map instance
                    // const source = this.map.getSource('composite'); 
                    // ... complex.

                    // Fallback to a known tile server for demo or generic pattern
                    // If using demotiles style, it points to:
                    // "tiles": ["https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf"]
                    const url = `https://demotiles.maplibre.org/tiles/${z}/${x}/${y}.pbf`;
                    tilesToFetch.push(url);
                }
            }
        }

        alert(`Caching ${tilesToFetch.length} tiles. This may take a while.`);

        const cache = await caches.open(this.CACHE_NAME);

        // Batch fetch
        let success = 0;
        let fail = 0;

        // Process in chunks to avoid network congestion
        const chunkSize = 10;
        for (let i = 0; i < tilesToFetch.length; i += chunkSize) {
            const chunk = tilesToFetch.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (url) => {
                try {
                    // Check if already cached
                    const match = await cache.match(url);
                    if (match) {
                        success++;
                        return;
                    }

                    const res = await fetch(url, { mode: 'cors' });
                    if (res.ok) {
                        await cache.put(url, res);
                        success++;
                    } else {
                        fail++;
                    }
                } catch (e) {
                    console.warn('Failed to cache', url, e);
                    fail++;
                }
            }));

            // Updates progress?
        }

        alert(`Finished!\nCached: ${success}\nFailed: ${fail}`);
        document.getElementById('debug-info').innerText = `Cached: ${success} tiles`;
    }

    // Slippy map tile math
    long2tile(lon, zoom) {
        return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
    }
    lat2tile(lat, zoom) {
        return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
    }
}
