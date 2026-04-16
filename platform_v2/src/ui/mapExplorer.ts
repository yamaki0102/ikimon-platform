import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { overlaysForLang, type LocalizedOverlay } from "../services/layerCatalog.js";
import { escapeHtml } from "./siteShell.js";

/**
 * mapExplorer — the /map page's interactive core.
 *
 * Server emits a shell (hero, filter bar, canvas, side panel, empty bottom sheet)
 * and a boot script that hydrates the MapLibre map client-side. Data comes from
 * /api/v1/map/observations and /api/v1/map/coverage, which the client refetches
 * whenever a filter / tab / basemap changes. No Alpine — plain vanilla JS to
 * keep the v2 SSR bundle lean.
 */

export type TaxonGroupChip = {
  value: string;
  label: string;
  icon: string;
};

export type MapExplorerCopy = {
  tabMarkers: string;
  tabHeatmap: string;
  tabCoverage: string;
  tabAriaLabel: string;
  taxonFilterLabel: string;
  yearFilterLabel: string;
  yearAll: string;
  seasonFilterLabel: string;
  seasonAll: string;
  seasonSpring: string;
  seasonSummer: string;
  seasonAutumn: string;
  seasonWinter: string;
  regionFilterLabel: string;
  regionPresets: Array<{ key: string; label: string; bounds: [number, number, number, number] }>;
  basemapLabel: string;
  basemapStandard: string;
  basemapSatelliteGsi: string;
  basemapSatelliteEsri: string;
  legendLabel: string;
  coverageLegendLow: string;
  coverageLegendHigh: string;
  heatmapLegendLow: string;
  heatmapLegendHigh: string;
  loading: string;
  statsLabel: (returned: number, total: number) => string;
  empty: string;
  sideRecentLabel: string;
  sideRevisitLabel: string;
  crossEyebrow: string;
  crossLensLabel: string;
  crossScanLabel: string;
  crossNotesLabel: string;
  popupOpenLabel: string;
  bottomSheetRecord: string;
  bottomSheetNotes: string;
  bottomSheetLens: string;
  bottomSheetScan: string;
  taxonChips: TaxonGroupChip[];
};

// Bounding boxes for 1-tap region jumps. Kept identical across locales
// (they're geographic bboxes, not translations).
const REGION_BBOXES: Array<{ key: string; bounds: [number, number, number, number] }> = [
  { key: "japan",      bounds: [122.9, 24.0, 146.0, 45.6] },
  { key: "shizuoka",   bounds: [138.21, 34.90, 138.55, 35.17] },
  { key: "shizuoka_pref", bounds: [137.47, 34.57, 139.16, 35.65] },
  { key: "tokyo",      bounds: [139.58, 35.55, 139.92, 35.82] },
  { key: "nagoya",     bounds: [136.80, 35.00, 137.05, 35.24] },
  { key: "osaka",      bounds: [135.35, 34.55, 135.65, 34.78] },
  { key: "kyoto",      bounds: [135.65, 34.92, 135.90, 35.10] },
  { key: "fukuoka",    bounds: [130.30, 33.48, 130.55, 33.68] },
  { key: "sapporo",    bounds: [141.25, 42.94, 141.50, 43.15] },
];

function regionPresets(labels: Record<string, string>): Array<{ key: string; label: string; bounds: [number, number, number, number] }> {
  return REGION_BBOXES.map((r) => ({ ...r, label: labels[r.key] ?? r.key }));
}

