import type { ObservationField, FieldStats } from "../services/observationFieldRegistry.js";
import type { PlaceSnapshot } from "../services/placeSnapshot.js";
import type { AreaObservationGalleryItem, AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import { renderPlaceSnapshotTeaser } from "./placeSnapshot.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function isIkimonUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.hostname === "ikimon.life" || parsed.hostname.endsWith(".ikimon.life");
  } catch {
    return /^https?:\/\/(?:[^/]+\.)?ikimon\.life(?:[/:?#]|$)/i.test(value);
  }
}

function sourceConfidenceLabel(field: ObservationField): string {
  if (field.verificationLabel.trim()) return field.verificationLabel;
  if (field.verificationLevel === "registry_matched") return "公的台帳と一致";
  if (field.verificationLevel === "page_verified") return "公式ページで確認";
  if (field.verificationLevel === "owner_verified") return "設置者により確認済み";
  if (field.verificationLevel === "staff_verified") return "担当者確認済み";
  const score = field.sourceConfidence;
  if (score >= 0.95) return "一次情報: 強い外部根拠あり";
  if (score >= 0.75) return "一次情報: 公式ページ候補あり";
  if (score >= 0.45) return "一次情報: 外部情報確認中";
  return "一次情報: 未確認";
}

function renderSourceButtons(field: ObservationField): string {
  const items = [
    { label: "公式", url: field.ownerUrl },
    { label: "認定情報", url: field.certificationUrl },
    { label: "事例", url: field.storyUrl },
  ];
  if (!items.some((item) => item.url) && field.officialUrl) {
    items.push({ label: isIkimonUrl(field.officialUrl) ? "事例" : "公式", url: field.officialUrl });
  }
  const seen = new Set<string>();
  const links = items
    .filter((item) => {
      const url = item.url.trim();
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((item) => `<a class="evt-btn evt-btn-on-dark" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label)} ↗</a>`)
    .join("");
  return `${links}<span class="evt-btn evt-btn-on-dark" aria-label="一次情報の確認状況">${escapeHtml(sourceConfidenceLabel(field))}</span>`;
}

const SOURCE_LABEL: Record<string, string> = {
  user_defined: "マイ",
  nature_symbiosis_site: "自然共生サイト",
  tsunag: "TSUNAG",
  protected_area: "保護区",
  oecm: "OECM",
  school: "学校",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function isAreaSnapshot(snapshot: PlaceSnapshot | null | undefined): snapshot is AreaPlaceSnapshot {
  return Boolean(snapshot && Array.isArray((snapshot as Partial<AreaPlaceSnapshot>).observationGallery));
}

function renderAlbumCard(item: AreaObservationGalleryItem): string {
  const href = `/observations/${encodeURIComponent(item.occurrenceId)}`;
  const meta = [
    item.isCurrentSeason && item.seasonLabel ? `今の季節・${item.seasonLabel}` : item.seasonLabel ?? "",
    `${item.observationCount}件`,
    item.observedAt ? item.observedAt.slice(0, 10) : "",
  ].filter(Boolean).join(" / ");
  const media = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span aria-hidden="true">✦</span>`;
  return `<a class="field-album-card" href="${escapeHtml(href)}">
    ${media}
    <strong>${escapeHtml(item.displayName || "同定待ち")}</strong>
    <small>${escapeHtml(meta)}</small>
  </a>`;
}

function renderFieldAlbum(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const gallery = snapshot.observationGallery.slice(0, 12);
  const current = gallery.filter((item) => item.isCurrentSeason).slice(0, 6);
  const missing = snapshot.seasonalCoverage.filter((row) => row.observations <= 0);
  const missingText = missing.length > 0 ? missing.map((row) => row.label).join("・") : "四季の入口あり";
  const galleryHtml = gallery.length > 0
    ? gallery.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Area Album</span><h3 class="evt-heading">まだ観察カードはありません</h3><p class="evt-lead">この場所で最初の写真を残すと、地域の生きものアルバムが始まります。</p></article>`;
  const currentHtml = current.length > 0
    ? current.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Season</span><h3 class="evt-heading">今の季節の記録を足す</h3><p class="evt-lead">季節の顔が見えると、地図からこの場所を選ぶ理由が強くなります。</p></article>`;
  return `<section class="field-album">
    <header>
      <div><span class="evt-eyebrow">Area Album</span><h2 class="evt-heading">地域の生きものアルバム</h2></div>
      <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">公開図鑑ページ</a>
    </header>
    <p class="evt-lead">未記録季節: ${escapeHtml(missingText)}。公園や水辺を見に来た人が、ここで何が観察されているかを写真から眺められる入口です。</p>
    <div class="field-album-grid">${galleryHtml}</div>
    <h3 class="evt-heading" style="font-size:18px;margin:18px 0 10px;">今の季節に見えるもの</h3>
    <div class="field-album-grid field-album-grid-compact">${currentHtml}</div>
  </section>`;
}

export function renderFieldDetailBody(args: { field: ObservationField; stats: FieldStats; snapshot?: PlaceSnapshot | null }): string {
  const { field, stats, snapshot } = args;
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
      <a class="evt-btn evt-btn-on-dark" href="/places/${encodeURIComponent(field.fieldId)}/snapshot">この場所のいま</a>
      ${renderSourceButtons(field)}
      <a class="evt-btn evt-btn-on-dark" href="/community/fields">フィールド一覧へ</a>
    </div>
  </article>

  ${snapshot ? renderPlaceSnapshotTeaser(snapshot) : ""}

  ${renderFieldAlbum(snapshot)}

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

export const FIELD_DETAIL_ALBUM_STYLES = `
.field-album {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(236,253,245,.94), rgba(240,249,255,.92));
  border: 1px solid rgba(16,185,129,.18);
}
.field-album > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.field-album-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.field-album-grid-compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.field-album-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: rgba(255,255,255,.94);
  border: 1px solid rgba(15,23,42,.08);
  color: #0f172a;
  text-decoration: none;
}
.field-album-card img,
.field-album-card > span {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 11px;
  object-fit: cover;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #e0f2fe, #dcfce7);
  color: #0f766e;
  font-size: 24px;
}
.field-album-card strong {
  font-size: 13px;
  line-height: 1.35;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.field-album-card small {
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 760;
}
@media (max-width: 920px) {
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field-album > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 560px) {
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: 1fr;
  }
}
`;
