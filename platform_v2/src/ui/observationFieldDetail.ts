import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SOURCE_LABEL: Record<string, string> = {
  user_defined: "マイ",
  nature_symbiosis_site: "自然共生サイト",
  tsunag: "TSUNAG",
  protected_area: "保護区",
  oecm: "OECM",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

export function renderFieldDetailBody(args: { field: ObservationField; stats: FieldStats }): string {
  const { field, stats } = args;
  const sourceLabel = SOURCE_LABEL[field.source] ?? field.source;

  const sessionRows = stats.recentSessions.length === 0
    ? `<p class="evt-lead">まだこのフィールドでの観察会はありません。</p>`
    : stats.recentSessions.map((s) => {
        const isLive = !s.endedAt;
        const detailHref = isLive
          ? (s.eventCode ? `/community/events/${encodeURIComponent(s.eventCode)}/join` : `/events/${s.sessionId}/live`)
          : `/events/${s.sessionId}/recap`;
        return `<article class="evt-card" style="display:grid; gap:6px;">
          <header style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
            <span class="evt-badge ${isLive ? "evt-mode-discovery is-live" : "evt-mode-discovery"}">${isLive ? "LIVE" : "終了"}</span>
            <span class="evt-eyebrow">${escapeHtml(formatDate(s.startedAt))}</span>
          </header>
          <h3 class="evt-heading" style="margin:0; font-size:16px;">${escapeHtml(s.title || "観察会")}</h3>
          <div style="display:flex; gap:6px;">
            <a class="evt-btn evt-btn-ghost" href="${escapeHtml(detailHref)}" style="flex:1; min-height:36px; padding:6px 10px;">${isLive ? "参加" : "振り返り"}</a>
            <a class="evt-btn evt-btn-primary" href="/community/events/new?template_from=${encodeURIComponent(s.sessionId)}" style="flex:1; min-height:36px; padding:6px 10px;">🔁 再開催</a>
          </div>
        </article>`;
      }).join("");

  const topTaxa = stats.topTaxa.length === 0
    ? `<p class="evt-lead">観察記録はまだありません。</p>`
    : stats.topTaxa.map((t) => `<span class="evt-badge evt-mode-discovery">${escapeHtml(t.name)} ×${t.count}</span>`).join(" ");

  const polygonJson = field.polygon ? JSON.stringify(field.polygon) : "null";

  return `
<section class="evt-recap-shell" data-field-id="${escapeHtml(field.fieldId)}"
         data-lat="${escapeHtml(String(field.lat))}"
         data-lng="${escapeHtml(String(field.lng))}"
         data-radius="${escapeHtml(String(field.radiusM))}"
         data-polygon='${polygonJson.replace(/'/g, "&#39;")}'>

  <article class="evt-result-card">
    <span class="evt-result-eyebrow">${escapeHtml(sourceLabel)} • ${escapeHtml([field.prefecture, field.city].filter(Boolean).join(" / "))}</span>
    <h2>${escapeHtml(field.name)}</h2>
    ${field.summary ? `<p style="margin:0; color:rgba(236,253,245,.86);">${escapeHtml(field.summary)}</p>` : ""}
    <div class="evt-result-stats evt-stagger">
      <div><strong>${stats.totalSessions}</strong><span>開催回数</span></div>
      <div><strong>${stats.uniqueSpeciesCount}</strong><span>累計種数</span></div>
      <div><strong>${stats.totalObservations}</strong><span>累計観察</span></div>
    </div>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:18px;">
      <a class="evt-btn evt-btn-primary" href="/community/events/new?field_id=${encodeURIComponent(field.fieldId)}">✨ ここで観察会を作る</a>
      ${field.officialUrl ? `<a class="evt-btn evt-btn-on-dark" href="${escapeHtml(field.officialUrl)}" target="_blank" rel="noopener">📜 公式情報</a>` : ""}
      <a class="evt-btn evt-btn-on-dark" href="/community/fields">フィールド一覧へ</a>
    </div>
  </article>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <h2 class="evt-heading" style="margin:0;">エリア</h2>
      <span class="evt-eyebrow">${field.areaHa ? `${field.areaHa.toFixed(2)} ha` : `半径 ${field.radiusM} m`}</span>
    </header>
    <div class="evt-live-map" style="position:relative; height:300px;">
      <div class="evt-live-map-canvas" data-evt-field-map></div>
    </div>
  </section>

  <section>
    <h2 class="evt-heading">よく見つかる種</h2>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${topTaxa}</div>
  </section>

  <section>
    <header style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
      <h2 class="evt-heading" style="margin:0;">過去・進行中の観察会</h2>
      <span class="evt-eyebrow">${stats.totalSessions}</span>
    </header>
    <div class="evt-stagger" style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
      ${sessionRows}
    </div>
  </section>
</section>
`;
}

export function fieldDetailScript(): string {
  return String.raw`
(() => {
  const root = document.querySelector("[data-field-id]");
  if (!root) return;
  const lat = Number(root.dataset.lat || 35.0);
  const lng = Number(root.dataset.lng || 138.0);
  const radius = Number(root.dataset.radius || 1000);
  let polygon = null;
  try { polygon = JSON.parse(root.dataset.polygon || "null"); } catch(_){}
  const mapEl = root.querySelector("[data-evt-field-map]");

  function ensureMaplibre(){
    return new Promise((resolve) => {
      if (window.maplibregl) return resolve(window.maplibregl);
      if (!document.querySelector("link[data-evt-maplibre-css]")){
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
        css.dataset.evtMaplibreCss = "1";
        document.head.appendChild(css);
      }
      const existing = document.querySelector("script[data-evt-maplibre-js]");
      if (existing){
        const i = setInterval(() => { if (window.maplibregl){ clearInterval(i); resolve(window.maplibregl); } }, 60);
        return;
      }
      const s = document.createElement("script");
      s.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      s.async = true;
      s.dataset.evtMaplibreJs = "1";
      s.onload = () => resolve(window.maplibregl);
      document.head.appendChild(s);
    });
  }

  function buildCircle(lat, lng, radiusM, steps = 64){
    const coords = [];
    const earthR = 6378137;
    for (let i = 0; i <= steps; i++){
      const angle = (i / steps) * 2 * Math.PI;
      const dx = radiusM * Math.cos(angle);
      const dy = radiusM * Math.sin(angle);
      const dLat = (dy / earthR) * (180 / Math.PI);
      const dLng = (dx / (earthR * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
      coords.push([lng + dLng, lat + dLat]);
    }
    return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
  }

  (async () => {
    if (!mapEl) return;
    const ml = await ensureMaplibre();
    if (!ml) return;
    const map = new ml.Map({
      container: mapEl,
      style: {
        version: 8,
        sources: {
          gsi: { type: "raster", tiles: ["https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"], tileSize: 256, attribution: "&copy; 国土地理院" }
        },
        layers: [{ id: "gsi", type: "raster", source: "gsi" }]
      },
      center: [lng, lat],
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.on("load", () => {
      const polyFeature = (polygon && polygon.type === "Polygon" || polygon && polygon.type === "MultiPolygon")
        ? { type: "Feature", geometry: polygon, properties: {} }
        : buildCircle(lat, lng, radius);
      map.addSource("evt-field", { type: "geojson", data: polyFeature });
      map.addLayer({
        id: "evt-field-fill",
        type: "fill",
        source: "evt-field",
        paint: { "fill-color": "#10b981", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "evt-field-line",
        type: "line",
        source: "evt-field",
        paint: { "line-color": "#0ea5e9", "line-width": 3 },
      });
    });
  })();
})();
`;
}
