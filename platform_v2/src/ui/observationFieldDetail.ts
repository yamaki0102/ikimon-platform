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

function sourceLinkItems(field: ObservationField): Array<{ label: string; url: string }> {
  const items = [
    { label: "公式", url: field.ownerUrl },
    { label: "認定情報", url: field.certificationUrl },
    { label: "事例", url: field.storyUrl },
  ];
  if (!items.some((item) => item.url) && field.officialUrl) {
    items.push({ label: isIkimonUrl(field.officialUrl) ? "事例" : "公式", url: field.officialUrl });
  }
  const seen = new Set<string>();
  return items
    .map((item) => ({ label: item.label, url: item.url.trim() }))
    .filter((item) => {
      const url = item.url.trim();
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function renderSourceButtons(field: ObservationField): string {
  return sourceLinkItems(field)
    .map((item) => `<a class="evt-btn evt-btn-on-dark" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.label)} ↗</a>`)
    .join("");
}

function renderFieldTrustInfo(field: ObservationField): string {
  const buttons = renderSourceButtons(field);
  return `<section class="field-trust-info" aria-label="信頼情報">
    <header>
      <div>
        <span class="evt-eyebrow">Source</span>
        <h2 class="evt-heading">信頼情報</h2>
      </div>
      <span class="field-trust-status">${escapeHtml(sourceConfidenceLabel(field))}</span>
    </header>
    ${buttons ? `<div class="field-trust-links">${buttons}</div>` : ""}
  </section>`;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.max(0, Number.isFinite(value) ? value : 0));
}

function formatObservationDate(iso: string | null | undefined): string {
  if (!iso) return "まだ記録なし";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "まだ記録なし";
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

function isAreaSnapshot(snapshot: PlaceSnapshot | null | undefined): snapshot is AreaPlaceSnapshot {
  return Boolean(snapshot && Array.isArray((snapshot as Partial<AreaPlaceSnapshot>).observationGallery));
}

function fieldHeroMetrics(stats: FieldStats, snapshot: PlaceSnapshot | null | undefined): Array<{ value: number; label: string }> {
  const summary = snapshot?.observationSummary;
  const hasPlaceObservations = Boolean(
    summary && (summary.totalObservations > 0 || summary.uniqueTaxa > 0 || summary.totalVisits > 0),
  );
  if (hasPlaceObservations && summary) {
    return [
      { value: summary.totalVisits, label: "記録回数" },
      { value: summary.uniqueTaxa, label: "累計種数" },
      { value: summary.totalObservations, label: "累計記録" },
    ];
  }
  return [
    { value: stats.totalSessions, label: "開催回数" },
    { value: stats.uniqueSpeciesCount, label: "累計種数" },
    { value: stats.totalObservations, label: "累計記録" },
  ];
}

function fieldSeasonLabel(snapshot: PlaceSnapshot | null | undefined): string {
  const labels = snapshot?.observationSummary.seasonLabels?.filter(Boolean) ?? [];
  return labels.length > 0 ? labels.join("・") : "季節の記録を募集中";
}

function renderFieldHeroSignals(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const names = snapshot.observationGallery
    .filter((item) => item.isCurrentSeason)
    .map((item) => item.displayName || "見つけたもの")
    .filter(Boolean);
  const uniqueNames = Array.from(new Set(names)).slice(0, 6);
  if (uniqueNames.length === 0) return "";
  return `<div class="field-map-signals" aria-label="今の季節に見えるもの">
    <span>今見えるもの</span>
    ${uniqueNames.map((name) => `<b>${escapeHtml(name)}</b>`).join("")}
  </div>`;
}

function renderAlbumCard(item: AreaObservationGalleryItem): string {
  const isPrivate = item.visibility === "viewer_private";
  const href = `/observations/${encodeURIComponent(item.occurrenceId)}`;
  const meta = [
    item.isCurrentSeason && item.seasonLabel ? `今の季節・${item.seasonLabel}` : item.seasonLabel ?? "",
    isPrivate ? "" : `${item.observationCount}件`,
    item.observedAt ? item.observedAt.slice(0, 10) : "",
  ].filter(Boolean).join(" / ");
  const media = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span aria-hidden="true">✦</span>`;
  const privacy = isPrivate
    ? `<em class="field-album-private"><small>${escapeHtml(item.privacyReason ?? "公開アルバムには出ていません")}</small></em>`
    : "";
  return `<a class="field-album-card${isPrivate ? " is-private" : ""}" href="${escapeHtml(href)}">
    ${media}
    ${privacy}
    <strong>${escapeHtml(item.displayName || "見つけたもの")}</strong>
    <small>${escapeHtml(meta)}</small>
  </a>`;
}

function renderFieldViewerMemory(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot) || !snapshot.viewerContribution?.hasViewerRecords) return "";
  const cards = snapshot.viewerContribution.recordCards.slice(0, 4).map(renderAlbumCard).join("");
  return `<section class="field-memory">
    <header>
      <div><span class="evt-eyebrow">My Memory</span><h2 class="evt-heading">あなたがこの場所で見つけたもの</h2></div>
      <span class="evt-badge evt-mode-discovery">${snapshot.viewerContribution.recordCount}件</span>
    </header>
    <p class="evt-lead">${escapeHtml(snapshot.viewerContribution.positiveFeedbackLine)}</p>
    <div class="field-album-grid field-album-grid-compact">${cards}</div>
  </section>`;
}

function renderFieldAlbum(snapshot: PlaceSnapshot | null | undefined): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const gallery = snapshot.observationGallery.slice(0, 12);
  const current = gallery.filter((item) => item.isCurrentSeason).slice(0, 6);
  const missing = snapshot.seasonalCoverage.filter((row) => row.observations <= 0);
  const missingText = missing.length > 0 ? missing.map((row) => row.label).join("・") : "四季の入口あり";
  const galleryHtml = gallery.length > 0
    ? gallery.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Area Album</span><h3 class="evt-heading">まだ記録カードはありません</h3><p class="evt-lead">この場所で最初の写真を残すと、地域の生きものアルバムが始まります。</p></article>`;
  const currentHtml = current.length > 0
    ? current.map(renderAlbumCard).join("")
    : `<article class="evt-card"><span class="evt-eyebrow">Season</span><h3 class="evt-heading">今の季節の記録を足す</h3><p class="evt-lead">季節の顔が見えると、地図からこの場所を選ぶ理由が強くなります。</p></article>`;
  return `<section class="field-album" id="field-album">
    <header>
      <div><span class="evt-eyebrow">Area Album</span><h2 class="evt-heading">地域の生きものアルバム</h2></div>
      <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">公開図鑑ページ</a>
    </header>
    <p class="evt-lead">未記録季節: ${escapeHtml(missingText)}。公園や水辺を見に来た人が、ここにどんな記録があるかを写真から眺められる入口です。</p>
    <div class="field-album-grid">${galleryHtml}</div>
    <h3 class="evt-heading" style="font-size:18px;margin:18px 0 10px;">今の季節に見えるもの</h3>
    <div class="field-album-grid field-album-grid-compact">${currentHtml}</div>
  </section>`;
}

export function renderFieldDetailBody(args: { field: ObservationField; stats: FieldStats; snapshot?: PlaceSnapshot | null }): string {
  const { field, stats, snapshot } = args;
  const sourceLabel = SOURCE_LABEL[field.source] ?? field.source;
  const heroMetrics = fieldHeroMetrics(stats, snapshot);
  const latestObservedAt = snapshot?.observationSummary.latestObservedAt ?? null;

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
    ? `<p class="evt-lead">記録はまだありません。</p>`
    : stats.topTaxa.map((t) => `<span class="evt-badge evt-mode-discovery">${escapeHtml(t.name)} ×${t.count}</span>`).join(" ");

  const polygonJson = field.polygon ? JSON.stringify(field.polygon) : "null";
  const locationLabel = [field.prefecture, field.city].filter(Boolean).join(" / ");
  const areaLabel = field.areaHa ? `${field.areaHa.toFixed(2)} ha` : `半径 ${field.radiusM} m`;

  return `
<section class="evt-recap-shell field-detail-shell" data-field-id="${escapeHtml(field.fieldId)}"
         data-lat="${escapeHtml(String(field.lat))}"
         data-lng="${escapeHtml(String(field.lng))}"
         data-radius="${escapeHtml(String(field.radiusM))}"
         data-polygon='${polygonJson.replace(/'/g, "&#39;")}'>

  <article class="field-map-hero">
    <div class="field-map-hero-map">
      <div class="evt-live-map-canvas" data-evt-field-map></div>
    </div>
    <div class="field-map-hero-copy">
      <span class="evt-result-eyebrow">${escapeHtml(sourceLabel)}${locationLabel ? ` • ${escapeHtml(locationLabel)}` : ""}</span>
      <h2>${escapeHtml(field.name)}</h2>
      ${field.summary ? `<p>${escapeHtml(field.summary)}</p>` : ""}
      <div class="field-map-hero-tags">
        <span>${escapeHtml(fieldSeasonLabel(snapshot))}</span>
      </div>
      ${renderFieldHeroSignals(snapshot)}
      <div class="field-detail-actions">
        <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(field.fieldId)}/snapshot">この場所のいま</a>
        <a class="evt-btn evt-btn-on-dark" href="#field-album">地域のアルバム</a>
      </div>
    </div>
  </article>

  ${renderFieldViewerMemory(snapshot)}

  ${renderFieldAlbum(snapshot)}

  ${snapshot ? renderPlaceSnapshotTeaser(snapshot) : ""}

  <section class="field-detail-metrics" aria-label="記録の厚み">
    <header>
      <div>
        <span class="evt-eyebrow">Field Record</span>
        <h2 class="evt-heading">記録の厚み</h2>
      </div>
      <div class="field-detail-metrics-actions">
        <a class="evt-btn evt-btn-primary" href="/community/events/new?field_id=${encodeURIComponent(field.fieldId)}">ここで観察会を作る</a>
        <a class="evt-btn evt-btn-ghost" href="/community/fields">フィールド一覧へ</a>
      </div>
    </header>
    <p class="evt-lead">エリア: ${escapeHtml(areaLabel)}</p>
    <div class="evt-result-stats evt-stagger">
      ${heroMetrics.map((item) => `<div><strong>${formatNumber(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`).join("")}
    </div>
    <div class="field-detail-freshness"><span>最終記録</span><strong>${escapeHtml(formatObservationDate(latestObservedAt))}</strong></div>
  </section>

  ${renderFieldTrustInfo(field)}

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
      const pin = document.createElement("div");
      pin.className = "field-map-pin";
      new ml.Marker({ element: pin, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
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
      const bounds = new ml.LngLatBounds();
      const collect = (coords) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
          bounds.extend(coords);
          return;
        }
        coords.forEach(collect);
      };
      collect(polyFeature.geometry.coordinates);
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration: 0 });
    });
  })();
})();
`;
}

export const FIELD_DETAIL_ALBUM_STYLES = `
.field-detail-shell {
  max-width: 1240px;
}
.field-detail-shell .evt-result-stats {
  max-width: 900px;
}
.field-map-hero {
  min-height: clamp(480px, 58vw, 660px);
  overflow: hidden;
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: end;
  border-radius: 24px;
  border: 1px solid rgba(15,23,42,.08);
  background: #dbeafe;
  box-shadow: 0 24px 70px rgba(15,23,42,.14);
}
.field-map-hero-map {
  position: absolute;
  inset: 0;
}
.field-map-hero-map::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(15,23,42,.04) 0%, rgba(15,23,42,.10) 42%, rgba(15,23,42,.72) 100%);
}
.field-map-hero-map .evt-live-map-canvas {
  width: 100%;
  height: 100%;
}
.field-map-pin {
  width: 34px;
  height: 34px;
  border-radius: 999px 999px 999px 4px;
  transform: rotate(-45deg);
  background: #f97316;
  border: 3px solid #ffffff;
  box-shadow: 0 12px 28px rgba(15,23,42,.30);
}
.field-map-pin::after {
  content: "";
  position: absolute;
  inset: 8px;
  border-radius: 999px;
  background: #ffffff;
}
.field-map-hero-copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 14px;
  width: min(720px, calc(100% - 32px));
  margin: 16px;
  padding: clamp(20px, 3vw, 34px);
  border-radius: 20px;
  background: rgba(6,78,59,.88);
  color: #ffffff;
  box-shadow: 0 18px 46px rgba(15,23,42,.28);
  backdrop-filter: blur(12px);
}
.field-map-hero-copy h2 {
  max-width: 24ch;
  margin: 0;
  font-size: clamp(27px, 4vw, 48px);
  line-height: 1.1;
  font-weight: 900;
  letter-spacing: 0;
}
.field-map-hero-copy p {
  max-width: 64ch;
  margin: 0;
  color: rgba(236,253,245,.90);
}
.field-map-hero-tags,
.field-map-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-map-hero-tags span,
.field-map-signals b,
.field-map-signals > span {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.12);
  color: #ecfdf5;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
}
.field-map-signals > span {
  background: rgba(255,255,255,.20);
}
.field-map-signals b {
  overflow-wrap: anywhere;
}
.field-detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.field-map-hero-copy .field-detail-actions {
  margin-top: 2px;
}
.field-detail-freshness {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.18);
  color: #d1fae5;
}
.field-detail-freshness span {
  font-size: 11px;
  font-weight: 850;
  letter-spacing: .08em;
}
.field-detail-freshness strong {
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
}
.field-detail-metrics {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(15,23,42,.08);
}
.field-detail-metrics > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-detail-metrics-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.field-detail-metrics .evt-heading {
  margin: 0;
}
.field-detail-metrics .field-detail-freshness {
  background: rgba(16,185,129,.10);
  border-color: rgba(16,185,129,.18);
  color: #047857;
}
.field-detail-metrics .field-detail-freshness strong {
  color: #064e3b;
}
.field-trust-info {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: rgba(248,250,252,.94);
  border: 1px solid rgba(15,23,42,.08);
}
.field-trust-info > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.field-trust-info .evt-heading {
  margin: 0;
}
.field-trust-status {
  width: fit-content;
  max-width: 100%;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.18);
  color: #047857;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.2;
}
.field-trust-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.field-trust-links .evt-btn-on-dark {
  background: #0f766e;
  color: #ffffff;
  border-color: rgba(15,118,110,.28);
}
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
.field-album-card.is-private {
  border-color: rgba(14,165,233,.26);
  background: linear-gradient(180deg, #fff, rgba(240,249,255,.92));
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
.field-album-private {
  display: grid;
  gap: 3px;
  font-style: normal;
  color: #075985;
  font-size: 11px;
  font-weight: 900;
}
.field-album-private::before {
  content: "自分だけ";
  width: fit-content;
  border-radius: 999px;
  background: rgba(14,165,233,.12);
  border: 1px solid rgba(14,165,233,.22);
  padding: 3px 8px;
}
.field-album-private small {
  color: #64748b;
}
.field-memory {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,251,235,.78), rgba(240,249,255,.90));
  border: 1px solid rgba(245,158,11,.20);
}
.field-memory > header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
@media (max-width: 920px) {
  .field-detail-shell {
    max-width: 1080px;
  }
  .field-map-hero {
    min-height: 620px;
  }
  .field-map-hero-copy {
    width: calc(100% - 24px);
    margin: 12px;
  }
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field-album > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-memory > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-detail-metrics > header {
    align-items: flex-start;
    flex-direction: column;
  }
  .field-detail-metrics-actions {
    justify-content: flex-start;
  }
  .field-trust-info > header {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 560px) {
  .field-map-hero {
    min-height: 680px;
    border-radius: 18px;
  }
  .field-map-hero-copy {
    padding: 18px;
    border-radius: 16px;
  }
  .field-map-hero-copy h2 {
    font-size: 28px;
  }
  .field-album-grid,
  .field-album-grid-compact {
    grid-template-columns: 1fr;
  }
}
`;