export const MAP_EXPLORER_COPY: Record<SiteLang, MapExplorerCopy> = {
  ja: {
    tabMarkers: "観察ピン",
    tabHeatmap: "密度ヒート",
    tabCoverage: "足跡メッシュ",
    tabAriaLabel: "マップの表示切替",
    taxonFilterLabel: "分類",
    yearFilterLabel: "年",
    yearAll: "すべての年",
    seasonFilterLabel: "季節",
    seasonAll: "通年",
    seasonSpring: "春",
    seasonSummer: "夏",
    seasonAutumn: "秋",
    seasonWinter: "冬",
    regionFilterLabel: "地域",
    regionPresets: regionPresets({
      japan: "日本全体",
      shizuoka: "静岡市",
      shizuoka_pref: "静岡県",
      tokyo: "東京",
      nagoya: "名古屋",
      osaka: "大阪",
      kyoto: "京都",
      fukuoka: "福岡",
      sapporo: "札幌",
    }),
    basemapLabel: "ベース",
    basemapStandard: "標準",
    basemapSatelliteGsi: "空撮（地理院）",
    basemapSatelliteEsri: "衛星（Esri）",
    legendLabel: "凡例",
    coverageLegendLow: "まばら",
    coverageLegendHigh: "積み上がる",
    heatmapLegendLow: "薄い",
    heatmapLegendHigh: "濃い",
    loading: "読み込み中…",
    statsLabel: (returned, total) => `${returned.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 件`,
    empty: "この条件に合う観察はまだない。フィルタをゆるめるか、別の年を試す。",
    sideRecentLabel: "最近の観察",
    sideRevisitLabel: "積み上がっている場所",
    crossEyebrow: "この場所で、次の 1 枚を書く",
    crossLensLabel: "AIレンズで見る",
    crossScanLabel: "フィールドスキャンで見る",
    crossNotesLabel: "ノートに戻る",
    popupOpenLabel: "詳細を開く →",
    bottomSheetRecord: "ここで記録する",
    bottomSheetNotes: "ノート詳細",
    bottomSheetLens: "AIレンズ",
    bottomSheetScan: "スキャン",
    taxonChips: [
      { value: "", label: "すべて", icon: "✨" },
      { value: "insect", label: "昆虫", icon: "🦋" },
      { value: "bird", label: "鳥類", icon: "🐦" },
      { value: "plant", label: "植物", icon: "🌿" },
      { value: "amphibian_reptile", label: "両爬", icon: "🐸" },
      { value: "mammal", label: "哺乳類", icon: "🐾" },
      { value: "fungi", label: "菌類", icon: "🍄" },
      { value: "other", label: "その他", icon: "🔍" },
    ],
  },
  en: {
    tabMarkers: "Pins",
    tabHeatmap: "Heatmap",
    tabCoverage: "Coverage",
    tabAriaLabel: "Switch map view",
    taxonFilterLabel: "Group",
    yearFilterLabel: "Year",
    yearAll: "All years",
    seasonFilterLabel: "Season",
    seasonAll: "Year-round",
    seasonSpring: "Spring",
    seasonSummer: "Summer",
    seasonAutumn: "Autumn",
    seasonWinter: "Winter",
    regionFilterLabel: "Region",
    regionPresets: regionPresets({
      japan: "Japan",
      shizuoka: "Shizuoka City",
      shizuoka_pref: "Shizuoka Pref.",
      tokyo: "Tokyo",
      nagoya: "Nagoya",
      osaka: "Osaka",
      kyoto: "Kyoto",
      fukuoka: "Fukuoka",
      sapporo: "Sapporo",
    }),
    basemapLabel: "Base",
    basemapStandard: "Standard",
    basemapSatelliteGsi: "Aerial (GSI)",
    basemapSatelliteEsri: "Satellite (Esri)",
    legendLabel: "Legend",
    coverageLegendLow: "Few",
    coverageLegendHigh: "Many",
    heatmapLegendLow: "Low",
    heatmapLegendHigh: "High",
    loading: "Loading…",
    statsLabel: (returned, total) => `${returned.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`,
    empty: "No observations match. Loosen the filter or try another year.",
    sideRecentLabel: "Recent observations",
    sideRevisitLabel: "Where records stack up",
    crossEyebrow: "Write the next page from here",
    crossLensLabel: "Open AI Lens",
    crossScanLabel: "Open Field Scan",
    crossNotesLabel: "Back to notebook",
    popupOpenLabel: "Open detail →",
    bottomSheetRecord: "Record here",
    bottomSheetNotes: "Notebook detail",
    bottomSheetLens: "AI Lens",
    bottomSheetScan: "Scan",
    taxonChips: [
      { value: "", label: "All", icon: "✨" },
      { value: "insect", label: "Insects", icon: "🦋" },
      { value: "bird", label: "Birds", icon: "🐦" },
      { value: "plant", label: "Plants", icon: "🌿" },
      { value: "amphibian_reptile", label: "Amph/Reptile", icon: "🐸" },
      { value: "mammal", label: "Mammals", icon: "🐾" },
      { value: "fungi", label: "Fungi", icon: "🍄" },
      { value: "other", label: "Other", icon: "🔍" },
    ],
  },
  es: {
    tabMarkers: "Pines",
    tabHeatmap: "Mapa de calor",
    tabCoverage: "Cobertura",
    tabAriaLabel: "Cambiar vista del mapa",
    taxonFilterLabel: "Grupo",
    yearFilterLabel: "Año",
    yearAll: "Todos los años",
    seasonFilterLabel: "Estación",
    seasonAll: "Todo el año",
    seasonSpring: "Primavera",
    seasonSummer: "Verano",
    seasonAutumn: "Otoño",
    seasonWinter: "Invierno",
    regionFilterLabel: "Región",
    regionPresets: regionPresets({
      japan: "Japón",
      shizuoka: "Ciudad de Shizuoka",
      shizuoka_pref: "Pref. Shizuoka",
      tokyo: "Tokio",
      nagoya: "Nagoya",
      osaka: "Osaka",
      kyoto: "Kioto",
      fukuoka: "Fukuoka",
      sapporo: "Sapporo",
    }),
    basemapLabel: "Base",
    basemapStandard: "Estándar",
    basemapSatelliteGsi: "Aérea (GSI)",
    basemapSatelliteEsri: "Satélite (Esri)",
    legendLabel: "Leyenda",
    coverageLegendLow: "Pocos",
    coverageLegendHigh: "Muchos",
    heatmapLegendLow: "Baja",
    heatmapLegendHigh: "Alta",
    loading: "Cargando…",
    statsLabel: (returned, total) => `${returned.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")}`,
    empty: "No hay observaciones. Afloja el filtro o prueba otro año.",
    sideRecentLabel: "Observaciones recientes",
    sideRevisitLabel: "Lugares donde se acumulan",
    crossEyebrow: "Escribe la próxima página desde aquí",
    crossLensLabel: "Abrir Lente IA",
    crossScanLabel: "Abrir Escaneo",
    crossNotesLabel: "Volver al cuaderno",
    popupOpenLabel: "Ver detalle →",
    bottomSheetRecord: "Registrar aquí",
    bottomSheetNotes: "Detalle del cuaderno",
    bottomSheetLens: "Lente IA",
    bottomSheetScan: "Escaneo",
    taxonChips: [
      { value: "", label: "Todo", icon: "✨" },
      { value: "insect", label: "Insectos", icon: "🦋" },
      { value: "bird", label: "Aves", icon: "🐦" },
      { value: "plant", label: "Plantas", icon: "🌿" },
      { value: "amphibian_reptile", label: "Anf/Reptil", icon: "🐸" },
      { value: "mammal", label: "Mamíferos", icon: "🐾" },
      { value: "fungi", label: "Hongos", icon: "🍄" },
      { value: "other", label: "Otros", icon: "🔍" },
    ],
  },
  "pt-BR": {
    tabMarkers: "Pinos",
    tabHeatmap: "Mapa de calor",
    tabCoverage: "Cobertura",
    tabAriaLabel: "Alternar visão do mapa",
    taxonFilterLabel: "Grupo",
    yearFilterLabel: "Ano",
    yearAll: "Todos os anos",
    seasonFilterLabel: "Estação",
    seasonAll: "O ano todo",
    seasonSpring: "Primavera",
    seasonSummer: "Verão",
    seasonAutumn: "Outono",
    seasonWinter: "Inverno",
    regionFilterLabel: "Região",
    regionPresets: regionPresets({
      japan: "Japão",
      shizuoka: "Cidade de Shizuoka",
      shizuoka_pref: "Pref. Shizuoka",
      tokyo: "Tóquio",
      nagoya: "Nagoya",
      osaka: "Osaka",
      kyoto: "Kyoto",
      fukuoka: "Fukuoka",
      sapporo: "Sapporo",
    }),
    basemapLabel: "Base",
    basemapStandard: "Padrão",
    basemapSatelliteGsi: "Aérea (GSI)",
    basemapSatelliteEsri: "Satélite (Esri)",
    legendLabel: "Legenda",
    coverageLegendLow: "Poucos",
    coverageLegendHigh: "Muitos",
    heatmapLegendLow: "Baixa",
    heatmapLegendHigh: "Alta",
    loading: "Carregando…",
    statsLabel: (returned, total) => `${returned.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`,
    empty: "Sem observações. Afrouxe o filtro ou tente outro ano.",
    sideRecentLabel: "Observações recentes",
    sideRevisitLabel: "Lugares que se acumulam",
    crossEyebrow: "Escreva a próxima página daqui",
    crossLensLabel: "Abrir Lente IA",
    crossScanLabel: "Abrir Escaneamento",
    crossNotesLabel: "Voltar ao caderno",
    popupOpenLabel: "Ver detalhe →",
    bottomSheetRecord: "Registrar aqui",
    bottomSheetNotes: "Detalhe do caderno",
    bottomSheetLens: "Lente IA",
    bottomSheetScan: "Escaneamento",
    taxonChips: [
      { value: "", label: "Tudo", icon: "✨" },
      { value: "insect", label: "Insetos", icon: "🦋" },
      { value: "bird", label: "Aves", icon: "🐦" },
      { value: "plant", label: "Plantas", icon: "🌿" },
      { value: "amphibian_reptile", label: "Anf/Réptil", icon: "🐸" },
      { value: "mammal", label: "Mamíferos", icon: "🐾" },
      { value: "fungi", label: "Fungos", icon: "🍄" },
      { value: "other", label: "Outros", icon: "🔍" },
    ],
  },
};

