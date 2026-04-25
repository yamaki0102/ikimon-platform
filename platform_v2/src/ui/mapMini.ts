import { buildPublicMapCellHref } from "../services/publicLocation.js";
import type { LandingMapPreviewCell } from "../services/readModels.js";
import { escapeHtml } from "./siteShell.js";

export type MapMiniCell = LandingMapPreviewCell & {
  href: string;
};

function asHref(mapHref: string, cell: LandingMapPreviewCell): string {
  return buildPublicMapCellHref(mapHref, {
    label: cell.label,
    scope: "blurred",
    cellId: cell.cellId,
    gridM: cell.gridM,
    radiusM: null,
    centroidLat: cell.centroidLat,
    centroidLng: cell.centroidLng,
    displayMode: "area",
  });
}

export function toMapMiniCells(cells: LandingMapPreviewCell[], mapHref: string): MapMiniCell[] {
  return cells.map((cell) => ({
    ...cell,
    href: asHref(mapHref, cell),
  }));
}

export type MapMiniProps = {
  id?: string;
  cells: MapMiniCell[];
  mapHref: string;
  mapCtaLabel: string;
  mapCtaKpiAction?: string;
  emptyLabel: string;
  height?: number;
};

function projectCells(cells: MapMiniCell[]): Array<MapMiniCell & {
  leftPct: number;
  topPct: number;
  widthPct: number;
  heightPct: number;
}> {
  const coords = cells.flatMap((cell) => cell.polygon);
  if (coords.length === 0) return [];

  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const padLng = lngSpan * 0.08;
  const padLat = latSpan * 0.08;

  return cells.map((cell) => {
    const cellLngs = cell.polygon.map((coord) => coord[0]);
    const cellLats = cell.polygon.map((coord) => coord[1]);
    const cellMinLng = Math.min(...cellLngs);
    const cellMaxLng = Math.max(...cellLngs);
    const cellMinLat = Math.min(...cellLats);
    const cellMaxLat = Math.max(...cellLats);
    const totalLng = lngSpan + padLng * 2;
    const totalLat = latSpan + padLat * 2;

    return {
      ...cell,
      leftPct: ((cellMinLng - (minLng - padLng)) / totalLng) * 100,
      widthPct: ((cellMaxLng - cellMinLng) / totalLng) * 100,
      topPct: (1 - ((cellMaxLat - (minLat - padLat)) / totalLat)) * 100,
      heightPct: ((cellMaxLat - cellMinLat) / totalLat) * 100,
    };
  });
}

export function renderMapMini(props: MapMiniProps): string {
  const id = props.id ?? "ikimon-map-mini";
  const height = props.height ?? 260;
  const mapCtaKpiAction = props.mapCtaKpiAction
    ? ` data-kpi-action="${escapeHtml(props.mapCtaKpiAction)}"`
    : "";
  const fallbackCells = projectCells(props.cells.slice(0, 18));
  const fallbackShapes = fallbackCells
    .map((cell, index) => `
      <a class="map-mini-fallback-cell"
         href="${escapeHtml(cell.href)}"
         style="left:${cell.leftPct.toFixed(3)}%;top:${cell.topPct.toFixed(3)}%;width:${cell.widthPct.toFixed(3)}%;height:${cell.heightPct.toFixed(3)}%;--cell-delay:${index};"
         title="${escapeHtml(`${cell.label} · ${cell.count}件`)}">
        <span class="map-mini-fallback-count">${escapeHtml(String(cell.count))}</span>
      </a>`)
    .join("");
  const badges = fallbackCells
    .slice(0, 4)
    .map((cell) => `<a class="map-mini-badge" href="${escapeHtml(cell.href)}"><strong>${escapeHtml(cell.label)}</strong><span>${escapeHtml(`${cell.count}件`)}</span></a>`)
    .join("");

  const payload = JSON.stringify({
    cells: props.cells.slice(0, 18).map((cell) => ({
      cellId: cell.cellId,
      label: cell.label,
      count: cell.count,
      gridM: cell.gridM,
      centroidLat: cell.centroidLat,
      centroidLng: cell.centroidLng,
      polygon: cell.polygon,
      href: cell.href,
    })),
  });

  return `<div class="map-mini" style="--map-mini-height:${height}px">
    <div id="${escapeHtml(id)}" class="map-mini-canvas" data-cells='${escapeHtml(payload)}'>
      <div class="map-mini-fallback" aria-hidden="true">
        <div class="map-mini-fallback-graticule"></div>
        <div class="map-mini-fallback-glow"></div>
        ${fallbackShapes || `<span class="map-mini-empty">${escapeHtml(props.emptyLabel)}</span>`}
      </div>
      ${badges ? `<div class="map-mini-badges">${badges}</div>` : ""}
    </div>
    <a class="map-mini-cta" href="${escapeHtml(props.mapHref)}"${mapCtaKpiAction}>${escapeHtml(props.mapCtaLabel)} →</a>
  </div>`;
}

