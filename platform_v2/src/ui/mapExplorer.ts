import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import { overlaysForLang, type LocalizedOverlay } from "../services/layerCatalog.js";
import {
  buildOfficialNoticeClientRenderer,
  getOfficialNoticeRenderCopy,
  OFFICIAL_NOTICE_CARD_STYLES,
} from "./officialNoticeCard.js";
import { MAP_EXPLORER_STATE_RUNTIME } from "./mapExplorerState.js";
import { escapeHtml } from "./siteShell.js";

/**
 * mapExplorer — the /map page's interactive core.
 *
 * Server emits a shell (hero, filter bar, canvas, side panel, empty bottom sheet)
 * and a boot script that hydrates the MapLibre map client-side. Data comes from
 * /api/v1/map/cells and /api/v1/map/observations, which the client refetches
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
  siteBriefHeading: string;
  siteBriefReasonsLabel: string;
  siteBriefChecksLabel: string;
  siteBriefCapturesLabel: string;
  siteBriefWhyHereLabel: string;
  siteBriefWhyNowLabel: string;
  siteBriefOneVisitLabel: string;
  siteBriefNextHookLabel: string;
  siteBriefLoading: string;
  siteBriefError: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  searchNoResult: string;
  searchError: string;
  searchResultSpecies: string;
  searchResultPlace: string;
  locateLabel: string;
  locateError: string;
  timelineAriaLabel: string;
  shareLabel: string;
  shareCopied: string;
  shareError: string;
  taxonChips: TaxonGroupChip[];
};

// Bounding boxes for 1-tap region jumps. Kept identical across locales
// (they're geographic bboxes, not translations).
const REGION_BBOXES: Array<{ key: string; bounds: [number, number, number, number] }> = [
  { key: "japan",         bounds: [122.9,   24.0,   146.0,  45.6  ] },
  // 静岡県 — 全域 → 政令市 → 主要市の順
  { key: "shizuoka_pref", bounds: [137.47,  34.57,  139.16, 35.65 ] },
  { key: "hamamatsu",     bounds: [137.55,  34.61,  137.91, 34.85 ] }, // 浜松市（政令市）
  { key: "shizuoka",      bounds: [138.21,  34.90,  138.55, 35.17 ] }, // 静岡市（政令市）
  { key: "iwata",         bounds: [137.82,  34.69,  137.97, 34.80 ] }, // 磐田市
  { key: "kakegawa",      bounds: [137.95,  34.71,  138.10, 34.84 ] }, // 掛川市
  { key: "fukuroi",       bounds: [137.88,  34.71,  138.00, 34.81 ] }, // 袋井市
  { key: "shimada",       bounds: [138.10,  34.79,  138.26, 34.93 ] }, // 島田市
  { key: "fuji",          bounds: [138.60,  35.08,  138.80, 35.22 ] }, // 富士市
  { key: "numazu",        bounds: [138.82,  35.06,  138.97, 35.17 ] }, // 沼津市
  // 全国主要都市
  { key: "tokyo",         bounds: [139.58,  35.55,  139.92, 35.82 ] },
  { key: "nagoya",        bounds: [136.80,  35.00,  137.05, 35.24 ] },
  { key: "osaka",         bounds: [135.35,  34.55,  135.65, 34.78 ] },
  { key: "kyoto",         bounds: [135.65,  34.92,  135.90, 35.10 ] },
  { key: "fukuoka",       bounds: [130.30,  33.48,  130.55, 33.68 ] },
  { key: "sapporo",       bounds: [141.25,  42.94,  141.50, 43.15 ] },
];

function regionPresets(labels: Record<string, string>): Array<{ key: string; label: string; bounds: [number, number, number, number] }> {
  return REGION_BBOXES.map((r) => ({ ...r, label: labels[r.key] ?? r.key }));
}

export const MAP_EXPLORER_COPY: Record<SiteLang, MapExplorerCopy> = {
  ja: {
    tabMarkers: "観察エリア",
    tabHeatmap: "密度ヒート",
    tabCoverage: "調査前進",
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
      shizuoka_pref: "静岡県",
      hamamatsu: "浜松市",
      shizuoka: "静岡市",
      iwata: "磐田市",
      kakegawa: "掛川市",
      fukuroi: "袋井市",
      shimada: "島田市",
      fuji: "富士市",
      numazu: "沼津市",
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
    coverageLegendLow: "薄い",
    coverageLegendHigh: "厚い",
    heatmapLegendLow: "薄い",
    heatmapLegendHigh: "濃い",
    loading: "読み込み中…",
    statsLabel: (returned, total) => `${returned.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 件`,
    empty: "この条件に合う記録はまだありません。条件をゆるめるか、別の年を試してください。",
    sideRecentLabel: "最近の記録",
    sideRevisitLabel: "この場所で見つかったもの",
    crossEyebrow: "この場所で、次の 1 件を残す",
    crossLensLabel: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    crossScanLabel: JA_PUBLIC_SHARED_COPY.cta.openScan,
    crossNotesLabel: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    popupOpenLabel: "詳細を開く →",
    bottomSheetRecord: JA_PUBLIC_SHARED_COPY.cta.record,
    bottomSheetNotes: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    bottomSheetLens: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    bottomSheetScan: JA_PUBLIC_SHARED_COPY.cta.openScan,
    siteBriefHeading: "この場所で見てみたいこと",
    siteBriefReasonsLabel: "根拠",
    siteBriefChecksLabel: "現地で確かめる",
    siteBriefCapturesLabel: "撮るなら",
    siteBriefWhyHereLabel: "ここが気になる理由",
    siteBriefWhyNowLabel: "今行く理由",
    siteBriefOneVisitLabel: "1 回の訪問で残せること",
    siteBriefNextHookLabel: "次にまた行きたくなる理由",
    siteBriefLoading: "この地点を読み解き中…",
    siteBriefError: "手がかりが取れなかった。現地の直感を優先して。",
    searchPlaceholder: "場所や生きものを探す（例: 静岡市 谷津山、モンシロチョウ）",
    searchAriaLabel: "場所または種を検索",
    searchNoResult: "見つからなかった。もう一語ゆるめてみる。",
    searchError: "検索に失敗した。しばらく待ってから試す。",
    searchResultSpecies: "種",
    searchResultPlace: "場所",
    locateLabel: "現在地を見る",
    locateError: "現在地を取得できなかった。ブラウザの位置情報を許可してほしい。",
    timelineAriaLabel: "年のタイムライン",
    shareLabel: "この表示を共有",
    shareCopied: "共有リンクをコピーした。",
    shareError: "共有リンクを作れなかった。",
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
    tabMarkers: "Areas",
    tabHeatmap: "Heatmap",
    tabCoverage: "Frontier",
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
      shizuoka_pref: "Shizuoka Pref.",
      hamamatsu: "Hamamatsu",
      shizuoka: "Shizuoka City",
      iwata: "Iwata",
      kakegawa: "Kakegawa",
      fukuroi: "Fukuroi",
      shimada: "Shimada",
      fuji: "Fuji",
      numazu: "Numazu",
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
    coverageLegendLow: "Thin",
    coverageLegendHigh: "Deep",
    heatmapLegendLow: "Low",
    heatmapLegendHigh: "High",
    loading: "Loading…",
    statsLabel: (returned, total) => `${returned.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`,
    empty: "Nothing here yet — this could be your page to write.",
    sideRecentLabel: "My progress",
    sideRevisitLabel: "Area progress",
    crossEyebrow: "Your next page starts here",
    crossLensLabel: "Open Lens",
    crossScanLabel: "Open Explore Map",
    crossNotesLabel: "Back to notebook",
    popupOpenLabel: "Open detail →",
    bottomSheetRecord: "Record here",
    bottomSheetNotes: "Notebook detail",
    bottomSheetLens: "Lens",
    bottomSheetScan: "Scan",
    siteBriefHeading: "Three things to check here",
    siteBriefReasonsLabel: "Why",
    siteBriefChecksLabel: "Check on the ground",
    siteBriefCapturesLabel: "If you shoot",
    siteBriefWhyHereLabel: "why here",
    siteBriefWhyNowLabel: "why now",
    siteBriefOneVisitLabel: "one-visit contribution",
    siteBriefNextHookLabel: "next revisit hook",
    siteBriefLoading: "Reading this place…",
    siteBriefError: "Could not read this place. Trust your field sense.",
    searchPlaceholder: "Find a place or species (e.g. Shizuoka, swallowtail)",
    searchAriaLabel: "Search place or species",
    searchNoResult: "No match. Try a looser term.",
    searchError: "Search failed. Wait a moment and retry.",
    searchResultSpecies: "Species",
    searchResultPlace: "Place",
    locateLabel: "My location",
    locateError: "Could not get your location. Allow location in your browser.",
    timelineAriaLabel: "Year timeline",
    shareLabel: "Share this view",
    shareCopied: "Share link copied.",
    shareError: "Could not create a share link.",
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
    tabMarkers: "Áreas",
    tabHeatmap: "Mapa de calor",
    tabCoverage: "Frontera",
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
      shizuoka_pref: "Pref. Shizuoka",
      hamamatsu: "Hamamatsu",
      shizuoka: "Ciudad de Shizuoka",
      iwata: "Iwata",
      kakegawa: "Kakegawa",
      fukuroi: "Fukuroi",
      shimada: "Shimada",
      fuji: "Fuji",
      numazu: "Numazu",
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
    coverageLegendLow: "Ligera",
    coverageLegendHigh: "Gruesa",
    heatmapLegendLow: "Baja",
    heatmapLegendHigh: "Alta",
    loading: "Cargando…",
    statsLabel: (returned, total) => `${returned.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")}`,
    empty: "Aún no hay nada aquí — podrías ser el primero en registrar algo.",
    sideRecentLabel: "Mi avance",
    sideRevisitLabel: "Avance del área",
    crossEyebrow: "Tu próxima página empieza aquí",
    crossLensLabel: "Abrir Guía de Campo",
    crossScanLabel: "Abrir Escaneo",
    crossNotesLabel: "Volver al cuaderno",
    popupOpenLabel: "Ver detalle →",
    bottomSheetRecord: "Registrar aquí",
    bottomSheetNotes: "Detalle del cuaderno",
    bottomSheetLens: "Guía de Campo",
    bottomSheetScan: "Escaneo",
    siteBriefHeading: "Tres cosas para verificar aquí",
    siteBriefReasonsLabel: "Por qué",
    siteBriefChecksLabel: "Verifica en el sitio",
    siteBriefCapturesLabel: "Si disparas",
    siteBriefWhyHereLabel: "por qué aquí",
    siteBriefWhyNowLabel: "por qué ahora",
    siteBriefOneVisitLabel: "aporte de una visita",
    siteBriefNextHookLabel: "gancho para volver",
    siteBriefLoading: "Leyendo este lugar…",
    siteBriefError: "No pude leer este lugar. Confía en tu campo.",
    searchPlaceholder: "Buscar lugar o especie (p. ej. Shizuoka, mariposa)",
    searchAriaLabel: "Buscar lugar o especie",
    searchNoResult: "Sin resultados. Prueba con menos palabras.",
    searchError: "Fallo al buscar. Espera y reintenta.",
    searchResultSpecies: "Especie",
    searchResultPlace: "Lugar",
    locateLabel: "Mi ubicación",
    locateError: "No pude obtener tu ubicación. Permite la geolocalización en el navegador.",
    timelineAriaLabel: "Línea de tiempo por año",
    shareLabel: "Compartir esta vista",
    shareCopied: "Enlace copiado.",
    shareError: "No pude crear el enlace.",
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
    tabMarkers: "Áreas",
    tabHeatmap: "Mapa de calor",
    tabCoverage: "Fronteira",
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
      shizuoka_pref: "Pref. Shizuoka",
      hamamatsu: "Hamamatsu",
      shizuoka: "Cidade de Shizuoka",
      iwata: "Iwata",
      kakegawa: "Kakegawa",
      fukuroi: "Fukuroi",
      shimada: "Shimada",
      fuji: "Fuji",
      numazu: "Numazu",
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
    coverageLegendLow: "Fina",
    coverageLegendHigh: "Densa",
    heatmapLegendLow: "Baixa",
    heatmapLegendHigh: "Alta",
    loading: "Carregando…",
    statsLabel: (returned, total) => `${returned.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`,
    empty: "Nada registrado aqui ainda — pode ser a sua vez de começar.",
    sideRecentLabel: "Meu avanço",
    sideRevisitLabel: "Avanço da área",
    crossEyebrow: "Sua próxima página começa aqui",
    crossLensLabel: "Abrir Guia de Campo",
    crossScanLabel: "Abrir Escaneamento",
    crossNotesLabel: "Voltar ao caderno",
    popupOpenLabel: "Ver detalhe →",
    bottomSheetRecord: "Registrar aqui",
    bottomSheetNotes: "Detalhe do caderno",
    bottomSheetLens: "Guia de Campo",
    bottomSheetScan: "Escaneamento",
    siteBriefHeading: "Três coisas para checar aqui",
    siteBriefReasonsLabel: "Porquê",
    siteBriefChecksLabel: "Verifique no campo",
    siteBriefCapturesLabel: "Se for fotografar",
    siteBriefWhyHereLabel: "por que aqui",
    siteBriefWhyNowLabel: "por que agora",
    siteBriefOneVisitLabel: "contribuição de uma visita",
    siteBriefNextHookLabel: "gancho para voltar",
    siteBriefLoading: "Lendo este lugar…",
    siteBriefError: "Não consegui ler este lugar. Confie no campo.",
    searchPlaceholder: "Buscar local ou espécie (ex.: Shizuoka, borboleta)",
    searchAriaLabel: "Buscar local ou espécie",
    searchNoResult: "Sem resultados. Tente um termo mais amplo.",
    searchError: "Falha na busca. Aguarde e tente novamente.",
    searchResultSpecies: "Espécie",
    searchResultPlace: "Lugar",
    locateLabel: "Minha localização",
    locateError: "Não foi possível obter sua localização. Permita a geolocalização no navegador.",
    timelineAriaLabel: "Linha do tempo por ano",
    shareLabel: "Compartilhar esta vista",
    shareCopied: "Link copiado.",
    shareError: "Não foi possível criar o link.",
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

function ambientPanelLabels(lang: SiteLang): {
  roleLabel: string;
  roles: Array<{ value: "note" | "guide" | "scan" | "mixed"; label: string; icon: string }>;
  selfLabel: string;
  communityLabel: string;
  frontierLabel: string;
  roleCardLabel: string;
} {
  if (lang === "en") {
    return {
      roleLabel: "Role",
      roles: [
        { value: "note", label: "Note", icon: "📖" },
        { value: "guide", label: "Guide", icon: "🔍" },
        { value: "scan", label: "Scan", icon: "📡" },
        { value: "mixed", label: "Mixed", icon: "🧭" },
      ],
      selfLabel: "My progress",
      communityLabel: "Area progress",
      frontierLabel: "Next frontier",
      roleCardLabel: "Best role here",
    };
  }
  if (lang === "es") {
    return {
      roleLabel: "Rol",
      roles: [
        { value: "note", label: "Nota", icon: "📖" },
        { value: "guide", label: "Guía", icon: "🔍" },
        { value: "scan", label: "Escaneo", icon: "📡" },
        { value: "mixed", label: "Mixto", icon: "🧭" },
      ],
      selfLabel: "Mi avance",
      communityLabel: "Avance del área",
      frontierLabel: "Siguiente frontera",
      roleCardLabel: "Mejor rol aquí",
    };
  }
  if (lang === "pt-BR") {
    return {
      roleLabel: "Papel",
      roles: [
        { value: "note", label: "Nota", icon: "📖" },
        { value: "guide", label: "Guia", icon: "🔍" },
        { value: "scan", label: "Escanear", icon: "📡" },
        { value: "mixed", label: "Misto", icon: "🧭" },
      ],
      selfLabel: "Meu avanço",
      communityLabel: "Avanço da área",
      frontierLabel: "Próxima fronteira",
      roleCardLabel: "Melhor papel aqui",
    };
  }
  return {
    roleLabel: "役割",
    roles: [
      { value: "note", label: "Note", icon: "📖" },
      { value: "guide", label: "Guide", icon: "🔍" },
      { value: "scan", label: "Scan", icon: "📡" },
      { value: "mixed", label: "Mixed", icon: "🧭" },
    ],
    selfLabel: "自分の前進",
    communityLabel: "地域の前進",
    frontierLabel: "次の frontier",
    roleCardLabel: "この場所で最適な役割",
  };
}

function actorPanelLabels(lang: SiteLang): {
  actorLabel: string;
  actors: Array<{ value: "all" | "local_steward" | "traveler" | "casual"; label: string; icon: string }>;
} {
  if (lang === "en") {
    return {
      actorLabel: "Actor lens",
      actors: [
        { value: "all", label: "All", icon: "🧭" },
        { value: "local_steward", label: "Local steward", icon: "🏡" },
        { value: "traveler", label: "Traveler", icon: "🧳" },
        { value: "casual", label: "Casual", icon: "🚶" },
      ],
    };
  }
  if (lang === "es") {
    return {
      actorLabel: "Lente de actor",
      actors: [
        { value: "all", label: "Todo", icon: "🧭" },
        { value: "local_steward", label: "Cuidador local", icon: "🏡" },
        { value: "traveler", label: "Viajero", icon: "🧳" },
        { value: "casual", label: "Casual", icon: "🚶" },
      ],
    };
  }
  if (lang === "pt-BR") {
    return {
      actorLabel: "Lente do ator",
      actors: [
        { value: "all", label: "Tudo", icon: "🧭" },
        { value: "local_steward", label: "Guardião local", icon: "🏡" },
        { value: "traveler", label: "Viajante", icon: "🧳" },
        { value: "casual", label: "Casual", icon: "🚶" },
      ],
    };
  }
  return {
    actorLabel: "見る主体",
    actors: [
      { value: "all", label: "All", icon: "🧭" },
      { value: "local_steward", label: "Local steward", icon: "🏡" },
      { value: "traveler", label: "Traveler", icon: "🧳" },
      { value: "casual", label: "Casual", icon: "🚶" },
    ],
  };
}

export function renderMapExplorer(props: MapExplorerProps): string {
  const lang = props.lang;
  const copy = MAP_EXPLORER_COPY[lang];
  const ambientLabels = ambientPanelLabels(lang);
  const actorLabels = actorPanelLabels(lang);
  const yearTimelineValues = [...props.years].sort((a, b) => a - b);
  const yearValuesJson = escapeHtml(JSON.stringify(yearTimelineValues));
  const overlays: LocalizedOverlay[] = overlaysForLang(lang);
  const overlayLabels = overlayPanelLabels(lang);
  const recordHref = appendLangToHref(withBasePath(props.basePath, "/record"), props.lang);
  const notesHref = appendLangToHref(withBasePath(props.basePath, "/notes"), props.lang);
  const lensHref = appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang);
  const apiCells = withBasePath(props.basePath, "/api/v1/map/cells");
  const apiObservations = withBasePath(props.basePath, "/api/v1/map/observations");
  const apiSiteBrief = withBasePath(props.basePath, "/api/v1/map/site-brief");
  const apiTraces = withBasePath(props.basePath, "/api/v1/map/traces");
  const apiFrontier = withBasePath(props.basePath, "/api/v1/map/frontier");
  const apiEffortSummary = withBasePath(props.basePath, "/api/v1/map/effort-summary");

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

  const yearScaleLabels = yearTimelineValues.length >= 3
    ? [yearTimelineValues[0], yearTimelineValues[Math.floor(yearTimelineValues.length / 2)]!, yearTimelineValues[yearTimelineValues.length - 1]!]
    : yearTimelineValues;
  const yearScaleHtml = yearScaleLabels
    .map((year) => `<span>${escapeHtml(String(year))}</span>`)
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

  const roleChipsHtml = ambientLabels.roles
    .map(
      (role, idx) => `<button
        type="button"
        class="me-chip me-role-chip${role.value === "mixed" || idx === ambientLabels.roles.length - 1 ? " is-active" : ""}"
        data-role="${escapeHtml(role.value)}"
        aria-pressed="${role.value === "mixed" || idx === ambientLabels.roles.length - 1 ? "true" : "false"}">
        <span class="me-chip-icon" aria-hidden="true">${escapeHtml(role.icon)}</span>
        <span>${escapeHtml(role.label)}</span>
      </button>`,
    )
    .join("");
  const actorChipsHtml = actorLabels.actors
    .map(
      (actor, idx) => `<button
        type="button"
        class="me-chip me-actor-chip${actor.value === "all" || idx === 0 ? " is-active" : ""}"
        data-actor-class="${escapeHtml(actor.value)}"
        aria-pressed="${actor.value === "all" || idx === 0 ? "true" : "false"}">
        <span aria-hidden="true">${escapeHtml(actor.icon)}</span>
        ${escapeHtml(actor.label)}
      </button>`,
    )
    .join("");

  const filterToggleLabel = lang === "ja"
    ? "フィルタ"
    : lang === "es"
      ? "Filtros"
      : lang === "pt-BR"
        ? "Filtros"
        : "Filters";
  const listHeading = lang === "ja"
    ? "この範囲の観察"
    : lang === "es"
      ? "Observaciones en esta área"
      : lang === "pt-BR"
        ? "Observações nesta área"
        : "Observations in this area";
  const searchAreaLabel = lang === "ja"
    ? "この範囲で再検索"
    : lang === "es"
      ? "Buscar en esta área"
      : lang === "pt-BR"
        ? "Buscar nesta área"
        : "Search this area";

  return `<section class="section me-section" aria-label="Map Explorer">
    <div class="me-topbar">
      <div class="me-topbar-primary">
        <div class="me-search-shell" role="search">
          <span class="me-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            id="me-search-input"
            class="me-search-input"
            placeholder="${escapeHtml(copy.searchPlaceholder)}"
            aria-label="${escapeHtml(copy.searchAriaLabel)}"
            autocomplete="off"
            spellcheck="false"
          />
          <div id="me-search-results" class="me-search-results" role="listbox" aria-label="${escapeHtml(copy.searchAriaLabel)}"></div>
        </div>
        <div class="me-tabs" role="tablist" aria-label="${escapeHtml(copy.tabAriaLabel)}">
          <button type="button" class="me-tab is-active" role="tab" aria-selected="true" data-tab="markers">${escapeHtml(copy.tabMarkers)}</button>
          <button type="button" class="me-tab" role="tab" aria-selected="false" data-tab="heatmap">${escapeHtml(copy.tabHeatmap)}</button>
          <button type="button" class="me-tab" role="tab" aria-selected="false" data-tab="frontier">${escapeHtml(copy.tabCoverage)}</button>
        </div>
      </div>
      <div class="me-topbar-secondary">
        <div class="me-filter-group me-filter-group-quick">
          <span class="me-filter-label">${escapeHtml(copy.taxonFilterLabel)}</span>
          <div class="me-chip-row" role="group" aria-label="${escapeHtml(copy.taxonFilterLabel)}">${taxonChipsHtml}</div>
        </div>
        <details class="me-filter-drawer">
          <summary class="me-filter-toggle">${escapeHtml(filterToggleLabel)}</summary>
          <div class="me-filter-panel">
            <div class="me-filter-group">
              <span class="me-filter-label">${escapeHtml(ambientLabels.roleLabel)}</span>
              <div class="me-chip-row" role="group" aria-label="${escapeHtml(ambientLabels.roleLabel)}">${roleChipsHtml}</div>
            </div>
            <div class="me-filter-group">
              <span class="me-filter-label">${escapeHtml(actorLabels.actorLabel)}</span>
              <div class="me-chip-row" role="group" aria-label="${escapeHtml(actorLabels.actorLabel)}">${actorChipsHtml}</div>
            </div>
            <div class="me-filter-group">
              <span class="me-filter-label">${escapeHtml(copy.seasonFilterLabel)}</span>
              <div class="me-chip-row" role="group" aria-label="${escapeHtml(copy.seasonFilterLabel)}">${seasonChipsHtml}</div>
            </div>
            <div class="me-filter-group">
              <span class="me-filter-label">${escapeHtml(copy.yearFilterLabel)}</span>
              <div class="me-time-controls">
                <button type="button" class="me-chip me-year-all-chip is-active" id="me-year-all" aria-pressed="true">${escapeHtml(copy.yearAll)}</button>
                <div class="me-time-slider-wrap">
                  <input
                    type="range"
                    id="me-year-range"
                    class="me-year-range"
                    data-year-values="${yearValuesJson}"
                    min="0"
                    max="${Math.max(yearTimelineValues.length - 1, 0)}"
                    value="${Math.max(yearTimelineValues.length - 1, 0)}"
                    aria-label="${escapeHtml(copy.timelineAriaLabel)}"
                  />
                  <div class="me-year-scale" aria-hidden="true">${yearScaleHtml}</div>
                </div>
                <output id="me-year-label" class="me-year-pill">${escapeHtml(copy.yearAll)}</output>
              </div>
            </div>
            <div class="me-filter-group me-basemap-group">
              <span class="me-filter-label">${escapeHtml(copy.basemapLabel)}</span>
              <div class="me-basemap-row" role="group" aria-label="${escapeHtml(copy.basemapLabel)}">${basemapRadiosHtml}</div>
            </div>
            <div class="me-filter-group">
              <label class="me-trace-toggle-label" title="${escapeHtml(lang === "ja" ? "歩いた軌跡を地図に重ねる" : lang === "es" ? "Mostrar rutas recorridas" : lang === "pt-BR" ? "Mostrar trilhas percorridas" : "Show walk traces")}">
                <input type="checkbox" id="me-trace-toggle" class="me-trace-toggle" />
                <span class="me-filter-label">${escapeHtml(lang === "ja" ? "軌跡" : lang === "es" ? "Trazas" : lang === "pt-BR" ? "Trilhas" : "Traces")}</span>
              </label>
            </div>
            <details class="me-region-bar" role="group" aria-label="${escapeHtml(copy.regionFilterLabel)}">
              <summary class="me-region-summary"><span class="me-filter-label">${escapeHtml(copy.regionFilterLabel)}</span><span class="me-region-hint">${escapeHtml(lang === "ja" ? "日本全体 / 静岡市 / 東京 …" : "Japan / Shizuoka / Tokyo …")}</span></summary>
              <div class="me-region-row">${regionChipsHtml}</div>
            </details>
            <details class="me-overlay-panel">
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
            <div class="me-filter-group me-filter-group-actions">
              <a class="me-cross-chip" href="${escapeHtml(lensHref)}" data-kpi-action="map:cross-lens"><span aria-hidden="true">🔍</span>${escapeHtml(copy.crossLensLabel)}</a>
              <a class="me-cross-chip" href="${escapeHtml(notesHref)}" data-kpi-action="map:cross-notes"><span aria-hidden="true">📖</span>${escapeHtml(copy.crossNotesLabel)}</a>
              <button type="button" class="me-share-btn" id="me-share-state">${escapeHtml(copy.shareLabel)}</button>
            </div>
          </div>
        </details>
      </div>
    </div>

    <div class="me-main">
      <aside class="me-side" aria-label="result panel">
        <div class="me-side-head">
          <h3 class="me-side-title">${escapeHtml(listHeading)}</h3>
          <div class="me-side-subtitle" id="me-side-status">${escapeHtml(copy.loading)}</div>
        </div>
        <div class="me-results-list" id="me-results-list" data-testid="map-result-list"></div>
      </aside>
      <div class="me-map-wrap">
        <div id="map-explorer" class="me-map" data-results-pending="0" data-api-cells="${escapeHtml(apiCells)}" data-api-observations="${escapeHtml(apiObservations)}" data-api-site-brief="${escapeHtml(apiSiteBrief)}" data-api-traces="${escapeHtml(apiTraces)}" data-api-frontier="${escapeHtml(apiFrontier)}" data-api-effort-summary="${escapeHtml(apiEffortSummary)}"></div>
        <div class="me-map-panel me-map-panel-selection" id="me-map-selection-card"></div>
        <div class="me-map-panel me-map-panel-insight" id="me-map-insight-card"></div>
        <button type="button" class="me-search-area-btn is-hidden" id="me-search-area-btn">${escapeHtml(searchAreaLabel)}</button>
        <button type="button" class="me-locate-fab" id="me-locate-fab" aria-label="${escapeHtml(copy.locateLabel)}" title="${escapeHtml(copy.locateLabel)}">
          <span aria-hidden="true">📍</span>
        </button>
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
    </div>
  </section>`;
}

export function mapExplorerBootScript(props: { lang: SiteLang; basePath: string }): string {
  const copy = MAP_EXPLORER_COPY[props.lang];
  const ambient = ambientPanelLabels(props.lang);
  const actor = actorPanelLabels(props.lang);
  const noticeCopy = getOfficialNoticeRenderCopy(props.lang);
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
  var sideStatusEl = document.getElementById('me-side-status');
  var resultsListEl = document.getElementById('me-results-list');
  var selectedCardEl = document.getElementById('me-map-selection-card');
  var mapInsightCardEl = document.getElementById('me-map-insight-card');
  var yearRangeEl = document.getElementById('me-year-range');
  var yearLabelEl = document.getElementById('me-year-label');
  var yearAllEl = document.getElementById('me-year-all');
  var shareStateEl = document.getElementById('me-share-state');
  var searchAreaBtnEl = document.getElementById('me-search-area-btn');
  var apiCells = root.getAttribute('data-api-cells') || '';
  var apiObservations = root.getAttribute('data-api-observations') || '';
  var apiSiteBrief = root.getAttribute('data-api-site-brief') || '';
  var apiTraces = root.getAttribute('data-api-traces') || '';
  var apiFrontier = root.getAttribute('data-api-frontier') || '';
  var apiEffortSummary = root.getAttribute('data-api-effort-summary') || '';

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
    siteBriefHeading: copy.siteBriefHeading,
    siteBriefReasonsLabel: copy.siteBriefReasonsLabel,
    siteBriefChecksLabel: copy.siteBriefChecksLabel,
    siteBriefCapturesLabel: copy.siteBriefCapturesLabel,
    siteBriefWhyHereLabel: copy.siteBriefWhyHereLabel,
    siteBriefWhyNowLabel: copy.siteBriefWhyNowLabel,
    siteBriefOneVisitLabel: copy.siteBriefOneVisitLabel,
    siteBriefNextHookLabel: copy.siteBriefNextHookLabel,
    siteBriefLoading: copy.siteBriefLoading,
    siteBriefError: copy.siteBriefError,
    loopHookTravelerFallback: props.lang === "ja" ? "今回の 1 回を、次の寄り道の理由に変える" : props.lang === "es" ? "Convierte esta visita en motivo para volver" : props.lang === "pt-BR" ? "Transforme esta visita em motivo para voltar" : "Turn this one visit into a reason to return",
    loopHookLocalFallback: props.lang === "ja" ? "次にまた見に来る理由を 1 行残す" : props.lang === "es" ? "Deja una razón breve para volver" : props.lang === "pt-BR" ? "Deixe um motivo curto para voltar" : "Leave one short reason to return",
    loopHookLocalPrefix: props.lang === "ja" ? "次は " : props.lang === "es" ? "Lo siguiente: " : props.lang === "pt-BR" ? "Próximo: " : "Next: ",
    searchNoResult: copy.searchNoResult,
    searchError: copy.searchError,
    searchResultSpecies: copy.searchResultSpecies,
    searchResultPlace: copy.searchResultPlace,
    locateError: copy.locateError,
    yearAll: copy.yearAll,
    shareCopied: copy.shareCopied,
    shareError: copy.shareError,
    selfLabel: ambient.selfLabel,
    communityLabel: ambient.communityLabel,
    frontierLabel: ambient.frontierLabel,
    roleCardLabel: ambient.roleCardLabel,
    roleLabel: ambient.roleLabel,
    roleOptions: ambient.roles,
    actorLabel: actor.actorLabel,
    actorOptions: actor.actors,
    actorLensLabel: props.lang === "ja" ? "主体レンズ" : props.lang === "es" ? "Lente elegido" : props.lang === "pt-BR" ? "Lente ativa" : "Active lens",
    actor_all: props.lang === "ja" ? "全体" : props.lang === "es" ? "Todo" : props.lang === "pt-BR" ? "Tudo" : "All",
    actor_local_steward: props.lang === "ja" ? "地元 steward" : props.lang === "es" ? "Cuidador local" : props.lang === "pt-BR" ? "Guardião local" : "Local steward",
    actor_traveler: props.lang === "ja" ? "Traveler" : props.lang === "es" ? "Viajero" : props.lang === "pt-BR" ? "Viajante" : "Traveler",
    actor_casual: props.lang === "ja" ? "Casual" : props.lang === "es" ? "Casual" : props.lang === "pt-BR" ? "Casual" : "Casual",
    actorHint_all: props.lang === "ja" ? "地図全体の frontier を見る" : props.lang === "es" ? "Mirar la frontera total" : props.lang === "pt-BR" ? "Ver a fronteira total" : "Look at the whole frontier",
    actorHint_local_steward: props.lang === "ja" ? "同じ場所を育てる前提で見る" : props.lang === "es" ? "Mirar para volver y cuidar" : props.lang === "pt-BR" ? "Olhar para voltar e cuidar" : "Look as someone who will return",
    actorHint_traveler: props.lang === "ja" ? "一度の訪問で開ける空白を探す" : props.lang === "es" ? "Buscar huecos para una sola visita" : props.lang === "pt-BR" ? "Buscar vazios de visita única" : "Look for gaps to open in one visit",
    actorHint_casual: props.lang === "ja" ? "生活動線の近くで埋められる薄い帯を見る" : props.lang === "es" ? "Ver huecos cercanos a la rutina" : props.lang === "pt-BR" ? "Ver lacunas perto da rotina" : "Look for nearby routine gaps",
    roleHintScan: props.lang === "ja" ? "空白を埋めるなら Scan" : props.lang === "es" ? "Si quieres abrir huecos, usa Escaneo" : props.lang === "pt-BR" ? "Se quer abrir vazios, use Escaneamento" : "Use Scan to open blank areas",
    roleHintGuide: props.lang === "ja" ? "確度を上げるなら Guide" : props.lang === "es" ? "Usa Guía para subir la certeza" : props.lang === "pt-BR" ? "Use Guia para subir a certeza" : "Use Guide to raise certainty",
    roleHintNote: props.lang === "ja" ? "比較可能にするなら Note" : props.lang === "es" ? "Usa Nota para hacer comparables los registros" : props.lang === "pt-BR" ? "Use Nota para tornar comparável" : "Use Note to make it revisitable",
    roleHintMixed: props.lang === "ja" ? "今日は Mixed で小さく前進する" : props.lang === "es" ? "Hoy avanza poco a poco en modo mixto" : props.lang === "pt-BR" ? "Hoje avance em modo misto" : "Use Mixed for a quiet all-round step",
    axis_scan_pass: props.lang === "ja" ? "Scan が薄い" : props.lang === "es" ? "Falta Escaneo" : props.lang === "pt-BR" ? "Falta Scan" : "Scan is thin",
    axis_guide_scene: props.lang === "ja" ? "Guide が薄い" : props.lang === "es" ? "Falta Guía" : props.lang === "pt-BR" ? "Falta Guia" : "Guide is thin",
    axis_revisit_note: props.lang === "ja" ? "Note が薄い" : props.lang === "es" ? "Falta Nota" : props.lang === "pt-BR" ? "Falta Nota" : "Note is thin",
    contributorBand_0: props.lang === "ja" ? "まだ集計なし" : props.lang === "es" ? "Sin agregado aún" : props.lang === "pt-BR" ? "Sem agregado ainda" : "No aggregate yet",
    contributorBand_1_2: props.lang === "ja" ? "1-2人ほど" : props.lang === "es" ? "1-2 personas" : props.lang === "pt-BR" ? "1-2 pessoas" : "about 1-2 people",
    contributorBand_3_5: props.lang === "ja" ? "3-5人ほど" : props.lang === "es" ? "3-5 personas" : props.lang === "pt-BR" ? "3-5 pessoas" : "about 3-5 people",
    contributorBand_6p: props.lang === "ja" ? "6人以上" : props.lang === "es" ? "6 o más" : props.lang === "pt-BR" ? "6 ou mais" : "6+ people",
    winsLabel: props.lang === "ja" ? "前進" : props.lang === "es" ? "Avances" : props.lang === "pt-BR" ? "Avanços" : "wins",
    revisitLabel: props.lang === "ja" ? "再訪地点" : props.lang === "es" ? "Revisitas" : props.lang === "pt-BR" ? "Revisitas" : "revisits",
    communityStrengthLabel: props.lang === "ja" ? "最近厚くなった帯" : props.lang === "es" ? "Áreas reforzadas" : props.lang === "pt-BR" ? "Faixas fortalecidas" : "strengthened bands",
    communityProgressLabel: props.lang === "ja" ? "共同前進" : props.lang === "es" ? "Progreso colectivo" : props.lang === "pt-BR" ? "Progresso coletivo" : "collective progress",
    aggregateContributorLabel: props.lang === "ja" ? "集計された記録者" : props.lang === "es" ? "personas agregadas" : props.lang === "pt-BR" ? "pessoas agregadas" : "aggregated contributors",
    frontierBlankLabel: props.lang === "ja" ? "薄い帯" : props.lang === "es" ? "bandas vacías" : props.lang === "pt-BR" ? "faixas vazias" : "blank bands",
    frontierBuildingLabel: props.lang === "ja" ? "育ち始め" : props.lang === "es" ? "en construcción" : props.lang === "pt-BR" ? "em construção" : "building",
    frontierRepeatableLabel: props.lang === "ja" ? "比較可能" : props.lang === "es" ? "comparables" : props.lang === "pt-BR" ? "comparáveis" : "repeatable",
    frontierMatureLabel: props.lang === "ja" ? "厚い帯" : props.lang === "es" ? "maduras" : props.lang === "pt-BR" ? "maduras" : "mature",
    campaign_scan_blank: props.lang === "ja" ? "空白帯をひとつ開く" : props.lang === "es" ? "Abrir una banda vacía" : props.lang === "pt-BR" ? "Abrir uma faixa vazia" : "Open one blank band",
    campaign_guide_building: props.lang === "ja" ? "育ち始めの場所の確度を上げる" : props.lang === "es" ? "Subir la certeza de zonas en crecimiento" : props.lang === "pt-BR" ? "Aumentar a certeza das zonas em crescimento" : "Raise certainty in building areas",
    campaign_note_repeatable: props.lang === "ja" ? "比較できる場所をもう一段厚くする" : props.lang === "es" ? "Hacer más densa una zona repetible" : props.lang === "pt-BR" ? "Tornar mais espessa uma zona repetível" : "Thicken one repeatable area",
    campaign_mixed_frontier: props.lang === "ja" ? "静かに frontier を前に進める" : props.lang === "es" ? "Empujar la frontera con calma" : props.lang === "pt-BR" ? "Avançar a fronteira com calma" : "Quietly move the frontier forward",
    priorityCueLabel: props.lang === "ja" ? "priority" : props.lang === "es" ? "prioridad" : props.lang === "pt-BR" ? "prioridade" : "priority",
    priority_steady_revisit: props.lang === "ja" ? "再訪で厚くする" : props.lang === "es" ? "Engrosar con revisitas" : props.lang === "pt-BR" ? "Espessar com revisitas" : "Thicken by revisiting",
    priority_fresh_gap: props.lang === "ja" ? "新しい空白を開く" : props.lang === "es" ? "Abrir un hueco nuevo" : props.lang === "pt-BR" ? "Abrir um vazio novo" : "Open a fresh gap",
    priority_nearby_gap: props.lang === "ja" ? "近場の薄い帯を埋める" : props.lang === "es" ? "Cubrir huecos cercanos" : props.lang === "pt-BR" ? "Cobrir lacunas próximas" : "Fill a nearby thin band",
    remainingLabel: props.lang === "ja" ? "残り frontier" : props.lang === "es" ? "fronteras restantes" : props.lang === "pt-BR" ? "fronteiras restantes" : "frontier left",
    aggregateModeNote: props.lang === "ja" ? "他ユーザー個別ではなく、地域の集計だけを表示中" : props.lang === "es" ? "Solo agregados del área, no personas concretas" : props.lang === "pt-BR" ? "Somente agregados da área, sem pessoas específicas" : "Area aggregate only, no individual people shown",
    searchArea: props.lang === "ja" ? "この範囲で再検索" : props.lang === "es" ? "Buscar en esta área" : props.lang === "pt-BR" ? "Buscar nesta área" : "Search this area",
    resultHeading: props.lang === "ja" ? "この範囲の観察" : props.lang === "es" ? "Observaciones en esta área" : props.lang === "pt-BR" ? "Observações nesta área" : "Observations in this area",
    resultCountLabel: props.lang === "ja" ? "件を表示中" : props.lang === "es" ? "resultados visibles" : props.lang === "pt-BR" ? "resultados visíveis" : "results visible",
    movedHint: props.lang === "ja" ? "地図を動かした。結果を更新するには押す。" : props.lang === "es" ? "Moviste el mapa. Pulsa para actualizar resultados." : props.lang === "pt-BR" ? "Você moveu o mapa. Toque para atualizar." : "Map moved. Press to refresh results.",
    selectHint: props.lang === "ja" ? "エリアか一覧を選ぶと、ここに写真と次の行動が出る。" : props.lang === "es" ? "Elige un área o una fila para ver foto y siguiente acción." : props.lang === "pt-BR" ? "Escolha uma área ou item para ver foto e próxima ação." : "Pick an area or row to see the photo and next action.",
    placeHint: props.lang === "ja" ? "地図を押すと、その地点の仮説と次の行動をここに出す。" : props.lang === "es" ? "Toca el mapa para ver la hipótesis del lugar y la siguiente acción." : props.lang === "pt-BR" ? "Toque no mapa para ver a hipótese do lugar e a próxima ação." : "Tap the map to see the place hypothesis and next action.",
    selectedCardLabel: props.lang === "ja" ? "詳細を見る" : props.lang === "es" ? "Ver detalle" : props.lang === "pt-BR" ? "Ver detalhes" : "Open detail",
    identifyLabel: props.lang === "ja" ? "同定する" : props.lang === "es" ? "Identificar" : props.lang === "pt-BR" ? "Identificar" : "Identify",
    selectedFieldLabel: props.lang === "ja" ? "この場所で次に見る" : props.lang === "es" ? "Qué mirar aquí" : props.lang === "pt-BR" ? "O que ver aqui" : "What to look for here",
    selectedRoleLead: props.lang === "ja" ? "次は" : props.lang === "es" ? "Siguiente" : props.lang === "pt-BR" ? "Próximo" : "Next",
    selectionObservationLabel: props.lang === "ja" ? "選択中の観察" : props.lang === "es" ? "Observación seleccionada" : props.lang === "pt-BR" ? "Observação selecionada" : "Selected observation",
    selectionPlaceLabel: props.lang === "ja" ? "この地点の place card" : props.lang === "es" ? "Tarjeta del lugar" : props.lang === "pt-BR" ? "Cartão do lugar" : "Place card",
    insightHeading: props.lang === "ja" ? "静かな前進" : props.lang === "es" ? "Progreso tranquilo" : props.lang === "pt-BR" ? "Progresso calmo" : "Quiet progress",
    insightSubhead: props.lang === "ja" ? "この viewport の厚みを一目で見る。" : props.lang === "es" ? "Cómo de densa está esta ventana." : props.lang === "pt-BR" ? "Quanto esta janela já acumulou." : "How this viewport is stacking up.",
  })};
  ${MAP_EXPLORER_STATE_RUNTIME}
  var SEARCH_LANG = ${JSON.stringify(props.lang)};
  var YEAR_VALUES = [];
  try {
    YEAR_VALUES = JSON.parse((yearRangeEl && yearRangeEl.getAttribute('data-year-values')) || '[]');
  } catch (_) { YEAR_VALUES = []; }
  var OBSERVATION_HREF_TPL = ${JSON.stringify(observationHrefTpl)};
  var RECORD_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/record"), props.lang))};
  var NOTES_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/notes"), props.lang))};
  var LENS_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang))};
  ${buildOfficialNoticeClientRenderer("renderMapOfficialNotices", noticeCopy, { kpiNamespace: "map" })}

  var MAPLIBRE_CSS_SRI = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
  var MAPLIBRE_JS_SRI  = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
  var MAPLIBRE_CSS_PRIMARY = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  var MAPLIBRE_CSS_FALLBACK = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  var MAPLIBRE_JS_PRIMARY = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  var MAPLIBRE_JS_FALLBACK = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  if (!document.querySelector('link[data-maplibre="1"]')) {
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = MAPLIBRE_CSS_PRIMARY;
    link.integrity = MAPLIBRE_CSS_SRI; link.crossOrigin = 'anonymous';
    link.referrerPolicy = 'no-referrer'; link.setAttribute('data-maplibre', '1');
    link.onerror = function () {
      if (link.getAttribute('data-fallback') === '1') return;
      link.setAttribute('data-fallback', '1');
      link.href = MAPLIBRE_CSS_FALLBACK;
    };
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

  var overlayCatalog = [];
  try {
    var catalogEl = document.querySelector('.me-overlay-list');
    if (catalogEl) overlayCatalog = JSON.parse(catalogEl.getAttribute('data-overlay-catalog') || '[]');
  } catch (_) { overlayCatalog = []; }
  var overlayState = {};
  overlayCatalog.forEach(function (o) { overlayState[o.id] = { enabled: false, opacity: o.defaultOpacity }; });

  var state = {
    tab: 'markers',
    role: 'mixed',
    actorClass: 'all',
    markerProfile: 'all_research_artifacts',
    taxonGroup: '',
    year: '',
    season: '',
    basemap: 'standard',
    tracesVisible: false,
    map: null,
    features: [],
    records: [],
    frontier: null,
    effortSummary: null,
    selectedOccurrenceId: null,
    selectedCellId: null,
    selectedPoint: null,
    lastStats: null,
    lastCellStats: null,
    lastSearchedBbox: '',
    pendingViewportSearch: false,
    ignoreNextMoveEnd: false,
    lastAbort: null,
    recordAbort: null,
    frontierAbort: null,
    effortAbort: null,
    _cellsRequestSeq: 0,
    _cellsAppliedSeq: 0,
    _recordsRequestSeq: 0,
    _recordsAppliedSeq: 0,
    _restoredCenter: null,
    _restoredZoom: null,
    _restoredCellId: null,
    _fittedOnce: false,
    _meMarker: null,
  };

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ''; }
  function setStatusMeta(meta) { if (statusEl) statusEl.title = meta || ''; }
  function formatYearLabel(year) { return year ? String(year) : COPY.yearAll; }
  function syncYearUi() {
    if (yearLabelEl) yearLabelEl.textContent = formatYearLabel(state.year);
    if (yearAllEl) {
      var allActive = !state.year;
      yearAllEl.classList.toggle('is-active', allActive);
      yearAllEl.setAttribute('aria-pressed', allActive ? 'true' : 'false');
    }
    if (yearRangeEl) {
      if (!YEAR_VALUES.length) {
        yearRangeEl.disabled = true;
        return;
      }
      yearRangeEl.disabled = false;
      var fallbackIndex = YEAR_VALUES.length - 1;
      var selectedIndex = state.year ? YEAR_VALUES.indexOf(Number(state.year)) : fallbackIndex;
      yearRangeEl.value = String(selectedIndex >= 0 ? selectedIndex : fallbackIndex);
    }
  }
  function recordNameVariants(record) {
    return [record && record.displayName]
      .filter(Boolean)
      .map(function (value) { return String(value); });
  }
  function maxZoomForGrid(gridM) {
    if (!isFinite(gridM) || gridM <= 1000) return 13.2;
    if (gridM <= 3000) return 11.8;
    return 10.1;
  }
  function fitToCellSet(features, options) {
    if (!state.map || !features || !features.length) return;
    var bounds = new window.maplibregl.LngLatBounds();
    features.forEach(function (feature) {
      var ring = feature && feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates[0] : null;
      if (!ring || !ring.length) return;
      ring.forEach(function (coord) { bounds.extend(coord); });
    });
    var single = features.length === 1 ? features[0] : null;
    var maxZoom = single && single.properties ? maxZoomForGrid(Number(single.properties.gridM)) : 12.2;
    if (!bounds.isEmpty()) state.map.fitBounds(bounds, { padding: 56, maxZoom: maxZoom, duration: 520 });
  }
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

  function fmtProvenanceMeta(stats) {
    if (!stats || !stats.provenance) return '';
    var visible = stats.provenance.visible || {};
    var excluded = stats.provenance.excluded || {};
    var sampleLabel = stats.provenance.sampled ? ('sample ' + String(stats.provenance.sampleSize || 0)) : 'full';
    return [
      'profile=' + String(stats.markerProfile || 'all_research_artifacts'),
      'visible manual=' + String(visible.manual || 0),
      'legacy=' + String(visible.legacy || 0),
      'track=' + String(visible.track || 0),
      'other=' + String(visible.other || 0),
      'excluded legacy=' + String(excluded.legacy || 0),
      'track=' + String(excluded.track || 0),
      'other=' + String(excluded.other || 0),
      sampleLabel,
    ].join(' | ');
  }

  function shouldUseBottomSheet() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  }

  function updateSearchAreaUi() {
    if (!searchAreaBtnEl) return;
    searchAreaBtnEl.classList.toggle('is-hidden', !state.pendingViewportSearch);
    searchAreaBtnEl.textContent = state.pendingViewportSearch ? COPY.searchArea : COPY.searchArea;
  }

  function hasPendingMapResults() {
    return state._cellsRequestSeq !== state._cellsAppliedSeq || state._recordsRequestSeq !== state._recordsAppliedSeq;
  }

  function updatePendingMapResultsState() {
    var pending = hasPendingMapResults();
    if (root) root.setAttribute('data-results-pending', pending ? '1' : '0');
    if (root) root.setAttribute('aria-busy', pending ? 'true' : 'false');
    if (resultsListEl) resultsListEl.setAttribute('aria-busy', pending ? 'true' : 'false');
  }

  updatePendingMapResultsState();

  function contributorBandLabel(band) {
    if (band === '1-2') return COPY.contributorBand_1_2;
    if (band === '3-5') return COPY.contributorBand_3_5;
    if (band === '6+') return COPY.contributorBand_6p;
    return COPY.contributorBand_0;
  }

  function progressPercent(value) {
    return Math.round(Math.max(0, Math.min(1, Number(value || 0))) * 100);
  }

  function axisLabel(axis) {
    return COPY[axis ? ('axis_' + axis) : 'axis_scan_pass'] || axis || '—';
  }

  function roleHintLabel(role) {
    if (role === 'scan') return COPY.roleHintScan;
    if (role === 'guide') return COPY.roleHintGuide;
    if (role === 'note') return COPY.roleHintNote;
    return COPY.roleHintMixed;
  }

  function actorLabel(actorClass) {
    return COPY['actor_' + actorClass] || COPY.actor_all;
  }

  function actorHintLabel(actorClass) {
    return COPY['actorHint_' + actorClass] || COPY.actorHint_all;
  }

  function priorityCueLabel(priorityCue) {
    return COPY['priority_' + priorityCue] || COPY.priority_fresh_gap;
  }

  function roleLabel(role) {
    var opts = Array.isArray(COPY.roleOptions) ? COPY.roleOptions : [];
    for (var i = 0; i < opts.length; i += 1) {
      if (opts[i] && opts[i].value === role) return opts[i].label;
    }
    return role;
  }

  function renderSidePanels() {
    if (!mapInsightCardEl) return;
    if (shouldUseBottomSheet()) {
      mapInsightCardEl.innerHTML = '';
      mapInsightCardEl.classList.remove('is-visible');
      return;
    }
    if (getSelectedContext()) {
      mapInsightCardEl.innerHTML = '';
      mapInsightCardEl.classList.remove('is-visible');
      return;
    }
    var summary = state.effortSummary;
    if (!summary) {
      mapInsightCardEl.innerHTML =
        '<div class="me-map-card me-map-card-quiet">' +
          '<div class="me-map-card-head">' +
            '<div>' +
              '<div class="me-map-card-kicker">' + escapeHtml(COPY.insightHeading) + '</div>' +
              '<strong class="me-map-card-title">' + escapeHtml(COPY.insightHeading) + '</strong>' +
              '<span class="me-map-card-copy">' + escapeHtml(COPY.insightSubhead) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="me-map-insight-grid">' +
            '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.loading) + '</span><strong>—</strong><span>…</span></div>' +
          '</div>' +
        '</div>';
      mapInsightCardEl.classList.add('is-visible');
      return;
    }

    var ownCell = summary.myProgress
      ? '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.selfLabel) + '</span><strong>' + summary.myProgress.winCount + ' ' + escapeHtml(COPY.winsLabel) + '</strong><span>' + escapeHtml(roleHintLabel(summary.myProgress.focusRole)) + ' · ' + summary.myProgress.revisitCount + ' ' + escapeHtml(COPY.revisitLabel) + '</span></div>'
      : '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.selfLabel) + '</span><strong>' + escapeHtml(roleHintLabel('mixed')) + '</strong><span>' + escapeHtml(COPY.aggregateModeNote) + '</span></div>';
    var actorCell =
      '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.actorLensLabel) + '</span><strong>' + escapeHtml(actorLabel(summary.actorLens.actorClass)) + '</strong><span>' + escapeHtml(actorHintLabel(summary.actorLens.actorClass)) + ' · ' + String(summary.actorLens.matchingContributorCount) + '</span></div>';
    var communityCell =
      '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.communityLabel) + '</span><strong>' + summary.communityProgress.activeCellCount + '</strong><span>' + escapeHtml(contributorBandLabel(summary.communityProgress.contributorBand)) + ' · ' + progressPercent(summary.communityProgress.progressRatio) + '%</span></div>';
    var frontierCell =
      '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.frontierLabel) + '</span><strong>' + summary.frontierRemaining.blankCount + ' / ' + summary.frontierRemaining.buildingCount + '</strong><span>' + escapeHtml(summary.frontierRemaining.topMissingAxes.map(axisLabel).join(' · ') || '—') + ' · ' + escapeHtml(priorityCueLabel(summary.frontierRemaining.priorityCue)) + '</span></div>';
    var nextCell =
      '<div class="me-map-insight-item"><span class="me-map-insight-label">' + escapeHtml(COPY.roleCardLabel) + '</span><strong>' + escapeHtml(roleHintLabel(summary.campaignProgress.recommendedRole)) + '</strong><span>' + escapeHtml(priorityCueLabel(summary.campaignProgress.priorityCue)) + ' · ' + summary.campaignProgress.remainingCount + ' ' + escapeHtml(COPY.remainingLabel) + '</span></div>';

    mapInsightCardEl.innerHTML =
      '<div class="me-map-card me-map-card-quiet">' +
        '<div class="me-map-card-head">' +
          '<div>' +
            '<div class="me-map-card-kicker">' + escapeHtml(COPY.insightHeading) + '</div>' +
            '<strong class="me-map-card-title">' + escapeHtml(COPY.insightHeading) + '</strong>' +
            '<span class="me-map-card-copy">' + escapeHtml(COPY.insightSubhead) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="me-map-insight-grid">' +
          ownCell +
          actorCell +
          communityCell +
          frontierCell +
          nextCell +
        '</div>' +
      '</div>';
    mapInsightCardEl.classList.add('is-visible');
  }

  function findCellFeatureById(cellId) {
    if (!cellId) return null;
    for (var i = 0; i < state.features.length; i += 1) {
      var feature = state.features[i];
      if (feature && feature.properties && feature.properties.cellId === cellId) return feature;
    }
    return null;
  }

  function getSelectedCellFeature() {
    return findCellFeatureById(state.selectedCellId);
  }

  function getSelectedRecord() {
    if (!state.selectedOccurrenceId) return null;
    for (var i = 0; i < state.records.length; i += 1) {
      var record = state.records[i];
      if (record && record.occurrenceId === state.selectedOccurrenceId) return record;
    }
    return null;
  }

  function cellCenter(feature) {
    var p = feature && feature.properties ? feature.properties : {};
    return {
      lat: Number(p.centroidLat),
      lng: Number(p.centroidLng),
    };
  }

  function getSelectedContext() {
    if (state.selectedPoint && state.selectedPoint.kind === 'place') return state.selectedPoint;
    var cellFeature = getSelectedCellFeature();
    var record = getSelectedRecord();
    if (record && cellFeature) {
      var center = cellCenter(cellFeature);
      return {
        lat: center.lat,
        lng: center.lng,
        kind: 'observation',
        cellFeature: cellFeature,
        record: record,
      };
    }
    if (cellFeature) {
      var cell = cellCenter(cellFeature);
      return {
        lat: cell.lat,
        lng: cell.lng,
        kind: 'cell',
        cellFeature: cellFeature,
      };
    }
    if (state.selectedPoint && (state.selectedPoint.kind === 'observation' || state.selectedPoint.kind === 'cell')) {
      return state.selectedPoint;
    }
    return null;
  }

  function renderResultList() {
    if (!resultsListEl || !sideStatusEl) return;
    var records = Array.isArray(state.records) ? state.records : [];
    var totalAll = state.lastStats && Number.isFinite(state.lastStats.totalAll) ? state.lastStats.totalAll : records.length;
    if (!records.length) {
      sideStatusEl.textContent = COPY.empty;
      resultsListEl.innerHTML = '<div class="me-results-empty">' + escapeHtml(COPY.empty) + '</div>';
      return;
    }
    sideStatusEl.textContent = records.length + ' ' + COPY.resultCountLabel + ' · ' + totalAll;
    resultsListEl.innerHTML = records.slice(0, 120).map(function (record) {
      var active = record.occurrenceId === state.selectedOccurrenceId;
      var date = record.observedAt ? String(record.observedAt).slice(0, 10) : '';
      var thumb = record.photoUrl
        ? '<img class="me-result-thumb" src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" width="92" height="92" loading="lazy" decoding="async" fetchpriority="low" onerror="this.outerHTML=&quot;<div class=\\&quot;me-result-thumb me-result-thumb-placeholder\\&quot;>\ud83c\udf3f</div>&quot;" />'
        : '<div class="me-result-thumb me-result-thumb-placeholder">🌿</div>';
      var displayLabel = record.displayName || '同定待ち';
      var speciesBadge = record.isAwaitingId
        ? '<span class="me-result-awaiting">同定待ち</span>'
        : record.isAiCandidate
          ? '<span class="me-result-ai">AI候補</span><strong>' + escapeHtml(displayLabel) + '</strong>'
          : '<strong>' + escapeHtml(displayLabel) + '</strong>';
      return '<button type="button" class="me-result-row' + (active ? ' is-active' : '') + '" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '">' +
        thumb +
        '<span class="me-result-body">' +
          speciesBadge +
          '<span>' + escapeHtml(record.localityLabel || '—') + '</span>' +
          (date ? '<span>' + escapeHtml(date) + '</span>' : '') +
        '</span>' +
      '</button>';
    }).join('');
    resultsListEl.querySelectorAll('.me-result-row').forEach(function (rowEl) {
      rowEl.addEventListener('click', function () {
        if (hasPendingMapResults()) return;
        var occurrenceId = rowEl.getAttribute('data-occurrence-id');
        var record = state.records.find(function (item) {
          return item && item.occurrenceId === occurrenceId;
        });
        if (!record) return;
        selectRecord(record, { focusMap: true, openSheet: shouldUseBottomSheet() });
      });
    });
  }

  function renderSelectedCard() {
    if (!selectedCardEl) return;
    if (shouldUseBottomSheet()) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      return;
    }
    var context = getSelectedContext();
    if (!context) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      return;
    }
    if (context.kind === 'place') {
      var seq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<div class="me-map-card">' +
          '<div class="me-map-card-head">' +
            '<div>' +
              '<div class="me-map-card-kicker">' + escapeHtml(COPY.selectionPlaceLabel) + '</div>' +
              '<strong class="me-map-card-title">' + escapeHtml(COPY.selectedFieldLabel) + '</strong>' +
              '<span class="me-map-card-copy">' + escapeHtml(context.lat.toFixed(4) + ', ' + context.lng.toFixed(4)) + '</span>' +
            '</div>' +
          '</div>' +
          '<div id="me-selected-brief-slot" class="me-site-brief-slot is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</div>' +
          renderPlaceActions() +
          '<div id="me-selected-ambient-slot" class="me-selected-ambient">' + renderSheetAmbient(context) + '</div>' +
        '</div>';
      selectedCardEl.classList.add('is-visible');
      fetchSiteBrief(context.lat, context.lng, seq, document.getElementById('me-selected-brief-slot'));
      return;
    }
    if (context.kind === 'cell') {
      var feature = context.cellFeature;
      var cellProps = feature && feature.properties ? feature.properties : {};
      var countLabel = Number(cellProps.count || 0) + ' ' + COPY.resultCountLabel;
      var latest = cellProps.latestObservedAt ? String(cellProps.latestObservedAt).slice(0, 10) : '';
      var cellSeq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<div class="me-map-card">' +
          '<div class="me-map-card-head">' +
            '<div>' +
              '<div class="me-map-card-kicker">' + escapeHtml(COPY.selectionPlaceLabel) + '</div>' +
              '<strong class="me-map-card-title">' + escapeHtml(cellProps.label || '—') + '</strong>' +
              '<span class="me-map-card-copy">' + escapeHtml(countLabel) + (latest ? ' · ' + escapeHtml(latest) : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div id="me-selected-brief-slot" class="me-site-brief-slot is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</div>' +
          renderPlaceActions() +
          '<div id="me-selected-ambient-slot" class="me-selected-ambient">' + renderSheetAmbient(context) + '</div>' +
        '</div>';
      selectedCardEl.classList.add('is-visible');
      fetchSiteBrief(context.lat, context.lng, cellSeq, document.getElementById('me-selected-brief-slot'));
      return;
    }
    var record = context.record || getSelectedRecord();
    if (!record) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      return;
    }
    var photo = record.photoUrl
      ? '<img class="me-selected-photo" src="' + escapeHtml(toThumbUrl(record.photoUrl, 'md')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />'
      : '';
    var href = OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId));
    var identifyHref = href + '#identify';
    selectedCardEl.innerHTML =
      '<div class="me-map-card">' +
        photo +
        '<div class="me-map-card-head">' +
          '<div>' +
            '<div class="me-map-card-kicker">' + escapeHtml(COPY.selectionObservationLabel) + (record.isAiCandidate ? ' · <span class="me-map-card-ai">AI候補</span>' : record.isAwaitingId ? ' · <span class="me-map-card-awaiting">同定待ち</span>' : '') + '</div>' +
            '<strong class="me-map-card-title">' + escapeHtml(record.displayName || '同定待ち') + '</strong>' +
            '<span class="me-map-card-copy">' + escapeHtml(record.localityLabel || '—') + (record.observedAt ? ' · ' + escapeHtml(String(record.observedAt).slice(0, 10)) : '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="me-selected-actions">' +
          '<a class="btn btn-solid" href="' + href + '">' + escapeHtml(COPY.selectedCardLabel) + '</a>' +
          '<a class="inline-link" href="' + identifyHref + '">' + escapeHtml(COPY.identifyLabel) + '</a>' +
          '<a class="inline-link" href="' + RECORD_HREF + '">' + escapeHtml(COPY.bottomSheetRecord) + '</a>' +
        '</div>' +
        '<div id="me-selected-ambient-slot" class="me-selected-ambient">' + renderSheetAmbient(context) + '</div>' +
      '</div>';
    selectedCardEl.classList.add('is-visible');
  }

  function refreshSelectedAmbient() {
    var slot = document.getElementById('me-selected-ambient-slot');
    var context = getSelectedContext();
    if (!slot || !context) return;
    slot.innerHTML = renderSheetAmbient(context);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toThumbUrl(url, preset) {
    if (!url) return url;
    var m = /^\\/(uploads|data\\/uploads)\\/(.+\\.(?:jpe?g|png|webp|gif))$/i.exec(url);
    if (!m) return url;
    return '/thumb/' + preset + '/' + m[2];
  }

  // Track the latest Site Brief fetch so older requests can't paint over a
  // newer one when the user taps around quickly.
  var siteBriefSeq = 0;

  function renderSiteBriefCard(brief) {
    if (!brief || !brief.hypothesis) {
      return '<div class="me-site-brief me-site-brief-error">' + escapeHtml(COPY.siteBriefError) + '</div>';
    }
    var h = brief.hypothesis;
    var confPct = Math.round((h.confidence || 0) * 100);
    var reasons = (brief.reasons || []).map(function (r) {
      return '<li>' + escapeHtml(r) + '</li>';
    }).join('');
    var checks = (brief.checks || []).map(function (c) {
      return '<li>' + escapeHtml(c) + '</li>';
    }).join('');
    var caps = (brief.captureHints || []).map(function (c) {
      return '<li>' + escapeHtml(c) + '</li>';
    }).join('');
    var notices = renderMapOfficialNotices(brief.officialNotices || []);
    var context = getSelectedContext();
    var frontier = context ? findFrontierAt(context.lng, context.lat) : null;
    var missingAxes = frontier && frontier.properties && Array.isArray(frontier.properties.missingAxes)
      ? frontier.properties.missingAxes.map(axisLabel).join(' · ')
      : '';
    var whyHere = (brief.reasons && brief.reasons[0]) || h.label;
    var whyNow = frontier && frontier.properties
      ? priorityCueLabel(frontier.properties.priorityCue)
      : (brief.checks && brief.checks[0]) || h.label;
    var oneVisit = frontier && frontier.properties
      ? roleHintLabel(frontier.properties.recommendedRole) + (missingAxes ? ' · ' + missingAxes : '')
      : (brief.captureHints && brief.captureHints[0]) || h.label;
    var nextHook = state.effortSummary && state.effortSummary.actorLens && state.effortSummary.actorLens.actorClass === 'traveler'
      ? (frontier && frontier.properties
          ? priorityCueLabel(frontier.properties.priorityCue) + (missingAxes ? ' · ' + missingAxes : '')
          : COPY.loopHookTravelerFallback)
      : (frontier && frontier.properties
          ? COPY.loopHookLocalPrefix + priorityCueLabel(frontier.properties.priorityCue)
          : COPY.loopHookLocalFallback);
    var loopCards = [
      { label: COPY.siteBriefWhyHereLabel, body: whyHere },
      { label: COPY.siteBriefWhyNowLabel, body: whyNow },
      { label: COPY.siteBriefOneVisitLabel, body: oneVisit },
      { label: COPY.siteBriefNextHookLabel, body: nextHook },
    ].map(function (item) {
      return '<div class="me-site-brief-loop-card"><div class="me-site-brief-loop-label">' + escapeHtml(item.label) + '</div><div class="me-site-brief-loop-body">' + escapeHtml(item.body) + '</div></div>';
    }).join('');
    return '<div class="me-site-brief">' +
      '<div class="me-site-brief-head">' +
        '<span class="me-site-brief-label">' + escapeHtml(h.label) + '</span>' +
        '<span class="me-site-brief-conf" title="confidence">' + confPct + '%</span>' +
      '</div>' +
      '<div class="me-site-brief-loop-grid">' + loopCards + '</div>' +
      '<div class="me-site-brief-heading">' + escapeHtml(COPY.siteBriefHeading) + '</div>' +
      (checks ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefChecksLabel) + '</div><ul>' + checks + '</ul></div>' : '') +
      (reasons ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefReasonsLabel) + '</div><ul class="me-site-brief-reasons">' + reasons + '</ul></div>' : '') +
      (caps ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefCapturesLabel) + '</div><ul>' + caps + '</ul></div>' : '') +
      '</div>' + notices;
  }

  function fetchSiteBrief(lat, lng, seq, target) {
    if (!apiSiteBrief) return;
    var url = apiSiteBrief + '?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng) + '&lang=' + encodeURIComponent(SEARCH_LANG === 'en' ? 'en' : 'ja');
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (brief) {
        if (seq !== siteBriefSeq) return; // stale
        if (!target) return;
        target.classList.remove('is-loading');
        target.innerHTML = renderSiteBriefCard(brief);
      })
      .catch(function () {
        if (seq !== siteBriefSeq || !target) return;
        target.classList.remove('is-loading');
        target.innerHTML = '<div class="me-site-brief me-site-brief-error">' + escapeHtml(COPY.siteBriefError) + '</div>';
      });
  }

  function renderObservationActions(record) {
    var photo = record.photoUrl ? '<img class="me-bottom-photo" src="' + escapeHtml(toThumbUrl(record.photoUrl, 'md')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />' : '';
    var href = OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId));
    var identifyHref = href + '#identify';
    var bottomBadge = record.isAiCandidate
      ? '<span class="me-result-ai">AI候補</span>'
      : record.isAwaitingId
        ? '<span class="me-result-awaiting">同定待ち</span>'
        : '';
    var bottomName = record.isAwaitingId ? '' : '<strong>' + escapeHtml(record.displayName) + '</strong>';
    return photo +
      '<div class="me-bottom-meta">' +
      bottomBadge + bottomName +
      '<span>' + escapeHtml(record.localityLabel || '—') + '</span>' +
      (record.observedAt ? '<span>' + escapeHtml(String(record.observedAt).slice(0, 10)) + '</span>' : '') +
      '</div>' +
      '<div class="me-bottom-actions">' +
        '<a class="btn btn-solid" href="' + href + '">' + escapeHtml(COPY.popupOpenLabel) + '</a>' +
      '<a class="inline-link" href="' + identifyHref + '">' + escapeHtml(COPY.identifyLabel) + '</a>' +
      '<a class="inline-link" href="' + NOTES_HREF + '">' + escapeHtml(COPY.bottomSheetNotes) + '</a>' +
      '<a class="inline-link" href="' + RECORD_HREF + '">' + escapeHtml(COPY.bottomSheetRecord) + '</a>' +
      '</div>';
  }

  function renderPlaceActions() {
    // No observation context — take the user to act now or review their own notes.
    return '<div class="me-bottom-actions">' +
      '<a class="btn btn-solid" href="' + RECORD_HREF + '">' + escapeHtml(COPY.bottomSheetRecord) + '</a>' +
      '<a class="inline-link" href="' + LENS_HREF + '">' + escapeHtml(COPY.bottomSheetLens) + '</a>' +
      '<a class="inline-link" href="' + NOTES_HREF + '">' + escapeHtml(COPY.bottomSheetNotes) + '</a>' +
      '</div>';
  }

  function findFrontierAt(lng, lat) {
    if (!state.frontier || !Array.isArray(state.frontier.features)) return null;
    for (var i = 0; i < state.frontier.features.length; i += 1) {
      var feature = state.frontier.features[i];
      var ring = feature && feature.geometry && feature.geometry.coordinates ? feature.geometry.coordinates[0] : null;
      if (!ring || !ring[0] || !ring[2]) continue;
      var minLng = Number(ring[0][0]);
      var minLat = Number(ring[0][1]);
      var maxLng = Number(ring[2][0]);
      var maxLat = Number(ring[2][1]);
      if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) return feature;
    }
    return null;
  }

  function renderSheetAmbient(context) {
    if (!context) return '';
    var frontier = findFrontierAt(context.lng, context.lat);
    var items = [];
    if (frontier) {
      items.push('<div class="me-sheet-card"><strong>' + escapeHtml(roleHintLabel(frontier.properties.recommendedRole)) + '</strong><span>' + escapeHtml((frontier.properties.missingAxes || []).map(axisLabel).join(' · ') || '—') + ' · ' + escapeHtml(priorityCueLabel(frontier.properties.priorityCue)) + '</span></div>');
      items.push('<div class="me-sheet-card"><strong>' + escapeHtml(COPY.communityProgressLabel) + ' ' + progressPercent(frontier.properties.communityGain) + '%</strong><span>' + frontier.properties.contributorCount + ' ' + escapeHtml(COPY.aggregateContributorLabel) + '</span></div>');
    }
    if (state.effortSummary && state.effortSummary.campaignProgress) {
      items.push('<div class="me-sheet-card"><strong>' + escapeHtml(actorLabel(state.effortSummary.actorLens.actorClass)) + '</strong><span>' + escapeHtml(COPY['campaign_' + state.effortSummary.campaignProgress.labelKey]) + ' · ' + escapeHtml(priorityCueLabel(state.effortSummary.campaignProgress.priorityCue)) + '</span></div>');
    }
    if (!items.length) return '';
    return '<div class="me-sheet-ambient">' + items.join('') + '</div>';
  }

  function refreshSheetAmbient() {
    if (!sheetInnerEl || !state.selectedPoint) return;
    var slot = document.getElementById('me-sheet-ambient-slot');
    if (!slot) return;
    slot.innerHTML = renderSheetAmbient(state.selectedPoint);
  }

  function focusCellFeature(feature) {
    if (!state.map || !feature) return;
    state.ignoreNextMoveEnd = true;
    fitToCellSet([feature], { openSheet: false });
  }

  function highlightSelectedCell() {
    if (!state.map) return;
    var filter = state.selectedCellId
      ? ['==', ['get', 'cellId'], state.selectedCellId]
      : ['==', ['get', 'cellId'], '__none__'];
    ['observation-cell-selected', 'obs-cell-heat-selected'].forEach(function (layerId) {
      if (state.map.getLayer(layerId)) state.map.setFilter(layerId, filter);
    });
  }

  function selectCell(feature, options) {
    if (!feature || !feature.properties) return;
    state.selectedCellId = feature.properties.cellId || null;
    state._restoredCellId = null;
    state.selectedOccurrenceId = null;
    var center = cellCenter(feature);
    state.selectedPoint = {
      lat: center.lat,
      lng: center.lng,
      kind: 'cell',
      cellFeature: feature,
    };
    highlightSelectedCell();
    renderSelectedCard();
    renderSidePanels();
    if (state.map && options && options.focusMap !== false) focusCellFeature(feature);
    loadRecords(state.selectedCellId ? { cellId: state.selectedCellId } : null);
    if (options && options.openSheet && shouldUseBottomSheet()) openCellSheet(feature);
    else if (!shouldUseBottomSheet()) closeBottomSheet();
    saveMapState();
  }

  function selectRecord(record, options) {
    if (!record) return;
    state.selectedOccurrenceId = record.occurrenceId || null;
    state.selectedCellId = record.cellId || null;
    var feature = getSelectedCellFeature();
    if (state.selectedCellId && (!feature || feature.properties.cellId !== state.selectedCellId)) {
      for (var i = 0; i < state.features.length; i += 1) {
        if (state.features[i] && state.features[i].properties && state.features[i].properties.cellId === state.selectedCellId) {
          feature = state.features[i];
          break;
        }
      }
    }
    if (!feature) return;
    var center = cellCenter(feature);
    state.selectedPoint = {
      lat: center.lat,
      lng: center.lng,
      kind: 'observation',
      cellFeature: feature,
      record: record,
    };
    highlightSelectedCell();
    renderResultList();
    renderSelectedCard();
    renderSidePanels();
    if (state.map && options && options.focusMap !== false) focusCellFeature(feature);
    if (state.lastStats && state.lastStats.selectedCellId !== state.selectedCellId) {
      loadRecords({ cellId: state.selectedCellId });
    }
    if (options && options.openSheet && shouldUseBottomSheet()) openBottomSheet(record);
    else if (!shouldUseBottomSheet()) closeBottomSheet();
    saveMapState();
  }

  function openBottomSheet(record) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!shouldUseBottomSheet()) return;
    var feature = getSelectedCellFeature();
    var center = feature ? cellCenter(feature) : { lat: null, lng: null };
    state.selectedPoint = (center.lat != null && center.lng != null)
      ? { lat: center.lat, lng: center.lng, kind: 'observation', cellFeature: feature, record: record }
      : null;
    sheetInnerEl.innerHTML =
      renderObservationActions(record) +
      '<div id="me-sheet-ambient-slot">' + renderSheetAmbient({ lat: center.lat, lng: center.lng, kind: 'observation', cellFeature: feature, record: record }) + '</div>';
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
  }

  function openCellSheet(feature) {
    if (!sheetEl || !sheetInnerEl || !feature || !feature.properties) return;
    if (!shouldUseBottomSheet()) return;
    var center = cellCenter(feature);
    state.selectedPoint = { lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature };
    var seq = ++siteBriefSeq;
    var p = feature.properties || {};
    sheetInnerEl.innerHTML =
      '<div class="me-bottom-meta">' +
        '<strong>' + escapeHtml(p.label || '—') + '</strong>' +
        '<span>' + escapeHtml(String(p.count || 0) + ' ' + COPY.resultCountLabel) + '</span>' +
        (p.latestObservedAt ? '<span>' + escapeHtml(String(p.latestObservedAt).slice(0, 10)) + '</span>' : '') +
      '</div>' +
      '<div id="me-site-brief-slot" class="me-site-brief-slot is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</div>' +
      renderPlaceActions() +
      '<div id="me-sheet-ambient-slot">' + renderSheetAmbient({ lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature }) + '</div>';
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
    fetchSiteBrief(center.lat, center.lng, seq, document.getElementById('me-site-brief-slot'));
  }

  function openPlaceSheet(lat, lng) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    if (!shouldUseBottomSheet()) {
      state.selectedPoint = { lat: lat, lng: lng, kind: 'place' };
      highlightSelectedCell();
      closeBottomSheet();
      renderResultList();
      renderSelectedCard();
      renderSidePanels();
      saveMapState();
      return;
    }
    state.selectedPoint = { lat: lat, lng: lng, kind: 'place' };
    highlightSelectedCell();
    var seq = ++siteBriefSeq;
    sheetInnerEl.innerHTML =
      '<div id="me-site-brief-slot" class="me-site-brief-slot is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</div>' +
      renderPlaceActions() +
      '<div id="me-sheet-ambient-slot">' + renderSheetAmbient({ lat: lat, lng: lng, kind: 'place' }) + '</div>';
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
    renderSidePanels();
    fetchSiteBrief(lat, lng, seq, document.getElementById('me-site-brief-slot'));
    saveMapState();
  }
  function closeBottomSheet() {
    if (!sheetEl) return;
    sheetEl.classList.remove('is-open');
    sheetEl.setAttribute('aria-hidden', 'true');
  }
  if (sheetCloseEl) sheetCloseEl.addEventListener('click', closeBottomSheet);

  function ensureCellSource(map, features) {
    var sourceId = 'observations';
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData({ type: 'FeatureCollection', features: features });
      highlightSelectedCell();
      return;
    }
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: features },
    });
    map.addLayer({
      id: 'observation-cell-fill',
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': 'rgba(14,165,233,0.24)',
        'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 1, 0.12, 4, 0.18, 12, 0.28],
      },
    });
    map.addLayer({
      id: 'observation-cell-outline',
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': 'rgba(14,165,233,0.55)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 1.4],
      },
    });
    map.addLayer({
      id: 'observation-cell-selected',
      type: 'line',
      source: sourceId,
      filter: ['==', ['get', 'cellId'], '__none__'],
      paint: {
        'line-color': 'rgba(5,150,105,0.96)',
        'line-width': 3,
      },
    });
    map.addLayer({
      id: 'obs-cell-heat',
      type: 'fill',
      source: sourceId,
      layout: { visibility: 'none' },
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'count'], 0],
          0, 'rgba(56,189,248,0.08)',
          2, 'rgba(14,165,233,0.22)',
          6, 'rgba(245,158,11,0.42)',
          12, 'rgba(239,68,68,0.6)',
        ],
        'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 0, 0.08, 2, 0.14, 6, 0.26, 12, 0.36],
      },
    });
    map.addLayer({
      id: 'obs-cell-heat-selected',
      type: 'line',
      source: sourceId,
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'cellId'], '__none__'],
      paint: {
        'line-color': 'rgba(255,255,255,0.96)',
        'line-width': 2.4,
      },
    });
    ['observation-cell-fill', 'observation-cell-outline', 'obs-cell-heat'].forEach(function (layerId) {
      map.on('click', layerId, function (e) {
        if (hasPendingMapResults()) return;
        if (!e.features || !e.features[0]) return;
        selectCell(e.features[0], { focusMap: false, openSheet: true });
      });
      map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
    });
    highlightSelectedCell();
  }

  function removeLayerIfExists(map, id) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  function removeSourceIfExists(map, id) {
    if (map.getSource(id)) map.removeSource(id);
  }

  function applyTab(map, tab) {
    // Show/hide layers based on active tab.
    var markerLayers = ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-selected'];
    var heatLayers = ['obs-cell-heat', 'obs-cell-heat-selected'];
    var frontierLayers = ['frontier-fill'];
    var show = function (ids, visible) {
      ids.forEach(function (id) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      });
    };
    show(markerLayers, tab === 'markers');
    show(heatLayers, tab === 'heatmap');
    show(frontierLayers, tab === 'frontier');

    if (tab === 'heatmap') {
      ensureHeatmap(map);
      showLegend(COPY.heatmapLegendLow, COPY.heatmapLegendHigh,
        'linear-gradient(90deg, rgba(56,189,248,0.2), #0ea5e9 40%, #f59e0b 75%, #ef4444)');
    } else if (tab === 'frontier') {
      ensureFrontier(map);
      showLegend(COPY.coverageLegendLow, COPY.coverageLegendHigh,
        'linear-gradient(90deg, rgba(148,163,184,0.14), rgba(14,165,233,0.28) 30%, rgba(16,185,129,0.4) 65%, rgba(5,150,105,0.72))');
    } else {
      hideLegend();
    }
  }

  function ensureHeatmap(map) {
    highlightSelectedCell();
  }

  function ensureFrontier(map) {
    if (!state.frontier) {
      loadFrontier(map);
      return;
    }
    paintFrontier(map, state.frontier);
  }

  function paintFrontier(map, collection) {
    var sourceId = 'frontier';
    var fillId = 'frontier-fill';
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: collection });
      map.addLayer({
        id: fillId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': [
            'match', ['get', 'stage'],
            'blank', 'rgba(148,163,184,0.18)',
            'building', 'rgba(14,165,233,0.28)',
            'repeatable', 'rgba(16,185,129,0.42)',
            'rgba(5,150,105,0.72)',
          ],
          'fill-opacity': [
            'match', ['get', 'stage'],
            'blank', 0.08,
            'building', 0.18,
            'repeatable', 0.3,
            0.42,
          ],
          'fill-outline-color': 'rgba(15,23,42,0.12)',
        },
      });
      map.on('click', 'frontier-fill', function (e) {
        if (!e.features || !e.features[0]) return;
        var ring = e.features[0].geometry && e.features[0].geometry.coordinates ? e.features[0].geometry.coordinates[0] : null;
        if (!ring || !ring[0] || !ring[2]) return;
        var centerLng = (Number(ring[0][0]) + Number(ring[2][0])) / 2;
        var centerLat = (Number(ring[0][1]) + Number(ring[2][1])) / 2;
        openPlaceSheet(centerLat, centerLng);
      });
      map.on('mouseenter', 'frontier-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'frontier-fill', function () { map.getCanvas().style.cursor = ''; });
    } else {
      map.getSource(sourceId).setData(collection);
    }
  }

  function currentBboxString() {
    if (!state.map) return '';
    var bounds = state.map.getBounds();
    if (!bounds) return '';
    return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map(function (n) { return Number(n).toFixed(5); }).join(',');
  }

  function loadFrontier(map) {
    if (!apiFrontier) return;
    if (state.frontierAbort) { try { state.frontierAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.frontierAbort = controller;
    var qs = '?bbox=' + encodeURIComponent(currentBboxString());
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    if (state.actorClass && state.actorClass !== 'all') qs += '&actor_class=' + encodeURIComponent(state.actorClass);
    fetch(apiFrontier + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (coll) {
        if (!coll) return;
        state.frontier = coll;
        paintFrontier(map, coll);
        refreshSheetAmbient();
        refreshSelectedAmbient();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
  }

  function loadEffortSummary() {
    if (!apiEffortSummary || !state.map) return;
    var qs = '?bbox=' + encodeURIComponent(currentBboxString());
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    if (state.role) qs += '&role=' + encodeURIComponent(state.role);
    if (state.actorClass && state.actorClass !== 'all') qs += '&actor_class=' + encodeURIComponent(state.actorClass);
    if (state.effortAbort) { try { state.effortAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.effortAbort = controller;
    fetch(apiEffortSummary + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (summary) {
        if (!summary) return;
        state.effortSummary = summary;
        renderSidePanels();
        refreshSheetAmbient();
        refreshSelectedAmbient();
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
  }

  function loadCells() {
    if (!state.map) return;
    var bbox = currentBboxString();
    if (!bbox) return;
    var qs = '?bbox=' + encodeURIComponent(bbox);
    qs += '&zoom=' + encodeURIComponent(state.map.getZoom().toFixed(2));
    if (state.markerProfile) qs += '&marker_profile=' + encodeURIComponent(state.markerProfile);
    if (state.taxonGroup) qs += '&taxon_group=' + encodeURIComponent(state.taxonGroup);
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    if (state.season) qs += '&season=' + encodeURIComponent(state.season);
    if (state.lastAbort) { try { state.lastAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var requestSeq = state._cellsRequestSeq + 1;
    state._cellsRequestSeq = requestSeq;
    state.lastAbort = controller;
    updatePendingMapResultsState();
    fetch(apiCells + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('cells ' + r.status)); })
      .then(function (coll) {
        if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._cellsRequestSeq)) return;
        state._cellsAppliedSeq = requestSeq;
        state.features = (coll && coll.features) || [];
        state.lastCellStats = (coll && coll.stats) || null;
        state.lastSearchedBbox = bbox;
        state.pendingViewportSearch = false;
        ensureCellSource(state.map, state.features);
        var availableCellIds = state.features.map(function (feature) {
          return feature && feature.properties ? feature.properties.cellId || null : null;
        }).filter(function (cellId) { return !!cellId; });
        var selectionOutcome = MapExplorerStateHelpers.reconcileSelectedCellAfterCellsResponse({
          selectedCellId: state.selectedCellId,
          availableCellIds: availableCellIds,
          responseSeq: requestSeq,
          latestRequestSeq: state._cellsRequestSeq,
        });
        if (selectionOutcome.clearSelectedPoint) {
          state.selectedOccurrenceId = null;
          state.selectedCellId = selectionOutcome.selectedCellId;
          if (state.selectedPoint && state.selectedPoint.kind !== 'place') state.selectedPoint = null;
          closeBottomSheet();
        }
        updatePendingMapResultsState();
        if (state._restoredCellId) {
          var restoredFeature = findCellFeatureById(state._restoredCellId);
          if (restoredFeature) {
            updateSearchAreaUi();
            applyTab(state.map, state.tab);
            state._fittedOnce = true;
            selectCell(restoredFeature, { focusMap: false, openSheet: shouldUseBottomSheet() });
            return;
          }
        }
        renderSelectedCard();
        renderSidePanels();
        updateSearchAreaUi();
        applyTab(state.map, state.tab);
        state._fittedOnce = true;
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._cellsRequestSeq)) {
          state._cellsAppliedSeq = requestSeq;
          updatePendingMapResultsState();
        }
      });
  }

  function loadRecords(scope) {
    if (!state.map) return;
    var qs = '?limit=1500';
    if (state.markerProfile) qs += '&marker_profile=' + encodeURIComponent(state.markerProfile);
    if (state.taxonGroup) qs += '&taxon_group=' + encodeURIComponent(state.taxonGroup);
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    if (state.season) qs += '&season=' + encodeURIComponent(state.season);
    if (scope && scope.cellId) {
      qs += '&cell_id=' + encodeURIComponent(scope.cellId);
    } else {
      var bbox = currentBboxString();
      if (!bbox) return;
      qs += '&bbox=' + encodeURIComponent(bbox);
      qs += '&zoom=' + encodeURIComponent(state.map.getZoom().toFixed(2));
      state.lastSearchedBbox = bbox;
      state.pendingViewportSearch = false;
    }
    setStatus(COPY.loading);
    if (state.recordAbort) { try { state.recordAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var requestSeq = state._recordsRequestSeq + 1;
    state._recordsRequestSeq = requestSeq;
    state.recordAbort = controller;
    updatePendingMapResultsState();
    fetch(apiObservations + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('records ' + r.status)); })
      .then(function (list) {
        if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) return;
        state._recordsAppliedSeq = requestSeq;
        state.records = (list && list.items) || [];
        state.lastStats = (list && list.stats) || null;
        if (state.selectedOccurrenceId) {
          var selectedRecord = getSelectedRecord();
          if (!selectedRecord) {
            state.selectedOccurrenceId = null;
            if (state.selectedCellId) {
              var fallbackCell = findCellFeatureById(state.selectedCellId);
              if (fallbackCell) {
                var center = cellCenter(fallbackCell);
                state.selectedPoint = {
                  lat: center.lat,
                  lng: center.lng,
                  kind: 'cell',
                  cellFeature: fallbackCell,
                };
              } else if (state.selectedPoint && state.selectedPoint.kind === 'observation') {
                state.selectedPoint = null;
              }
            } else if (state.selectedPoint && state.selectedPoint.kind === 'observation') {
              state.selectedPoint = null;
            }
          }
        }
        renderResultList();
        renderSelectedCard();
        renderSidePanels();
        updatePendingMapResultsState();
        updateSearchAreaUi();
        var totalAll = (list && list.stats && list.stats.totalAll) || state.records.length;
        if (!state.records.length) setStatus(COPY.empty);
        else setStatus(fmtStatsLabel(state.records.length, totalAll));
        setStatusMeta(fmtProvenanceMeta(list && list.stats));
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) {
          state._recordsAppliedSeq = requestSeq;
          updatePendingMapResultsState();
        }
        setStatus('—');
        setStatusMeta('');
      });
  }

  function refreshMapData() {
    loadCells();
    loadRecords(null);
  }

  function refreshYearDependentData() {
    state.frontier = null;
    if (state.map && state.map.getSource('frontier')) {
      removeLayerIfExists(state.map, 'frontier-fill');
      removeSourceIfExists(state.map, 'frontier');
    }
    refreshMapData();
    if (state.map) loadFrontier(state.map);
    loadEffortSummary();
    loadTraces();
    saveMapState();
  }

  function switchBasemap(key) {
    if (!state.map || !BASEMAPS[key]) return;
    var wasTab = state.tab;
    state.basemap = key;
    state.map.setStyle(BASEMAPS[key]);
    state.map.once('style.load', function () {
      ensureCellSource(state.map, state.features);
      if (state.frontier) paintFrontier(state.map, state.frontier);
      highlightSelectedCell();
      applyTab(state.map, wasTab);
    });
  }

  // ---- State persistence: query string + localStorage ---------------------
  // Keeps map state shareable as a plain URL while preserving unrelated
  // params like lang.
  var STATE_STORAGE_KEY = 'ikimon-map-v2';
  var MAP_STATE_KEYS = MapExplorerStateHelpers.MAP_STATE_KEYS.slice();

  function currentOverlayShareState() {
    var overlays = [];
    overlayCatalog.forEach(function (o) {
      var s = overlayState[o.id];
      overlays.push({
        id: o.id,
        enabled: !!(s && s.enabled),
        opacity: s && typeof s.opacity === 'number' ? s.opacity : null,
      });
    });
    return overlays;
  }

  function serializeMapState() {
    var center = null;
    var zoom = null;
    if (state.map) {
      var c = state.map.getCenter();
      center = { lng: c.lng, lat: c.lat };
      zoom = state.map.getZoom();
    }
    return MapExplorerStateHelpers.serializeSharedMapState({
      tab: state.tab,
      role: state.role,
      actorClass: state.actorClass,
      markerProfile: state.markerProfile,
      taxonGroup: state.taxonGroup,
      year: state.year,
      season: state.season,
      basemap: state.basemap,
      tracesVisible: state.tracesVisible,
      selectedCellId: state.selectedCellId,
      overlays: currentOverlayShareState(),
      center: center,
      zoom: zoom,
    });
  }

  function saveMapState() {
    var s = serializeMapState();
    try {
      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        MAP_STATE_KEYS.forEach(function (key) { url.searchParams.delete(key); });
        if (s) {
          var mapParams = new URLSearchParams(s);
          mapParams.forEach(function (value, key) { url.searchParams.set(key, value); });
        }
        var next = url.pathname + (url.search ? url.search : '');
        window.history.replaceState(null, '', next + (url.hash || ''));
      }
      localStorage.setItem(STATE_STORAGE_KEY, s);
    } catch (_) {}
  }

  function parseStateString(raw) {
    var params = {};
    if (!raw) return params;
    var cleaned = raw.replace(/^[?#]/, '');
    if (!cleaned) return params;
    new URLSearchParams(cleaned).forEach(function (value, key) { params[key] = value; });
    return params;
  }

  function applyRestoredParams(params) {
    if (!params || !Object.keys(params).length) return;
    if (params.tab) state.tab = params.tab === 'coverage' ? 'frontier' : params.tab;
    if (params.role) state.role = params.role;
    if (params.actor) state.actorClass = params.actor;
    if (params.mp === 'manual_only' || params.mp === 'trusted_only' || params.mp === 'all_research_artifacts') state.markerProfile = params.mp;
    if (params.taxon !== undefined) state.taxonGroup = params.taxon;
    if (params.year) state.year = params.year;
    if (params.season) state.season = params.season;
    if (params.bm && BASEMAPS[params.bm]) state.basemap = params.bm;
    state.tracesVisible = params.traces === '1' || params.traces === 'true';
    if (params.cell) state._restoredCellId = params.cell;
    if (params.lng && params.lat && params.z) {
      var lng2 = parseFloat(params.lng);
      var lat2 = parseFloat(params.lat);
      var z2 = parseFloat(params.z);
      if (
        isFinite(lng2) && isFinite(lat2) && isFinite(z2) &&
        lng2 >= -180 && lng2 <= 180 &&
        lat2 >= -85 && lat2 <= 85 &&
        z2 >= 0 && z2 <= 22
      ) {
        state._restoredCenter = [lng2, lat2];
        state._restoredZoom = z2;
      }
    }
    if (params.ov) {
      params.ov.split(',').forEach(function (item) {
        var colon = item.lastIndexOf(':');
        if (colon < 1) return;
        var id = item.slice(0, colon);
        var op = parseFloat(item.slice(colon + 1));
        if (overlayState[id]) {
          overlayState[id].enabled = true;
          if (isFinite(op)) overlayState[id].opacity = op;
        }
      });
    }
  }

  function syncUiFromState() {
    document.querySelectorAll('.me-tab').forEach(function (btn) {
      var t = btn.getAttribute('data-tab');
      btn.classList.toggle('is-active', t === state.tab);
      btn.setAttribute('aria-selected', t === state.tab ? 'true' : 'false');
    });
    document.querySelectorAll('.me-role-chip').forEach(function (btn) {
      var v = btn.getAttribute('data-role') || 'mixed';
      btn.classList.toggle('is-active', v === state.role);
      btn.setAttribute('aria-pressed', v === state.role ? 'true' : 'false');
    });
    document.querySelectorAll('.me-actor-chip').forEach(function (btn) {
      var v = btn.getAttribute('data-actor-class') || 'all';
      btn.classList.toggle('is-active', v === state.actorClass);
      btn.setAttribute('aria-pressed', v === state.actorClass ? 'true' : 'false');
    });
    document.querySelectorAll('.me-taxon-chip').forEach(function (btn) {
      var v = btn.getAttribute('data-taxon-group') || '';
      btn.classList.toggle('is-active', v === state.taxonGroup);
      btn.setAttribute('aria-pressed', v === state.taxonGroup ? 'true' : 'false');
    });
    document.querySelectorAll('.me-season-chip').forEach(function (btn) {
      var v = btn.getAttribute('data-season') || '';
      btn.classList.toggle('is-active', v === state.season);
      btn.setAttribute('aria-pressed', v === state.season ? 'true' : 'false');
    });
    syncYearUi();
    document.querySelectorAll('input[name="me-basemap"]').forEach(function (inp) {
      inp.checked = inp.value === state.basemap;
      var opt = inp.closest ? inp.closest('.me-basemap-opt') : inp.parentElement;
      if (opt) opt.classList.toggle('is-active', inp.value === state.basemap);
    });
    var traceToggleR = document.getElementById('me-trace-toggle');
    if (traceToggleR) traceToggleR.checked = !!state.tracesVisible;
    document.querySelectorAll('.me-overlay-item').forEach(function (label) {
      var id = label.getAttribute('data-overlay-id');
      if (!id || !overlayState[id]) return;
      var toggle = label.querySelector('.me-overlay-toggle');
      var range = label.querySelector('.me-overlay-opacity-range');
      if (toggle) { toggle.checked = !!overlayState[id].enabled; }
      label.classList.toggle('is-on', !!overlayState[id].enabled);
      if (range && overlayState[id].opacity != null) range.value = String(overlayState[id].opacity);
    });
  }

  // Restore from query string, then hash, then localStorage.
  (function () {
    var params = parseStateString(window.location.search);
    if (!Object.keys(params).length) {
      var hash = window.location.hash;
      params = hash ? parseStateString(hash) : {};
    }
    if (!Object.keys(params).length) {
      try { params = parseStateString(localStorage.getItem(STATE_STORAGE_KEY) || ''); } catch (_) {}
    }
    applyRestoredParams(params);
    syncUiFromState();
  })();

  // ---- Trace lines (visit_track_points → GeoJSON LineStrings) -------------
  function paintTraces(map, coll) {
    if (!map || !coll || !coll.features || !coll.features.length) return;
    var srcId = 'traces';
    var layerId = 'traces-line';
    if (map.getSource(srcId)) {
      map.getSource(srcId).setData(coll);
      return;
    }
    map.addSource(srcId, { type: 'geojson', data: coll });
    // Insert below observation cells so the privacy layer stays visually primary.
    var insertBefore = map.getLayer('observation-cell-selected') ? 'observation-cell-selected'
      : map.getLayer('observation-cell-fill') ? 'observation-cell-fill'
      : undefined;
    map.addLayer({
      id: layerId,
      type: 'line',
      source: srcId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#0ea5e9',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 3],
        'line-opacity': 0.5,
      },
    }, insertBefore || undefined);
  }

  function loadTraces() {
    if (!apiTraces || !state.map || !state.tracesVisible) return;
    var qs = '?limit=200';
    if (state.year) qs += '&year=' + encodeURIComponent(state.year);
    fetch(apiTraces + qs, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (coll) { if (coll && state.map) paintTraces(state.map, coll); })
      .catch(function () {});
  }

  var traceToggleEl = document.getElementById('me-trace-toggle');
  if (traceToggleEl) {
    traceToggleEl.addEventListener('change', function () {
      state.tracesVisible = !!traceToggleEl.checked;
      if (state.map && state.map.getLayer('traces-line')) {
        state.map.setLayoutProperty('traces-line', 'visibility', state.tracesVisible ? 'visible' : 'none');
      } else if (state.tracesVisible) {
        loadTraces();
      }
      saveMapState();
    });
  }

  // Patch reapplyOverlays: also repaint traces after basemap reload.
  var _origReapplyOverlays = reapplyOverlays;
  reapplyOverlays = function (map) {
    _origReapplyOverlays(map);
    if (state.tracesVisible) loadTraces();
  };

  function hydrate() {
    if (!window.maplibregl) { showMapLoadFailure(); return; }
    try {
      state.map = new window.maplibregl.Map({
        container: root,
        style: BASEMAPS[state.basemap] || BASEMAPS.standard,
        center: state._restoredCenter || [138.38, 35.34],
        zoom: state._restoredZoom != null ? state._restoredZoom : 5.2,
        attributionControl: true,
      });
    } catch (err) {
      try { console.error('[map] init failed', err); } catch (_) {}
      state._restoredCenter = null;
      state._restoredZoom = null;
      try {
        state.map = new window.maplibregl.Map({
          container: root,
          style: BASEMAPS.standard,
          center: [138.38, 35.34],
          zoom: 5.2,
          attributionControl: true,
        });
      } catch (err2) {
        showMapLoadFailure();
        return;
      }
    }
    state.map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    state.map.on('load', function () {
      // Restore enabled overlays from URL/localStorage state before loading data.
      overlayCatalog.forEach(function (def) {
        if (overlayState[def.id] && overlayState[def.id].enabled) addOverlay(state.map, def);
      });
      refreshMapData();
      loadFrontier(state.map);
      loadEffortSummary();
      loadTraces();
      maybeAutoLocateOnFirstOpen();
    });
    state.map.on('moveend', function () {
      if (state.ignoreNextMoveEnd) {
        state.ignoreNextMoveEnd = false;
        saveMapState();
        return;
      }
      saveMapState();
      var bbox = currentBboxString();
      state.pendingViewportSearch = !!bbox && bbox !== state.lastSearchedBbox;
      updateSearchAreaUi();
    });
    // Empty-point tap → Site Brief. Skip if the click hit an observation
    // layer (those have their own handlers via map.on('click', 'layer', ...)).
    state.map.on('click', function (e) {
      var layers = [];
      ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-selected', 'obs-cell-heat', 'obs-cell-heat-selected'].forEach(function (id) {
        if (state.map.getLayer(id)) layers.push(id);
      });
      if (state.map.getLayer('frontier-fill')) layers.push('frontier-fill');
      var hits = layers.length > 0 ? state.map.queryRenderedFeatures(e.point, { layers: layers }) : [];
      if (hits && hits.length > 0) return;
      openPlaceSheet(e.lngLat.lat, e.lngLat.lng);
    });
  }

  function showMapLoadFailure() {
    setStatus('—');
    if (!root || root.querySelector('[data-map-load-error="1"]')) return;
    var box = document.createElement('div');
    box.setAttribute('data-map-load-error', '1');
    box.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#ecfeff,#eff6ff);color:#0f172a;font:500 14px/1.5 system-ui,sans-serif;text-align:center;z-index:4;';
    box.innerHTML = '<div><div style="font-size:15px;margin-bottom:6px;">地図ライブラリを読み込めませんでした</div><div style="opacity:.75;margin-bottom:12px;">ネットワーク状況を確認のうえ、もう一度開いてください。</div><button type="button" style="padding:8px 14px;border-radius:9999px;border:1px solid rgba(15,23,42,.18);background:#fff;cursor:pointer;font:600 13px/1 system-ui,sans-serif;">再読み込み</button></div>';
    var btn = box.querySelector('button');
    if (btn) btn.addEventListener('click', function () { window.location.reload(); });
    root.appendChild(box);
  }

  function loadMaplibreScript(src, useSri, onload, onfail) {
    var s = document.createElement('script');
    s.src = src;
    if (useSri) {
      s.integrity = MAPLIBRE_JS_SRI;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
    }
    s.defer = true;
    s.onload = function () {
      if (window.maplibregl) onload();
      else onfail();
    };
    s.onerror = onfail;
    document.head.appendChild(s);
  }

  if (window.maplibregl) hydrate();
  else {
    loadMaplibreScript(MAPLIBRE_JS_PRIMARY, true, hydrate, function () {
      loadMaplibreScript(MAPLIBRE_JS_FALLBACK, true, hydrate, showMapLoadFailure);
    });
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
      refreshMapData();
      saveMapState();
    });
  });
  if (yearRangeEl) {
    yearRangeEl.addEventListener('input', function () {
      var nextYear = YEAR_VALUES[Number(yearRangeEl.value)];
      if (!nextYear) return;
      state.year = String(nextYear);
      syncYearUi();
    });
    yearRangeEl.addEventListener('change', refreshYearDependentData);
  }
  if (yearAllEl) {
    yearAllEl.addEventListener('click', function () {
      state.year = '';
      syncYearUi();
      refreshYearDependentData();
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
      if (state.map) {
        applyTab(state.map, state.tab);
        if (state.tab === 'frontier') loadFrontier(state.map);
      }
      saveMapState();
    });
  });
  document.querySelectorAll('.me-role-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-role') || 'mixed';
      state.role = value;
      document.querySelectorAll('.me-role-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      loadEffortSummary();
      saveMapState();
    });
  });
  document.querySelectorAll('.me-actor-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.getAttribute('data-actor-class') || 'all';
      state.actorClass = value;
      document.querySelectorAll('.me-actor-chip').forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      refreshMapData();
      if (state.map && state.tab === 'frontier') loadFrontier(state.map);
      loadEffortSummary();
      saveMapState();
    });
  });
  if (shareStateEl) {
    shareStateEl.addEventListener('click', function () {
      saveMapState();
      try {
        var shareUrl = window.location.origin + window.location.pathname + window.location.search;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function () {
            setStatus(COPY.shareCopied);
          }).catch(function () {
            try {
              var ta = document.createElement('textarea');
              ta.value = shareUrl;
              ta.setAttribute('readonly', 'readonly');
              ta.style.position = 'absolute';
              ta.style.left = '-9999px';
              document.body.appendChild(ta);
              ta.select();
              var ok = document.execCommand('copy');
              document.body.removeChild(ta);
              setStatus(ok ? COPY.shareCopied : COPY.shareError);
            } catch (_) {
              setStatus(COPY.shareError);
            }
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = shareUrl;
          ta.setAttribute('readonly', 'readonly');
          ta.style.position = 'absolute';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          var copied = document.execCommand('copy');
          document.body.removeChild(ta);
          setStatus(copied ? COPY.shareCopied : COPY.shareError);
        }
      } catch (_) {
        setStatus(COPY.shareError);
      }
    });
  }
  document.querySelectorAll('input[name="me-basemap"]').forEach(function (inp) {
    inp.addEventListener('change', function () {
      if (!inp.checked) return;
      var v = inp.value;
      document.querySelectorAll('.me-basemap-opt').forEach(function (el) {
        el.classList.toggle('is-active', el.contains(inp));
      });
      switchBasemap(v);
      saveMapState();
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
      refreshMapData();
      if (state.map) loadFrontier(state.map);
      loadEffortSummary();
      saveMapState();
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
  if (searchAreaBtnEl) {
    searchAreaBtnEl.addEventListener('click', function () {
      if (!state.map) return;
      var bbox = currentBboxString();
      if (bbox) state.lastSearchedBbox = bbox;
      state.pendingViewportSearch = false;
      updateSearchAreaUi();
      refreshMapData();
      loadFrontier(state.map);
      loadEffortSummary();
    });
  }

  // ---- Unified species + place search ------------------------------------
  // Species hits are resolved locally from the currently visible observation
  // set so they feel instant; place hits come from Nominatim and append below.
  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  var searchInputEl = document.getElementById('me-search-input');
  var searchResultsEl = document.getElementById('me-search-results');
  var searchDebounce = null;
  var searchAbort = null;
  var searchSeq = 0;

  function normalizeSearchText(value) {
    return String(value == null ? '' : value).trim().toLowerCase();
  }

  function closeSearchResults() {
    if (!searchResultsEl) return;
    searchResultsEl.innerHTML = '';
    searchResultsEl.classList.remove('is-open');
  }

  function renderSearchRows(rows) {
    if (!searchResultsEl) return;
    if (!rows || !rows.length) {
      searchResultsEl.innerHTML = '<div class="me-search-empty">' + escapeHtml(COPY.searchNoResult) + '</div>';
      searchResultsEl.classList.add('is-open');
      return;
    }
    searchResultsEl.innerHTML = rows.map(function (row, idx) {
      return '<button type="button" role="option" class="me-search-row" data-idx="' + idx + '">' +
        '<span class="me-search-badge me-search-badge-' + escapeHtml(row.kind) + '">' + escapeHtml(row.badge) + '</span>' +
        '<strong>' + escapeHtml(row.title) + '</strong>' +
        (row.subtitle ? '<span>' + escapeHtml(row.subtitle) + '</span>' : '') +
        '</button>';
    }).join('');
    searchResultsEl.classList.add('is-open');
    searchResultsEl.querySelectorAll('.me-search-row').forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        var row = rows[i];
        if (!row || typeof row.onSelect !== 'function') return;
        row.onSelect();
      });
    });
  }

  function buildSpeciesSearchRows(query) {
    var q = normalizeSearchText(query);
    if (!q || q.length < 2) return [];
    var speciesMap = {};
    state.records.forEach(function (record) {
      var variants = recordNameVariants(record);
      if (!variants.length) return;
      var matched = variants.some(function (name) { return normalizeSearchText(name).indexOf(q) !== -1; });
      if (!matched) return;
      var key = normalizeSearchText(record.displayName || variants[0]);
      if (!speciesMap[key]) {
        speciesMap[key] = {
          kind: 'species',
          badge: COPY.searchResultSpecies,
          title: record.displayName || variants[0],
          subtitle: record.localityLabel || '',
          occurrenceIds: [],
          cellIds: {},
          taxonGroup: record.taxonGroup || '',
        };
      }
      speciesMap[key].occurrenceIds.push(record.occurrenceId);
      if (record.cellId) speciesMap[key].cellIds[record.cellId] = true;
    });
    return Object.keys(speciesMap)
      .map(function (key) { return speciesMap[key]; })
      .sort(function (a, b) { return b.occurrenceIds.length - a.occurrenceIds.length; })
      .slice(0, 5)
      .map(function (row) {
        var hitLabel = SEARCH_LANG === 'ja' ? '件'
          : SEARCH_LANG === 'es' ? ' registros'
          : SEARCH_LANG === 'pt-BR' ? ' registros'
          : ' hits';
        row.subtitle = row.subtitle
          ? row.subtitle + ' · ' + row.occurrenceIds.length + hitLabel
          : row.occurrenceIds.length + hitLabel;
        row.onSelect = function () {
          if (!state.map) return;
          state.tab = 'markers';
          syncUiFromState();
          applyTab(state.map, state.tab);
          var matches = state.records.filter(function (record) {
            return row.occurrenceIds.indexOf(record.occurrenceId) !== -1;
          });
          var seenCells = {};
          var matchingCells = [];
          matches.forEach(function (record) {
            if (!record || !record.cellId || seenCells[record.cellId]) return;
            var feature = findCellFeatureById(record.cellId);
            if (!feature) return;
            seenCells[record.cellId] = true;
            matchingCells.push(feature);
          });
          if (matchingCells.length) fitToCellSet(matchingCells, { openSheet: false });
          if (matches.length === 1) selectRecord(matches[0], { focusMap: false, openSheet: true });
          else if (matchingCells.length === 1) selectCell(matchingCells[0], { focusMap: false, openSheet: true });
          if (searchInputEl) searchInputEl.value = row.title;
          searchResultsEl.classList.remove('is-open');
          saveMapState();
        };
        return row;
      });
  }

  function buildPlaceSearchRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 5).map(function (row) {
      var name = row.display_name || row.name || '';
      var cls = row.type || row.category || '';
      return {
        kind: 'place',
        badge: COPY.searchResultPlace,
        title: name,
        subtitle: cls,
        onSelect: function () {
          if (!row || !state.map) return;
          var lat = Number(row.lat);
          var lng = Number(row.lon);
          if (!isFinite(lat) || !isFinite(lng)) return;
          if (row.boundingbox && row.boundingbox.length === 4) {
            var b = row.boundingbox.map(Number);
            if (b.every(isFinite)) {
              state.map.fitBounds([[b[2], b[0]], [b[3], b[1]]], { padding: 48, maxZoom: 14, duration: 500 });
            } else {
              state.map.flyTo({ center: [lng, lat], zoom: 12, duration: 500 });
            }
          } else {
            state.map.flyTo({ center: [lng, lat], zoom: 12, duration: 500 });
          }
          searchResultsEl.classList.remove('is-open');
          if (searchInputEl) searchInputEl.value = row.display_name || '';
          saveMapState();
        },
      };
    });
  }

  function runUnifiedSearch(query) {
    if (!searchResultsEl) return;
    var trimmed = String(query || '').trim();
    var seq = ++searchSeq;
    var localRows = buildSpeciesSearchRows(trimmed);
    if (!trimmed || trimmed.length < 2) {
      closeSearchResults();
      return;
    }
    if (localRows.length) renderSearchRows(localRows);
    else closeSearchResults();

    if (searchAbort) { try { searchAbort.abort(); } catch(_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    searchAbort = controller;

    var params = new URLSearchParams({
      q: trimmed,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'jp',
      'accept-language': SEARCH_LANG,
      addressdetails: '0',
    });
    params.set('email', 'ops@ikimon.life');

    fetch(NOMINATIM_URL + '?' + params.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined,
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('nominatim ' + r.status)); })
      .then(function (rows) {
        if (seq !== searchSeq) return;
        var merged = localRows.concat(buildPlaceSearchRows(rows));
        if (!merged.length) {
          renderSearchRows([]);
          return;
        }
        renderSearchRows(merged.slice(0, 8));
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
        if (seq !== searchSeq) return;
        if (localRows.length) {
          renderSearchRows(localRows);
          return;
        }
        searchResultsEl.innerHTML = '<div class="me-search-empty">' + escapeHtml(COPY.searchError) + '</div>';
        searchResultsEl.classList.add('is-open');
      });
  }

  if (searchInputEl) {
    searchInputEl.addEventListener('input', function () {
      var q = searchInputEl.value;
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(function () { runUnifiedSearch(q); }, 280);
    });
    searchInputEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !searchResultsEl) return;
      var first = searchResultsEl.querySelector('.me-search-row');
      if (!first) return;
      e.preventDefault();
      first.click();
    });
    searchInputEl.addEventListener('focus', function () {
      if (searchResultsEl && searchResultsEl.childElementCount > 0) searchResultsEl.classList.add('is-open');
    });
    // Close results on outside click.
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!searchResultsEl || !searchInputEl) return;
      if (target === searchInputEl || searchResultsEl.contains(target)) return;
      searchResultsEl.classList.remove('is-open');
    });
  }

  function dropMeMarker(lng, lat) {
    if (!state.map || !window.maplibregl) return;
    if (state._meMarker) state._meMarker.remove();
    var el = document.createElement('div');
    el.className = 'me-locate-marker';
    state._meMarker = new window.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(state.map);
  }

  // First-open auto-locate: zoom into the user's location only when no
  // explicit location was restored from URL/hash/localStorage. Silent on
  // permission denial or any failure — falls back to the default view.
  var _autoLocateAttempted = false;
  function maybeAutoLocateOnFirstOpen() {
    if (_autoLocateAttempted) return;
    _autoLocateAttempted = true;
    if (!state.map || !navigator.geolocation) return;
    if (state._restoredCenter || state._restoredCellId) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      if (!state.map) return;
      var lng = pos.coords.longitude;
      var lat = pos.coords.latitude;
      if (!isFinite(lng) || !isFinite(lat)) return;
      if (lng < -180 || lng > 180 || lat < -85 || lat > 85) return;
      // Suppress later data-driven auto-fit so the user's location wins.
      state._fittedOnce = true;
      state.map.flyTo({ center: [lng, lat], zoom: 13, duration: 900, essential: true });
      dropMeMarker(lng, lat);
    }, function () { /* silent: keep default view */ }, {
      enableHighAccuracy: false,
      maximumAge: 60000,
      timeout: 6000,
    });
  }

  // locate-me
  var locateFab = document.getElementById('me-locate-fab');
  if (locateFab) {
    locateFab.addEventListener('click', function () {
      if (!state.map || !navigator.geolocation) {
        setStatus(COPY.locateError);
        return;
      }
      locateFab.classList.add('is-loading');
      navigator.geolocation.getCurrentPosition(function (pos) {
        locateFab.classList.remove('is-loading');
        var lng = pos.coords.longitude;
        var lat = pos.coords.latitude;
        state.map.flyTo({ center: [lng, lat], zoom: 14, duration: 650 });
        // Drop a quick "you are here" marker; cheap DOM element rather than a
        // source so it doesn't need a style reload.
        if (state._meMarker) state._meMarker.remove();
        var el = document.createElement('div');
        el.className = 'me-locate-marker';
        state._meMarker = new window.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(state.map);
      }, function () {
        locateFab.classList.remove('is-loading');
        setStatus(COPY.locateError);
      }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    });
  }

  // ---- Overlay registry wire-up ------------------------------------------
  // Reads the JSON catalog baked into data-overlay-catalog, then adds /
  // removes raster sources + layers on toggle, and updates raster-opacity
  // on slider change. Kept client-side so the server doesn't need to know
  // which overlays are currently visible.

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
      // Insert below the observation cells so the privacy layer remains primary.
      var firstObsLayer = null;
      if (map.getLayer('observation-cell-fill')) firstObsLayer = 'observation-cell-fill';
      else if (map.getLayer('obs-cell-heat')) firstObsLayer = 'obs-cell-heat';
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
      saveMapState();
    });
    range.addEventListener('input', function () {
      var op = Number(range.value);
      if (!isFinite(op)) return;
      overlayState[id].opacity = op;
      if (state.map) setOverlayOpacity(state.map, id, op);
      saveMapState();
    });
  });
})();
</script>`;
}

export const MAP_EXPLORER_STYLES = `
  .me-section {
    --me-map-height: clamp(620px, calc(100vh - 172px), 980px);
    margin-top: 0;
  }
  .me-topbar {
    display: grid;
    gap: 14px 18px;
    grid-template-columns: minmax(0, 1.1fr) minmax(340px, .9fr);
    align-items: start;
    margin-bottom: 16px;
  }
  .me-topbar-primary,
  .me-topbar-secondary {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }
  .me-topbar-secondary {
    justify-content: space-between;
  }
  .me-search-shell {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 56px;
    padding: 8px 12px 8px 16px;
    border-radius: 20px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 10px 28px rgba(15,23,42,.08);
  }
  .me-tabs { display: inline-flex; gap: 4px; padding: 4px; border-radius: 14px; background: rgba(15,23,42,.04); }
  .me-tab { min-height: 48px; padding: 8px 16px; border-radius: 12px; border: 0; background: transparent; font-weight: 800; font-size: 13px; color: #475569; cursor: pointer; transition: background .15s ease, color .15s ease; }
  .me-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 4px 10px rgba(15,23,42,.08); }
  .me-filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .me-filter-group-quick { flex: 1 1 auto; min-height: 56px; padding: 4px 0; }
  .me-filter-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  .me-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .me-chip { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; font-weight: 700; font-size: 12px; color: #334155; cursor: pointer; transition: all .15s ease; }
  .me-chip:hover { border-color: rgba(16,185,129,.35); }
  .me-chip.is-active { background: linear-gradient(135deg, rgba(16,185,129,.16), rgba(14,165,233,.14)); border-color: rgba(16,185,129,.45); color: #065f46; }
  .me-chip-icon { font-size: 13px; }
  .me-filter-drawer { position: relative; flex: 0 0 auto; }
  .me-filter-toggle {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 56px; min-width: 116px; padding: 0 18px;
    border-radius: 16px; cursor: pointer; list-style: none;
    background: #fff; border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 8px 24px rgba(15,23,42,.06);
    font-size: 13px; font-weight: 800; color: #0f172a;
  }
  .me-filter-toggle::-webkit-details-marker { display: none; }
  .me-filter-panel {
    position: absolute; right: 0; top: calc(100% + 10px); z-index: 20;
    width: min(92vw, 640px);
    display: grid; gap: 14px;
    padding: 16px;
    border-radius: 24px;
    background: rgba(255,255,255,.98);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 20px 54px rgba(15,23,42,.16);
  }
  .me-filter-group-actions { justify-content: flex-start; }
  .me-cross-chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 6px 12px; border-radius: 999px; background: rgba(16,185,129,.08); color: #065f46; font-weight: 700; text-decoration: none; transition: background .15s ease; }
  .me-cross-chip:hover { background: rgba(16,185,129,.16); }
  .me-time-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: min(100%, 360px); }
  .me-time-slider-wrap { min-width: 180px; flex: 1 1 220px; display: flex; flex-direction: column; gap: 4px; }
  .me-year-range { width: 100%; accent-color: #10b981; }
  .me-year-scale { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; font-weight: 700; color: #94a3b8; }
  .me-year-pill { min-width: 74px; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.05); font-weight: 800; font-size: 12px; color: #0f172a; text-align: center; }
  .me-share-btn {
    min-height: 38px; padding: 8px 12px; border-radius: 999px;
    border: 1px solid rgba(14,165,233,.18); background: rgba(14,165,233,.08);
    color: #075985; font-size: 12px; font-weight: 800; cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
  }
  .me-share-btn:hover { background: rgba(14,165,233,.14); border-color: rgba(14,165,233,.3); }
  .me-trace-toggle-label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .me-trace-toggle { width: 32px; height: 18px; appearance: none; background: rgba(15,23,42,.12); border-radius: 999px; position: relative; cursor: pointer; transition: background .2s ease; }
  .me-trace-toggle:checked { background: #0ea5e9; }
  .me-trace-toggle::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 2px; left: 2px; transition: left .2s ease; }
  .me-trace-toggle:checked::after { left: 16px; }
  .me-basemap-row { display: inline-flex; gap: 4px; padding: 3px; border-radius: 12px; background: rgba(15,23,42,.04); }
  .me-basemap-opt { position: relative; }
  .me-basemap-opt input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .me-basemap-opt span { display: inline-block; padding: 6px 10px; border-radius: 9px; font-weight: 700; font-size: 12px; color: #475569; transition: background .15s ease, color .15s ease; }
  .me-basemap-opt.is-active span { background: #fff; color: #0f172a; box-shadow: 0 3px 8px rgba(15,23,42,.08); }

  .me-region-bar {
    border-radius: 14px;
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(15,23,42,.05);
    overflow: hidden;
  }
  .me-region-summary {
    display: flex; align-items: center; gap: 8px; padding: 8px 14px;
    cursor: pointer; user-select: none; position: relative;
  }
  .me-region-summary::-webkit-details-marker { display: none; }
  .me-region-summary::after { content: "⌄"; margin-left: auto; font-weight: 800; color: #475569; transition: transform .2s ease; }
  .me-region-bar[open] .me-region-summary::after { transform: rotate(180deg); }
  .me-region-hint { font-size: 11px; color: #64748b; font-weight: 700; }
  .me-region-row { display: flex; gap: 6px; flex-wrap: nowrap; padding: 0 14px 12px; overflow-x: auto; }
  .me-region-chip { white-space: nowrap; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; font-weight: 700; font-size: 12px; color: #334155; cursor: pointer; }
  .me-region-chip:hover { border-color: rgba(14,165,233,.4); }
  .me-region-chip.is-active { background: linear-gradient(135deg, rgba(14,165,233,.18), rgba(16,185,129,.14)); border-color: rgba(14,165,233,.45); color: #075985; }

  .me-overlay-panel {
    padding: 0;
    border-radius: 14px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(15,23,42,.06);
    overflow: hidden;
  }
  .me-overlay-summary {
    display: flex; flex-direction: column; gap: 2px;
    padding: 10px 16px; cursor: pointer; user-select: none;
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

  .me-main {
    display: grid;
    gap: 18px;
    grid-template-columns: clamp(320px, 24vw, 380px) minmax(0, 1fr);
    align-items: start;
  }
  .me-map-wrap {
    position: sticky;
    top: 86px;
    min-height: var(--me-map-height);
    border-radius: 28px;
    overflow: hidden;
    background: linear-gradient(135deg,#ecfeff,#eff6ff);
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 18px 42px rgba(15,23,42,.08);
  }
  .me-map { position: relative; width: 100%; height: var(--me-map-height); min-height: 620px; }
  .me-map-panel {
    position: absolute;
    z-index: 5;
    pointer-events: none;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity .18s ease, transform .18s ease;
  }
  .me-map-panel.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
  .me-map-panel-selection {
    top: 72px;
    left: 18px;
    width: clamp(280px, 28vw, 360px);
    max-width: calc(100% - 36px);
  }
  .me-map-panel-selection .me-map-card {
    max-height: calc(var(--me-map-height) - 96px);
    overflow-y: auto;
  }
  .me-map-panel-insight {
    left: 18px;
    bottom: 18px;
    width: min(420px, calc(100% - 108px));
  }
  .me-map-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 22px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 18px 40px rgba(15,23,42,.14);
    backdrop-filter: blur(16px);
    pointer-events: auto;
  }
  .me-map-card-empty,
  .me-map-card-quiet { gap: 10px; }
  .me-map-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .me-map-card-kicker {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    margin-bottom: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(14,165,233,.1);
    color: #0369a1;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .me-map-card-title { display: block; font-size: 19px; line-height: 1.28; font-weight: 900; color: #0f172a; letter-spacing: -.02em; }
  .me-map-card-copy { display: block; margin-top: 6px; font-size: 12px; line-height: 1.6; color: #64748b; font-weight: 700; }
  .me-map-insight-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .me-map-insight-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 11px 12px;
    border-radius: 16px;
    background: rgba(248,250,252,.88);
    border: 1px solid rgba(148,163,184,.14);
  }
  .me-map-insight-label {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: #64748b;
  }
  .me-map-insight-item strong { font-size: 14px; font-weight: 900; color: #0f172a; }
  .me-map-insight-item span { font-size: 11px; line-height: 1.45; color: #64748b; }
  .me-map-status {
    position: absolute; right: 14px; top: 14px; z-index: 4;
    padding: 6px 12px; border-radius: 999px; background: rgba(15,23,42,.82);
    color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .02em;
    backdrop-filter: blur(8px);
  }

  .me-search-icon { font-size: 13px; color: #475569; }
  .me-search-input {
    flex: 1 1 auto; min-width: 0; border: 0; background: transparent;
    padding: 6px 4px; font-size: 14px; font-weight: 700; color: #0f172a;
    outline: none;
  }
  .me-search-input::placeholder { color: #94a3b8; }
  .me-search-results {
    position: absolute; left: 0; right: 0; top: 100%; margin-top: 6px;
    max-height: 320px; overflow-y: auto; z-index: 6;
    background: #fff; border: 1px solid rgba(15,23,42,.08); border-radius: 14px;
    box-shadow: 0 18px 38px rgba(15,23,42,.14);
    display: none;
  }
  .me-search-results.is-open { display: block; }
  .me-search-row {
    display: flex; flex-direction: column; gap: 2px;
    width: 100%; text-align: left; border: 0; background: transparent;
    padding: 10px 14px; cursor: pointer; border-bottom: 1px solid rgba(15,23,42,.05);
  }
  .me-search-row:last-child { border-bottom: 0; }
  .me-search-row:hover { background: rgba(236,253,245,.55); }
  .me-search-row .me-search-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: fit-content; margin-bottom: 4px; padding: 2px 8px; border-radius: 999px;
    font-size: 10px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase;
  }
  .me-search-row .me-search-badge-species { background: rgba(16,185,129,.14); color: #065f46; }
  .me-search-row .me-search-badge-place { background: rgba(14,165,233,.12); color: #075985; }
  .me-search-row strong { font-size: 13px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
  .me-search-row span { font-size: 11px; color: #64748b; }
  .me-search-empty { padding: 14px; font-size: 12px; color: #64748b; }

  .me-locate-fab {
    position: absolute; right: 14px; bottom: 84px; z-index: 5;
    width: 44px; height: 44px; border-radius: 999px; border: 0;
    background: #fff; color: #0f172a; cursor: pointer;
    box-shadow: 0 10px 24px rgba(15,23,42,.16);
    display: grid; place-items: center; font-size: 18px;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .me-locate-fab:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(15,23,42,.2); }
  .me-locate-fab.is-loading { animation: me-locate-spin .8s linear infinite; }
  @keyframes me-locate-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .me-locate-marker {
    width: 18px; height: 18px; border-radius: 50%;
    background: #0ea5e9; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(14,165,233,.28);
  }
  .me-legend {
    position: absolute; right: 18px; bottom: 18px; z-index: 4;
    padding: 8px 12px; border-radius: 14px;
    background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 8px 16px rgba(15,23,42,.1);
    display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800;
  }
  .me-legend.is-hidden { display: none; }
  .me-legend-label { color: #475569; letter-spacing: .1em; text-transform: uppercase; }
  .me-legend-gradient { width: 140px; height: 10px; border-radius: 999px; display: inline-block; }
  .me-legend-range { display: inline-flex; gap: 10px; color: #64748b; font-weight: 700; }
  .me-search-area-btn {
    position: absolute;
    top: 14px;
    left: 50%;
    z-index: 5;
    transform: translateX(-50%);
    min-height: 44px;
    padding: 0 16px;
    border-radius: 999px;
    border: 1px solid rgba(14,165,233,.22);
    background: rgba(255,255,255,.96);
    box-shadow: 0 12px 30px rgba(15,23,42,.12);
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
  }
  .me-search-area-btn.is-hidden { display: none; }

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
  .me-bottom-photo { width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px 16px 0 0; margin-bottom: 0; }
  .me-bottom-meta { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; margin-top: 10px; }
  .me-bottom-meta strong { font-size: 18px; font-weight: 800; color: #0f172a; }
  .me-bottom-meta span { font-size: 12px; color: #64748b; font-weight: 600; }
  .me-bottom-actions { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
  .me-bottom-actions .btn { padding: 10px 20px; font-size: 14px; font-weight: 800; }
  .me-sheet-ambient { display: grid; gap: 8px; margin-top: 12px; }
  .me-sheet-card { padding: 10px 12px; border-radius: 14px; background: rgba(248,250,252,.94); border: 1px solid rgba(148,163,184,.16); display: flex; flex-direction: column; gap: 3px; }
  .me-sheet-card strong { font-size: 12px; font-weight: 800; color: #0f172a; }
  .me-sheet-card span { font-size: 11px; color: #64748b; line-height: 1.45; }

  .me-site-brief { margin-bottom: 14px; padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(16,185,129,.08), rgba(14,165,233,.08)); border: 1px solid rgba(16,185,129,.22); }
  .me-site-brief-slot { margin-bottom: 14px; }
  .me-site-brief-slot.is-loading { padding: 12px 14px; border-radius: 14px; background: linear-gradient(135deg, rgba(16,185,129,.08), rgba(14,165,233,.08)); border: 1px solid rgba(16,185,129,.22); color: #64748b; font-size: 12px; font-weight: 600; }
  .me-site-brief.is-loading { color: #64748b; font-size: 12px; font-weight: 600; }
  .me-site-brief-error { color: #b91c1c; font-size: 12px; font-weight: 600; background: rgba(254,226,226,.5); border-color: rgba(220,38,38,.2); }
  .me-site-brief-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
  .me-site-brief-label { font-size: 14px; font-weight: 800; color: #064e3b; }
  .me-site-brief-conf { font-size: 11px; font-weight: 800; color: #047857; background: rgba(16,185,129,.18); padding: 2px 8px; border-radius: 999px; }
  .me-site-brief-loop-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
  .me-site-brief-loop-card { padding: 10px 11px; border-radius: 12px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); display: grid; gap: 4px; }
  .me-site-brief-loop-label { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  .me-site-brief-loop-body { font-size: 11.5px; line-height: 1.45; color: #0f172a; font-weight: 700; }
  .me-site-brief-heading { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #059669; margin-bottom: 6px; }
  .me-site-brief-section { margin-top: 6px; }
  .me-site-brief-sublabel { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px; }
  .me-site-brief ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
  .me-site-brief ul li { font-size: 12px; color: #0f172a; line-height: 1.45; }
  .me-site-brief-reasons li { color: #475569; font-size: 11px; }
  @media (max-width: 520px) {
    .me-site-brief-loop-grid { grid-template-columns: 1fr; }
  }
  ${OFFICIAL_NOTICE_CARD_STYLES}

  .me-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .me-side-head { padding: 4px 2px 0; }
  .me-side-title { margin: 0; font-size: 22px; line-height: 1.15; font-weight: 900; color: #0f172a; letter-spacing: -.02em; }
  .me-side-subtitle { margin-top: 6px; font-size: 12px; color: #64748b; font-weight: 700; }
  .me-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: var(--me-map-height);
    overflow-y: auto;
    padding-right: 4px;
  }
  .me-result-row {
    display: grid;
    grid-template-columns: 92px minmax(0,1fr);
    gap: 12px;
    width: 100%;
    padding: 10px;
    border: 1px solid rgba(15,23,42,.06);
    border-radius: 18px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 8px 20px rgba(15,23,42,.05);
    text-align: left;
    cursor: pointer;
  }
  .me-result-row.is-active { border-color: rgba(14,165,233,.28); box-shadow: 0 12px 28px rgba(14,165,233,.12); }
  .me-result-thumb {
    width: 92px;
    height: 92px;
    object-fit: cover;
    border-radius: 14px;
    background: rgba(241,245,249,.9);
  }
  .me-result-thumb-placeholder { display: grid; place-items: center; font-size: 28px; color: #64748b; }
  .me-result-body { display: flex; flex-direction: column; justify-content: center; gap: 5px; min-width: 0; }
  .me-result-body strong { font-size: 14px; font-weight: 900; color: #0f172a; letter-spacing: -.01em; }
  .me-result-body span { font-size: 12px; color: #64748b; line-height: 1.4; }
  .me-result-ai { display: inline-block; padding: 1px 7px; border-radius: 999px; background: rgba(14,165,233,.14); color: #075985; font-size: 10px; font-weight: 900; letter-spacing: .04em; margin-right: 6px; vertical-align: middle; }
  .me-result-awaiting { display: inline-block; padding: 2px 9px; border-radius: 999px; background: rgba(234,179,8,.18); color: #713f12; font-size: 11.5px; font-weight: 900; }
  .me-map-card-ai { color: #075985; font-weight: 900; }
  .me-map-card-awaiting { color: #713f12; font-weight: 900; }
  .me-results-empty, .me-side-empty {
    padding: 16px;
    border-radius: 18px;
    background: rgba(255,255,255,.9);
    border: 1px solid rgba(15,23,42,.06);
    font-size: 13px;
    color: #64748b;
  }
  .me-selected-photo { width: 100%; max-height: 220px; object-fit: cover; border-radius: 16px; margin-bottom: 2px; }
  .me-selected-actions { display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; margin-bottom: 12px; }
  .me-selected-ambient { margin-top: 2px; }
  .me-cluster-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-radius: 10px; background: rgba(248,250,252,.8); font-size: 12px; }
  .me-cluster-item strong { font-weight: 800; color: #059669; }
  .me-chip:focus-visible,
  .me-tab:focus-visible,
  .me-search-row:focus-visible,
  .me-share-btn:focus-visible,
  .me-locate-fab:focus-visible,
  .me-bottom-close:focus-visible,
  .me-year-range:focus-visible,
  .me-result-row:focus-visible,
  .me-filter-toggle:focus-visible,
  .me-search-area-btn:focus-visible {
    outline: 3px solid rgba(14,165,233,.32);
    outline-offset: 2px;
  }

  @media (max-width: 1200px) {
    .me-topbar {
      grid-template-columns: 1fr;
    }
    .me-map-panel-selection {
      width: clamp(260px, 34vw, 320px);
    }
    .me-map-panel-insight {
      width: min(360px, calc(100% - 96px));
    }
  }

  @media (max-width: 900px) {
    .me-topbar-primary,
    .me-topbar-secondary { flex-direction: column; }
    .me-topbar-secondary { justify-content: flex-start; }
    .me-tabs { width: fit-content; }
    .me-filter-drawer { width: 100%; }
    .me-filter-toggle { width: 100%; }
    .me-filter-panel {
      position: static;
      width: auto;
      margin-top: 10px;
      box-shadow: 0 10px 24px rgba(15,23,42,.08);
    }
    .me-main {
      grid-template-columns: 1fr;
    }
    .me-map-wrap {
      position: relative;
      top: auto;
      order: 1;
    }
    .me-map { min-height: 72vh; height: 72vh; }
    .me-map-panel {
      display: none;
    }
    .me-side {
      order: 2;
      display: none;
    }
    .me-search-area-btn {
      top: 72px;
      width: max-content;
      max-width: calc(100% - 28px);
    }
    .me-locate-fab { bottom: 96px; }
    .me-bottom-sheet {
      display: block;
      border-radius: 22px 22px 0 0;
      left: 0;
      right: 0;
      bottom: 0;
      max-height: 62%;
    }
  }
`;