export type MapExplorerProps = {
  basePath: string;
  lang: SiteLang;
  /** Build a year list starting from min to current year. */
  years: number[];
};

function overlayPanelLabels(lang: SiteLang): {
  heading: string;
  intro: string;
  opacityLabel: string;
} {
  if (lang === "en") return { heading: "Layers", intro: "Toggle to stack on top of the basemap.", opacityLabel: "Opacity" };
  if (lang === "es") return { heading: "Capas", intro: "Actívalas para apilar sobre el mapa base.", opacityLabel: "Opacidad" };
  if (lang === "pt-BR") return { heading: "Camadas", intro: "Ative para empilhar sobre o mapa base.", opacityLabel: "Opacidade" };
  return { heading: "レイヤー", intro: "ベース地図の上に重ねて、行政 GIS × 市民観察 の視点を組み合わせる。", opacityLabel: "濃度" };
}

export function renderMapExplorer(props: MapExplorerProps): string {
  const copy = MAP_EXPLORER_COPY[props.lang];
  const overlays: LocalizedOverlay[] = overlaysForLang(props.lang);
  const overlayLabels = overlayPanelLabels(props.lang);
  const recordHref = appendLangToHref(withBasePath(props.basePath, "/record"), props.lang);
  const notesHref = appendLangToHref(withBasePath(props.basePath, "/notes"), props.lang);
  const lensHref = appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang);
  const scanHref = appendLangToHref(withBasePath(props.basePath, "/scan"), props.lang);
  const apiObservations = withBasePath(props.basePath, "/api/v1/map/observations");
  const apiCoverage = withBasePath(props.basePath, "/api/v1/map/coverage");

  const taxonChipsHtml = copy.taxonChips
    .map(
      (chip, idx) => `<button
        type="button"
        class="me-chip me-taxon-chip${idx === 0 ? " is-active" : ""}"
        data-taxon-group="${escapeHtml(chip.value)}"
        aria-pressed="${idx === 0 ? "true" : "false"}">
        <span class="me-chip-icon" aria-hidden="true">${escapeHtml(chip.icon)}</span>
        <span>${escapeHtml(chip.label)}</span>
      </button>`,
    )
    .join("");

  const seasonOptions = [
    { value: "", label: copy.seasonAll, icon: "✨" },
    { value: "spring", label: copy.seasonSpring, icon: "🌸" },
    { value: "summer", label: copy.seasonSummer, icon: "☀️" },
    { value: "autumn", label: copy.seasonAutumn, icon: "🍁" },
    { value: "winter", label: copy.seasonWinter, icon: "❄️" },
  ];
  const seasonChipsHtml = seasonOptions
    .map(
      (s, idx) => `<button
        type="button"
        class="me-chip me-season-chip${idx === 0 ? " is-active" : ""}"
        data-season="${escapeHtml(s.value)}"
        aria-pressed="${idx === 0 ? "true" : "false"}">
        <span class="me-chip-icon" aria-hidden="true">${escapeHtml(s.icon)}</span>
        <span>${escapeHtml(s.label)}</span>
      </button>`,
    )
    .join("");

  const regionChipsHtml = copy.regionPresets
    .map((r) => `<button
      type="button"
      class="me-chip me-region-chip"
      data-bounds="${escapeHtml(r.bounds.join(","))}">${escapeHtml(r.label)}</button>`)
    .join("");

  const yearOptionsHtml = [`<option value="">${escapeHtml(copy.yearAll)}</option>`]
    .concat(props.years.map((y) => `<option value="${y}">${y}</option>`))
    .join("");

  const basemapOptions: Array<{ value: "standard" | "gsi" | "esri"; label: string }> = [
    { value: "standard", label: copy.basemapStandard },
    { value: "gsi", label: copy.basemapSatelliteGsi },
    { value: "esri", label: copy.basemapSatelliteEsri },
  ];
  const basemapRadiosHtml = basemapOptions
    .map(
      (opt, idx) => `<label class="me-basemap-opt${idx === 0 ? " is-active" : ""}">
        <input type="radio" name="me-basemap" value="${opt.value}"${idx === 0 ? " checked" : ""} />
        <span>${escapeHtml(opt.label)}</span>
      </label>`,
    )
    .join("");

  const crossChipsHtml = `<div class="me-cross-chips" aria-label="${escapeHtml(copy.crossEyebrow)}">
    <span class="me-cross-eyebrow">${escapeHtml(copy.crossEyebrow)}</span>
    <a class="me-cross-chip" href="${escapeHtml(lensHref)}" data-kpi-action="map:cross-lens">
      <span aria-hidden="true">🔍</span> ${escapeHtml(copy.crossLensLabel)}
    </a>
    <a class="me-cross-chip" href="${escapeHtml(scanHref)}" data-kpi-action="map:cross-scan">
      <span aria-hidden="true">📡</span> ${escapeHtml(copy.crossScanLabel)}
    </a>
    <a class="me-cross-chip" href="${escapeHtml(notesHref)}" data-kpi-action="map:cross-notes">
      <span aria-hidden="true">📖</span> ${escapeHtml(copy.crossNotesLabel)}
    </a>
  </div>`;

  return `<section class="section me-section" aria-label="Map Explorer">
    ${crossChipsHtml}
    <div class="me-toolbar">
      <div class="me-tabs" role="tablist" aria-label="${escapeHtml(copy.tabAriaLabel)}">
        <button type="button" class="me-tab is-active" role="tab" aria-selected="true" data-tab="markers">${escapeHtml(copy.tabMarkers)}</button>
        <button type="button" class="me-tab" role="tab" aria-selected="false" data-tab="heatmap">${escapeHtml(copy.tabHeatmap)}</button>
        <button type="button" class="me-tab" role="tab" aria-selected="false" data-tab="coverage">${escapeHtml(copy.tabCoverage)}</button>
      </div>
      <div class="me-filter-group">
        <span class="me-filter-label">${escapeHtml(copy.taxonFilterLabel)}</span>
        <div class="me-chip-row" role="group" aria-label="${escapeHtml(copy.taxonFilterLabel)}">${taxonChipsHtml}</div>
      </div>
      <div class="me-filter-group">
        <span class="me-filter-label">${escapeHtml(copy.seasonFilterLabel)}</span>
        <div class="me-chip-row" role="group" aria-label="${escapeHtml(copy.seasonFilterLabel)}">${seasonChipsHtml}</div>
      </div>
      <div class="me-filter-group">
        <label class="me-filter-label" for="me-year">${escapeHtml(copy.yearFilterLabel)}</label>
        <select id="me-year" class="me-year-select">${yearOptionsHtml}</select>
      </div>
      <div class="me-filter-group me-basemap-group">
        <span class="me-filter-label">${escapeHtml(copy.basemapLabel)}</span>
        <div class="me-basemap-row" role="group" aria-label="${escapeHtml(copy.basemapLabel)}">${basemapRadiosHtml}</div>
      </div>
    </div>

    <div class="me-region-bar" role="group" aria-label="${escapeHtml(copy.regionFilterLabel)}">
      <span class="me-filter-label">${escapeHtml(copy.regionFilterLabel)}</span>
      <div class="me-region-row">${regionChipsHtml}</div>
    </div>

    <details class="me-overlay-panel" open>
      <summary class="me-overlay-summary">
        <span class="me-overlay-heading">${escapeHtml(overlayLabels.heading)}</span>
        <span class="me-overlay-intro">${escapeHtml(overlayLabels.intro)}</span>
      </summary>
      <div class="me-overlay-list" data-overlay-catalog='${escapeHtml(
        JSON.stringify(overlays.map((o) => ({
          id: o.id,
          tiles: o.tiles,
          tileSize: o.tileSize,
          attribution: o.attribution,
          minzoom: o.minzoom,
          maxzoom: o.maxzoom,
          defaultOpacity: o.defaultOpacity,
        })))
      )}'>
        ${overlays
          .map(
            (o) => `<label class="me-overlay-item" data-overlay-id="${escapeHtml(o.id)}">
              <div class="me-overlay-row">
                <input type="checkbox" class="me-overlay-toggle" />
                <span class="me-overlay-label">${escapeHtml(o.label)}</span>
                <span class="me-overlay-category me-overlay-cat-${escapeHtml(o.category)}">${escapeHtml(o.category)}</span>
              </div>
              ${o.note ? `<p class="me-overlay-note">${escapeHtml(o.note)}</p>` : ""}
              ${o.legendGradient ? `<div class="me-overlay-legend">
                <span class="me-overlay-legend-low">${escapeHtml(o.legendLow ?? "")}</span>
                <span class="me-overlay-legend-gradient" style="background:${escapeHtml(o.legendGradient)}"></span>
                <span class="me-overlay-legend-high">${escapeHtml(o.legendHigh ?? "")}</span>
              </div>` : ""}
              <div class="me-overlay-opacity">
                <span class="me-overlay-opacity-label">${escapeHtml(overlayLabels.opacityLabel)}</span>
                <input
                  type="range"
                  class="me-overlay-opacity-range"
                  min="0"
                  max="1"
                  step="0.05"
                  value="${o.defaultOpacity.toString()}"
                  aria-label="${escapeHtml(overlayLabels.opacityLabel)}: ${escapeHtml(o.label)}"
                />
              </div>
            </label>`,
          )
          .join("")}
      </div>
    </details>

    <div class="me-main">
      <div class="me-map-wrap">
        <div id="map-explorer" class="me-map" data-api-observations="${escapeHtml(apiObservations)}" data-api-coverage="${escapeHtml(apiCoverage)}"></div>
        <div class="me-map-status" id="me-map-status" role="status" aria-live="polite">${escapeHtml(copy.loading)}</div>
        <div class="me-legend is-hidden" id="me-legend" aria-hidden="true">
          <span class="me-legend-label" id="me-legend-label">${escapeHtml(copy.legendLabel)}</span>
          <span class="me-legend-gradient" id="me-legend-gradient"></span>
          <span class="me-legend-range"><span id="me-legend-low">${escapeHtml(copy.heatmapLegendLow)}</span><span id="me-legend-high">${escapeHtml(copy.heatmapLegendHigh)}</span></span>
        </div>
        <div class="me-bottom-sheet" id="me-bottom-sheet" aria-hidden="true">
          <button type="button" class="me-bottom-close" id="me-bottom-close" aria-label="close">×</button>
          <div class="me-bottom-inner" id="me-bottom-inner"></div>
        </div>
      </div>
      <aside class="me-side" aria-label="side info">
        <div class="me-side-card">
          <h3 class="me-side-heading">${escapeHtml(copy.sideRecentLabel)}</h3>
          <div class="me-side-list" id="me-side-recent"></div>
        </div>
        <div class="me-side-card">
          <h3 class="me-side-heading">${escapeHtml(copy.sideRevisitLabel)}</h3>
          <div class="me-side-list" id="me-side-cluster"></div>
        </div>
      </aside>
    </div>
  </section>`;
}

