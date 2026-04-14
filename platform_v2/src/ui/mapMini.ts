import type { LandingObservation } from "../services/readModels.js";
import { escapeHtml } from "./siteShell.js";

export type MapPoint = {
  lat: number;
  lng: number;
  occurrenceId: string;
  displayName: string;
  placeName: string;
};

export function toMapPoints(observations: LandingObservation[]): MapPoint[] {
  return observations
    .filter((o): o is LandingObservation & { latitude: number; longitude: number } =>
      typeof o.latitude === "number" && typeof o.longitude === "number",
    )
    .map((o) => ({
      lat: o.latitude as number,
      lng: o.longitude as number,
      occurrenceId: o.occurrenceId,
      displayName: o.displayName,
      placeName: o.placeName,
    }));
}

export type MapMiniProps = {
  id?: string;
  points: MapPoint[];
  mapHref: string;
  mapCtaLabel: string;
  emptyLabel: string;
  height?: number;
};

export function renderMapMini(props: MapMiniProps): string {
  const id = props.id ?? "ikimon-map-mini";
  const height = props.height ?? 260;
  const fallbackPoints = props.points.slice(0, 20);
  const fallbackMarkers = fallbackPoints
    .map((p, idx) => {
      const x = ((p.lng + 180) / 360) * 100;
      const y = (1 - (p.lat + 90) / 180) * 100;
      return `<span class="map-mini-fallback-dot" style="left:${x.toFixed(3)}%;top:${y.toFixed(3)}%" title="${escapeHtml(p.displayName)}"></span>`;
    })
    .join("");

  const payload = JSON.stringify({
    points: fallbackPoints.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      id: p.occurrenceId,
      name: p.displayName,
      place: p.placeName,
    })),
  });

  return `<div class="map-mini" style="--map-mini-height:${height}px">
    <div id="${escapeHtml(id)}" class="map-mini-canvas" data-points='${escapeHtml(payload)}'>
      <div class="map-mini-fallback" aria-hidden="true">
        <div class="map-mini-fallback-graticule"></div>
        ${fallbackMarkers || `<span class="map-mini-empty">${escapeHtml(props.emptyLabel)}</span>`}
      </div>
    </div>
    <a class="map-mini-cta" href="${escapeHtml(props.mapHref)}">${escapeHtml(props.mapCtaLabel)} →</a>
  </div>`;
}

/** Script that progressively enhances the mini map with MapLibre if available. */
export function mapMiniBootScript(id: string = "ikimon-map-mini"): string {
  return `<script>
(function () {
  var el = document.getElementById(${JSON.stringify(id)});
  if (!el) return;
  var raw = el.getAttribute('data-points') || '{}';
  var data;
  try { data = JSON.parse(raw); } catch (_) { return; }
  if (!data || !Array.isArray(data.points) || data.points.length === 0) return;

  var styleHref = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  if (!document.querySelector('link[data-maplibre="1"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleHref;
    link.setAttribute('data-maplibre', '1');
    document.head.appendChild(link);
  }

  function hydrate() {
    if (!window.maplibregl) return;
    var fallback = el.querySelector('.map-mini-fallback');
    if (fallback) fallback.style.display = 'none';
    var pts = data.points;
    var lats = pts.map(function (p) { return p.lat; });
    var lngs = pts.map(function (p) { return p.lng; });
    var centerLat = lats.reduce(function (a, b) { return a + b; }, 0) / lats.length;
    var centerLng = lngs.reduce(function (a, b) { return a + b; }, 0) / lngs.length;

    var map = new window.maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [centerLng, centerLat],
      zoom: 8,
      attributionControl: true,
      interactive: true,
    });

    map.on('load', function () {
      pts.forEach(function (p) {
        var dot = document.createElement('div');
        dot.className = 'map-mini-marker';
        dot.title = p.name;
        new window.maplibregl.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(map);
      });
      var bounds = new window.maplibregl.LngLatBounds();
      pts.forEach(function (p) { bounds.extend([p.lng, p.lat]); });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, maxZoom: 11, duration: 0 });
    });
  }

  if (window.maplibregl) {
    hydrate();
  } else {
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.defer = true;
    s.onload = hydrate;
    document.head.appendChild(s);
  }
})();
</script>`;
}

export const MAP_MINI_STYLES = `
  .map-mini { position: relative; border-radius: 22px; overflow: hidden; background: linear-gradient(135deg,#ecfeff,#eff6ff); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 10px 24px rgba(15,23,42,.05); }
  .map-mini-canvas { position: relative; width: 100%; height: var(--map-mini-height, 260px); }
  .map-mini-fallback { position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, rgba(16,185,129,.18), transparent 55%), radial-gradient(circle at 70% 70%, rgba(14,165,233,.18), transparent 55%), linear-gradient(135deg,#e0f2fe,#ecfdf5); overflow: hidden; }
  .map-mini-fallback-graticule { position: absolute; inset: 0; background-image: linear-gradient(0deg, rgba(15,23,42,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.04) 1px, transparent 1px); background-size: 36px 36px; }
  .map-mini-fallback-dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #0ea5e9; box-shadow: 0 0 0 4px rgba(14,165,233,.22); transform: translate(-50%, -50%); pointer-events: none; }
  .map-mini-empty { position: absolute; inset: 0; display: grid; place-items: center; color: #475569; font-weight: 700; font-size: 13px; }
  .map-mini-marker { width: 14px; height: 14px; border-radius: 50%; background: #0ea5e9; box-shadow: 0 0 0 5px rgba(14,165,233,.22); border: 2px solid #fff; cursor: pointer; }
  .map-mini-cta { position: absolute; right: 14px; bottom: 14px; padding: 8px 14px; border-radius: 999px; background: rgba(15,23,42,.86); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .02em; box-shadow: 0 8px 18px rgba(15,23,42,.2); backdrop-filter: blur(8px); z-index: 2; }
  .map-mini-cta:hover { background: #0f172a; }
`;