/** Script that progressively enhances the mini map with MapLibre if available. */
export function mapMiniBootScript(id: string = "ikimon-map-mini"): string {
  return `<script>
(function () {
  var el = document.getElementById(${JSON.stringify(id)});
  if (!el) return;
  var raw = el.getAttribute('data-cells') || '{}';
  var data;
  try { data = JSON.parse(raw); } catch (_) { return; }
  if (!data || !Array.isArray(data.cells) || data.cells.length === 0) return;

  var MAPLIBRE_CSS_SRI = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
  var MAPLIBRE_JS_SRI  = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
  var styleHref = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  if (!document.querySelector('link[data-maplibre="1"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = styleHref;
    link.integrity = MAPLIBRE_CSS_SRI;
    link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer';
    link.setAttribute('data-maplibre', '1');
    document.head.appendChild(link);
  }

  function hydrate() {
    if (!window.maplibregl) return;
    var fallback = el.querySelector('.map-mini-fallback');
    if (fallback) fallback.style.display = 'none';
    var cells = data.cells;
    var featureCollection = {
      type: 'FeatureCollection',
      features: cells.map(function (cell) {
        return {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [cell.polygon] },
          properties: {
            cellId: cell.cellId,
            label: cell.label,
            count: cell.count,
            href: cell.href
          }
        };
      })
    };

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
      center: [cells[0].centroidLng, cells[0].centroidLat],
      zoom: 8,
      attributionControl: false,
      interactive: true,
    });

    map.on('load', function () {
      map.addSource('mini-cells', { type: 'geojson', data: featureCollection });
      map.addLayer({
        id: 'mini-cells-fill',
        type: 'fill',
        source: 'mini-cells',
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': ['interpolate', ['linear'], ['get', 'count'], 1, 0.18, 6, 0.42],
        },
      });
      map.addLayer({
        id: 'mini-cells-outline',
        type: 'line',
        source: 'mini-cells',
        paint: {
          'line-color': '#0f172a',
          'line-width': 1.2,
          'line-opacity': 0.35,
        },
      });

      var bounds = new window.maplibregl.LngLatBounds();
      cells.forEach(function (cell) {
        (cell.polygon || []).forEach(function (coord) { bounds.extend(coord); });
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 28, maxZoom: 10.8, duration: 0 });

      map.on('click', 'mini-cells-fill', function (event) {
        var feature = event && event.features && event.features[0];
        var href = feature && feature.properties ? feature.properties.href : '';
        if (href) window.location.href = href;
      });
      map.on('mouseenter', 'mini-cells-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'mini-cells-fill', function () { map.getCanvas().style.cursor = ''; });
    });
  }

  if (window.maplibregl) {
    hydrate();
  } else {
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.integrity = MAPLIBRE_JS_SRI;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.defer = true;
    s.onload = hydrate;
    s.onerror = function () {
      console.warn('MapLibre CDN load failed (possibly SRI mismatch). Falling back to teaser cells.');
    };
    document.head.appendChild(s);
  }
})();
</script>`;
}

export const MAP_MINI_STYLES = `
  .map-mini { position: relative; border-radius: 22px; overflow: hidden; background: linear-gradient(145deg,#f0fdf4,#eff6ff 58%,#ecfeff); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 10px 24px rgba(15,23,42,.05); }
  .map-mini-canvas { position: relative; width: 100%; height: var(--map-mini-height, 260px); }
  .map-mini-fallback { position: absolute; inset: 0; background: linear-gradient(145deg,#f8fffc,#eef8ff 58%,#eefcf7); overflow: hidden; }
  .map-mini-fallback-graticule { position: absolute; inset: 0; background-image: linear-gradient(0deg, rgba(15,23,42,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.04) 1px, transparent 1px); background-size: 32px 32px; }
  .map-mini-fallback-glow { position: absolute; inset: 0; background: radial-gradient(circle at 24% 28%, rgba(16,185,129,.18), transparent 34%), radial-gradient(circle at 76% 68%, rgba(14,165,233,.18), transparent 36%); }
  .map-mini-fallback-cell {
    position: absolute;
    display: grid;
    place-items: center;
    min-width: 18px;
    min-height: 18px;
    border: 1px solid rgba(15,23,42,.18);
    background: linear-gradient(145deg, rgba(14,165,233,.22), rgba(16,185,129,.18));
    box-shadow: 0 10px 22px rgba(15,23,42,.08);
    backdrop-filter: blur(4px);
    transition: transform .18s ease, background .18s ease;
    animation: map-mini-rise .4s ease both;
    animation-delay: calc(var(--cell-delay, 0) * 28ms);
  }
  .map-mini-fallback-cell:hover { transform: translateY(-2px); background: linear-gradient(145deg, rgba(14,165,233,.28), rgba(16,185,129,.22)); }
  .map-mini-fallback-count { padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.92); color: #0f172a; font-size: 11px; font-weight: 900; box-shadow: 0 4px 10px rgba(15,23,42,.08); }
  .map-mini-badges { position: absolute; left: 14px; top: 14px; display: flex; flex-wrap: wrap; gap: 8px; max-width: calc(100% - 112px); z-index: 2; }
  .map-mini-badge { display: inline-flex; flex-direction: column; gap: 1px; min-height: 36px; padding: 8px 12px; border-radius: 16px; background: rgba(255,255,255,.9); box-shadow: 0 10px 22px rgba(15,23,42,.08); color: #0f172a; }
  .map-mini-badge strong { font-size: 12px; font-weight: 900; }
  .map-mini-badge span { font-size: 10px; color: #64748b; font-weight: 800; }
  .map-mini-empty { position: absolute; inset: 0; display: grid; place-items: center; color: #475569; font-weight: 700; font-size: 13px; }
  .map-mini-cta { position: absolute; right: 14px; bottom: 14px; padding: 8px 14px; border-radius: 999px; background: rgba(15,23,42,.86); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .02em; box-shadow: 0 8px 18px rgba(15,23,42,.2); backdrop-filter: blur(8px); z-index: 3; }
  .map-mini-cta:hover { background: #0f172a; }
  @keyframes map-mini-rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