export function mapExplorerBootScript(props: { lang: SiteLang; basePath: string }): string {
  const copy = MAP_EXPLORER_COPY[props.lang];
  const observationHrefTpl = withBasePath(props.basePath, "/observations/__ID__") +
    "?lang=" + props.lang;

  // Everything client-side lives in one IIFE to avoid globals.
  return `<script>
(function () {
  var root = document.getElementById('map-explorer');
  if (!root) return;
  var statusEl = document.getElementById('me-map-status');
  var legendEl = document.getElementById('me-legend');
  var legendLowEl = document.getElementById('me-legend-low');
  var legendHighEl = document.getElementById('me-legend-high');
  var sheetEl = document.getElementById('me-bottom-sheet');
  var sheetInnerEl = document.getElementById('me-bottom-inner');
  var sheetCloseEl = document.getElementById('me-bottom-close');
  var sideRecentEl = document.getElementById('me-side-recent');
  var sideClusterEl = document.getElementById('me-side-cluster');
  var apiObservations = root.getAttribute('data-api-observations') || '';
  var apiCoverage = root.getAttribute('data-api-coverage') || '';

  var COPY = ${JSON.stringify({
    loading: copy.loading,
    empty: copy.empty,
    statsTemplate: "__RETURNED__ / __TOTAL__",
    coverageLegendLow: copy.coverageLegendLow,
    coverageLegendHigh: copy.coverageLegendHigh,
    heatmapLegendLow: copy.heatmapLegendLow,
    heatmapLegendHigh: copy.heatmapLegendHigh,
    legendLabel: copy.legendLabel,
    popupOpenLabel: copy.popupOpenLabel,
    bottomSheetRecord: copy.bottomSheetRecord,
    bottomSheetNotes: copy.bottomSheetNotes,
    bottomSheetLens: copy.bottomSheetLens,
    bottomSheetScan: copy.bottomSheetScan,
  })};
  var OBSERVATION_HREF_TPL = ${JSON.stringify(observationHrefTpl)};
  var RECORD_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/record"), props.lang))};
  var NOTES_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/notes"), props.lang))};
  var LENS_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang))};
  var SCAN_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/scan"), props.lang))};

  var MAPLIBRE_CSS_SRI = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
  var MAPLIBRE_JS_SRI  = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
  var styleHref = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  if (!document.querySelector('link[data-maplibre="1"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = styleHref;
    link.integrity = MAPLIBRE_CSS_SRI; link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer'; link.setAttribute('data-maplibre', '1');
    document.head.appendChild(link);
  }

  var BASEMAPS = {
    standard: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    gsi: {
      version: 8,
      sources: {
        gsi_photo: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], tileSize: 256, attribution: '国土地理院シームレス空中写真' },
      },
      layers: [{ id: 'gsi_photo', type: 'raster', source: 'gsi_photo' }],
    },
    esri: {
      version: 8,
      sources: {
        esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' },
      },
      layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
    },
  };

  var state = {
    tab: 'markers',
    taxonGroup: '',
    year: '',
    season: '',
    basemap: 'standard',
    map: null,
    rawFeatures: [],   // unfiltered
    features: [],      // season-filtered
    coverage: null,
    lastAbort: null,
  };

  // Month ranges per season. Using 3/6/9/12 as the season boundaries
  // keeps the UX simple even if meteorologists prefer finer splits.
  var SEASON_MONTHS = {
    spring: [3, 4, 5],
    summer: [6, 7, 8],
    autumn: [9, 10, 11],
    winter: [12, 1, 2],
  };
  function filterBySeason(features, season) {
    if (!season || !SEASON_MONTHS[season]) return features.slice();
    var months = SEASON_MONTHS[season];
    return features.filter(function (f) {
      var ts = f.properties && f.properties.observedAt;
      if (!ts) return false;
      var m = new Date(ts).getMonth() + 1;
      return months.indexOf(m) !== -1;
    });
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ''; }
  function showLegend(lowLabel, highLabel, gradient) {
    if (!legendEl) return;
    legendEl.classList.remove('is-hidden');
    legendEl.setAttribute('aria-hidden', 'false');
    if (legendLowEl) legendLowEl.textContent = lowLabel;
    if (legendHighEl) legendHighEl.textContent = highLabel;
    var gradEl = document.getElementById('me-legend-gradient');
    if (gradEl) gradEl.style.background = gradient;
  }
  function hideLegend() {
    if (!legendEl) return;
    legendEl.classList.add('is-hidden');
    legendEl.setAttribute('aria-hidden', 'true');
  }

  function fmtStatsLabel(ret, tot) {
    return String(ret) + ' / ' + String(tot);
  }

  function renderSideLists(features) {
    if (!sideRecentEl || !sideClusterEl) return;
    // Recent: first 8 sorted by observedAt desc (features already desc from API).
    var recent = features.slice(0, 8);
    sideRecentEl.innerHTML = recent.map(function (f) {
      var p = f.properties;
      var place = [p.placeName, p.municipality].filter(Boolean).join(' · ') || '—';
      return '<a class="me-side-item" href="' + OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(p.occurrenceId)) + '">' +
        '<strong>' + escapeHtml(p.displayName) + '</strong>' +
        '<span>' + escapeHtml(place) + '</span>' +
        '</a>';
    }).join('');

    // Cluster-by-municipality
    var buckets = {};
    for (var i = 0; i < features.length; i++) {
      var key = features[i].properties.municipality || '—';
      buckets[key] = (buckets[key] || 0) + 1;
    }
    var bucketArr = Object.keys(buckets).map(function (k) { return { name: k, count: buckets[k] }; });
    bucketArr.sort(function (a, b) { return b.count - a.count; });
    sideClusterEl.innerHTML = bucketArr.slice(0, 6).map(function (b) {
      return '<div class="me-cluster-item"><span>' + escapeHtml(b.name) + '</span><strong>' + b.count + '</strong></div>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function openBottomSheet(feature) {
    if (!sheetEl || !sheetInnerEl) return;
    var p = feature.properties;
    var place = [p.placeName, p.municipality].filter(Boolean).join(' · ') || '—';
    var photo = p.photoUrl ? '<img class="me-bottom-photo" src="' + escapeHtml(p.photoUrl) + '" alt="" loading="lazy" />' : '';
    var href = OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(p.occurrenceId));
    sheetInnerEl.innerHTML = photo +
      '<div class="me-bottom-meta">' +
      '<strong>' + escapeHtml(p.displayName) + '</strong>' +
      '<span>' + escapeHtml(place) + '</span>' +
      (p.observedAt ? '<span>' + escapeHtml(String(p.observedAt).slice(0, 10)) + '</span>' : '') +
      '</div>' +
      '<div class="me-bottom-actions">' +
      '<a class="btn btn-solid" href="' + href + '">' + escapeHtml(COPY.popupOpenLabel) + '</a>' +
      '<a class="inline-link" href="' + NOTES_HREF + '">' + escapeHtml(COPY.bottomSheetNotes) + '</a>' +
      '<a class="inline-link" href="' + LENS_HREF + '">' + escapeHtml(COPY.bottomSheetLens) + '</a>' +
      '<a class="inline-link" href="' + SCAN_HREF + '">' + escapeHtml(COPY.bottomSheetScan) + '</a>' +
      '<a class="inline-link" href="' + RECORD_HREF + '">' + escapeHtml(COPY.bottomSheetRecord) + '</a>' +
      '</div>';
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
  }
  function closeBottomSheet() {
    if (!sheetEl) return;
    sheetEl.classList.remove('is-open');
    sheetEl.setAttribute('aria-hidden', 'true');
  }
  if (sheetCloseEl) sheetCloseEl.addEventListener('click', closeBottomSheet);

  function ensureObservationSource(map, features) {
    if (map.getSource('observations')) {
      map.getSource('observations').setData({ type: 'FeatureCollection', features: features });
      return;
    }
    map.addSource('observations', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: features },
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 48,
    });
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'observations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#10b981',
        'circle-opacity': 0.72,
        'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 25, 24, 100, 30],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    });
    // Inner dot used as a subtle "cluster" visual cue. Avoided a symbol layer
    // with text-field because our raster basemaps don't ship a "glyphs" URL,
    // which MapLibre requires for text rendering. The outer circle already
    // communicates cluster presence and size; hover/click reveals the count.
    map.addLayer({
      id: 'cluster-inner',
      type: 'circle',
      source: 'observations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#047857',
        'circle-opacity': 0.9,
        'circle-radius': ['step', ['get', 'point_count'], 4, 5, 5, 25, 6, 100, 7],
      },
    });
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'observations',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': [
          'match', ['get', 'taxonGroup'],
          'bird', '#f59e0b',
          'insect', '#f43f5e',
          'plant', '#10b981',
          'amphibian_reptile', '#14b8a6',
          'mammal', '#8b5cf6',
          'fungi', '#a16207',
          '#0ea5e9',
        ],
        'circle-radius': 6,
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1.5,
      },
    });

    map.on('click', 'unclustered-point', function (e) {
      if (!e.features || !e.features[0]) return;
      openBottomSheet(e.features[0]);
    });
    map.on('click', 'clusters', function (e) {
      var fs = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      if (!fs[0]) return;
      var clusterId = fs[0].properties.cluster_id;
      map.getSource('observations').getClusterExpansionZoom(clusterId, function (err, zoom) {
        if (err) return;
        map.easeTo({ center: fs[0].geometry.coordinates, zoom: zoom });
      });
    });
    map.on('mouseenter', 'unclustered-point', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'unclustered-point', function () { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'clusters', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', function () { map.getCanvas().style.cursor = ''; });
  }

  function removeLayerIfExists(map, id) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  function removeSourceIfExists(map, id) {
    if (map.getSource(id)) map.removeSource(id);
  }

  function applyTab(map, tab) {
    // Show/hide layers based on active tab.
    var markerLayers = ['clusters', 'cluster-inner', 'unclustered-point'];
    var heatLayers = ['obs-heat'];
    var coverageLayers = ['coverage-fill'];
    var show = function (ids, visible) {
      ids.forEach(function (id) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      });
    };
    show(markerLayers, tab === 'markers');
    show(heatLayers, tab === 'heatmap');
    show(coverageLayers, tab === 'coverage');

    if (tab === 'heatmap') {
      ensureHeatmap(map);
      showLegend(COPY.heatmapLegendLow, COPY.heatmapLegendHigh,
        'linear-gradient(90deg, rgba(56,189,248,0.2), #0ea5e9 40%, #f59e0b 75%, #ef4444)');
    } else if (tab === 'coverage') {
      ensureCoverage(map);
      showLegend(COPY.coverageLegendLow, COPY.coverageLegendHigh,
        'linear-gradient(90deg, rgba(16,185,129,0.18), #10b981 60%, #059669)');
    } else {
      hideLegend();
    }
  }

  function ensureHeatmap(map) {
    if (map.getLayer('obs-heat')) return;
    map.addLayer({
      id: 'obs-heat',
      type: 'heatmap',
      source: 'observations',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 12, 1.4],
        'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(56,189,248,0)',
          0.2, 'rgba(56,189,248,0.25)',
          0.45, 'rgba(14,165,233,0.45)',
          0.7, 'rgba(245,158,11,0.6)',
          1, 'rgba(239,68,68,0.85)'],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 7, 16, 12, 32],
        'heatmap-opacity': 0.75,
      },
    });
  }

  function ensureCoverage(map) {
    if (!state.coverage) {
      loadCoverage(map);
      return;
    }
    paintCoverage(map, state.coverage);
  }

  function paintCoverage(map, collection) {
    var sourceId = 'coverage';
    var fillId = 'coverage-fill';
    // Normalize opacity by count on the JS side so we never feed MapLibre
    // a non-ascending interpolate (a bug we hit when max was tiny).
    var max = Math.max(collection.maxCount || 1, 1);
    var scaled = {
      type: 'FeatureCollection',
      features: (collection.features || []).map(function (f) {
        var c = (f.properties && f.properties.count) || 0;
        var op = 0.08 + 0.57 * Math.min(1, c / max);
        return {
          type: 'Feature',
          geometry: f.geometry,
          properties: Object.assign({}, f.properties, { op: op }),
        };
      }),
    };
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: scaled });
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': ['get', 'op'],
          'fill-outline-color': 'rgba(5,150,105,0.35)',
        },
      });
    } else {
      map.getSource(sourceId).setData(scaled);
    }
  }

  function loadCoverage(map) {
    var qs = '';
    if (state.year) qs += (qs ? '&' : '?') + 'year=' + encodeURIComponent(state.year);
    fetch(apiCoverage + qs, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (coll) {
        state.coverage = coll;
        paintCoverage(map, coll);
      })
      .catch(function () {});
  }

  function loadObservations() {
    if (!state.map) return;
    var qs = '?limit=1500';
    if (state.taxonGroup) qs += '&taxon_group=' + encodeURIComponent(state.taxonGroup);
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    setStatus(COPY.loading);
    if (state.lastAbort) { try { state.lastAbort.abort(); } catch(_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.lastAbort = controller;
    fetch(apiObservations + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (coll) {
        state.rawFeatures = (coll && coll.features) || [];
        state.features = filterBySeason(state.rawFeatures, state.season);
        ensureObservationSource(state.map, state.features);
        renderSideLists(state.features);
        applyTab(state.map, state.tab);
        var totalAll = (coll && coll.stats && coll.stats.totalAll) || state.rawFeatures.length;
        if (state.features.length === 0) {
          setStatus(COPY.empty);
        } else {
          setStatus(fmtStatsLabel(state.features.length, totalAll));
        }
        // Fit bounds on first load only.
        if (state.features.length > 0 && !state._fittedOnce) {
          var bounds = new window.maplibregl.LngLatBounds();
          state.features.forEach(function (f) {
            if (f.geometry && f.geometry.coordinates) bounds.extend(f.geometry.coordinates);
          });
          if (!bounds.isEmpty()) state.map.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: 350 });
          state._fittedOnce = true;
        }
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        setStatus('—');
      });
  }

  function applySeasonLocal() {
    state.features = filterBySeason(state.rawFeatures, state.season);
    if (!state.map) return;
    ensureObservationSource(state.map, state.features);
    renderSideLists(state.features);
    applyTab(state.map, state.tab);
    if (state.features.length === 0) setStatus(COPY.empty);
    else setStatus(fmtStatsLabel(state.features.length, state.rawFeatures.length));
  }

  function switchBasemap(key) {
    if (!state.map || !BASEMAPS[key]) return;
    var wasTab = state.tab;
    state.basemap = key;
    state.map.setStyle(BASEMAPS[key]);
    // Re-add sources/layers after style load.
    state.map.once('style.load', function () {
      ensureObservationSource(state.map, state.features);
      if (state.coverage) paintCoverage(state.map, state.coverage);
      applyTab(state.map, wasTab);
    });
  }

  function hydrate() {
    if (!window.maplibregl) return;
    state.map = new window.maplibregl.Map({
      container: root,
      style: BASEMAPS.standard,
      center: [138.38, 35.34],
      zoom: 5.2,
      attributionControl: true,
    });
    state.map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    state.map.on('load', function () {
      loadObservations();
    });
  }

  if (window.maplibregl) hydrate();
  else {
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.integrity = MAPLIBRE_JS_SRI;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.defer = true;
    s.onload = hydrate;
    s.onerror = function () { setStatus('—'); };
    document.head.appendChild(s);
  }

  // Bind UI events.
  document.querySelectorAll('.me-taxon-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-taxon-group') || '';
      state.taxonGroup = value;
      document.querySelectorAll('.me-taxon-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      loadObservations();
    });
  });
  var yearSel = document.getElementById('me-year');
  if (yearSel) {
    yearSel.addEventListener('change', function () {
      state.year = yearSel.value;
      state.coverage = null; // invalidate so coverage refetches for new year
      if (state.map && state.map.getSource('coverage')) { removeLayerIfExists(state.map, 'coverage-fill'); removeSourceIfExists(state.map, 'coverage'); }
      loadObservations();
      if (state.tab === 'coverage' && state.map) loadCoverage(state.map);
    });
  }
  document.querySelectorAll('.me-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.getAttribute('data-tab') || 'markers';
      state.tab = t;
      document.querySelectorAll('.me-tab').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      if (state.map) applyTab(state.map, state.tab);
    });
  });
  document.querySelectorAll('input[name="me-basemap"]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      if (!inp.checked) return;
      var v = inp.value;
      document.querySelectorAll('.me-basemap-opt').forEach(function (el) {
        el.classList.toggle('is-active', el.contains(inp));
      });
      switchBasemap(v);
    });
  });
  document.querySelectorAll('.me-season-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.getAttribute('data-season') || '';
      state.season = v;
      document.querySelectorAll('.me-season-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      applySeasonLocal();
    });
  });
  document.querySelectorAll('.me-region-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!state.map) return;
      var bs = (btn.getAttribute('data-bounds') || '').split(',').map(Number);
      if (bs.length !== 4 || bs.some(function (n) { return !isFinite(n); })) return;
      state.map.fitBounds([[bs[0], bs[1]], [bs[2], bs[3]]], { padding: 36, maxZoom: 12, duration: 450 });
      document.querySelectorAll('.me-region-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
      });
    });
  });

  // ---- Overlay registry wire-up ------------------------------------------
  // Reads the JSON catalog baked into data-overlay-catalog, then adds /
  // removes raster sources + layers on toggle, and updates raster-opacity
  // on slider change. Kept client-side so the server doesn't need to know
  // which overlays are currently visible.
  var overlayCatalog = [];
  try {
    var catalogEl = document.querySelector('.me-overlay-list');
    if (catalogEl) overlayCatalog = JSON.parse(catalogEl.getAttribute('data-overlay-catalog') || '[]');
  } catch (_) { overlayCatalog = []; }
  var overlayState = {};
  overlayCatalog.forEach(function (o) { overlayState[o.id] = { enabled: false, opacity: o.defaultOpacity }; });

  function overlaySourceId(id) { return 'overlay-src-' + id; }
  function overlayLayerId(id) { return 'overlay-layer-' + id; }

  function addOverlay(map, def) {
    if (!map || map.getSource(overlaySourceId(def.id))) return;
    try {
      map.addSource(overlaySourceId(def.id), {
        type: 'raster',
        tiles: [def.tiles],
        tileSize: def.tileSize || 256,
        attribution: def.attribution,
        minzoom: def.minzoom || 0,
        maxzoom: def.maxzoom || 22,
      });
      // Insert below the observation layers so pins stay on top.
      var firstObsLayer = null;
      if (map.getLayer('clusters')) firstObsLayer = 'clusters';
      else if (map.getLayer('unclustered-point')) firstObsLayer = 'unclustered-point';
      else if (map.getLayer('obs-heat')) firstObsLayer = 'obs-heat';
      map.addLayer({
        id: overlayLayerId(def.id),
        type: 'raster',
        source: overlaySourceId(def.id),
        paint: { 'raster-opacity': overlayState[def.id].opacity },
      }, firstObsLayer || undefined);
    } catch (err) {
      // Tile provider unreachable / CORS fail — swallow so one broken
      // overlay doesn't kill the others.
      console.warn('overlay add failed', def.id, err);
    }
  }
  function removeOverlay(map, id) {
    if (!map) return;
    if (map.getLayer(overlayLayerId(id))) map.removeLayer(overlayLayerId(id));
    if (map.getSource(overlaySourceId(id))) map.removeSource(overlaySourceId(id));
  }
  function setOverlayOpacity(map, id, opacity) {
    if (!map || !map.getLayer(overlayLayerId(id))) return;
    map.setPaintProperty(overlayLayerId(id), 'raster-opacity', opacity);
  }
  function reapplyOverlays(map) {
    // Called after basemap swap so overlays survive a setStyle.
    overlayCatalog.forEach(function (def) {
      if (overlayState[def.id] && overlayState[def.id].enabled) addOverlay(map, def);
    });
  }
  // Patch switchBasemap to also re-add overlays after style reloads.
  var originalSwitchBasemap = switchBasemap;
  switchBasemap = function (key) {
    originalSwitchBasemap(key);
    if (state.map) state.map.once('style.load', function () { reapplyOverlays(state.map); });
  };

  document.querySelectorAll('.me-overlay-item').forEach(function (label) {
    var id = label.getAttribute('data-overlay-id');
    var toggle = label.querySelector('.me-overlay-toggle');
    var range = label.querySelector('.me-overlay-opacity-range');
    if (!id || !toggle || !range) return;
    var def = overlayCatalog.find(function (o) { return o.id === id; });
    if (!def) return;

    toggle.addEventListener('change', function () {
      overlayState[id].enabled = !!toggle.checked;
      label.classList.toggle('is-on', !!toggle.checked);
      if (!state.map) return;
      if (toggle.checked) addOverlay(state.map, def);
      else removeOverlay(state.map, id);
    });
    range.addEventListener('input', function () {
      var op = Number(range.value);
      if (!isFinite(op)) return;
      overlayState[id].opacity = op;
      if (state.map) setOverlayOpacity(state.map, id, op);
    });
  });
})();
</script>`;
}

export const MAP_EXPLORER_STYLES = `
  .me-section { margin-top: 16px; }
  .me-cross-chips {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    margin-bottom: 14px; padding: 10px 14px; border-radius: 999px;
    background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 4px 12px rgba(15,23,42,.04); font-size: 13px;
  }
  .me-cross-eyebrow { font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
  .me-cross-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(16,185,129,.08); color: #065f46; font-weight: 700; text-decoration: none; transition: background .15s ease; }
  .me-cross-chip:hover { background: rgba(16,185,129,.16); }

  .me-toolbar {
    display: grid; gap: 12px 18px; grid-template-columns: 1fr; margin-bottom: 14px;
    padding: 14px 16px; border-radius: 20px;
    background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.05);
    box-shadow: 0 6px 16px rgba(15,23,42,.04);
  }
  @media (min-width: 900px) { .me-toolbar { grid-template-columns: auto 1fr auto auto; align-items: center; } }
  .me-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(15,23,42,.04); }
  .me-tab { padding: 8px 14px; border-radius: 10px; border: 0; background: transparent; font-weight: 800; font-size: 13px; color: #475569; cursor: pointer; transition: background .15s ease, color .15s ease; }
  .me-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 4px 10px rgba(15,23,42,.08); }
  .me-filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .me-filter-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  .me-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .me-chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; font-weight: 700; font-size: 12px; color: #334155; cursor: pointer; transition: all .15s ease; }
  .me-chip:hover { border-color: rgba(16,185,129,.35); }
  .me-chip.is-active { background: linear-gradient(135deg, rgba(16,185,129,.16), rgba(14,165,233,.14)); border-color: rgba(16,185,129,.45); color: #065f46; }
  .me-chip-icon { font-size: 13px; }
  .me-year-select { padding: 6px 10px; border-radius: 10px; border: 1px solid rgba(15,23,42,.1); background: #fff; font-weight: 700; font-size: 13px; color: #0f172a; }
  .me-basemap-row { display: inline-flex; gap: 4px; padding: 3px; border-radius: 12px; background: rgba(15,23,42,.04); }
  .me-basemap-opt { position: relative; }
  .me-basemap-opt input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .me-basemap-opt span { display: inline-block; padding: 6px 10px; border-radius: 9px; font-weight: 700; font-size: 12px; color: #475569; transition: background .15s ease, color .15s ease; }
  .me-basemap-opt.is-active span { background: #fff; color: #0f172a; box-shadow: 0 3px 8px rgba(15,23,42,.08); }

  .me-region-bar {
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px;
    padding: 10px 14px; border-radius: 16px;
    background: rgba(255,255,255,.88); border: 1px solid rgba(15,23,42,.05);
    overflow-x: auto;
  }
  .me-region-row { display: flex; gap: 6px; flex-wrap: nowrap; }
  .me-region-chip { white-space: nowrap; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; font-weight: 700; font-size: 12px; color: #334155; cursor: pointer; }
  .me-region-chip:hover { border-color: rgba(14,165,233,.4); }
  .me-region-chip.is-active { background: linear-gradient(135deg, rgba(14,165,233,.18), rgba(16,185,129,.14)); border-color: rgba(14,165,233,.45); color: #075985; }

  .me-overlay-panel {
    margin-bottom: 14px;
    padding: 0;
    border-radius: 16px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(15,23,42,.06);
    overflow: hidden;
  }
  .me-overlay-summary {
    display: flex; flex-direction: column; gap: 2px;
    padding: 12px 18px; cursor: pointer; user-select: none;
    background: linear-gradient(90deg, rgba(99,102,241,.05), rgba(16,185,129,.05));
  }
  .me-overlay-summary::-webkit-details-marker { display: none; }
  .me-overlay-summary::after { content: "⌄"; position: absolute; right: 20px; font-weight: 800; color: #475569; transition: transform .2s ease; }
  .me-overlay-panel[open] .me-overlay-summary::after { transform: rotate(180deg); }
  .me-overlay-summary { position: relative; }
  .me-overlay-heading { font-weight: 900; font-size: 14px; color: #0f172a; letter-spacing: -.01em; }
  .me-overlay-intro { font-size: 12px; color: #475569; line-height: 1.5; }

  .me-overlay-list {
    display: grid; gap: 10px; padding: 14px 16px 16px;
    grid-template-columns: 1fr;
  }
  @media (min-width: 760px) { .me-overlay-list { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1100px) { .me-overlay-list { grid-template-columns: 1fr 1fr 1fr 1fr; } }
  .me-overlay-item {
    display: flex; flex-direction: column; gap: 6px;
    padding: 10px 12px; border-radius: 12px;
    background: #fff; border: 1px solid rgba(15,23,42,.06);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .me-overlay-item.is-on { border-color: rgba(99,102,241,.45); box-shadow: 0 6px 14px rgba(99,102,241,.08); }
  .me-overlay-row { display: flex; align-items: center; gap: 8px; }
  .me-overlay-toggle { width: 16px; height: 16px; accent-color: #6366f1; flex-shrink: 0; }
  .me-overlay-label { flex: 1 1 auto; font-weight: 800; font-size: 13px; color: #0f172a; letter-spacing: -.01em; }
  .me-overlay-category {
    font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 999px;
  }
  .me-overlay-cat-terrain { background: rgba(245,158,11,.12); color: #92400e; }
  .me-overlay-cat-landcover { background: rgba(16,185,129,.14); color: #065f46; }
  .me-overlay-cat-conservation { background: rgba(99,102,241,.12); color: #3730a3; }
  .me-overlay-note { margin: 0; font-size: 11px; line-height: 1.55; color: #64748b; }
  .me-overlay-legend { display: flex; align-items: center; gap: 6px; font-size: 10px; color: #64748b; }
  .me-overlay-legend-gradient { flex: 1; height: 6px; border-radius: 3px; }
  .me-overlay-opacity { display: flex; align-items: center; gap: 8px; opacity: .55; transition: opacity .15s ease; }
  .me-overlay-item.is-on .me-overlay-opacity { opacity: 1; }
  .me-overlay-opacity-label { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  .me-overlay-opacity-range { flex: 1; }

  .me-main { display: grid; gap: 16px; grid-template-columns: 1fr; }
  @media (min-width: 960px) { .me-main { grid-template-columns: minmax(0, 1fr) 280px; } }
  .me-map-wrap { position: relative; border-radius: 22px; overflow: hidden; background: linear-gradient(135deg,#ecfeff,#eff6ff); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 10px 24px rgba(15,23,42,.05); }
  .me-map { width: 100%; height: 68vh; min-height: 420px; }
  .me-map-status {
    position: absolute; right: 14px; top: 14px; z-index: 4;
    padding: 6px 12px; border-radius: 999px; background: rgba(15,23,42,.82);
    color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .02em;
    backdrop-filter: blur(8px);
  }
  .me-legend {
    position: absolute; left: 14px; bottom: 14px; z-index: 4;
    padding: 8px 12px; border-radius: 14px;
    background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 8px 16px rgba(15,23,42,.1);
    display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800;
  }
  .me-legend.is-hidden { display: none; }
  .me-legend-label { color: #475569; letter-spacing: .1em; text-transform: uppercase; }
  .me-legend-gradient { width: 140px; height: 10px; border-radius: 999px; display: inline-block; }
  .me-legend-range { display: inline-flex; gap: 10px; color: #64748b; font-weight: 700; }

  .me-bottom-sheet {
    position: absolute; left: 14px; right: 14px; bottom: 14px; z-index: 5;
    padding: 16px 18px; border-radius: 20px;
    background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 18px 38px rgba(15,23,42,.16);
    transform: translateY(20px); opacity: 0; pointer-events: none;
    transition: transform .25s ease, opacity .25s ease;
    max-height: 50%;
    overflow-y: auto;
  }
  .me-bottom-sheet.is-open { transform: translateY(0); opacity: 1; pointer-events: auto; }
  .me-bottom-close { position: absolute; right: 10px; top: 10px; width: 30px; height: 30px; border-radius: 999px; background: rgba(15,23,42,.06); border: 0; color: #475569; font-size: 18px; cursor: pointer; }
  .me-bottom-photo { width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; margin-bottom: 10px; }
  .me-bottom-meta { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
  .me-bottom-meta strong { font-size: 15px; font-weight: 800; color: #0f172a; }
  .me-bottom-meta span { font-size: 12px; color: #64748b; font-weight: 600; }
  .me-bottom-actions { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
  .me-bottom-actions .btn { padding: 8px 14px; font-size: 13px; }

  .me-side { display: flex; flex-direction: column; gap: 14px; }
  .me-side-card { background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 20px; padding: 14px 16px; box-shadow: 0 6px 16px rgba(15,23,42,.04); }
  .me-side-heading { margin: 0 0 10px; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #059669; }
  .me-side-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
  .me-side-item { padding: 8px 10px; border-radius: 12px; background: rgba(236,253,245,.4); border: 1px solid rgba(16,185,129,.12); text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 2px; }
  .me-side-item:hover { background: rgba(236,253,245,.8); }
  .me-side-item strong { font-size: 13px; font-weight: 800; color: #0f172a; }
  .me-side-item span { font-size: 11px; color: #64748b; }
  .me-cluster-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 10px; background: rgba(248,250,252,.8); font-size: 12px; }
  .me-cluster-item strong { font-weight: 800; color: #059669; }

  @media (max-width: 900px) {
    .me-side { flex-direction: row; overflow-x: auto; }
    .me-side-card { min-width: 240px; flex-shrink: 0; }
  }
`;
