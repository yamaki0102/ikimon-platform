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
  enjoyTitle: string;
  enjoyLead: string;
  visualCueCount: string;
  visualCueColor: string;
  visualCuePlace: string;
  tabMarkers: string;
  tabHeatmap: string;
  tabPlaces: string;
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
  siteBriefEnvironmentLabel: string;
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
    enjoyTitle: "Enjoy Nature Map",
    enjoyLead: "写真、公園、季節の手がかりから、次に行きたい自然を見つける地図。場所を選ぶと、今見られるものと次にできることが出ます。",
    visualCueCount: "写真カード = 最近の発見",
    visualCueColor: "色 = 生きものの気配",
    visualCuePlace: "面 = 公園・自然共生サイト・学校",
    tabMarkers: "最近の発見",
    tabHeatmap: "季節の気配",
    tabPlaces: "エリア図鑑",
    tabCoverage: "記録の余白",
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
    coverageLegendLow: "これから",
    coverageLegendHigh: "育っている",
    heatmapLegendLow: "少ない",
    heatmapLegendHigh: "多い",
    loading: "読み込み中…",
    statsLabel: (returned, total) => `${returned.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 件`,
    empty: "この範囲はまだこれから。季節や地域を少し広げると、行きたくなる場所が見つかるかもしれません。",
    sideRecentLabel: "近くの発見",
    sideRevisitLabel: "場所のストーリー",
    crossEyebrow: "この場所で、次の自然体験を残す",
    crossLensLabel: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    crossScanLabel: JA_PUBLIC_SHARED_COPY.cta.openScan,
    crossNotesLabel: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    popupOpenLabel: "詳細を開く →",
    bottomSheetRecord: JA_PUBLIC_SHARED_COPY.cta.record,
    bottomSheetNotes: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    bottomSheetLens: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    bottomSheetScan: JA_PUBLIC_SHARED_COPY.cta.openScan,
    siteBriefHeading: "ここで見つかるもの",
    siteBriefReasonsLabel: "最近の発見",
    siteBriefChecksLabel: "歩きながら見たいこと",
    siteBriefCapturesLabel: "撮るなら",
    siteBriefEnvironmentLabel: "衛星・地図の手がかり",
    siteBriefWhyHereLabel: "行きたくなる理由",
    siteBriefWhyNowLabel: "今の季節",
    siteBriefOneVisitLabel: "今日できること",
    siteBriefNextHookLabel: "また見たくなること",
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
    enjoyTitle: "Enjoy Nature Map",
    enjoyLead: "Find the next place you want to visit through photos, parks, seasons, and field clues. Pick a place to see what is visible now and what to do next.",
    visualCueCount: "Photo cards = recent finds",
    visualCueColor: "Color = signs of life",
    visualCuePlace: "Areas = parks / symbiosis sites / schools",
    tabMarkers: "Recent finds",
    tabHeatmap: "Seasonal signs",
    tabPlaces: "Area Albums",
    tabCoverage: "Open gaps",
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
    empty: "This area is still opening up. Widen the season or region to find a place worth visiting.",
    sideRecentLabel: "Nearby finds",
    sideRevisitLabel: "Place story",
    crossEyebrow: "Your next nature page starts here",
    crossLensLabel: "Open Lens",
    crossScanLabel: "Open Explore Map",
    crossNotesLabel: "Back to notebook",
    popupOpenLabel: "Open detail →",
    bottomSheetRecord: "Record here",
    bottomSheetNotes: "Notebook detail",
    bottomSheetLens: "Lens",
    bottomSheetScan: "Scan",
    siteBriefHeading: "What you may find here",
    siteBriefReasonsLabel: "Why",
    siteBriefChecksLabel: "Check on the ground",
    siteBriefCapturesLabel: "If you shoot",
    siteBriefEnvironmentLabel: "Satellite/map clues",
    siteBriefWhyHereLabel: "why go",
    siteBriefWhyNowLabel: "this season",
    siteBriefOneVisitLabel: "what to do",
    siteBriefNextHookLabel: "why return",
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
    enjoyTitle: "Enjoy Nature Map",
    enjoyLead: "Encuentra el próximo lugar para visitar a partir de fotos, parques, estaciones y pistas de campo. Elige un lugar para ver qué hay ahora y qué hacer después.",
    visualCueCount: "Tarjetas con foto = hallazgos recientes",
    visualCueColor: "Color = señales de vida",
    visualCuePlace: "Zonas = parques / sitios de simbiosis / escuelas",
    tabMarkers: "Hallazgos recientes",
    tabHeatmap: "Señales de estación",
    tabPlaces: "Álbumes de áreas",
    tabCoverage: "Huecos por mirar",
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
    empty: "Esta zona todavía se está abriendo. Amplía estación o región para encontrar un lugar que invite a ir.",
    sideRecentLabel: "Hallazgos cercanos",
    sideRevisitLabel: "Historia del lugar",
    crossEyebrow: "Tu próxima página de naturaleza empieza aquí",
    crossLensLabel: "Abrir Guía de Campo",
    crossScanLabel: "Abrir Escaneo",
    crossNotesLabel: "Volver al cuaderno",
    popupOpenLabel: "Ver detalle →",
    bottomSheetRecord: "Registrar aquí",
    bottomSheetNotes: "Detalle del cuaderno",
    bottomSheetLens: "Guía de Campo",
    bottomSheetScan: "Escaneo",
    siteBriefHeading: "Qué puedes encontrar aquí",
    siteBriefReasonsLabel: "Por qué",
    siteBriefChecksLabel: "Verifica en el sitio",
    siteBriefCapturesLabel: "Si disparas",
    siteBriefEnvironmentLabel: "Pistas de satélite/mapa",
    siteBriefWhyHereLabel: "por qué ir",
    siteBriefWhyNowLabel: "esta estación",
    siteBriefOneVisitLabel: "qué hacer",
    siteBriefNextHookLabel: "por qué volver",
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
    enjoyTitle: "Enjoy Nature Map",
    enjoyLead: "Encontre o próximo lugar para visitar por fotos, parques, estações e pistas de campo. Escolha um lugar para ver o que aparece agora e o que fazer depois.",
    visualCueCount: "Cartões com foto = descobertas recentes",
    visualCueColor: "Cor = sinais de vida",
    visualCuePlace: "Áreas = parques / sítios de simbiose / escolas",
    tabMarkers: "Descobertas recentes",
    tabHeatmap: "Sinais da estação",
    tabPlaces: "Álbuns de áreas",
    tabCoverage: "Lacunas para olhar",
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
    empty: "Esta área ainda está se abrindo. Amplie a estação ou região para encontrar um lugar que dê vontade de visitar.",
    sideRecentLabel: "Descobertas por perto",
    sideRevisitLabel: "História do local",
    crossEyebrow: "Sua próxima página de natureza começa aqui",
    crossLensLabel: "Abrir Guia de Campo",
    crossScanLabel: "Abrir Escaneamento",
    crossNotesLabel: "Voltar ao caderno",
    popupOpenLabel: "Ver detalhe →",
    bottomSheetRecord: "Registrar aqui",
    bottomSheetNotes: "Detalhe do caderno",
    bottomSheetLens: "Guia de Campo",
    bottomSheetScan: "Escaneamento",
    siteBriefHeading: "O que você pode encontrar aqui",
    siteBriefReasonsLabel: "Porquê",
    siteBriefChecksLabel: "Verifique no campo",
    siteBriefCapturesLabel: "Se for fotografar",
    siteBriefEnvironmentLabel: "Pistas de satélite/mapa",
    siteBriefWhyHereLabel: "por que ir",
    siteBriefWhyNowLabel: "esta estação",
    siteBriefOneVisitLabel: "o que fazer",
    siteBriefNextHookLabel: "por que voltar",
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

export type MapItem =
  | { type: "observation"; occurrenceId: string; displayName: string; photoUrl?: string | null }
  | { type: "guide"; guideRecordId: string; displayName: string; photoUrl?: string | null }
  | { type: "scan"; visitId: string; displayName: string; photoUrl?: string | null }
  | { type: "place"; fieldId: string; name: string; source: string }
  | { type: "frontier_cell"; cellId: string; recommendedRole: "note" | "guide" | "scan" | "mixed" };

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
        { value: "note", label: "Notebook", icon: "📖" },
        { value: "guide", label: "Check here", icon: "🔍" },
        { value: "scan", label: "Explore", icon: "📡" },
        { value: "mixed", label: "All-round", icon: "🧭" },
      ],
      selfLabel: "My progress",
      communityLabel: "Area progress",
      frontierLabel: "Places you may want to see",
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
      frontierLabel: "Lugares que dan ganas de ver",
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
      frontierLabel: "Lugares que dão vontade de ver",
      roleCardLabel: "Melhor papel aqui",
    };
  }
  return {
    roleLabel: "役割",
    roles: [
      { value: "note", label: "ノート", icon: "📖" },
      { value: "guide", label: "その場で調べる", icon: "🔍" },
      { value: "scan", label: "探索", icon: "📡" },
      { value: "mixed", label: "ひと通り見る", icon: "🧭" },
    ],
    selfLabel: "キミの記録が役立ったこと",
    communityLabel: "みんなの記録が育てた場所",
    frontierLabel: "次に見に行きたい余白",
    roleCardLabel: "次にできること",
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
  const notesHref = appendLangToHref(withBasePath(props.basePath, "/notes"), props.lang);
  const lensHref = appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang);
  const apiCells = withBasePath(props.basePath, "/api/v1/map/cells");
  const apiObservations = withBasePath(props.basePath, "/api/v1/map/observations");
  const apiSiteBrief = withBasePath(props.basePath, "/api/v1/map/site-brief");
  const apiTraces = withBasePath(props.basePath, "/api/v1/map/traces");
  const apiFrontier = withBasePath(props.basePath, "/api/v1/map/frontier");
  const apiEffortSummary = withBasePath(props.basePath, "/api/v1/map/effort-summary");
  const apiAreaPolygons = withBasePath(props.basePath, "/api/v1/map/area-polygons");
  const apiAreaSnapshotTemplate = withBasePath(props.basePath, "/api/v1/fields/__FIELD_ID__/area-snapshot");
  const apiAreaFollow = withBasePath(props.basePath, "/api/v1/me/area-subscriptions");
  const eventsNewHrefTemplate = appendLangToHref(
    withBasePath(props.basePath, "/community/events/new?field_id=__FIELD_ID__"),
    props.lang,
  );

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

  const areaSourceFilterLabel = lang === "ja"
    ? "エリア種別"
    : lang === "es"
      ? "Tipo de área"
      : lang === "pt-BR"
        ? "Tipo de área"
        : "Area type";
  const areaSourceAllLabel = lang === "ja"
    ? "すべて"
    : lang === "es"
      ? "Todo"
      : lang === "pt-BR"
        ? "Tudo"
        : "All";
  const areaSourceOptions = [
    {
      value: "nature_symbiosis_site",
      label: lang === "ja" ? "自然共生サイト" : lang === "es" ? "Sitios de simbiosis" : lang === "pt-BR" ? "Sítios de simbiose" : "Symbiosis sites",
      icon: "🌱",
    },
    { value: "tsunag", label: "TSUNAG", icon: "🔗" },
    {
      value: "school",
      label: lang === "ja" ? "学校・キャンパス" : lang === "es" ? "Escuelas/campus" : lang === "pt-BR" ? "Escolas/campus" : "Schools/campuses",
      icon: "🏫",
    },
    {
      value: "protected_area,oecm,osm_park,user_defined",
      label: lang === "ja" ? "公園・保護区" : lang === "es" ? "Parques/protegidas" : lang === "pt-BR" ? "Parques/protegidas" : "Parks/protected",
      icon: "🌳",
    },
  ];
  const areaSourceFiltersHtml = `<label class="me-area-source-opt is-active" data-area-source-all>
      <input type="checkbox" id="me-area-source-all" checked />
      <span aria-hidden="true">◎</span>
      <strong>${escapeHtml(areaSourceAllLabel)}</strong>
    </label>` + areaSourceOptions
      .map((opt) => `<label class="me-area-source-opt" data-area-source-opt>
        <input type="checkbox" class="me-area-source-toggle" data-area-source="${escapeHtml(opt.value)}" />
        <span aria-hidden="true">${escapeHtml(opt.icon)}</span>
        <strong>${escapeHtml(opt.label)}</strong>
      </label>`)
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
    ? "近くの発見"
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
  const sideTabResultsLabel = lang === "ja"
    ? "最近の発見"
    : lang === "es"
      ? "Lista"
      : lang === "pt-BR"
        ? "Lista"
        : "List";
  const sideTabSelectionLabel = lang === "ja"
    ? "場所ストーリー"
    : lang === "es"
      ? "Este lugar"
      : lang === "pt-BR"
        ? "Este local"
        : "This place";
  const sideToggleLabel = lang === "ja"
    ? "サイドパネルを折りたたむ"
    : lang === "es"
      ? "Plegar panel lateral"
      : lang === "pt-BR"
        ? "Recolher painel"
        : "Collapse side panel";
  const sideSelectionEmptyLabel = lang === "ja"
    ? "公園、緑地、発見カードを選ぶと、ここに今見られるものと次の行動が出ます。"
    : lang === "es"
      ? "Toca un pin o una celda del mapa para ver los detalles aquí."
      : lang === "pt-BR"
        ? "Toque em um pino ou célula no mapa para ver os detalhes aqui."
        : "Tap a pin or cell on the map to see details here.";

  return `<section class="section me-section" data-side="open" aria-label="Map Explorer">
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
          <button type="button" class="me-tab" role="tab" aria-selected="false" data-tab="places">${escapeHtml(copy.tabPlaces)}</button>
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
            <div class="me-filter-group me-area-source-group">
              <span class="me-filter-label">${escapeHtml(areaSourceFilterLabel)}</span>
              <div class="me-area-source-row" role="group" aria-label="${escapeHtml(areaSourceFilterLabel)}">${areaSourceFiltersHtml}</div>
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
      <aside class="me-side" id="me-side" data-tab="results" aria-label="result panel">
        <button type="button" class="me-side-toggle" id="me-side-toggle" aria-label="${escapeHtml(sideToggleLabel)}" title="${escapeHtml(sideToggleLabel)}" aria-expanded="true">
          <span class="me-side-toggle-icon" aria-hidden="true">‹</span>
        </button>
        <div class="me-side-rail-icons" aria-hidden="true">
          <span>📋</span>
          <span class="me-side-rail-count" id="me-side-rail-count">—</span>
        </div>
        <div class="me-side-tabs" role="tablist">
          <button type="button" class="me-side-tab is-active" data-side-tab="results" role="tab" aria-selected="true">${escapeHtml(sideTabResultsLabel)}</button>
          <button type="button" class="me-side-tab" data-side-tab="selection" role="tab" aria-selected="false" disabled>${escapeHtml(sideTabSelectionLabel)}</button>
        </div>
        <div class="me-side-body">
          <div class="me-side-pane me-side-pane-results" role="tabpanel">
            <div class="me-side-head">
              <h3 class="me-side-title">${escapeHtml(listHeading)}</h3>
              <div class="me-side-subtitle" id="me-side-status">${escapeHtml(copy.loading)}</div>
            </div>
            <div class="me-contribution-panel" id="me-contribution-panel" data-testid="map-contribution-panel"></div>
            <div class="me-results-list" id="me-results-list" data-testid="map-result-list"></div>
          </div>
          <div class="me-side-pane me-side-pane-selection" role="tabpanel">
            <div class="me-map-panel me-map-panel-selection" id="me-map-selection-card"></div>
            <div class="me-side-pane-selection-empty" id="me-side-selection-empty">${escapeHtml(sideSelectionEmptyLabel)}</div>
          </div>
        </div>
      </aside>
      <div class="me-map-wrap">
        <div id="map-explorer" class="me-map" data-results-pending="0" data-api-cells="${escapeHtml(apiCells)}" data-api-observations="${escapeHtml(apiObservations)}" data-api-site-brief="${escapeHtml(apiSiteBrief)}" data-api-traces="${escapeHtml(apiTraces)}" data-api-frontier="${escapeHtml(apiFrontier)}" data-api-effort-summary="${escapeHtml(apiEffortSummary)}" data-api-area-polygons="${escapeHtml(apiAreaPolygons)}" data-api-area-snapshot="${escapeHtml(apiAreaSnapshotTemplate)}" data-api-area-follow="${escapeHtml(apiAreaFollow)}" data-events-new-href="${escapeHtml(eventsNewHrefTemplate)}"></div>
        <div class="me-enjoy-strip" aria-label="${escapeHtml(copy.enjoyTitle)}">
          <strong>${escapeHtml(copy.enjoyTitle)}</strong>
          <span>${escapeHtml(copy.enjoyLead)}</span>
          <div class="me-map-cues" aria-hidden="true">
            <span><i class="me-cue-dot"></i>${escapeHtml(copy.visualCueCount)}</span>
            <span><i class="me-cue-rainbow"></i>${escapeHtml(copy.visualCueColor)}</span>
            <span><i class="me-cue-place"></i>${escapeHtml(copy.visualCuePlace)}</span>
          </div>
        </div>
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
          <button type="button" class="me-bottom-grip" id="me-bottom-grip" aria-label="詳細を広げる"></button>
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
  var sheetGripEl = document.getElementById('me-bottom-grip');
  var sideStatusEl = document.getElementById('me-side-status');
  var resultsListEl = document.getElementById('me-results-list');
  var selectedCardEl = document.getElementById('me-map-selection-card');
  var mapInsightCardEl = document.getElementById('me-map-insight-card');
  var contributionPanelEl = document.getElementById('me-contribution-panel');
  var sideEl = document.getElementById('me-side');
  var sideToggleEl = document.getElementById('me-side-toggle');
  var sideRailCountEl = document.getElementById('me-side-rail-count');
  var sideSelectionEmptyEl = document.getElementById('me-side-selection-empty');
  var sideSectionEl = sideEl ? sideEl.closest('.me-section') : null;
  var sideTabBtns = document.querySelectorAll('[data-side-tab]');
  function setSideTab(name) {
    if (!sideEl) return;
    sideEl.setAttribute('data-tab', name);
    for (var i = 0; i < sideTabBtns.length; i++) {
      var btn = sideTabBtns[i];
      var on = btn.getAttribute('data-side-tab') === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }
  function setSideSelectionTabAvailable(available) {
    var btn = document.querySelector('[data-side-tab="selection"]');
    if (!btn) return;
    if (available) btn.removeAttribute('disabled');
    else btn.setAttribute('disabled', 'disabled');
  }
  function setSideRailMode(rail) {
    if (!sideSectionEl) return;
    sideSectionEl.setAttribute('data-side', rail ? 'rail' : 'open');
    if (sideToggleEl) sideToggleEl.setAttribute('aria-expanded', rail ? 'false' : 'true');
    try { window.localStorage.setItem('me-side-rail', rail ? '1' : '0'); } catch (e) {}
    // Resize map after panel size change so MapLibre picks up new dimensions.
    setTimeout(function () {
      try { if (state && state.map && state.map.resize) state.map.resize(); } catch (e) {}
    }, 280);
  }
  if (sideToggleEl) {
    sideToggleEl.addEventListener('click', function () {
      var nowRail = !sideSectionEl || sideSectionEl.getAttribute('data-side') !== 'rail';
      setSideRailMode(nowRail);
    });
  }
  for (var st = 0; st < sideTabBtns.length; st++) {
    sideTabBtns[st].addEventListener('click', function (ev) {
      var t = ev.currentTarget;
      if (t.hasAttribute('disabled')) return;
      setSideTab(t.getAttribute('data-side-tab') || 'results');
    });
  }
  try {
    var stored = window.localStorage.getItem('me-side-rail');
    if (stored === '1') setSideRailMode(true);
  } catch (e) {}
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
  var apiAreaPolygons = root.getAttribute('data-api-area-polygons') || '';
  var apiAreaSnapshotTemplate = root.getAttribute('data-api-area-snapshot') || '';
  var apiAreaFollow = root.getAttribute('data-api-area-follow') || '';
  var eventsNewHrefTemplate = root.getAttribute('data-events-new-href') || '';

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
    siteBriefEnvironmentLabel: copy.siteBriefEnvironmentLabel,
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
    seasonAll: copy.seasonAll,
    seasonSpring: copy.seasonSpring,
    seasonSummer: copy.seasonSummer,
    seasonAutumn: copy.seasonAutumn,
    seasonWinter: copy.seasonWinter,
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
    actorHint_all: props.lang === "ja" ? "地図全体のまだ知らない場所を眺める" : props.lang === "es" ? "Mirar lugares por conocer en todo el mapa" : props.lang === "pt-BR" ? "Ver lugares a conhecer no mapa todo" : "Browse unknown places across the map",
    actorHint_local_steward: props.lang === "ja" ? "同じ場所を育てる前提で見る" : props.lang === "es" ? "Mirar para volver y cuidar" : props.lang === "pt-BR" ? "Olhar para voltar e cuidar" : "Look as someone who will return",
    actorHint_traveler: props.lang === "ja" ? "一度の訪問で開ける空白を探す" : props.lang === "es" ? "Buscar huecos para una sola visita" : props.lang === "pt-BR" ? "Buscar vazios de visita única" : "Look for gaps to open in one visit",
    actorHint_casual: props.lang === "ja" ? "生活動線の近くにある余白を見る" : props.lang === "es" ? "Ver lugares pendientes cerca de la rutina" : props.lang === "pt-BR" ? "Ver lugares pendentes perto da rotina" : "Look for nearby everyday gaps",
    roleHintScan: props.lang === "ja" ? "気になる余白を見に行くなら周辺を散歩" : props.lang === "es" ? "Pasea alrededor para conocer huecos" : props.lang === "pt-BR" ? "Caminhe ao redor para conhecer vazios" : "Walk nearby to explore the blank spots",
    roleHintGuide: props.lang === "ja" ? "確度を上げるならその場で調べる" : props.lang === "es" ? "Consulta en el sitio para subir la certeza" : props.lang === "pt-BR" ? "Verifique no local para subir a certeza" : "Check on site to raise certainty",
    roleHintNote: props.lang === "ja" ? "比較可能にするならノートに残す" : props.lang === "es" ? "Deja una nota para hacerlo comparable" : props.lang === "pt-BR" ? "Registre em nota para tornar comparável" : "Leave a note to make it revisitable",
    roleHintMixed: props.lang === "ja" ? "今日は周辺写真・足元動画・メモ1行で進める" : props.lang === "es" ? "Hoy avanza con una foto amplia, un video corto y una nota" : props.lang === "pt-BR" ? "Hoje avance com uma foto ampla, um vídeo curto e uma nota" : "Use one wide photo, a short clip, and a note today",
    axis_scan_pass: props.lang === "ja" ? "まだ歩かれていない道がある" : props.lang === "es" ? "Quedan caminos poco recorridos" : props.lang === "pt-BR" ? "Ainda há caminhos pouco vistos" : "some paths are still little explored",
    axis_guide_scene: props.lang === "ja" ? "現地で見たい手がかりがある" : props.lang === "es" ? "Hay pistas para ver en sitio" : props.lang === "pt-BR" ? "Há pistas para ver no local" : "there are clues to see on site",
    axis_revisit_note: props.lang === "ja" ? "また行くと変化が見えそう" : props.lang === "es" ? "Volver puede mostrar cambios" : props.lang === "pt-BR" ? "Voltar pode mostrar mudanças" : "returning could reveal changes",
    contributorBand_0: props.lang === "ja" ? "まだ集計なし" : props.lang === "es" ? "Sin agregado aún" : props.lang === "pt-BR" ? "Sem agregado ainda" : "No aggregate yet",
    contributorBand_1_2: props.lang === "ja" ? "1-2人ほど" : props.lang === "es" ? "1-2 personas" : props.lang === "pt-BR" ? "1-2 pessoas" : "about 1-2 people",
    contributorBand_3_5: props.lang === "ja" ? "3-5人ほど" : props.lang === "es" ? "3-5 personas" : props.lang === "pt-BR" ? "3-5 pessoas" : "about 3-5 people",
    contributorBand_6p: props.lang === "ja" ? "6人以上" : props.lang === "es" ? "6 o más" : props.lang === "pt-BR" ? "6 ou mais" : "6+ people",
    winsLabel: props.lang === "ja" ? "前進" : props.lang === "es" ? "Avances" : props.lang === "pt-BR" ? "Avanços" : "wins",
    revisitLabel: props.lang === "ja" ? "再訪地点" : props.lang === "es" ? "Revisitas" : props.lang === "pt-BR" ? "Revisitas" : "revisits",
    communityStrengthLabel: props.lang === "ja" ? "最近厚くなった帯" : props.lang === "es" ? "Áreas reforzadas" : props.lang === "pt-BR" ? "Faixas fortalecidas" : "strengthened bands",
    communityProgressLabel: props.lang === "ja" ? "共同前進" : props.lang === "es" ? "Progreso colectivo" : props.lang === "pt-BR" ? "Progresso coletivo" : "collective progress",
    aggregateContributorLabel: props.lang === "ja" ? "集計された記録者" : props.lang === "es" ? "personas agregadas" : props.lang === "pt-BR" ? "pessoas agregadas" : "aggregated contributors",
    frontierBlankLabel: props.lang === "ja" ? "まだ知らない場所" : props.lang === "es" ? "lugares por conocer" : props.lang === "pt-BR" ? "lugares a conhecer" : "unknown places",
    frontierBuildingLabel: props.lang === "ja" ? "育ち始め" : props.lang === "es" ? "en construcción" : props.lang === "pt-BR" ? "em construção" : "building",
    frontierRepeatableLabel: props.lang === "ja" ? "比較可能" : props.lang === "es" ? "comparables" : props.lang === "pt-BR" ? "comparáveis" : "repeatable",
    frontierMatureLabel: props.lang === "ja" ? "厚い帯" : props.lang === "es" ? "maduras" : props.lang === "pt-BR" ? "maduras" : "mature",
    campaign_scan_blank: props.lang === "ja" ? "まだ知らない場所をひとつ見に行く" : props.lang === "es" ? "Visitar un lugar por conocer" : props.lang === "pt-BR" ? "Visitar um lugar a conhecer" : "Visit one unknown place",
    campaign_guide_building: props.lang === "ja" ? "育ち始めの場所の確度を上げる" : props.lang === "es" ? "Subir la certeza de zonas en crecimiento" : props.lang === "pt-BR" ? "Aumentar a certeza das zonas em crescimento" : "Raise certainty in building areas",
    campaign_note_repeatable: props.lang === "ja" ? "比較できる場所をもう一段厚くする" : props.lang === "es" ? "Hacer más densa una zona repetible" : props.lang === "pt-BR" ? "Tornar mais espessa uma zona repetível" : "Thicken one repeatable area",
    campaign_mixed_frontier: props.lang === "ja" ? "気になる場所の見え方を少し増やす" : props.lang === "es" ? "Añadir más mirada a un lugar curioso" : props.lang === "pt-BR" ? "Adicionar mais olhar a um lugar curioso" : "Add another view to a curious place",
    priorityCueLabel: props.lang === "ja" ? "優先理由" : props.lang === "es" ? "prioridad" : props.lang === "pt-BR" ? "prioridade" : "priority",
    priority_steady_revisit: props.lang === "ja" ? "再訪で厚くする" : props.lang === "es" ? "Engrosar con revisitas" : props.lang === "pt-BR" ? "Espessar com revisitas" : "Thicken by revisiting",
    priority_fresh_gap: props.lang === "ja" ? "新しい空白を開く" : props.lang === "es" ? "Abrir un hueco nuevo" : props.lang === "pt-BR" ? "Abrir um vazio novo" : "Open a fresh gap",
    priority_nearby_gap: props.lang === "ja" ? "近くにまだ知らない場所がある" : props.lang === "es" ? "Hay lugares cercanos por conocer" : props.lang === "pt-BR" ? "Há lugares perto para conhecer" : "There are unknown places nearby",
    remainingLabel: props.lang === "ja" ? "まだ知らない場所" : props.lang === "es" ? "lugares por conocer" : props.lang === "pt-BR" ? "lugares a conhecer" : "unknown places",
    aggregateModeNote: props.lang === "ja" ? "他ユーザー個別ではなく、地域の集計だけを表示中" : props.lang === "es" ? "Solo agregados del área, no personas concretas" : props.lang === "pt-BR" ? "Somente agregados da área, sem pessoas específicas" : "Area aggregate only, no individual people shown",
    impactPanelTitleMine: props.lang === "ja" ? "キミの記録が役立っていること" : props.lang === "es" ? "Cómo ayudan tus registros" : props.lang === "pt-BR" ? "Como seus registros ajudam" : "How your records help",
    impactPanelTitleGuest: props.lang === "ja" ? "みんなの記録がこの地域を育てています" : props.lang === "es" ? "Los registros de todos hacen crecer esta zona" : props.lang === "pt-BR" ? "Os registros de todos fazem esta área crescer" : "Everyone's records grow this area",
    impactPanelLoading: props.lang === "ja" ? "この範囲で役立っていることを読み込み中…" : props.lang === "es" ? "Leyendo cómo ayuda esta zona…" : props.lang === "pt-BR" ? "Lendo como esta área ajuda…" : "Reading how this area is growing…",
    impactRevisitStory: props.lang === "ja" ? "同じ場所を比べられるようになった" : props.lang === "es" ? "Hizo posible comparar el mismo lugar" : props.lang === "pt-BR" ? "Tornou possível comparar o mesmo lugar" : "Made the same place comparable",
    impactGuideStory: props.lang === "ja" ? "ガイド記録で季節の手がかりが増えた" : props.lang === "es" ? "La guía añadió pistas de temporada" : props.lang === "pt-BR" ? "O guia adicionou pistas da estação" : "Guide records added seasonal clues",
    impactScanStory: props.lang === "ja" ? "スキャンで未調査エリアが見えた" : props.lang === "es" ? "El escaneo mostró huecos por explorar" : props.lang === "pt-BR" ? "O escaneamento mostrou áreas a explorar" : "Scans revealed places still to explore",
    impactBlankStory: props.lang === "ja" ? "この場所の空白を埋める候補が見えた" : props.lang === "es" ? "Aparecieron huecos que se pueden completar" : props.lang === "pt-BR" ? "Apareceram vazios que podem ser preenchidos" : "Found gaps that can be filled",
    impactCommunityStory: props.lang === "ja" ? "最近、見え方が厚くなった場所" : props.lang === "es" ? "Lugares que se hicieron más claros hace poco" : props.lang === "pt-BR" ? "Lugares que ficaram mais claros recentemente" : "Places that became clearer recently",
    impactPrivateNote: props.lang === "ja" ? "個人名ではなく、地域の集計だけで表示しています。" : props.lang === "es" ? "Se muestra solo agregado del área, no nombres." : props.lang === "pt-BR" ? "Mostramos apenas agregados da área, sem nomes." : "Only area aggregates are shown, not names.",
    searchArea: props.lang === "ja" ? "この範囲で再検索" : props.lang === "es" ? "Buscar en esta área" : props.lang === "pt-BR" ? "Buscar nesta área" : "Search this area",
    resultHeading: props.lang === "ja" ? "近くの発見" : props.lang === "es" ? "Hallazgos cercanos" : props.lang === "pt-BR" ? "Descobertas por perto" : "Nearby finds",
    resultCountLabel: props.lang === "ja" ? "件を表示中" : props.lang === "es" ? "resultados visibles" : props.lang === "pt-BR" ? "resultados visíveis" : "results visible",
    movedHint: props.lang === "ja" ? "地図を動かした。結果を更新するには押す。" : props.lang === "es" ? "Moviste el mapa. Pulsa para actualizar resultados." : props.lang === "pt-BR" ? "Você moveu o mapa. Toque para atualizar." : "Map moved. Press to refresh results.",
    selectHint: props.lang === "ja" ? "エリアか一覧を選ぶと、ここに写真と次の行動が出る。" : props.lang === "es" ? "Elige un área o una fila para ver foto y siguiente acción." : props.lang === "pt-BR" ? "Escolha uma área ou item para ver foto e próxima ação." : "Pick an area or row to see the photo and next action.",
    placeHint: props.lang === "ja" ? "地図を押すと、その地点の仮説と次の行動をここに出す。" : props.lang === "es" ? "Toca el mapa para ver la hipótesis del lugar y la siguiente acción." : props.lang === "pt-BR" ? "Toque no mapa para ver a hipótese do lugar e a próxima ação." : "Tap the map to see the place hypothesis and next action.",
    selectedCardLabel: props.lang === "ja" ? "詳細を見る" : props.lang === "es" ? "Ver detalle" : props.lang === "pt-BR" ? "Ver detalhes" : "Open detail",
    identifyLabel: props.lang === "ja" ? "同定する" : props.lang === "es" ? "Identificar" : props.lang === "pt-BR" ? "Identificar" : "Identify",
    selectedFieldLabel: props.lang === "ja" ? "この場所の見え方" : props.lang === "es" ? "Cómo se ve este lugar" : props.lang === "pt-BR" ? "Como este lugar aparece" : "How this place reads",
    selectedRoleLead: props.lang === "ja" ? "手がかり" : props.lang === "es" ? "Pistas" : props.lang === "pt-BR" ? "Pistas" : "Clues",
    selectionObservationLabel: props.lang === "ja" ? "選択中の観察" : props.lang === "es" ? "Observación seleccionada" : props.lang === "pt-BR" ? "Observação selecionada" : "Selected observation",
    selectionPlaceLabel: props.lang === "ja" ? "地図の手がかり" : props.lang === "es" ? "Pistas del mapa" : props.lang === "pt-BR" ? "Pistas do mapa" : "Map clues",
    placeStoryTitle: props.lang === "ja" ? "場所ストーリー" : props.lang === "es" ? "Historia del lugar" : props.lang === "pt-BR" ? "História do local" : "Place story",
    placeStoryNow: props.lang === "ja" ? "今見られるもの" : props.lang === "es" ? "Lo que se puede ver ahora" : props.lang === "pt-BR" ? "O que dá para ver agora" : "What you may find now",
    placeStoryRecent: props.lang === "ja" ? "最近の発見" : props.lang === "es" ? "Hallazgos recientes" : props.lang === "pt-BR" ? "Descobertas recentes" : "Recent finds",
    placeStoryMissing: props.lang === "ja" ? "この場所で足りない記録" : props.lang === "es" ? "Registros que faltan aquí" : props.lang === "pt-BR" ? "Registros que faltam aqui" : "What is missing here",
    placeStoryActions: props.lang === "ja" ? "次にできること" : props.lang === "es" ? "Qué hacer después" : props.lang === "pt-BR" ? "O que fazer a seguir" : "What to do next",
    placeStoryNoTaxa: props.lang === "ja" ? "まだ代表種は少ない。最初の写真が場所の入口になります。" : props.lang === "es" ? "Aún hay pocos taxones destacados. La primera foto puede abrir este lugar." : props.lang === "pt-BR" ? "Ainda há poucos grupos destacados. A primeira foto pode abrir este local." : "Few featured taxa yet. The first photo can open this place.",
    placeStoryNeedSeason: props.lang === "ja" ? "季節をまたいだ記録が増えると、また行く理由が強くなる。" : props.lang === "es" ? "Más estaciones harán más fuerte el motivo para volver." : props.lang === "pt-BR" ? "Mais estações tornam o motivo para voltar mais forte." : "More seasons make the reason to return stronger.",
    placeStoryNeedGuide: props.lang === "ja" ? "ガイドでその場の手がかりを残すと、次の人が見つけやすい。" : props.lang === "es" ? "La guía deja pistas para que la siguiente persona encuentre más." : props.lang === "pt-BR" ? "O guia deixa pistas para a próxima pessoa encontrar mais." : "Guide clues help the next visitor find more.",
    coverSourceAdmin: props.lang === "ja" ? "管理者が選んだ代表写真" : props.lang === "es" ? "Foto destacada por el gestor" : props.lang === "pt-BR" ? "Foto escolhida pelo gestor" : "Manager-picked cover photo",
    coverSourceCommunity: props.lang === "ja" ? "みんなが選んだ代表写真" : props.lang === "es" ? "Foto destacada por la comunidad" : props.lang === "pt-BR" ? "Foto escolhida pela comunidade" : "Community-picked cover photo",
    coverSourceAuto: props.lang === "ja" ? "最近の発見から自動選定" : props.lang === "es" ? "Elegida automáticamente de hallazgos recientes" : props.lang === "pt-BR" ? "Escolhida automaticamente de descobertas recentes" : "Auto-picked from recent finds",
    coverFallbackTitle: props.lang === "ja" ? "代表写真" : props.lang === "es" ? "Foto del lugar" : props.lang === "pt-BR" ? "Foto do local" : "Place photo",
    areaGalleryTitle: props.lang === "ja" ? "このエリアで観察されたもの" : props.lang === "es" ? "Observado en esta zona" : props.lang === "pt-BR" ? "Observado nesta área" : "Observed in this area",
    areaGalleryLead: props.lang === "ja" ? "写真と記録から、この場所の顔をざっと見る。" : props.lang === "es" ? "Ver rápidamente la cara del lugar desde fotos y registros." : props.lang === "pt-BR" ? "Ver rapidamente a cara do lugar por fotos e registros." : "Scan the place through photos and records.",
    areaGalleryEmpty: props.lang === "ja" ? "まだ記録がありません。最初の発見者になれる場所です。" : props.lang === "es" ? "Aún no hay registros. Puedes ser quien abra este lugar." : props.lang === "pt-BR" ? "Ainda não há registros. Você pode abrir este lugar." : "No records yet. You can be the first finder here.",
    areaGalleryCountSuffix: props.lang === "ja" ? "件" : props.lang === "es" ? " registros" : props.lang === "pt-BR" ? " registros" : " records",
    areaSeasonNow: props.lang === "ja" ? "今の季節" : props.lang === "es" ? "Temporada actual" : props.lang === "pt-BR" ? "Estação atual" : "This season",
    areaTabRepresentative: props.lang === "ja" ? "代表種" : props.lang === "es" ? "Representativas" : props.lang === "pt-BR" ? "Representativas" : "Representative",
    areaTabRecent: props.lang === "ja" ? "最近増えた" : props.lang === "es" ? "Recientes" : props.lang === "pt-BR" ? "Recentes" : "Recent rise",
    areaTabMissing: props.lang === "ja" ? "未記録季節" : props.lang === "es" ? "Temporadas vacías" : props.lang === "pt-BR" ? "Estações vazias" : "Season gaps",
    areaMissingSeasonLead: props.lang === "ja" ? "この季節の記録を足すと、場所の図鑑が一段強くなる。" : props.lang === "es" ? "Sumar registros de estas temporadas fortalece el álbum del lugar." : props.lang === "pt-BR" ? "Adicionar registros destas estações fortalece o álbum do lugar." : "Adding these seasons makes the place album stronger.",
    areaCompleteSeasonLead: props.lang === "ja" ? "四季の入口があります。次は同じ季節の再訪で厚みを出せます。" : props.lang === "es" ? "Ya hay entrada para las cuatro temporadas. Ahora conviene revisitar." : props.lang === "pt-BR" ? "Já há entrada para as quatro estações. Agora vale revisitar." : "All seasons have an entry. Revisit to add depth.",
    areaPublicPageLabel: props.lang === "ja" ? "エリア図鑑を見る" : props.lang === "es" ? "Ver álbum del área" : props.lang === "pt-BR" ? "Ver álbum da área" : "Open area album",
    areaEventCreateLabel: props.lang === "ja" ? "このエリアで観察会" : props.lang === "es" ? "Crear salida aquí" : props.lang === "pt-BR" ? "Criar saída aqui" : "Create event here",
    areaEventCreateHint: props.lang === "ja" ? "この範囲を開催エリアにして、観察会と図鑑を育てる" : props.lang === "es" ? "Usa esta área para la salida y su álbum." : props.lang === "pt-BR" ? "Use esta área para a saída e o álbum." : "Use this area for an event and its album.",
    placeActionRecord: props.lang === "ja" ? "この場所で記録" : props.lang === "es" ? "Registrar aquí" : props.lang === "pt-BR" ? "Registrar aqui" : "Record here",
    placeActionGuide: props.lang === "ja" ? "ガイドで探す" : props.lang === "es" ? "Buscar con guía" : props.lang === "pt-BR" ? "Buscar com guia" : "Explore with guide",
    placeActionScan: props.lang === "ja" ? "スキャンする" : props.lang === "es" ? "Escanear" : props.lang === "pt-BR" ? "Escanear" : "Scan here",
    placeActionFollow: props.lang === "ja" ? "この場所をフォロー" : props.lang === "es" ? "Seguir este lugar" : props.lang === "pt-BR" ? "Seguir este local" : "Follow this place",
    insightHeading: props.lang === "ja" ? "見えてきた範囲" : props.lang === "es" ? "Lo que ya se ve" : props.lang === "pt-BR" ? "O que já aparece" : "What is coming into view",
    insightSubhead: props.lang === "ja" ? "この表示範囲の発見の気配を眺める。" : props.lang === "es" ? "Mira las señales de esta ventana." : props.lang === "pt-BR" ? "Veja os sinais nesta janela." : "Browse the signs in this viewport.",
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
  var SCAN_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/map?tab=frontier"), props.lang))};
  var EVENTS_NEW_BASE = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/community/events/new"), props.lang))};
  var FIELDS_NEW_BASE = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/community/fields/new"), props.lang))};
  var FIELDS_ALBUM_TPL = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/community/fields/__FIELD_ID__"), props.lang))};
  var LOGIN_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/login"), props.lang))};
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
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
    gsi: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        gsi_photo: { type: 'raster', tiles: ['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], tileSize: 256, attribution: '国土地理院シームレス空中写真' },
      },
      layers: [{ id: 'gsi_photo', type: 'raster', source: 'gsi_photo' }],
    },
    esri: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
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
  var AREA_SOURCE_VALUES = [
    'nature_symbiosis_site', 'tsunag', 'school',
    'protected_area', 'oecm', 'osm_park', 'user_defined',
  ];

  var state = {
    tab: 'markers',
    role: 'mixed',
    actorClass: 'all',
    markerProfile: 'all_research_artifacts',
    taxonGroup: '',
    year: '',
    season: '',
    areaSources: [],
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
    areaPolygonsAbort: null,
    areaPolygonsDebounce: null,
    waterwayAbort: null,
    waterwayDebounce: null,
    waterwaySearchKey: '',
    discoveryPreviewMarkers: [],
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
  function normalizeAreaSources(values) {
    var out = [];
    (values || []).forEach(function (raw) {
      String(raw || '').split(',').forEach(function (value) {
        var source = value.trim();
        if (!source || AREA_SOURCE_VALUES.indexOf(source) < 0 || out.indexOf(source) >= 0) return;
        out.push(source);
      });
    });
    return out;
  }
  function setAreaSources(values) {
    state.areaSources = normalizeAreaSources(values);
  }
  function areaSourcesQueryValue() {
    var sources = normalizeAreaSources(state.areaSources);
    return sources.length ? sources.join(',') : '';
  }
  function switchToPlacesForAreaFilter() {
    if (state.tab !== 'places') state.tab = 'places';
    syncUiFromState();
    if (state.map) applyTab(state.map, state.tab);
  }
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

  function parsePublicCellId(cellId) {
    var match = String(cellId || '').trim().match(/^(\\d+):(-?\\d+):(-?\\d+)$/);
    if (!match) return null;
    var gridM = Number(match[1]);
    var cellX = Number(match[2]);
    var cellY = Number(match[3]);
    if (!isFinite(gridM) || !isFinite(cellX) || !isFinite(cellY)) return null;
    return { gridM: gridM, cellX: cellX, cellY: cellY };
  }

  function lngFromMercatorX(x) {
    return (x / 6378137) * 180 / Math.PI;
  }

  function latFromMercatorY(y) {
    return (2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180 / Math.PI;
  }

  function buildCellFeatureFromId(cellId) {
    var parts = parsePublicCellId(cellId);
    if (!parts) return null;
    var minX = parts.cellX * parts.gridM;
    var minY = parts.cellY * parts.gridM;
    var maxX = minX + parts.gridM;
    var maxY = minY + parts.gridM;
    var ring = [
      [lngFromMercatorX(minX), latFromMercatorY(minY)],
      [lngFromMercatorX(maxX), latFromMercatorY(minY)],
      [lngFromMercatorX(maxX), latFromMercatorY(maxY)],
      [lngFromMercatorX(minX), latFromMercatorY(maxY)],
      [lngFromMercatorX(minX), latFromMercatorY(minY)]
    ];
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        cellId: cellId,
        gridM: parts.gridM,
        radiusM: Math.round((Math.sqrt(2) * parts.gridM) / 2),
        centroidLng: lngFromMercatorX(minX + parts.gridM / 2),
        centroidLat: latFromMercatorY(minY + parts.gridM / 2),
        count: 0,
        label: ''
      }
    };
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
    if (mapInsightCardEl) {
      mapInsightCardEl.innerHTML = '';
      mapInsightCardEl.classList.remove('is-visible');
    }
    if (!contributionPanelEl) return;
    contributionPanelEl.innerHTML = renderContributionPanel();
  }

  function compactNumber(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n)) return '0';
    return n.toLocaleString(SEARCH_LANG === 'ja' ? 'ja-JP' : 'en-US');
  }

  function renderImpactMini(label, value, icon) {
    return '<div class="me-impact-mini"><span aria-hidden="true">' + escapeHtml(icon) + '</span><strong>' + escapeHtml(compactNumber(value)) + '</strong><small>' + escapeHtml(label) + '</small></div>';
  }

  function renderContributionPanel() {
    var summary = state.effortSummary;
    if (!summary) {
      return '<div class="me-impact-card is-loading">' + escapeHtml(COPY.impactPanelLoading) + '</div>';
    }
    var my = summary.myProgress || null;
    var community = summary.communityProgress || {};
    var frontier = summary.frontierRemaining || {};
    var campaign = summary.campaignProgress || {};
    var title = my ? COPY.impactPanelTitleMine : COPY.impactPanelTitleGuest;
    var hero = my
      ? [
          renderImpactMini(COPY.impactRevisitStory, my.revisitCount || 0, '↻'),
          renderImpactMini(COPY.impactGuideStory, (my.roleBreakdown && my.roleBreakdown.guide) || 0, '🔍'),
          renderImpactMini(COPY.impactScanStory, (my.roleBreakdown && my.roleBreakdown.scan) || 0, '📡'),
        ].join('')
      : [
          renderImpactMini(COPY.impactCommunityStory, community.strengthenedCellCount || 0, '✨'),
          renderImpactMini(COPY.impactBlankStory, frontier.blankCount || 0, '🧭'),
          renderImpactMini(COPY.communityLabel, community.activeCellCount || 0, '🌿'),
        ].join('');
    var next = campaign.labelKey
      ? (COPY['campaign_' + campaign.labelKey] || COPY.impactBlankStory)
      : COPY.impactBlankStory;
    return ''
      + '<section class="me-impact-card" aria-label="' + escapeHtml(title) + '">'
      +   '<div class="me-impact-head">'
      +     '<strong>' + escapeHtml(title) + '</strong>'
      +     '<span>' + escapeHtml(COPY.impactPrivateNote) + '</span>'
      +   '</div>'
      +   '<div class="me-impact-grid">' + hero + '</div>'
      +   '<div class="me-impact-next"><span>' + escapeHtml(COPY.roleCardLabel) + '</span><strong>' + escapeHtml(next) + '</strong></div>'
      + '</section>';
  }

  function findCellFeatureById(cellId) {
    if (!cellId) return null;
    for (var i = 0; i < state.features.length; i += 1) {
      var feature = state.features[i];
      if (feature && feature.properties && feature.properties.cellId === cellId) return feature;
    }
    return null;
  }

  function findSelectableCellFeatureById(cellId) {
    return findCellFeatureById(cellId) || buildCellFeatureFromId(cellId);
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
    if (state.selectedPoint && (state.selectedPoint.kind === 'place' || state.selectedPoint.kind === 'area')) return state.selectedPoint;
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
    if (sideRailCountEl) sideRailCountEl.textContent = records.length ? String(records.length) : '—';
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

  function clearDiscoveryPreviewMarkers() {
    (state.discoveryPreviewMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.discoveryPreviewMarkers = [];
  }

  function recordCellCenter(record) {
    if (!record || !record.cellId) return null;
    var feature = findCellFeatureById(record.cellId);
    if (!feature) return null;
    var center = cellCenter(feature);
    return Number.isFinite(center.lat) && Number.isFinite(center.lng) ? center : null;
  }

  function recordTimestamp(record) {
    var time = record && record.observedAt ? Date.parse(String(record.observedAt)) : 0;
    return Number.isFinite(time) ? time : 0;
  }

  function sortedDiscoveryPreviewCandidates() {
    return (Array.isArray(state.records) ? state.records.slice() : []).sort(function (a, b) {
      var photoDelta = (b && b.photoUrl ? 1 : 0) - (a && a.photoUrl ? 1 : 0);
      if (photoDelta) return photoDelta;
      return recordTimestamp(b) - recordTimestamp(a);
    });
  }

  function pickDiscoveryPreviewRecords() {
    var picked = [];
    var seenCells = {};
    var seenGroups = {};
    var candidates = sortedDiscoveryPreviewCandidates();
    var pushIfUsable = function (record, preferNewGroup) {
      if (!record || picked.length >= 12 || !record.cellId || seenCells[record.cellId]) return;
      var group = record.taxonGroup || record.dominantTaxonGroup || '';
      if (preferNewGroup && group && seenGroups[group]) return;
      var center = recordCellCenter(record);
      if (!center) return;
      seenCells[record.cellId] = true;
      if (group) seenGroups[group] = true;
      picked.push({ record: record, center: center });
    };
    candidates.forEach(function (record) { pushIfUsable(record, true); });
    candidates.forEach(function (record) { pushIfUsable(record, false); });
    return picked;
  }

  function refreshDiscoveryPreviewMarkers() {
    clearDiscoveryPreviewMarkers();
    if (!state.map || !window.maplibregl || state.tab !== 'markers') return;
    var zoom = state.map.getZoom();
    if (!Number.isFinite(zoom) || zoom < 14.4) return;
    pickDiscoveryPreviewRecords().forEach(function (item) {
      var record = item.record;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'me-discovery-preview' + (record.photoUrl ? ' has-photo' : '');
      el.setAttribute('aria-label', (record.displayName || '最近の発見') + 'を開く');
      el.innerHTML = record.photoUrl
        ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-discovery-preview&quot;).classList.remove(&quot;has-photo&quot;);this.remove()" /><span>' + escapeHtml(record.displayName || '発見') + '</span>'
        : '<i aria-hidden="true">✦</i><span>' + escapeHtml(record.displayName || '発見') + '</span>';
      el.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        selectRecord(record, { focusMap: false, openSheet: shouldUseBottomSheet() });
      });
      var marker = new window.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] })
        .setLngLat([item.center.lng, item.center.lat])
        .addTo(state.map);
      state.discoveryPreviewMarkers.push(marker);
    });
  }

  function clearSideSelection() {
    if (sideSelectionEmptyEl) sideSelectionEmptyEl.style.display = '';
    setSideSelectionTabAvailable(false);
    if (sideEl && sideEl.getAttribute('data-tab') === 'selection') setSideTab('results');
  }
  function markSideSelection() {
    if (sideSelectionEmptyEl) sideSelectionEmptyEl.style.display = 'none';
    setSideSelectionTabAvailable(true);
    if (!shouldUseBottomSheet() && sideEl && sideEl.getAttribute('data-tab') !== 'selection') {
      setSideTab('selection');
    }
  }
  function coordLabel(lat, lng) {
    return Number(lat).toFixed(4) + ', ' + Number(lng).toFixed(4);
  }
  function renderDetailHero(options) {
    var title = options && options.title ? options.title : COPY.selectedFieldLabel;
    var meta = options && options.meta ? options.meta : '';
    var photoUrl = options && options.photoUrl ? options.photoUrl : '';
    var badge = options && options.badge ? options.badge : COPY.selectionPlaceLabel;
    if (photoUrl) {
      return '<figure class="me-detail-hero me-detail-hero-photo">' +
        '<img src="' + escapeHtml(toThumbUrl(photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-detail-hero&quot;).classList.add(&quot;is-empty&quot;);this.remove()" />' +
        '<figcaption><span>' + escapeHtml(badge) + '</span><strong>' + escapeHtml(title) + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</figcaption>' +
      '</figure>';
    }
    return '<div class="me-detail-hero me-detail-hero-map">' +
      '<div class="me-detail-hero-mark" aria-hidden="true">⌖</div>' +
      '<div class="me-detail-hero-copy"><span>' + escapeHtml(badge) + '</span><strong>' + escapeHtml(title) + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</div>' +
    '</div>';
  }
  function renderDetailActions(items) {
    return '<div class="me-detail-actions">' + items.map(function (item) {
      return '<a class="me-detail-action" href="' + escapeHtml(item.href) + '">' +
        '<span class="me-detail-action-icon" aria-hidden="true">' + escapeHtml(item.icon) + '</span>' +
        '<strong>' + escapeHtml(item.label) + '</strong>' +
      '</a>';
    }).join('') + '</div>';
  }
  function renderDetailStats(items) {
    return '<div class="me-detail-stats">' + items.map(function (item) {
      return '<div><span>' + escapeHtml(item.label) + '</span><strong>' + escapeHtml(item.value) + '</strong></div>';
    }).join('') + '</div>';
  }
  function currentSeasonLabel() {
    if (state.season === 'spring') return COPY.seasonSpring;
    if (state.season === 'summer') return COPY.seasonSummer;
    if (state.season === 'autumn') return COPY.seasonAutumn;
    if (state.season === 'winter') return COPY.seasonWinter;
    return COPY.seasonAll;
  }
  function detailRecordsForContext(context) {
    var records = Array.isArray(state.records) ? state.records : [];
    if (!context) return records.slice(0, 3);
    if (context.record) {
      var sameCell = records.filter(function (record) { return record && record.cellId && record.cellId === context.record.cellId; });
      return sameCell.length ? sameCell.slice(0, 3) : [context.record];
    }
    if (context.cellFeature && context.cellFeature.properties && context.cellFeature.properties.cellId) {
      var cellId = context.cellFeature.properties.cellId;
      return records.filter(function (record) { return record && record.cellId === cellId; }).slice(0, 3);
    }
    return records.slice(0, 3);
  }

  function distanceMeters(a, b) {
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return Infinity;
    var toRad = function (n) { return n * Math.PI / 180; };
    var r = 6371000;
    var dLat = toRad(b.lat - a.lat);
    var dLng = toRad(b.lng - a.lng);
    var lat1 = toRad(a.lat);
    var lat2 = toRad(b.lat);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function nearbyRecordsForContext(context, maxMeters) {
    if (!context || !Number.isFinite(context.lat) || !Number.isFinite(context.lng)) return [];
    var origin = { lat: context.lat, lng: context.lng };
    return (Array.isArray(state.records) ? state.records : [])
      .map(function (record) {
        var center = recordCellCenter(record);
        return { record: record, center: center, meters: distanceMeters(origin, center) };
      })
      .filter(function (item) {
        return item.record && item.center && Number.isFinite(item.meters) && item.meters <= maxMeters;
      })
      .sort(function (a, b) {
        var photoDelta = (b.record.photoUrl ? 1 : 0) - (a.record.photoUrl ? 1 : 0);
        if (photoDelta) return photoDelta;
        return a.meters - b.meters || recordTimestamp(b.record) - recordTimestamp(a.record);
      })
      .slice(0, 5);
  }

  function renderDetailRecentFinds(context) {
    var records = detailRecordsForContext(context);
    if (!records.length) return '';
    return '<section class="me-detail-section me-detail-recent" aria-label="' + escapeHtml(COPY.sideRecentLabel) + '">' +
      '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.sideRecentLabel) + '</span><strong>' + escapeHtml(COPY.siteBriefWhyNowLabel) + '</strong></div>' +
      '<div class="me-detail-recent-grid">' + records.map(function (record) {
        var date = record.observedAt ? String(record.observedAt).slice(0, 10) : '';
        var thumb = record.photoUrl
          ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-detail-recent-item&quot;).classList.add(&quot;is-photoless&quot;);this.remove()" />'
          : '<span class="me-detail-recent-placeholder" aria-hidden="true">✦</span>';
        return '<button type="button" class="me-detail-recent-item" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '">' +
          thumb +
          '<strong>' + escapeHtml(record.displayName || '同定待ち') + '</strong>' +
          (date ? '<small>' + escapeHtml(date) + '</small>' : '') +
        '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  function renderDetailWalkableFinds(context) {
    var items = nearbyRecordsForContext(context, 650);
    if (!items.length) return '';
    return '<section class="me-detail-section me-detail-walk" aria-label="徒歩5分圏の発見">' +
      '<div class="me-detail-section-head"><span>徒歩5分圏の発見</span><strong>近くで見えたもの</strong></div>' +
      '<div class="me-detail-walk-list">' + items.map(function (item) {
        var record = item.record;
        var date = record.observedAt ? String(record.observedAt).slice(0, 10) : '';
        var distance = item.meters < 100 ? 'すぐ近く' : '約' + String(Math.round(item.meters / 50) * 50) + 'm';
        var thumb = record.photoUrl
          ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />'
          : '<span aria-hidden="true">✦</span>';
        return '<button type="button" class="me-detail-walk-item" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '">' +
          thumb +
          '<strong>' + escapeHtml(record.displayName || '同定待ち') + '</strong>' +
          '<small>' + escapeHtml(distance + (date ? ' · ' + date : '')) + '</small>' +
        '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  function bindDetailRecentFinds(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    rootEl.querySelectorAll('.me-detail-recent-item, .me-detail-walk-item').forEach(function (button) {
      button.addEventListener('click', function () {
        var occurrenceId = button.getAttribute('data-occurrence-id');
        var record = state.records.find(function (item) { return item && item.occurrenceId === occurrenceId; });
        if (record) selectRecord(record, { focusMap: true, openSheet: shouldUseBottomSheet() });
      });
    });
  }
  function renderDetailVisitReasons(context) {
    var frontier = context && Number.isFinite(context.lng) && Number.isFinite(context.lat)
      ? findFrontierAt(context.lng, context.lat)
      : null;
    var gap = frontier && frontier.properties
      ? roleHintLabel(frontier.properties.recommendedRole)
      : COPY.placeStoryNeedGuide;
    var missingAxes = frontier && frontier.properties && Array.isArray(frontier.properties.missingAxes)
      ? frontier.properties.missingAxes.map(axisLabel).join(' · ')
      : '';
    return '<section class="me-detail-section me-detail-visit">' +
      '<div><span>' + escapeHtml(COPY.siteBriefWhyHereLabel) + '</span><strong>' + escapeHtml(COPY.placeStoryNoTaxa) + '</strong></div>' +
      '<div><span>' + escapeHtml(COPY.siteBriefWhyNowLabel) + '</span><strong>' + escapeHtml(currentSeasonLabel()) + '</strong></div>' +
      '<div><span>' + escapeHtml(COPY.siteBriefNextHookLabel) + '</span><strong>' + escapeHtml(missingAxes ? gap + ' · ' + missingAxes : gap) + '</strong></div>' +
    '</section>';
  }
  function renderPlaceDetailActions(context) {
    var hasCoord = context && Number.isFinite(context.lat) && Number.isFinite(context.lng);
    var sep = function (base) { return base.indexOf('?') >= 0 ? '&' : '?'; };
    var coordQs = hasCoord
      ? 'lat=' + encodeURIComponent(String(context.lat)) + '&lng=' + encodeURIComponent(String(context.lng))
      : '';
    var eventHref = hasCoord ? buildPointAreaEventHref(context.lat, context.lng) || EVENTS_NEW_BASE + sep(EVENTS_NEW_BASE) + coordQs : RECORD_HREF;
    var fieldHref = hasCoord ? FIELDS_NEW_BASE + sep(FIELDS_NEW_BASE) + coordQs : NOTES_HREF;
    return renderDetailActions([
      { icon: '＋', label: COPY.placeActionRecord, href: eventHref },
      { icon: '☆', label: COPY.placeActionFollow, href: fieldHref },
      { icon: '🔍', label: COPY.placeActionGuide, href: LENS_HREF },
      { icon: '📡', label: COPY.placeActionScan, href: SCAN_HREF },
      { icon: '↗', label: COPY.bottomSheetNotes, href: NOTES_HREF },
    ]);
  }
  function renderSelectedCard() {
    if (!selectedCardEl) return;
    if (shouldUseBottomSheet()) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      clearSideSelection();
      return;
    }
    var context = getSelectedContext();
    if (!context) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      clearSideSelection();
      return;
    }
    if (context.kind === 'area') {
      var areaContent = context.areaSnapshot
        ? renderAreaSheet(context.areaSnapshot)
        : context.areaFeature
          ? renderTransientAreaContent(context.areaFeature, { lat: context.lat, lng: context.lng })
          : '<div class="me-area-sheet-loading">エリア情報を読み込み中…</div>';
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-area">' +
          areaContent +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      return;
    }
    if (context.kind === 'place') {
      var seq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-place">' +
          renderDetailHero({ title: COPY.selectedFieldLabel, meta: coordLabel(context.lat, context.lng), badge: COPY.selectionPlaceLabel }) +
          renderDetailVisitReasons(context) +
          renderDetailRecentFinds(context) +
          renderDetailWalkableFinds(context) +
          renderPlaceDetailActions(context) +
          renderDetailStats([
            { label: COPY.placeStoryNow, value: COPY.placeStoryNoTaxa },
            { label: COPY.placeStoryMissing, value: COPY.placeStoryNeedSeason },
          ]) +
          '<section id="me-selected-brief-slot" class="me-site-brief-slot me-detail-section is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</section>' +
          '<section id="me-selected-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient(context) + '</section>' +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      bindDetailRecentFinds(selectedCardEl);
      fetchSiteBrief(context.lat, context.lng, seq, document.getElementById('me-selected-brief-slot'));
      return;
    }
    if (context.kind === 'cell') {
      var feature = context.cellFeature;
      var cellProps = feature && feature.properties ? feature.properties : {};
      var countLabel = Number(cellProps.count || 0) + ' ' + COPY.resultCountLabel;
      var latest = cellProps.latestObservedAt ? String(cellProps.latestObservedAt).slice(0, 10) : '';
      var era = cellProps.nameEraLabel ? String(cellProps.nameEraLabel) : '';
      var cellSeq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-cell">' +
          renderDetailHero({ title: cellProps.albumName || cellProps.label || COPY.selectedFieldLabel, meta: (cellProps.scaleLabel || countLabel) + ' · ' + countLabel + (latest ? ' · ' + latest : '') + (era ? ' · ' + era : ''), badge: cellProps.localityLabel || COPY.selectionPlaceLabel }) +
          renderDetailVisitReasons(context) +
          renderDetailRecentFinds(context) +
          renderDetailWalkableFinds(context) +
          renderPlaceDetailActions(context) +
          renderDetailStats([
            { label: COPY.placeStoryRecent, value: countLabel },
            { label: COPY.placeStoryActions, value: latest || COPY.placeStoryNeedSeason },
          ]) +
          '<section id="me-selected-brief-slot" class="me-site-brief-slot me-detail-section is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</section>' +
          '<section id="me-selected-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient(context) + '</section>' +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      bindDetailRecentFinds(selectedCardEl);
      fetchSiteBrief(context.lat, context.lng, cellSeq, document.getElementById('me-selected-brief-slot'));
      return;
    }
    var record = context.record || getSelectedRecord();
    if (!record) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      clearSideSelection();
      return;
    }
    var href = OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId));
    var identifyHref = href + '#identify';
    selectedCardEl.innerHTML =
      '<article class="me-detail-panel me-detail-panel-observation">' +
        renderDetailHero({
          title: record.displayName || '同定待ち',
          meta: (record.localityLabel || '—') + (record.observedAt ? ' · ' + String(record.observedAt).slice(0, 10) : ''),
          badge: COPY.selectionObservationLabel + (record.isAiCandidate ? ' · AI候補' : record.isAwaitingId ? ' · 同定待ち' : ''),
          photoUrl: record.photoUrl || '',
        }) +
        renderDetailVisitReasons(context) +
        renderDetailRecentFinds(context) +
        renderDetailWalkableFinds(context) +
        renderDetailActions([
          { icon: '↗', label: COPY.selectedCardLabel, href: href },
          { icon: '✓', label: COPY.identifyLabel, href: identifyHref },
          { icon: '＋', label: COPY.bottomSheetRecord, href: RECORD_HREF },
          { icon: '📖', label: COPY.bottomSheetNotes, href: NOTES_HREF },
        ]) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: record.displayName || '同定待ち' },
          { label: COPY.placeStoryRecent, value: record.observedAt ? String(record.observedAt).slice(0, 10) : '—' },
        ]) +
        '<section id="me-selected-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient(context) + '</section>' +
      '</article>';
    selectedCardEl.classList.add('is-visible');
    markSideSelection();
    bindDetailRecentFinds(selectedCardEl);
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
    var displayLabel = friendlyHypothesisLabel(h.label);
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
    var environment = (brief.environmentEvidence || []).slice(0, 4).map(function (item) {
      var meta = [item.value, item.source].filter(Boolean).join(' · ');
      var limitation = item.limitation ? '<em>' + escapeHtml(item.limitation) + '</em>' : '';
      return '<li><strong>' + escapeHtml(item.label || 'environment') + '</strong><span>' + escapeHtml(meta) + '</span>' + limitation + '</li>';
    }).join('');
    var notices = renderMapOfficialNotices(brief.officialNotices || []);
    var context = getSelectedContext();
    var frontier = context ? findFrontierAt(context.lng, context.lat) : null;
    var missingAxes = frontier && frontier.properties && Array.isArray(frontier.properties.missingAxes)
      ? frontier.properties.missingAxes.map(axisLabel).join(' · ')
      : '';
    var whyHere = (brief.reasons && brief.reasons[0]) || displayLabel;
    var whyNow = frontier && frontier.properties
      ? priorityCueLabel(frontier.properties.priorityCue)
      : (brief.checks && brief.checks[0]) || displayLabel;
    var oneVisit = frontier && frontier.properties
      ? roleHintLabel(frontier.properties.recommendedRole) + (missingAxes ? ' · ' + missingAxes : '')
      : (brief.captureHints && brief.captureHints[0]) || displayLabel;
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
        '<span class="me-site-brief-label">' + escapeHtml(displayLabel) + '</span>' +
        '<span class="me-site-brief-conf" title="confidence">' + confPct + '%</span>' +
      '</div>' +
      '<div class="me-site-brief-loop-grid">' + loopCards + '</div>' +
      '<div class="me-site-brief-heading">' + escapeHtml(COPY.siteBriefHeading) + '</div>' +
      (checks ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefChecksLabel) + '</div><ul>' + checks + '</ul></div>' : '') +
      (environment ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefEnvironmentLabel) + '</div><ul class="me-site-brief-environment">' + environment + '</ul></div>' : '') +
      (reasons ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefReasonsLabel) + '</div><ul class="me-site-brief-reasons">' + reasons + '</ul></div>' : '') +
      (caps ? '<div class="me-site-brief-section"><div class="me-site-brief-sublabel">' + escapeHtml(COPY.siteBriefCapturesLabel) + '</div><ul>' + caps + '</ul></div>' : '') +
      '</div>' + notices;
  }

  function friendlyHypothesisLabel(label) {
    var text = String(label || '').trim();
    if (!text) return '';
    if (/現地確認|空白地点|空白地帯/.test(text)) return '地図だけではわからない場所';
    if (/未記録|記録不足|低カバー|カバー不足/.test(text)) return '記録の余白';
    return text;
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
    var pt = state.selectedPoint;
    var hasCoord = pt && Number.isFinite(pt.lat) && Number.isFinite(pt.lng);
    var sep = function (base) { return base.indexOf('?') >= 0 ? '&' : '?'; };
    var coordQs = hasCoord
      ? 'lat=' + encodeURIComponent(String(pt.lat)) + '&lng=' + encodeURIComponent(String(pt.lng))
      : '';
    var eventHref = hasCoord ? buildPointAreaEventHref(pt.lat, pt.lng) || EVENTS_NEW_BASE + sep(EVENTS_NEW_BASE) + coordQs : '';
    var fieldHref = hasCoord ? FIELDS_NEW_BASE + sep(FIELDS_NEW_BASE) + coordQs : '';
    var ctaSeamless = hasCoord
      ? ''
        + '<div class="me-place-cta-row">'
        +   '<a class="me-place-cta me-place-cta-primary" href="' + escapeHtml(eventHref) + '">'
        +     '<span class="me-place-cta-icon" aria-hidden="true">＋</span>'
        +     '<span class="me-place-cta-body"><strong>' + escapeHtml(COPY.placeActionRecord) + '</strong>'
        +     '<span>' + escapeHtml(COPY.placeStoryActions) + '</span></span>'
        +   '</a>'
        +   '<a class="me-place-cta me-place-cta-secondary" href="' + escapeHtml(fieldHref) + '">'
        +     '<span class="me-place-cta-icon" aria-hidden="true">⛳</span>'
        +     '<span class="me-place-cta-body"><strong>' + escapeHtml(COPY.placeActionFollow) + '</strong>'
        +     '<span>' + escapeHtml(COPY.impactRevisitStory) + '</span></span>'
        +   '</a>'
        + '</div>'
      : '';
    return ctaSeamless +
      '<div class="me-bottom-actions">' +
      '<a class="inline-link" href="' + RECORD_HREF + '">' + escapeHtml(COPY.bottomSheetRecord) + '</a>' +
      '<a class="inline-link" href="' + LENS_HREF + '">' + escapeHtml(COPY.placeActionGuide) + '</a>' +
      '<a class="inline-link" href="' + SCAN_HREF + '">' + escapeHtml(COPY.placeActionScan) + '</a>' +
      '<a class="inline-link" href="' + NOTES_HREF + '">' + escapeHtml(COPY.bottomSheetNotes) + '</a>' +
      '</div>';
  }

  function mapFollowHref(params) {
    try {
      var url = new URL(window.location.href);
      Object.keys(params || {}).forEach(function (key) {
        var value = params[key];
        if (value == null || value === '') return;
        url.searchParams.set(key, String(value));
      });
      return url.pathname + url.search;
    } catch (_) {
      return '/map';
    }
  }

  function renderAreaFollowButton(targetType, targetId, label, href) {
    if (!targetType || !targetId) return '';
    return ''
      + '<button type="button" class="me-area-follow-btn" data-area-follow-button'
      + ' data-target-type="' + escapeHtml(targetType) + '"'
      + ' data-target-id="' + escapeHtml(targetId) + '"'
      + ' data-label="' + escapeHtml(label || '観察エリア') + '"'
      + ' data-href="' + escapeHtml(href || '/map') + '">'
      +   '<span aria-hidden="true">＋</span>'
      +   '<strong>' + escapeHtml(COPY.placeActionFollow) + '</strong>'
      +   '<small>' + escapeHtml(COPY.impactRevisitStory) + '</small>'
      + '</button>';
  }

  function followAreaFromButton(button) {
    if (!button || !apiAreaFollow) return;
    var targetType = button.getAttribute('data-target-type') || '';
    var targetId = button.getAttribute('data-target-id') || '';
    var label = button.getAttribute('data-label') || targetId;
    var href = button.getAttribute('data-href') || '/map';
    if (!targetType || !targetId) return;
    button.setAttribute('disabled', 'disabled');
    button.classList.add('is-loading');
    fetch(apiAreaFollow, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ targetType: targetType, targetId: targetId, label: label, href: href })
    })
      .then(function (response) {
        if (response.status === 401) {
          window.location.href = LOGIN_HREF + (LOGIN_HREF.indexOf('?') >= 0 ? '&' : '?') + 'redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then(function (payload) {
        if (!payload || !payload.ok) return;
        button.classList.remove('is-loading');
        button.classList.add('is-followed');
        button.innerHTML = '<span aria-hidden="true">✓</span><strong>' + escapeHtml(COPY.placeActionFollow) + '</strong><small>' + escapeHtml(COPY.impactRevisitStory) + '</small>';
        window.dispatchEvent(new CustomEvent('ikimon:area-followed', { detail: { targetType: targetType, targetId: targetId, label: label } }));
      })
      .catch(function () {
        button.classList.remove('is-loading');
      })
      .finally(function () {
        if (!button.classList.contains('is-followed')) button.removeAttribute('disabled');
      });
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

  function setDetailSheetSnap(snap) {
    if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--detail')) return;
    var next = snap === 'full' ? 'full' : 'peek';
    sheetEl.setAttribute('data-snap', next);
    if (sheetGripEl) {
      sheetGripEl.setAttribute('aria-label', next === 'full' ? '詳細を半分に戻す' : '詳細を広げる');
    }
  }
  function toggleDetailSheetSnap() {
    if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--detail')) return;
    setDetailSheetSnap(sheetEl.getAttribute('data-snap') === 'full' ? 'peek' : 'full');
  }
  function showDetailBottomSheet() {
    if (!sheetEl) return;
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.remove('me-bottom-sheet--area');
    sheetEl.classList.add('me-bottom-sheet--detail');
    sheetEl.classList.add('is-open');
    setDetailSheetSnap('peek');
    if (sheetInnerEl) sheetInnerEl.scrollTop = 0;
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
    var feature = findSelectableCellFeatureById(state.selectedCellId);
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
    var detailContext = (center.lat != null && center.lng != null)
      ? { lat: center.lat, lng: center.lng, kind: 'observation', cellFeature: feature, record: record }
      : null;
    state.selectedPoint = detailContext;
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-observation">' +
        renderDetailHero({
          title: record.displayName || '同定待ち',
          meta: (record.localityLabel || '—') + (record.observedAt ? ' · ' + String(record.observedAt).slice(0, 10) : ''),
          badge: COPY.selectionObservationLabel + (record.isAiCandidate ? ' · AI候補' : record.isAwaitingId ? ' · 同定待ち' : ''),
          photoUrl: record.photoUrl || '',
        }) +
        renderDetailVisitReasons(detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderDetailActions([
          { icon: '↗', label: COPY.selectedCardLabel, href: OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId)) },
          { icon: '✓', label: COPY.identifyLabel, href: OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId)) + '#identify' },
          { icon: '＋', label: COPY.bottomSheetRecord, href: RECORD_HREF },
          { icon: '📖', label: COPY.bottomSheetNotes, href: NOTES_HREF },
        ]) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: record.displayName || '同定待ち' },
          { label: COPY.placeStoryRecent, value: record.observedAt ? String(record.observedAt).slice(0, 10) : '—' },
        ]) +
        '<section id="me-sheet-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient({ lat: center.lat, lng: center.lng, kind: 'observation', cellFeature: feature, record: record }) + '</section>' +
      '</article>';
    showDetailBottomSheet();
    bindDetailRecentFinds(sheetInnerEl);
  }

  function openCellSheet(feature) {
    if (!sheetEl || !sheetInnerEl || !feature || !feature.properties) return;
    if (!shouldUseBottomSheet()) return;
    var center = cellCenter(feature);
    var detailContext = { lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature };
    state.selectedPoint = detailContext;
    var seq = ++siteBriefSeq;
    var p = feature.properties || {};
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-cell">' +
        renderDetailHero({
          title: p.albumName || p.label || COPY.selectedFieldLabel,
          meta: (p.scaleLabel || '') + (p.scaleLabel ? ' · ' : '') + String(p.count || 0) + ' ' + COPY.resultCountLabel + (p.latestObservedAt ? ' · ' + String(p.latestObservedAt).slice(0, 10) : '') + (p.nameEraLabel ? ' · ' + String(p.nameEraLabel) : ''),
          badge: p.localityLabel || COPY.selectionPlaceLabel,
        }) +
        renderDetailVisitReasons(detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderPlaceDetailActions(detailContext) +
        renderDetailStats([
          { label: COPY.placeStoryRecent, value: String(p.count || 0) + ' ' + COPY.resultCountLabel },
          { label: COPY.placeStoryActions, value: p.latestObservedAt ? String(p.latestObservedAt).slice(0, 10) : COPY.placeStoryNeedSeason },
        ]) +
        '<section id="me-site-brief-slot" class="me-site-brief-slot me-detail-section is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</section>' +
        '<section id="me-sheet-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient({ lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature }) + '</section>' +
      '</article>';
    showDetailBottomSheet();
    bindDetailRecentFinds(sheetInnerEl);
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
    var detailContext = { lat: lat, lng: lng, kind: 'place' };
    state.selectedPoint = detailContext;
    highlightSelectedCell();
    var seq = ++siteBriefSeq;
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-place">' +
        renderDetailHero({ title: COPY.selectedFieldLabel, meta: coordLabel(lat, lng), badge: COPY.selectionPlaceLabel }) +
        renderDetailVisitReasons(detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderPlaceDetailActions(detailContext) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: COPY.placeStoryNoTaxa },
          { label: COPY.placeStoryMissing, value: COPY.placeStoryNeedSeason },
        ]) +
        '<section id="me-site-brief-slot" class="me-site-brief-slot me-detail-section is-loading">' + escapeHtml(COPY.siteBriefLoading) + '</section>' +
        '<section id="me-sheet-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient({ lat: lat, lng: lng, kind: 'place' }) + '</section>' +
      '</article>';
    showDetailBottomSheet();
    bindDetailRecentFinds(sheetInnerEl);
    renderSidePanels();
    fetchSiteBrief(lat, lng, seq, document.getElementById('me-site-brief-slot'));
    saveMapState();
  }
  function isTransientAreaFeature(feature) {
    var props = (feature && feature.properties) || {};
    var fieldId = String(props.field_id || '');
    return props.transient === true || props.transient === 'true' || fieldId.indexOf('osm-live:') === 0;
  }
  function normalizeAreaGeometryForDraft(geometry) {
    if (!geometry || !geometry.type || !geometry.coordinates) return null;
    if (geometry.type === 'Polygon') return geometry;
    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates[0]) {
      return { type: 'Polygon', coordinates: geometry.coordinates[0] };
    }
    return null;
  }
  function areaFeatureCenter(feature, fallbackLat, fallbackLng) {
    var props = (feature && feature.properties) || {};
    var center = Array.isArray(props.center) ? props.center : null;
    if (center && Number.isFinite(Number(center[0])) && Number.isFinite(Number(center[1]))) {
      return { lat: Number(center[1]), lng: Number(center[0]) };
    }
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      return { lat: fallbackLat, lng: fallbackLng };
    }
    var polygon = normalizeAreaGeometryForDraft(feature && feature.geometry);
    var ring = polygon && polygon.coordinates && polygon.coordinates[0] ? polygon.coordinates[0] : [];
    if (!ring.length) return null;
    var lng = 0, lat = 0, count = 0;
    ring.forEach(function (p) {
      if (!Array.isArray(p) || p.length < 2) return;
      var x = Number(p[0]), y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      lng += x; lat += y; count += 1;
    });
    return count ? { lat: lat / count, lng: lng / count } : null;
  }
  function appendQueryParams(base, params) {
    var parts = [];
    Object.keys(params).forEach(function (key) {
      var value = params[key];
      if (value == null || value === '') return;
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    });
    if (!parts.length) return base;
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + parts.join('&');
  }
  function pointCirclePolygon(lat, lng, radiusM) {
    var radius = Math.max(80, Math.min(1200, Number(radiusM) || 300));
    var R = 6371000;
    var latR = lat * Math.PI / 180;
    var lngR = lng * Math.PI / 180;
    var angular = radius / R;
    var coords = [];
    for (var i = 0; i < 24; i += 1) {
      var bearing = 2 * Math.PI * i / 24;
      var outLat = Math.asin(Math.sin(latR) * Math.cos(angular) + Math.cos(latR) * Math.sin(angular) * Math.cos(bearing));
      var outLng = lngR + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latR), Math.cos(angular) - Math.sin(latR) * Math.sin(outLat));
      coords.push([Number((outLng * 180 / Math.PI).toFixed(7)), Number((outLat * 180 / Math.PI).toFixed(7))]);
    }
    coords.push(coords[0]);
    return { type: 'Polygon', coordinates: [coords] };
  }
  function buildPointAreaEventHref(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    var params = { lat: Number(lat).toFixed(6), lng: Number(lng).toFixed(6) };
    if (window.sessionStorage) {
      try {
        var draftId = 'point-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        window.sessionStorage.setItem('ikimon:event-area-draft:' + draftId, JSON.stringify({
          name: '地図で選んだ地点',
          center: { lat: Number(lat), lng: Number(lng) },
          polygon: pointCirclePolygon(Number(lat), Number(lng), 300),
          source: 'map_point_area',
        }));
        params.area_draft = draftId;
        params.name = '地図で選んだ地点';
      } catch (_) {}
    }
    return appendQueryParams(EVENTS_NEW_BASE, params);
  }
  function buildTransientAreaEventHref(feature, fallbackLat, fallbackLng) {
    var props = (feature && feature.properties) || {};
    var center = areaFeatureCenter(feature, fallbackLat, fallbackLng);
    var name = String(props.name || 'OSMの公園・緑地');
    var params = center
      ? { lat: center.lat.toFixed(6), lng: center.lng.toFixed(6), name: name }
      : { name: name };
    var polygon = normalizeAreaGeometryForDraft(feature && feature.geometry);
    if (center && polygon && window.sessionStorage) {
      try {
        var draftId = 'area-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        window.sessionStorage.setItem('ikimon:event-area-draft:' + draftId, JSON.stringify({
          name: name,
          center: center,
          polygon: polygon,
          source: 'osm_live_area',
          osm: {
            entityKey: props.entity_key || '',
            osmType: props.osm_type || '',
            osmId: props.osm_id || null,
          },
        }));
        params.area_draft = draftId;
      } catch (_) {}
    }
    return appendQueryParams(EVENTS_NEW_BASE, params);
  }

  function renderTransientAreaContent(feature, center) {
    var props = (feature && feature.properties) || {};
    var safeCenter = center || areaFeatureCenter(feature, null, null);
    var ctaHref = safeCenter ? buildTransientAreaEventHref(feature, safeCenter.lat, safeCenter.lng) : RECORD_HREF;
    var sourceLabel = String(props.source_label || '公園・緑地 (OSM live)');
    var officialUrl = String(props.official_url || '');
    var areaName = String(props.name || 'OSMの公園・緑地');
    var locationLabel = safeCenter ? safeCenter.lat.toFixed(4) + ', ' + safeCenter.lng.toFixed(4) : '';
    var followId = String(props.entity_key || props.field_id || (safeCenter ? 'point:' + safeCenter.lat.toFixed(5) + ',' + safeCenter.lng.toFixed(5) : areaName));
    return ''
      + renderAreaHero({ title: areaName, sourceLabel: sourceLabel, meta: locationLabel, photo: null })
      + '<div class="me-area-sheet-cta">'
      +   '<a class="me-area-sheet-cta-btn" href="' + escapeHtml(ctaHref) + '">'
      +     '<span class="me-area-sheet-cta-icon" aria-hidden="true">＋</span>'
      +     escapeHtml(COPY.areaEventCreateLabel)
      +   '</a>'
      +   (officialUrl ? '<a class="me-area-sheet-url" href="' + escapeHtml(officialUrl) + '" target="_blank" rel="noopener">公式情報 ↗</a>' : '')
      +   '<span class="me-area-sheet-cta-hint">' + escapeHtml(COPY.areaEventCreateHint) + '</span>'
      + '</div>'
      + renderAreaAccessGuidance(transientAccessGuidance(props))
      + renderAreaFollowButton('region', followId, areaName, mapFollowHref({ region: followId }))
      + renderAreaObservationGallery(transientAreaGalleryItems(safeCenter), { label: COPY.areaGalleryTitle })
      + renderPlaceStoryHighlights({ sourceLabel: sourceLabel }, { totalObservations: 0, totalVisits: 0, seasonsCovered: 0, topTaxa: [] }, null)
      + '<div class="me-area-sheet-timeline is-empty">このエリアはまだ ikimon のフィールドDBには未登録です。観察会を作ると、次回から通常のエリアとして扱えます。</div>';
  }

  function openTransientAreaSheet(feature, lat, lng) {
    if (!sheetEl || !sheetInnerEl || !feature) return;
    var props = feature.properties || {};
    var center = areaFeatureCenter(feature, lat, lng);
    if (!center) return;
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = { lat: center.lat, lng: center.lng, kind: 'area', fieldId: String(props.field_id || ''), areaFeature: feature, transient: true };
    if (state.map && state.map.getLayer('area-polygon-selected')) {
      state.map.setFilter('area-polygon-selected', ['==', ['get', 'field_id'], String(props.field_id || '__none__')]);
    }
    if (!shouldUseBottomSheet()) {
      sheetEl.classList.remove('is-open');
      sheetEl.classList.remove('me-bottom-sheet--area');
      sheetEl.classList.remove('me-bottom-sheet--detail');
      sheetEl.removeAttribute('data-snap');
      sheetEl.setAttribute('aria-hidden', 'true');
      renderSelectedCard();
      renderSidePanels();
      saveMapState();
      return;
    }
    sheetInnerEl.innerHTML = renderTransientAreaContent(feature, center);
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
    sheetEl.classList.remove('me-bottom-sheet--detail');
    sheetEl.removeAttribute('data-snap');
    sheetEl.classList.add('me-bottom-sheet--area');
    renderSidePanels();
    saveMapState();
  }
  function openAreaFeatureSheet(feature, lat, lng) {
    if (!feature || !feature.properties) return;
    if (isTransientAreaFeature(feature)) {
      openTransientAreaSheet(feature, lat, lng);
      return;
    }
    var fieldId = feature.properties.field_id || '';
    if (fieldId) openAreaSheet(fieldId, lat, lng);
  }
  function openAreaSheet(fieldId, lat, lng) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!fieldId) return;
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, kind: 'area', fieldId: fieldId };
    if (state.map && state.map.getLayer('area-polygon-selected')) {
      state.map.setFilter('area-polygon-selected', ['==', ['get', 'field_id'], fieldId]);
    }
    if (!shouldUseBottomSheet()) {
      sheetEl.classList.remove('is-open');
      sheetEl.classList.remove('me-bottom-sheet--area');
      sheetEl.classList.remove('me-bottom-sheet--detail');
      sheetEl.removeAttribute('data-snap');
      sheetEl.setAttribute('aria-hidden', 'true');
      renderSelectedCard();
      renderSidePanels();
      saveMapState();
      if (!apiAreaSnapshotTemplate) return;
      var sideUrl = apiAreaSnapshotTemplate.replace('__FIELD_ID__', encodeURIComponent(fieldId));
      fetch(sideUrl, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (payload) {
          if (!payload || !payload.snapshot) return;
          if (!state.selectedPoint || state.selectedPoint.kind !== 'area' || state.selectedPoint.fieldId !== fieldId) return;
          state.selectedPoint.areaSnapshot = payload.snapshot;
          renderSelectedCard();
        })
        .catch(function () { /* noop */ });
      return;
    }
    sheetInnerEl.innerHTML = '<div class="me-bottom-meta"><strong>エリア情報を読み込み中…</strong></div>';
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.add('is-open');
    sheetEl.classList.remove('me-bottom-sheet--detail');
    sheetEl.removeAttribute('data-snap');
    // PC では full-width だと地図を覆い隠して圧迫感が出るので area モード専用の狭幅版に。
    sheetEl.classList.add('me-bottom-sheet--area');
    if (!apiAreaSnapshotTemplate) return;
    var url = apiAreaSnapshotTemplate.replace('__FIELD_ID__', encodeURIComponent(fieldId));
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        if (!payload || !payload.snapshot) return;
        if (!state.selectedPoint || state.selectedPoint.kind !== 'area' || state.selectedPoint.fieldId !== fieldId) return;
        sheetInnerEl.innerHTML = renderAreaSheet(payload.snapshot);
      })
      .catch(function () { /* noop */ });
  }

  function closeBottomSheet() {
    if (!sheetEl) return;
    sheetEl.classList.remove('is-open');
    sheetEl.classList.remove('me-bottom-sheet--area');
    sheetEl.classList.remove('me-bottom-sheet--detail');
    sheetEl.removeAttribute('data-snap');
    sheetEl.setAttribute('aria-hidden', 'true');
    if (state.map && state.map.getLayer('area-polygon-selected')) {
      state.map.setFilter('area-polygon-selected', ['==', ['get', 'field_id'], '__none__']);
    }
  }
  if (sheetCloseEl) sheetCloseEl.addEventListener('click', closeBottomSheet);
  if (sheetGripEl) {
    sheetGripEl.addEventListener('click', function () {
      toggleDetailSheetSnap();
    });
    var sheetDragStartY = null;
    sheetGripEl.addEventListener('pointerdown', function (event) {
      if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--detail')) return;
      sheetDragStartY = event.clientY;
      try { sheetGripEl.setPointerCapture(event.pointerId); } catch (_) {}
    });
    sheetGripEl.addEventListener('pointerup', function (event) {
      if (sheetDragStartY == null) return;
      var deltaY = event.clientY - sheetDragStartY;
      sheetDragStartY = null;
      if (deltaY < -28) {
        setDetailSheetSnap('full');
      } else if (deltaY > 56 && sheetEl && sheetEl.getAttribute('data-snap') === 'peek') {
        closeBottomSheet();
      } else if (deltaY > 28) {
        setDetailSheetSnap('peek');
      }
      try { sheetGripEl.releasePointerCapture(event.pointerId); } catch (_) {}
    });
    sheetGripEl.addEventListener('pointercancel', function () {
      sheetDragStartY = null;
    });
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var button = target.closest('[data-area-follow-button]');
    if (!button) return;
    event.preventDefault();
    followAreaFromButton(button);
  });
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var tab = target.closest('[data-area-story-tab]');
    if (!tab) return;
    var root = tab.closest('[data-area-story-tabs]');
    if (!root) return;
    var key = tab.getAttribute('data-area-story-tab') || '';
    root.querySelectorAll('[data-area-story-tab]').forEach(function (button) {
      button.classList.toggle('is-active', button === tab);
    });
    root.querySelectorAll('[data-area-story-panel]').forEach(function (panel) {
      panel.classList.toggle('is-active', panel.getAttribute('data-area-story-panel') === key);
    });
  });

  function coverSourceLabel(source) {
    if (source === 'admin_curated') return COPY.coverSourceAdmin;
    if (source === 'community_curated') return COPY.coverSourceCommunity;
    return COPY.coverSourceAuto;
  }

  function renderRepresentativePhoto(photo) {
    if (!photo || !photo.photoUrl) return '';
    var displayName = String(photo.displayName || COPY.coverFallbackTitle);
    var locality = String(photo.localityLabel || '');
    var dateText = photo.observedAt ? String(photo.observedAt).slice(0, 10) : '';
    var meta = [dateText, locality].filter(Boolean).join(' / ');
    return ''
      + '<figure class="me-area-cover is-source-' + escapeHtml(String(photo.source || 'auto_observation')) + '">'
      +   '<img src="' + escapeHtml(toThumbUrl(photo.photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-area-cover&quot;).remove()" />'
      +   '<figcaption>'
      +     '<span>' + escapeHtml(coverSourceLabel(photo.source)) + '</span>'
      +     '<strong>' + escapeHtml(displayName) + '</strong>'
      +     (meta ? '<small>' + escapeHtml(meta) + '</small>' : '')
      +   '</figcaption>'
      + '</figure>';
  }

  function renderAreaHero(options) {
    var title = String(options && options.title || '観察エリア');
    var sourceLabel = String(options && options.sourceLabel || '');
    var meta = String(options && options.meta || '');
    var photo = options && options.photo;
    if (photo && photo.photoUrl) {
      var displayName = String(photo.displayName || COPY.coverFallbackTitle);
      var locality = String(photo.localityLabel || '');
      var dateText = photo.observedAt ? String(photo.observedAt).slice(0, 10) : '';
      var photoMeta = [dateText, locality].filter(Boolean).join(' / ');
      return ''
        + '<figure class="me-area-cover me-area-hero is-source-' + escapeHtml(String(photo.source || 'auto_observation')) + '">'
        +   '<img src="' + escapeHtml(toThumbUrl(photo.photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-area-hero&quot;).classList.add(&quot;is-empty&quot;);this.remove()" />'
        +   '<figcaption>'
        +     '<span>' + escapeHtml(sourceLabel || coverSourceLabel(photo.source)) + '</span>'
        +     '<strong>' + escapeHtml(title) + '</strong>'
        +     '<small>' + escapeHtml(displayName + (photoMeta ? ' · ' + photoMeta : '')) + '</small>'
        +   '</figcaption>'
        + '</figure>';
    }
    return ''
      + '<div class="me-area-cover me-area-hero me-area-hero-map">'
      +   '<div class="me-area-hero-mark" aria-hidden="true">⌖</div>'
      +   '<div class="me-area-hero-copy">'
      +     (sourceLabel ? '<span>' + escapeHtml(sourceLabel) + '</span>' : '')
      +     '<strong>' + escapeHtml(title) + '</strong>'
      +     (meta ? '<small>' + escapeHtml(meta) + '</small>' : '')
      +   '</div>'
      + '</div>';
  }

  function renderPlaceStoryHighlights(field, summary, indicators, representativePhoto) {
    var topTaxa = Array.isArray(summary && summary.topTaxa) ? summary.topTaxa.slice(0, 3) : [];
    var taxaText = topTaxa.length
      ? topTaxa.map(function (taxon) { return taxon && taxon.name; }).filter(Boolean).join(' / ')
      : (representativePhoto && representativePhoto.displayName ? representativePhoto.displayName : COPY.placeStoryNoTaxa);
    var seasons = Number(summary && summary.seasonsCovered || 0);
    var visits = Number(summary && summary.totalVisits || 0);
    var observations = Number(summary && summary.totalObservations || 0);
    var missing = seasons < 4 ? COPY.placeStoryNeedSeason : COPY.placeStoryNeedGuide;
    var effortIndex = indicators && typeof indicators.effortIndex === 'number' && Number.isFinite(indicators.effortIndex)
      ? Math.round(indicators.effortIndex) + '/100'
      : (observations > 0 ? observations + ' records' : 'open');
    var source = String(field && field.sourceLabel || '');
    return ''
      + '<div class="me-place-story" aria-label="' + escapeHtml(COPY.placeStoryTitle) + '">'
      +   '<div class="me-place-story-head">'
      +     '<span>' + escapeHtml(COPY.placeStoryTitle) + '</span>'
      +     (source ? '<strong>' + escapeHtml(source) + '</strong>' : '')
      +   '</div>'
      +   '<div class="me-place-story-grid">'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryNow) + '</span><strong>' + escapeHtml(taxaText) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryRecent) + '</span><strong>' + escapeHtml(observations + ' / ' + visits) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryMissing) + '</span><strong>' + escapeHtml(missing) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryActions) + '</span><strong>' + escapeHtml(effortIndex) + '</strong></div>'
      +   '</div>'
      + '</div>';
  }

  function renderSchoolAlbumEntrypoints(field) {
    var profiles = Array.isArray(field && field.schoolAlbumProfiles) ? field.schoolAlbumProfiles : [];
    if (!profiles.length) return '';
    return ''
      + '<section class="me-school-albums" aria-label="学校の図鑑">'
      +   '<div class="me-area-gallery-head">'
      +     '<span>学校の図鑑を育てる</span>'
      +     '<strong>授業、通学路、季節比較に分けて記録を集める。</strong>'
      +   '</div>'
      +   '<div class="me-school-albums-grid">'
      + profiles.map(function (profile) {
        return '<a class="me-school-album-card" href="' + escapeHtml(String(profile.href || '#')) + '">'
          + '<span>' + escapeHtml(String(profile.kind || 'school')) + '</span>'
          + '<strong>' + escapeHtml(String(profile.title || '学校図鑑')) + '</strong>'
          + '<small>' + escapeHtml(String(profile.lead || 'この学校の自然を記録する。')) + '</small>'
          + '</a>';
      }).join('')
      +   '</div>'
      + '</section>';
  }

  function renderAreaAccessGuidance(guidance) {
    if (!guidance) return '';
    return ''
      + '<section class="me-area-access me-area-access-' + escapeHtml(String(guidance.status || 'unknown')) + '">'
      +   '<span>' + escapeHtml(String(guidance.label || '立入可否 不明')) + '</span>'
      +   '<p>' + escapeHtml(String(guidance.body || 'このエリアが私有地か、無許可で入れる場所かは未確認です。立入前に現地の案内、管理者、公開範囲を確認してください。')) + '</p>'
      + '</section>';
  }

  function transientAccessGuidance(props) {
    var source = String(props && props.source || '');
    var access = String(props && props.access || '').toLowerCase();
    if (access === 'private' || access === 'no' || access === 'restricted') {
      return { status: 'private_or_restricted', label: '立入注意', body: '私有地または立入制限のある区域の可能性があります。管理者の許可なく入らず、道路・公開園路など入れる場所から観察してください。' };
    }
    if (source === 'school') {
      return { status: 'permission_required', label: '学校・キャンパス', body: '学校やキャンパスは関係者区域を含むことがあります。無許可で敷地内に入らず、公開範囲・学校行事・管理者許可のある観察だけにしてください。' };
    }
    if (access === 'yes' || access === 'public' || access === 'permissive') {
      return { status: 'public_access', label: '公開範囲を確認', body: '公開されている範囲でも、夜間閉鎖・保護区域・立入禁止ロープなど現地ルールが優先です。案内板と管理者の指示に従ってください。' };
    }
    return { status: 'unknown', label: '立入可否 不明', body: 'このエリアが私有地か、無許可で入れる場所かは未確認です。立入前に現地の案内、管理者、公開範囲を確認してください。' };
  }

  function renderAreaObservationGallery(items, options) {
    var records = Array.isArray(items) ? items.slice(0, 8) : [];
    var label = options && options.label ? String(options.label) : COPY.areaGalleryTitle;
    if (!records.length) {
      return ''
        + '<section class="me-area-gallery is-empty" aria-label="' + escapeHtml(label) + '">'
        +   '<div class="me-area-gallery-head">'
        +     '<span>' + escapeHtml(label) + '</span>'
        +     '<strong>' + escapeHtml(COPY.areaGalleryEmpty) + '</strong>'
        +   '</div>'
        +   '<a class="me-area-gallery-empty-cta" href="' + escapeHtml(RECORD_HREF) + '">' + escapeHtml(COPY.placeActionRecord) + '</a>'
        + '</section>';
    }
    return ''
      + '<section class="me-area-gallery" aria-label="' + escapeHtml(label) + '">'
      +   '<div class="me-area-gallery-head">'
      +     '<span>' + escapeHtml(label) + '</span>'
      +     '<strong>' + escapeHtml(COPY.areaGalleryLead) + '</strong>'
      +   '</div>'
      +   '<div class="me-area-gallery-grid">'
      + records.map(function (item) {
        var occurrenceId = String(item && item.occurrenceId || '');
        var href = occurrenceId ? OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(occurrenceId)) : NOTES_HREF;
        var count = Math.max(1, Number(item && item.observationCount || 1));
        var date = item && item.observedAt ? String(item.observedAt).slice(0, 10) : '';
        var locality = String(item && item.localityLabel || '');
        var meta = [count + COPY.areaGalleryCountSuffix, date, locality].filter(Boolean).join(' / ');
        var seasonBadge = item && item.seasonLabel
          ? '<span class="me-area-gallery-season' + (item.isCurrentSeason ? ' is-current' : '') + '">' + escapeHtml((item.isCurrentSeason ? COPY.areaSeasonNow + ' · ' : '') + item.seasonLabel) + '</span>'
          : '';
        var photo = item && item.photoUrl
          ? '<img src="' + escapeHtml(toThumbUrl(item.photoUrl, 'md')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-area-gallery-card&quot;).classList.add(&quot;is-photoless&quot;);this.remove()" />'
          : '<span class="me-area-gallery-placeholder" aria-hidden="true">✦</span>';
        return ''
          + '<a class="me-area-gallery-card" href="' + escapeHtml(href) + '">'
          +   photo
          +   seasonBadge
          +   '<strong>' + escapeHtml(String(item && item.displayName || '同定待ち')) + '</strong>'
          +   '<small>' + escapeHtml(meta) + '</small>'
          + '</a>';
      }).join('')
      +   '</div>'
      + '</section>';
  }

  function transientAreaGalleryItems(center) {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];
    return nearbyRecordsForContext({ lat: center.lat, lng: center.lng }, 900)
      .map(function (entry) {
        var record = entry.record || {};
        return {
          occurrenceId: record.occurrenceId || '',
          visitId: record.visitId || '',
          displayName: record.displayName || '同定待ち',
          observedAt: record.observedAt || null,
          photoUrl: record.photoUrl || null,
          localityLabel: record.localityLabel || '',
          observationCount: 1,
        };
      });
  }

  function renderAreaStoryTabs(snapshot) {
    var summary = (snapshot && snapshot.observationSummary) || {};
    var gallery = Array.isArray(snapshot && snapshot.observationGallery) ? snapshot.observationGallery : [];
    var seasonalCoverage = Array.isArray(snapshot && snapshot.seasonalCoverage) ? snapshot.seasonalCoverage : [];
    var topTaxa = Array.isArray(summary.topTaxa) ? summary.topTaxa.slice(0, 8) : [];
    var taxaHtml = topTaxa.length
      ? topTaxa.map(function (taxon) {
          return '<span class="me-area-story-chip">' + escapeHtml(String(taxon.name || '同定待ち')) + '<b>' + escapeHtml(String(taxon.count || 0)) + '</b></span>';
        }).join('')
      : '<p class="me-area-story-note">' + escapeHtml(COPY.placeStoryNoTaxa) + '</p>';
    var recentItems = gallery.slice().sort(function (a, b) {
      return Number(b.recentObservationCount || 0) - Number(a.recentObservationCount || 0)
        || Number(b.observationCount || 0) - Number(a.observationCount || 0);
    }).filter(function (item) { return Number(item.recentObservationCount || 0) > 0; }).slice(0, 5);
    var recentHtml = recentItems.length
      ? recentItems.map(function (item) {
          return '<span class="me-area-story-chip">' + escapeHtml(String(item.displayName || '同定待ち')) + '<b>' + escapeHtml(String(item.recentObservationCount || 0)) + '</b></span>';
        }).join('')
      : '<p class="me-area-story-note">' + escapeHtml(COPY.areaGalleryLead) + '</p>';
    var missing = seasonalCoverage.filter(function (row) { return Number(row.observations || 0) <= 0; });
    var missingHtml = missing.length
      ? '<p class="me-area-story-note">' + escapeHtml(COPY.areaMissingSeasonLead) + '</p>'
        + missing.map(function (row) {
            return '<a class="me-area-season-gap" href="' + escapeHtml(RECORD_HREF) + '">'
              + '<span>' + escapeHtml(String(row.label || row.season || 'season')) + '</span>'
              + '<strong>' + escapeHtml(COPY.placeActionRecord) + '</strong>'
              + '</a>';
          }).join('')
      : '<p class="me-area-story-note">' + escapeHtml(COPY.areaCompleteSeasonLead) + '</p>';
    return ''
      + '<section class="me-area-story-tabs" data-area-story-tabs>'
      +   '<div class="me-area-story-tablist" role="tablist">'
      +     '<button type="button" class="is-active" data-area-story-tab="representative">' + escapeHtml(COPY.areaTabRepresentative) + '</button>'
      +     '<button type="button" data-area-story-tab="recent">' + escapeHtml(COPY.areaTabRecent) + '</button>'
      +     '<button type="button" data-area-story-tab="missing">' + escapeHtml(COPY.areaTabMissing) + '</button>'
      +   '</div>'
      +   '<div class="me-area-story-panel is-active" data-area-story-panel="representative">' + taxaHtml + '</div>'
      +   '<div class="me-area-story-panel" data-area-story-panel="recent">' + recentHtml + '</div>'
      +   '<div class="me-area-story-panel" data-area-story-panel="missing">' + missingHtml + '</div>'
      + '</section>';
  }

  function coverSourceLabel(source) {
    if (source === 'admin_curated') return COPY.coverSourceAdmin;
    if (source === 'community_curated') return COPY.coverSourceCommunity;
    return COPY.coverSourceAuto;
  }

  function renderRepresentativePhoto(photo) {
    if (!photo || !photo.photoUrl) return '';
    var displayName = String(photo.displayName || COPY.coverFallbackTitle);
    var locality = String(photo.localityLabel || '');
    var dateText = photo.observedAt ? String(photo.observedAt).slice(0, 10) : '';
    var meta = [dateText, locality].filter(Boolean).join(' / ');
    return ''
      + '<figure class="me-area-cover is-source-' + escapeHtml(String(photo.source || 'auto_observation')) + '">'
      +   '<img src="' + escapeHtml(toThumbUrl(photo.photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-area-cover&quot;).remove()" />'
      +   '<figcaption>'
      +     '<span>' + escapeHtml(coverSourceLabel(photo.source)) + '</span>'
      +     '<strong>' + escapeHtml(displayName) + '</strong>'
      +     (meta ? '<small>' + escapeHtml(meta) + '</small>' : '')
      +   '</figcaption>'
      + '</figure>';
  }

  function renderAreaHero(options) {
    var title = String(options && options.title || '観察エリア');
    var sourceLabel = String(options && options.sourceLabel || '');
    var meta = String(options && options.meta || '');
    var photo = options && options.photo;
    if (photo && photo.photoUrl) {
      var displayName = String(photo.displayName || COPY.coverFallbackTitle);
      var locality = String(photo.localityLabel || '');
      var dateText = photo.observedAt ? String(photo.observedAt).slice(0, 10) : '';
      var photoMeta = [dateText, locality].filter(Boolean).join(' / ');
      return ''
        + '<figure class="me-area-cover me-area-hero is-source-' + escapeHtml(String(photo.source || 'auto_observation')) + '">'
        +   '<img src="' + escapeHtml(toThumbUrl(photo.photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-area-hero&quot;).classList.add(&quot;is-empty&quot;);this.remove()" />'
        +   '<figcaption>'
        +     '<span>' + escapeHtml(sourceLabel || coverSourceLabel(photo.source)) + '</span>'
        +     '<strong>' + escapeHtml(title) + '</strong>'
        +     '<small>' + escapeHtml(displayName + (photoMeta ? ' · ' + photoMeta : '')) + '</small>'
        +   '</figcaption>'
        + '</figure>';
    }
    return ''
      + '<div class="me-area-cover me-area-hero me-area-hero-map">'
      +   '<div class="me-area-hero-mark" aria-hidden="true">⌖</div>'
      +   '<div class="me-area-hero-copy">'
      +     (sourceLabel ? '<span>' + escapeHtml(sourceLabel) + '</span>' : '')
      +     '<strong>' + escapeHtml(title) + '</strong>'
      +     (meta ? '<small>' + escapeHtml(meta) + '</small>' : '')
      +   '</div>'
      + '</div>';
  }

  function renderPlaceStoryHighlights(field, summary, indicators, representativePhoto) {
    var topTaxa = Array.isArray(summary && summary.topTaxa) ? summary.topTaxa.slice(0, 3) : [];
    var taxaText = topTaxa.length
      ? topTaxa.map(function (taxon) { return taxon && taxon.name; }).filter(Boolean).join(' / ')
      : (representativePhoto && representativePhoto.displayName ? representativePhoto.displayName : COPY.placeStoryNoTaxa);
    var seasons = Number(summary && summary.seasonsCovered || 0);
    var visits = Number(summary && summary.totalVisits || 0);
    var observations = Number(summary && summary.totalObservations || 0);
    var missing = seasons < 4 ? COPY.placeStoryNeedSeason : COPY.placeStoryNeedGuide;
    var effortIndex = indicators && typeof indicators.effortIndex === 'number' && Number.isFinite(indicators.effortIndex)
      ? Math.round(indicators.effortIndex) + '/100'
      : (observations > 0 ? observations + ' records' : 'open');
    var source = String(field && field.sourceLabel || '');
    return ''
      + '<div class="me-place-story" aria-label="' + escapeHtml(COPY.placeStoryTitle) + '">'
      +   '<div class="me-place-story-head">'
      +     '<span>' + escapeHtml(COPY.placeStoryTitle) + '</span>'
      +     (source ? '<strong>' + escapeHtml(source) + '</strong>' : '')
      +   '</div>'
      +   '<div class="me-place-story-grid">'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryNow) + '</span><strong>' + escapeHtml(taxaText) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryRecent) + '</span><strong>' + escapeHtml(observations + ' / ' + visits) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryMissing) + '</span><strong>' + escapeHtml(missing) + '</strong></div>'
      +     '<div class="me-place-story-card"><span>' + escapeHtml(COPY.placeStoryActions) + '</span><strong>' + escapeHtml(effortIndex) + '</strong></div>'
      +   '</div>'
      + '</div>';
  }

  function renderAreaSheet(snapshot) {
    var f = (snapshot && snapshot.field) || {};
    var summary = (snapshot && snapshot.observationSummary) || {};
    var timeline = (snapshot && snapshot.yearlyTimeline) || [];
    var indicators = (snapshot && snapshot.effortIndicators) || null;
    var masking = (snapshot && snapshot.sensitiveMasking) || null;
    var representativePhoto = (snapshot && snapshot.representativePhoto) || null;
    var gallery = (snapshot && snapshot.observationGallery) || [];
    var name = escapeHtml(String(f.name || ''));
    var sourceLabel = escapeHtml(String(f.sourceLabel || ''));
    var rawLocationLabel = String(f.locationLabel || '');
    var locationLabel = escapeHtml(rawLocationLabel);
    var areaHa = (typeof f.areaHa === 'number' && Number.isFinite(f.areaHa))
      ? Math.round(f.areaHa).toLocaleString('ja-JP') + ' ha'
      : '';
    var officialUrl = String(f.officialUrl || '');
    var fieldId = (state.selectedPoint && state.selectedPoint.fieldId) || '';
    var ctaHref = fieldId && eventsNewHrefTemplate
      ? eventsNewHrefTemplate.replace('__FIELD_ID__', encodeURIComponent(fieldId))
      : '';
    var followHtml = renderAreaFollowButton('field', fieldId, String(f.name || '観察エリア'), mapFollowHref({ field: fieldId }));
    var areaMeta = rawLocationLabel + (areaHa ? ' / ' + areaHa : '');
    var heroHtml = renderAreaHero({
      title: String(f.name || '観察エリア'),
      sourceLabel: String(f.sourceLabel || ''),
      meta: areaMeta,
      photo: representativePhoto,
    });
    // CTA を上に置いて、スクロールせずに「ここで観察会を開く」が見える状態に。
    var ctaHtml = ctaHref
      ? ''
        + '<div class="me-area-sheet-cta">'
        +   '<a class="me-area-sheet-cta-btn" href="' + escapeHtml(ctaHref) + '">'
        +     '<span class="me-area-sheet-cta-icon" aria-hidden="true">＋</span>'
        +     escapeHtml(COPY.areaEventCreateLabel)
        +   '</a>'
        +   (officialUrl
          ? '<a class="me-area-sheet-url" href="' + escapeHtml(officialUrl) + '" target="_blank" rel="noopener">公式情報 ↗</a>'
          : '')
        +   '<span class="me-area-sheet-cta-hint">' + escapeHtml(COPY.areaEventCreateHint) + '</span>'
        + '</div>'
      : '';
    var summaryHtml = ''
      + '<div class="me-area-sheet-summary">'
      +   '<div><span>' + escapeHtml(COPY.placeStoryRecent) + '</span><strong>' + escapeHtml(String(summary.totalObservations || 0)) + '</strong></div>'
      +   '<div><span>' + escapeHtml(COPY.placeStoryNow) + '</span><strong>' + escapeHtml(String(summary.uniqueTaxa || 0)) + '</strong></div>'
      +   '<div><span>' + escapeHtml(COPY.placeActionRecord) + '</span><strong>' + escapeHtml(String(summary.totalVisits || 0)) + '</strong></div>'
      +   '<div><span>' + escapeHtml(COPY.siteBriefWhyNowLabel) + '</span><strong>' + escapeHtml(String(summary.seasonsCovered || 0)) + '/4</strong></div>'
      + '</div>';
    var timelineHtml = renderAreaTimeline(timeline);
    var indicatorsHtml = renderEffortIndicators(indicators);
    var maskingHtml = renderSensitiveBanner(masking);
    var placeStoryHtml = renderPlaceStoryHighlights(f, summary, indicators, representativePhoto);
    var galleryHtml = renderAreaObservationGallery(gallery, { label: COPY.areaGalleryTitle });
    var schoolAlbumHtml = renderSchoolAlbumEntrypoints(f);
    var accessHtml = renderAreaAccessGuidance(f.accessGuidance);
    var storyTabsHtml = renderAreaStoryTabs(snapshot);
    var publicPageHtml = fieldId
      ? '<a class="me-area-public-page" href="' + escapeHtml(FIELDS_ALBUM_TPL.replace('__FIELD_ID__', encodeURIComponent(fieldId))) + '">' + escapeHtml(COPY.areaPublicPageLabel) + '</a>'
      : '';
    return heroHtml + ctaHtml + accessHtml + followHtml + publicPageHtml + schoolAlbumHtml + galleryHtml + storyTabsHtml + placeStoryHtml + summaryHtml + timelineHtml + indicatorsHtml + maskingHtml;
  }

  function renderAreaTimeline(timeline) {
    if (!Array.isArray(timeline) || timeline.length === 0) {
      return '<div class="me-area-sheet-timeline is-empty">' + escapeHtml(COPY.placeStoryNeedSeason) + '</div>';
    }
    var maxObs = 1;
    timeline.forEach(function (row) {
      if (row && typeof row.observations === 'number' && row.observations > maxObs) maxObs = row.observations;
    });
    var bars = timeline.map(function (row) {
      var obs = (row && row.observations) || 0;
      var taxa = (row && row.uniqueTaxa) || 0;
      var height = Math.max(2, Math.round((obs / maxObs) * 48));
      return ''
        + '<div class="me-area-tl-bar" title="' + escapeHtml(String(row.year) + '年: ' + obs + '件 / ' + taxa + '種') + '">'
        +   '<span class="me-area-tl-bar-fill" style="height:' + height + 'px"></span>'
        +   '<span class="me-area-tl-bar-label">' + escapeHtml(String(row.year).slice(-2)) + '</span>'
        + '</div>';
    }).join('');
    return ''
      + '<div class="me-area-sheet-timeline">'
      +   '<div class="me-area-tl-title">' + escapeHtml(COPY.placeStoryRecent) + '</div>'
      +   '<div class="me-area-tl-row">' + bars + '</div>'
      + '</div>';
  }

  function renderEffortIndicators(indicators) {
    if (!indicators) return '';
    // 0% が並んだとき「エリアが悪い」のではなく「記録がまだ薄いだけ」と分かるように、
    // 各カードに「100% に近づくと何が言えるか」を hint として置く (eBird/iNaturalist 文献ベース)。
    var cards = [
      {
        label: '歩かれ方',
        value: indicators.effortReportedRate,
        hint: '歩いた時間や距離が添えられた記録。増えるほど、同じ場所の見え方を比べやすい',
      },
      {
        label: '見たものメモの厚み',
        value: indicators.completeChecklistRate,
        hint: '見たものをまとめて残した記録。多いほど、季節ごとの顔が見えやすくなる',
      },
      {
        label: '季節の見え方',
        value: indicators.temporalSpreadIndex,
        hint: '季節、月、年をまたいだ記録の広がり。高いほど、また行く楽しみが増える',
      },
      {
        label: '見ている人の広がり',
        value: indicators.observerDiversity,
        hint: '何人の目で見られているか。広がるほど、場所の表情が立体的になる',
      },
      {
        label: '見つからなかったメモ',
        value: indicators.nonDetectionRate,
        hint: '探したけれど見つからなかった記録。次に訪れたときの変化に気づきやすくなる',
      },
    ];
    var cardsHtml = cards.map(function (c) {
      var pct = (typeof c.value === 'number' && Number.isFinite(c.value))
        ? Math.round(c.value * 100) : null;
      var pctText = pct == null ? '—' : pct + '%';
      var barWidth = pct == null ? 0 : Math.max(2, Math.min(100, pct));
      return ''
        + '<div class="me-area-effort-card">'
        +   '<div class="me-area-effort-label">' + escapeHtml(c.label) + '</div>'
        +   '<div class="me-area-effort-value">' + escapeHtml(pctText) + '</div>'
        +   '<div class="me-area-effort-bar"><span style="width:' + barWidth + '%"></span></div>'
        +   '<div class="me-area-effort-hint">' + escapeHtml(c.hint) + '</div>'
        + '</div>';
    }).join('');
    var indexValue = (typeof indicators.effortIndex === 'number' && Number.isFinite(indicators.effortIndex))
      ? Math.round(indicators.effortIndex) : null;
    var indexText = indexValue == null ? '—' : (indexValue + '/100');
    var bandText = indexValue == null
      ? 'まだ評価できない'
      : indexValue < 30 ? 'まだこれから'
      : indexValue < 70 ? '季節が見え始めた'
      : 'また行く理由が育っている';
    return ''
      + '<div class="me-area-effort">'
      +   '<div class="me-area-effort-title">'
      +     '<span>' + escapeHtml(COPY.placeStoryMissing) + '</span>'
      +     '<span class="me-area-effort-index">' + escapeHtml(indexText) + ' · ' + escapeHtml(bandText) + '</span>'
      +   '</div>'
      +   '<p class="me-area-effort-explainer">'
      +     escapeHtml(COPY.impactPrivateNote) + '<br>'
      +     escapeHtml(COPY.placeStoryNeedSeason)
      +   '</p>'
      +   '<div class="me-area-effort-grid">' + cardsHtml + '</div>'
      + '</div>';
  }

  function renderSensitiveBanner(masking) {
    if (!masking || !masking.maskedSpecies) return '';
    var n = masking.maskedSpecies | 0;
    if (n <= 0) return '';
    var canSee = !!masking.viewerCanSeeExact;
    var msg = canSee
      ? '希少種 ' + n + ' 種の正確座標が見える権限です。観察記録を共有する際は配慮してください。'
      : 'このエリアには希少種 ' + n + ' 種が含まれます。座標は約 1km メッシュに丸めて表示しています。';
    return '<div class="me-area-sensitive ' + (canSee ? 'is-privileged' : '') + '">' + escapeHtml(msg) + '</div>';
  }

  function dominantTaxonGroup(taxonMix) {
    var best = 'other';
    var bestCount = -1;
    Object.keys(taxonMix || {}).forEach(function (key) {
      var count = Number(taxonMix[key] || 0);
      if (count > bestCount) {
        best = key;
        bestCount = count;
      }
    });
    return best;
  }

  function buildCellPointCollection(features) {
    return {
      type: 'FeatureCollection',
      features: (features || []).map(function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        var lng = Number(props.centroidLng);
        var lat = Number(props.centroidLat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        var group = dominantTaxonGroup(props.taxonMix || {});
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {
            cellId: props.cellId || '',
            count: Number(props.count || 0),
            dominantTaxonGroup: group,
            label: props.albumName || props.label || '',
          },
        };
      }).filter(Boolean),
    };
  }

  function syncCellPointSource(map, features) {
    var collection = buildCellPointCollection(features);
    var pointSource = map.getSource('observation-centroids');
    if (pointSource) pointSource.setData(collection);
    return collection;
  }

  function taxonColorExpression(alpha) {
    var a = typeof alpha === 'number' ? alpha : 1;
    return [
      'match', ['get', 'dominantTaxonGroup'],
      'insect', 'rgba(245,158,11,' + a + ')',
      'bird', 'rgba(14,165,233,' + a + ')',
      'plant', 'rgba(16,185,129,' + a + ')',
      'amphibian_reptile', 'rgba(34,197,94,' + a + ')',
      'mammal', 'rgba(168,85,247,' + a + ')',
      'fungi', 'rgba(239,68,68,' + a + ')',
      'rgba(100,116,139,' + a + ')',
    ];
  }

  function ensureCellSource(map, features) {
    var sourceId = 'observations';
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData({ type: 'FeatureCollection', features: features });
      syncCellPointSource(map, features);
      highlightSelectedCell();
      return;
    }
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: features },
    });
    map.addSource('observation-centroids', {
      type: 'geojson',
      data: buildCellPointCollection(features),
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
      id: 'observation-cell-bloom',
      type: 'circle',
      source: 'observation-centroids',
      paint: {
        'circle-color': taxonColorExpression(0.26),
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          6, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 1], 1, 8, 8, 14, 24, 24],
          13, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 1], 1, 15, 8, 24, 24, 38],
        ],
        'circle-stroke-color': taxonColorExpression(0.82),
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 1.2, 13, 2.4],
        'circle-opacity': 0.86,
      },
    });
    map.addLayer({
      id: 'observation-cell-dot',
      type: 'circle',
      source: 'observation-centroids',
      paint: {
        'circle-color': taxonColorExpression(0.95),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4, 13, 7],
        'circle-stroke-color': 'rgba(255,255,255,0.96)',
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: 'observation-cell-count',
      type: 'symbol',
      source: 'observation-centroids',
      minzoom: 7,
      layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'count'], 1]],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 13, 12],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(15,23,42,0.34)',
        'text-halo-width': 0.8,
      },
    });
    map.addLayer({
      id: 'observation-cell-label',
      type: 'symbol',
      source: sourceId,
      minzoom: 7,
      layout: {
        'text-field': ['to-string', ['coalesce', ['get', 'count'], 1]],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 13],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#075985',
        'text-halo-color': 'rgba(255,255,255,0.94)',
        'text-halo-width': 1.4,
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
    ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-bloom', 'observation-cell-dot', 'observation-cell-count', 'obs-cell-heat'].forEach(function (layerId) {
      map.on('click', layerId, function (e) {
        if (hasPendingMapResults()) return;
        // 公園ポリゴンが下に重なっているなら、そちらを優先 (西伊場第1公園のような
        // 小さな OSM polygon を heatmap セル経由でも開けるようにする)。
        if (state.map && state.map.getLayer('area-polygon-fill')) {
          var areaHits = state.map.queryRenderedFeatures(e.point, { layers: ['area-polygon-fill'] });
          if (areaHits && areaHits.length > 0) {
            var pick = areaHits[0];
            var pickArea = (pick.properties && Number(pick.properties.area_ha)) || Infinity;
            for (var i = 1; i < areaHits.length; i += 1) {
              var f = areaHits[i];
              var area = (f.properties && Number(f.properties.area_ha));
              if (Number.isFinite(area) && area < pickArea) {
                pick = f;
                pickArea = area;
              }
            }
            openAreaFeatureSheet(pick, e.lngLat.lat, e.lngLat.lng);
            return;
          }
        }
        if (!e.features || !e.features[0]) return;
        var selectedFeature = e.features[0];
        if (selectedFeature.geometry && selectedFeature.geometry.type === 'Point') {
          selectedFeature = findCellFeatureById(selectedFeature.properties && selectedFeature.properties.cellId) || selectedFeature;
        }
        selectCell(selectedFeature, { focusMap: false, openSheet: true });
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
    var markerLayers = ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-bloom', 'observation-cell-dot', 'observation-cell-count', 'observation-cell-label', 'observation-cell-selected'];
    var heatLayers = ['obs-cell-heat', 'obs-cell-heat-selected'];
    var frontierLayers = ['frontier-fill'];
    var areaLayers = ['area-polygon-fill', 'area-polygon-outline', 'area-polygon-selected'];
    var show = function (ids, visible) {
      ids.forEach(function (id) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      });
    };
    show(markerLayers, tab === 'markers');
    show(heatLayers, tab === 'heatmap');
    show(frontierLayers, tab === 'frontier');
    show(areaLayers, tab === 'markers' || tab === 'places');
    if (map.getLayer('waterway-hint-line')) {
      map.setLayoutProperty('waterway-hint-line', 'visibility', tab === 'places' ? 'visible' : 'none');
    }
    if (map.getLayer('area-polygon-fill')) {
      map.setPaintProperty('area-polygon-fill', 'fill-opacity',
        tab === 'places'
          ? ['interpolate', ['linear'], ['zoom'], 8, 0.22, 14, 0.46]
          : ['interpolate', ['linear'], ['zoom'], 8, 0.06, 14, 0.16]);
    }
    if (map.getLayer('area-polygon-outline')) {
      map.setPaintProperty('area-polygon-outline', 'line-opacity', tab === 'places' ? 0.86 : 0.42);
    }

    if (tab === 'heatmap') {
      ensureHeatmap(map);
      showLegend(COPY.heatmapLegendLow, COPY.heatmapLegendHigh,
        'linear-gradient(90deg, rgba(56,189,248,0.2), #0ea5e9 40%, #f59e0b 75%, #ef4444)');
    } else if (tab === 'frontier') {
      ensureFrontier(map);
      showLegend(COPY.coverageLegendLow, COPY.coverageLegendHigh,
        'linear-gradient(90deg, rgba(148,163,184,0.14), rgba(14,165,233,0.28) 30%, rgba(16,185,129,0.4) 65%, rgba(5,150,105,0.72))');
    } else if (tab === 'places') {
      hideLegend();
      loadWaterwayHints();
    } else {
      hideLegend();
    }
    refreshDiscoveryPreviewMarkers();
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
            'blank', 'rgba(100,116,139,0.12)',
            'building', 'rgba(14,165,233,0.16)',
            'repeatable', 'rgba(20,184,166,0.18)',
            'rgba(5,150,105,0.22)',
          ],
          'fill-opacity': [
            'match', ['get', 'stage'],
            'blank', 0.04,
            'building', 0.07,
            'repeatable', 0.09,
            0.12,
          ],
          'fill-outline-color': 'rgba(15,118,110,0.10)',
        },
      });
      map.on('click', 'frontier-fill', function (e) {
        // Frontier cells can cover small park polygons. If the click also hits
        // a registered area, open the concrete area so the event creator keeps
        // its field_id instead of falling back to a generic coordinate.
        if (state.map && state.map.getLayer('area-polygon-fill')) {
          var areaHits = state.map.queryRenderedFeatures(e.point, { layers: ['area-polygon-fill'] });
          if (areaHits && areaHits.length > 0) {
            var pick = areaHits[0];
            var pickArea = (pick.properties && Number(pick.properties.area_ha)) || Infinity;
            for (var i = 1; i < areaHits.length; i += 1) {
              var f = areaHits[i];
              var area = (f.properties && Number(f.properties.area_ha));
              if (Number.isFinite(area) && area < pickArea) {
                pick = f;
                pickArea = area;
              }
            }
            openAreaFeatureSheet(pick, e.lngLat.lat, e.lngLat.lng);
            return;
          }
        }
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

  function currentOverpassBbox() {
    if (!state.map) return null;
    var bounds = state.map.getBounds();
    if (!bounds) return null;
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  }

  function ensureWaterwayHints(map) {
    if (!map || map.getSource('waterway-hints')) return;
    map.addSource('waterway-hints', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    var beforeId = map.getLayer('area-polygon-fill') ? 'area-polygon-fill' : (map.getLayer('observation-cell-fill') ? 'observation-cell-fill' : undefined);
    map.addLayer({
      id: 'waterway-hint-line',
      type: 'line',
      source: 'waterway-hints',
      minzoom: 12.8,
      paint: {
        'line-color': [
          'match', ['get', 'kind'],
          'waterbody', '#38bdf8',
          '#0284c7',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.1, 16, 3.4],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.18, 16, 0.48],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 1.4],
      },
    }, beforeId);
  }

  function emptyWaterwayHints() {
    if (!state.map) return;
    var src = state.map.getSource('waterway-hints');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  }

  function overpassWayToFeature(element) {
    if (!element || !Array.isArray(element.geometry) || element.geometry.length < 2) return null;
    var coords = element.geometry.map(function (pt) {
      return [Number(pt.lon), Number(pt.lat)];
    }).filter(function (pt) {
      return Number.isFinite(pt[0]) && Number.isFinite(pt[1]);
    });
    if (coords.length < 2) return null;
    var tags = element.tags || {};
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {
        id: String(element.type || 'way') + ':' + String(element.id || ''),
        kind: tags.natural === 'water' ? 'waterbody' : 'waterway',
        name: tags.name || tags.waterway || tags.natural || '',
      },
    };
  }

  function loadWaterwayHints() {
    if (!state.map || state.tab !== 'places') return;
    if (state.map.getZoom() < 12.8) {
      emptyWaterwayHints();
      return;
    }
    ensureWaterwayHints(state.map);
    var bbox = currentOverpassBbox();
    if (!bbox) return;
    var searchKey = [bbox.south, bbox.west, bbox.north, bbox.east].map(function (n) { return Number(n).toFixed(3); }).join(',');
    if (state.waterwaySearchKey === searchKey) return;
    state.waterwaySearchKey = searchKey;
    if (state.waterwayAbort) { try { state.waterwayAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.waterwayAbort = controller;
    var bb = [bbox.south, bbox.west, bbox.north, bbox.east].map(function (n) { return Number(n).toFixed(6); }).join(',');
    var query = '[out:json][timeout:6];(' +
      'way["waterway"~"^(river|stream|canal|drain|ditch)$"](' + bb + ');' +
      'way["natural"="water"](' + bb + ');' +
      ');out geom 90;';
    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller ? controller.signal : undefined,
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        if (!json || !state.map || state.tab !== 'places') return;
        ensureWaterwayHints(state.map);
        var features = (Array.isArray(json.elements) ? json.elements : [])
          .map(overpassWayToFeature)
          .filter(Boolean)
          .slice(0, 90);
        var src = state.map.getSource('waterway-hints');
        if (src) src.setData({ type: 'FeatureCollection', features: features });
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
  }

  function ensureAreaPolygons(map) {
    if (map.getSource('area-polygons')) return;
    map.addSource('area-polygons', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    // Insert below observation-cell-fill so cell clicks still win for marker tab.
    var beforeId = map.getLayer('observation-cell-fill') ? 'observation-cell-fill' : undefined;
    map.addLayer({
      id: 'area-polygon-fill',
      type: 'fill',
      source: 'area-polygons',
      minzoom: 8,
      layout: {
        // 「公園 vs 行政界」のような大小ポリゴン重なりで小さい方を上に描画。
        // クリック時の queryRenderedFeatures もこの順を尊重するので、
        // クリック判定でも小ポリゴン (= より具体的な場所) が優先される。
        'fill-sort-key': ['-', 0, ['coalesce', ['get', 'area_ha'], 0]],
      },
      paint: {
        'fill-color': [
          'match', ['get', 'source'],
          'protected_area', 'rgba(34,197,94,0.18)',
          'oecm', 'rgba(132,204,22,0.18)',
          'nature_symbiosis_site', 'rgba(16,185,129,0.18)',
          'tsunag', 'rgba(20,184,166,0.18)',
          'school', 'rgba(245,158,11,0.16)',
          'osm_park', 'rgba(56,189,248,0.14)',
          'admin_municipality', 'rgba(148,163,184,0.10)',
          'admin_prefecture', 'rgba(148,163,184,0.08)',
          'admin_country', 'rgba(148,163,184,0.06)',
          'rgba(148,163,184,0.10)',
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.32, 14, 0.6],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-outline',
      type: 'line',
      source: 'area-polygons',
      minzoom: 8,
      paint: {
        'line-color': [
          'match', ['get', 'source'],
          'protected_area', '#15803d',
          'oecm', '#65a30d',
          'nature_symbiosis_site', '#0f766e',
          'tsunag', '#0d9488',
          'school', '#b45309',
          'osm_park', '#0284c7',
          '#475569',
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.6],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-selected',
      type: 'line',
      source: 'area-polygons',
      filter: ['==', ['get', 'field_id'], '__none__'],
      paint: {
        'line-color': '#0f766e',
        'line-width': 2.6,
      },
    });
    map.on('click', 'area-polygon-fill', function (e) {
      if (!e.features || e.features.length === 0) return;
      // 重なりがあるとき、面積最小 (= より具体的な公園) を優先する。
      // 大きな行政界に被さった小さな公園をクリックしたつもりが、
      // 行政界のほうが選ばれる事故を防ぐ。
      var pick = e.features[0];
      var pickArea = (pick.properties && Number(pick.properties.area_ha)) || Infinity;
      for (var i = 1; i < e.features.length; i += 1) {
        var f = e.features[i];
        var area = (f.properties && Number(f.properties.area_ha));
        if (Number.isFinite(area) && area < pickArea) {
          pick = f;
          pickArea = area;
        }
      }
      openAreaFeatureSheet(pick, e.lngLat.lat, e.lngLat.lng);
    });
    map.on('mouseenter', 'area-polygon-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'area-polygon-fill', function () { map.getCanvas().style.cursor = ''; });
  }

  function loadAreaPolygons() {
    if (!apiAreaPolygons || !state.map) return;
    var bbox = currentBboxString();
    if (!bbox) return;
    var zoom = state.map.getZoom();
    if (zoom < 8) {
      // Phase 1: nothing to render under z8 (admin_country/prefecture land in Phase 2).
      var src = state.map.getSource('area-polygons');
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    if (state.areaPolygonsAbort) { try { state.areaPolygonsAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.areaPolygonsAbort = controller;
    var qs = '?bbox=' + encodeURIComponent(bbox) + '&zoom=' + encodeURIComponent(zoom.toFixed(2));
    var selectedSources = areaSourcesQueryValue();
    if (selectedSources) qs += '&sources=' + encodeURIComponent(selectedSources);
    fetch(apiAreaPolygons + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (collection) {
        if (!collection) return;
        ensureAreaPolygons(state.map);
        var src = state.map.getSource('area-polygons');
        if (src) src.setData(collection);
        applyTab(state.map, state.tab);
      })
      .catch(function (err) { if (err && err.name === 'AbortError') return; });
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
        refreshDiscoveryPreviewMarkers();
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
        refreshDiscoveryPreviewMarkers();
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
        clearDiscoveryPreviewMarkers();
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
    if (state.map && state.tab === 'frontier') loadFrontier(state.map);
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
      ensureAreaPolygons(state.map);
      loadAreaPolygons();
      state.waterwaySearchKey = '';
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
      areaSources: state.areaSources,
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
      if (window.ikimonAppOutbox && typeof window.ikimonAppOutbox.enqueue === 'function') {
        window.ikimonAppOutbox.enqueue({
          id: 'map:state',
          source: 'map',
          kind: 'state',
          sourceId: STATE_STORAGE_KEY,
          status: 'saved',
          payloadMeta: {
            stateBytes: s.length,
            tab: state.tab,
            role: state.role,
            selectedCellId: state.selectedCellId || null
          }
        }).catch(function () {});
      }
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
    if (params.areas) setAreaSources(String(params.areas).split(','));
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
    var activeAreaSources = normalizeAreaSources(state.areaSources);
    var allAreaSources = document.getElementById('me-area-source-all');
    if (allAreaSources) {
      allAreaSources.checked = activeAreaSources.length === 0;
      var allLabel = allAreaSources.closest ? allAreaSources.closest('.me-area-source-opt') : allAreaSources.parentElement;
      if (allLabel) allLabel.classList.toggle('is-active', activeAreaSources.length === 0);
    }
    document.querySelectorAll('.me-area-source-toggle').forEach(function (input) {
      var values = normalizeAreaSources([input.getAttribute('data-area-source') || '']);
      var checked = values.some(function (source) { return activeAreaSources.indexOf(source) >= 0; });
      input.checked = checked;
      var label = input.closest ? input.closest('.me-area-source-opt') : input.parentElement;
      if (label) label.classList.toggle('is-active', checked);
    });
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
      ensureAreaPolygons(state.map);
      loadAreaPolygons();
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
      refreshDiscoveryPreviewMarkers();
      if (state.areaPolygonsDebounce) clearTimeout(state.areaPolygonsDebounce);
      state.areaPolygonsDebounce = setTimeout(function () { loadAreaPolygons(); }, 250);
      if (state.waterwayDebounce) clearTimeout(state.waterwayDebounce);
      state.waterwayDebounce = setTimeout(function () { loadWaterwayHints(); }, 350);
    });
    // Empty-point tap → Site Brief. Skip if the click hit an observation
    // layer (those have their own handlers via map.on('click', 'layer', ...)).
    state.map.on('click', function (e) {
      var layers = [];
      ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-selected', 'obs-cell-heat', 'obs-cell-heat-selected'].forEach(function (id) {
        if (state.map.getLayer(id)) layers.push(id);
      });
      if (state.map.getLayer('frontier-fill')) layers.push('frontier-fill');
      if (state.map.getLayer('area-polygon-fill')) layers.push('area-polygon-fill');
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
  var areaSourceAllEl = document.getElementById('me-area-source-all');
  if (areaSourceAllEl) {
    areaSourceAllEl.addEventListener('change', function () {
      setAreaSources([]);
      switchToPlacesForAreaFilter();
      loadAreaPolygons();
      saveMapState();
    });
  }
  document.querySelectorAll('.me-area-source-toggle').forEach(function (input) {
    input.addEventListener('change', function () {
      var next = normalizeAreaSources(state.areaSources);
      var values = normalizeAreaSources([input.getAttribute('data-area-source') || '']);
      values.forEach(function (source) {
        var idx = next.indexOf(source);
        if (input.checked && idx < 0) next.push(source);
        if (!input.checked && idx >= 0) next.splice(idx, 1);
      });
      setAreaSources(next);
      switchToPlacesForAreaFilter();
      loadAreaPolygons();
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
  .site-header {
    background: rgba(249,255,254,.9);
  }

  .site-shell.has-global-record-launcher {
    padding-bottom: 0;
  }

  .global-record-launcher {
    display: none;
  }

  .site-header-inner {
    max-width: none;
    min-height: 58px;
    padding: 6px 14px;
    gap: 10px;
  }

  .site-header .brand {
    gap: 8px;
  }

  .site-header .brand-mark {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
    border-radius: 10px;
  }

  .site-header .brand strong {
    font-size: 14px;
  }

  .site-header .brand small {
    font-size: 11px;
  }

  .site-header .site-nav-link {
    min-height: 36px;
    padding: 7px 8px;
    font-size: 13px;
  }

  .site-header .site-search {
    min-height: 36px;
    padding: 3px 12px;
  }

  .site-header .lang-switch {
    padding: 3px;
  }

  .site-header .lang-switch-link {
    min-width: 34px;
    min-height: 34px;
    padding: 0 8px;
  }

  .site-header .btn {
    min-height: 38px;
    padding: 8px 14px;
  }

  .site-header .site-mobile-menu-toggle {
    min-height: 38px;
    width: 42px;
    padding: 0;
  }

  @media (min-width: 1161px) {
    .site-header-inner {
      width: calc(100% - 32px);
      min-height: 58px;
      margin: 0 16px;
      padding: 7px 0;
      display: grid;
      grid-template-columns: var(--ikimon-desktop-sidebar-w) minmax(280px, 640px) auto;
      gap: 18px;
      justify-content: stretch;
    }
    .site-brand-cluster {
      width: var(--ikimon-desktop-sidebar-w);
    }
    .desktop-side-nav-toggle {
      display: grid;
    }
    .site-header .brand {
      flex: none;
      max-width: none;
    }
    .site-header .brand-logo-lockup {
      min-height: 40px;
      padding: 2px 8px 2px 0;
    }
    .site-header .brand-logo-lockup .brand-mark {
      width: 32px;
      height: 32px;
      flex-basis: 32px;
    }
    .site-nav-desktop,
    .lang-switch-desktop {
      display: none;
    }
    .site-search-desktop {
      width: min(640px, 100%);
      max-width: none;
      justify-self: center;
      min-height: 38px;
      box-shadow: none;
    }
    .site-header-actions-desktop {
      justify-self: end;
    }
    .site-shell.is-immersive-surface .site-header-inner {
      grid-template-columns: 204px minmax(280px, 640px) auto;
    }
    .site-shell.is-immersive-surface .site-brand-cluster {
      width: 204px;
    }
    body.is-desktop-side-nav-collapsed .site-shell.is-immersive-surface .brand-wordmark {
      display: inline-flex;
    }
  }

  @media (max-width: 720px) {
    .site-header-inner {
      min-height: 54px;
      padding: 7px 10px;
    }

    .site-header .brand-mark {
      width: 32px;
      height: 32px;
      flex-basis: 32px;
      border-radius: 9px;
    }

    .site-header .btn,
    .site-header .site-mobile-menu-toggle {
      min-height: 36px;
      padding-block: 7px;
    }
  }

  .me-section {
    --me-header-h: 58px;
    --me-topbar-h: 48px;
    --me-side-w: 420px;
    --me-side-rail-w: 52px;
    --me-side-gap: 0px;
    --me-map-height: calc(100dvh - var(--me-header-h) - var(--me-topbar-h));
    margin-top: 0;
    position: relative;
  }
  .me-section[data-side="rail"] {
    --me-side-w: var(--me-side-rail-w);
  }
  @media (max-width: 720px) {
    .me-section {
      --me-header-h: 54px;
    }
  }
  .me-topbar {
    display: grid;
    gap: 8px;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    margin-bottom: 0;
    padding: 6px 12px;
    height: var(--me-topbar-h);
    background: rgba(255,255,255,.96);
    border-bottom: 1px solid rgba(15,23,42,.06);
    position: relative;
    z-index: 8;
  }
  .me-topbar-primary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .me-topbar-secondary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: nowrap;
  }
  .me-search-shell {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 36px;
    padding: 3px 10px 3px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,1);
    border: 1px solid rgba(15,23,42,.1);
    box-shadow: 0 1px 4px rgba(15,23,42,.05);
  }
  .me-tabs { display: inline-flex; gap: 2px; padding: 2px; border-radius: 11px; background: rgba(15,23,42,.04); }
  .me-tab { min-height: 34px; padding: 3px 12px; border-radius: 9px; border: 0; background: transparent; font-weight: 800; font-size: 12px; color: #475569; cursor: pointer; transition: background .15s ease, color .15s ease; white-space: nowrap; }
  .me-tab.is-active { background: #fff; color: #0f172a; box-shadow: 0 4px 10px rgba(15,23,42,.08); }
  .me-filter-group { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .me-filter-group-quick { display: none; }
  .me-filter-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  .me-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .me-chip { display: inline-flex; align-items: center; gap: 5px; min-height: 40px; padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; font-weight: 700; font-size: 12px; color: #334155; cursor: pointer; transition: all .15s ease; }
  .me-chip:hover { border-color: rgba(16,185,129,.35); }
  .me-chip.is-active { background: linear-gradient(135deg, rgba(16,185,129,.16), rgba(14,165,233,.14)); border-color: rgba(16,185,129,.45); color: #065f46; }
  .me-chip-icon { font-size: 13px; }
  .me-area-source-group { align-items: flex-start; }
  .me-area-source-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .me-area-source-opt {
    position: relative;
    display: inline-flex; align-items: center; gap: 6px;
    min-height: 40px; padding: 6px 11px; border-radius: 999px;
    border: 1px solid rgba(15,23,42,.08); background: #fff;
    color: #334155; cursor: pointer;
    transition: background .15s ease, border-color .15s ease, color .15s ease, box-shadow .15s ease;
  }
  .me-area-source-opt:hover { border-color: rgba(14,165,233,.32); }
  .me-area-source-opt input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .me-area-source-opt span,
  .me-area-source-opt strong { position: relative; pointer-events: none; }
  .me-area-source-opt span { font-size: 13px; }
  .me-area-source-opt strong { font-size: 12px; line-height: 1.2; font-weight: 850; }
  .me-area-source-opt.is-active {
    background: linear-gradient(135deg, rgba(245,158,11,.14), rgba(14,165,233,.13));
    border-color: rgba(245,158,11,.36);
    color: #78350f;
    box-shadow: 0 4px 12px rgba(15,23,42,.06);
  }
  .me-filter-drawer { position: relative; flex: 0 0 auto; }
  .me-filter-toggle {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    min-height: 36px; min-width: 86px; padding: 0 12px;
    border-radius: 999px; cursor: pointer; list-style: none;
    background: #fff; border: 1px solid rgba(15,23,42,.1);
    box-shadow: 0 1px 4px rgba(15,23,42,.05);
    font-size: 12.5px; font-weight: 800; color: #0f172a;
  }
  .me-filter-toggle::-webkit-details-marker { display: none; }
  .me-filter-panel {
    position: absolute; right: 0; top: calc(100% + 10px); z-index: 20;
    width: min(92vw, 640px);
    max-height: min(680px, calc(100dvh - var(--me-header-h) - var(--me-topbar-h) - 24px));
    overflow: auto;
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
    position: relative;
    display: block;
    height: var(--me-map-height);
  }
  .me-map-wrap {
    position: relative;
    width: calc(100% - var(--me-side-w));
    margin-left: var(--me-side-w);
    height: var(--me-map-height);
    border-radius: 0;
    overflow: hidden;
    background: linear-gradient(135deg,#ecfeff,#eff6ff);
    border: 0;
    box-shadow: none;
    transition: width .25s ease, margin .25s ease;
  }
  .me-map { position: relative; width: 100%; height: var(--me-map-height); min-height: 0; }
  .me-enjoy-strip {
    position: absolute;
    top: 14px;
    left: 14px;
    right: 14px;
    z-index: 6;
    width: min(580px, calc(100% - 28px));
    display: none;
    gap: 7px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255,255,255,.9);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 8px 18px rgba(15,23,42,.1);
    backdrop-filter: blur(12px);
    pointer-events: none;
    transition: left .25s ease, width .25s ease;
  }
  .me-enjoy-strip strong {
    color: #0f172a;
    font-size: 16px;
    line-height: 1.25;
    font-weight: 950;
    letter-spacing: 0;
  }
  .me-enjoy-strip > span {
    display: none;
    color: #475569;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 750;
  }
  .me-map-cues {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 0;
  }
  .me-map-cues span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 26px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(248,250,252,.92);
    border: 1px solid rgba(15,23,42,.08);
    color: #334155;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 850;
  }
  .me-map-cues i {
    display: inline-block;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
  }
  .me-cue-dot {
    border-radius: 999px;
    background: #0ea5e9;
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px rgba(14,165,233,.28);
  }
  .me-cue-rainbow {
    border-radius: 999px;
    background: conic-gradient(from 30deg, #22c55e, #0ea5e9, #a855f7, #f59e0b, #22c55e);
  }
  .me-cue-place {
    border-radius: 4px;
    background: rgba(34,197,94,.24);
    border: 1px solid rgba(22,163,74,.44);
  }
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
    top: 148px;
    left: 18px;
    width: clamp(280px, 28vw, 360px);
    max-width: calc(100% - 36px);
  }
  .me-map-panel-selection .me-map-card {
    max-height: calc(var(--me-map-height) - 180px);
    overflow-y: auto;
  }
  .me-map-panel-insight {
    left: 18px;
    bottom: 18px;
    width: min(420px, calc(100% - 36px));
    transition: left .25s ease, width .25s ease;
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
    position: absolute; left: 18px; right: auto; bottom: 18px; top: auto; z-index: 4;
    max-width: min(320px, calc(100% - 120px));
    padding: 5px 9px; border-radius: 10px;
    background: rgba(255,255,255,.86);
    border: 1px solid rgba(15,23,42,.08);
    color: #475569; font-size: 11px; font-weight: 750; letter-spacing: 0;
    box-shadow: 0 6px 14px rgba(15,23,42,.08);
    backdrop-filter: blur(8px);
  }
  .me-discovery-preview {
    width: 72px;
    min-height: 78px;
    display: grid;
    justify-items: center;
    align-content: start;
    gap: 4px;
    padding: 5px;
    border: 0;
    border-radius: 14px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 10px 24px rgba(15,23,42,.18);
    color: #0f172a;
    cursor: pointer;
    transform-origin: bottom center;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .me-discovery-preview:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(15,23,42,.22); }
  .me-discovery-preview img,
  .me-discovery-preview i {
    width: 62px;
    height: 48px;
    border-radius: 10px;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e0f2fe, #dcfce7);
    color: #0f766e;
    font-style: normal;
    font-size: 22px;
  }
  .me-discovery-preview span {
    max-width: 62px;
    min-height: 24px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: center;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 900;
    letter-spacing: 0;
  }
  .me-discovery-preview::after {
    content: "";
    width: 10px;
    height: 10px;
    margin-bottom: -10px;
    transform: rotate(45deg);
    background: rgba(255,255,255,.96);
    box-shadow: 4px 4px 8px rgba(15,23,42,.08);
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
    /* MapLibre の OpenStreetMap attribution の上、確実に被らない位置に。
       attribution は実測で ~24-28px、上に 12px 余白を取って bottom:42px。 */
    position: absolute; right: 8px; bottom: 42px; z-index: 4;
    padding: 5px 10px; border-radius: 8px;
    background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 4px 10px rgba(15,23,42,.08);
    display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700;
  }
  .me-legend-gradient { width: 96px; height: 6px; }
  .me-legend.is-hidden { display: none; }
  .me-legend-label { color: #475569; letter-spacing: .1em; text-transform: uppercase; }
  .me-legend-gradient { width: 140px; height: 10px; border-radius: 999px; display: inline-block; }
  .me-legend-range { display: inline-flex; gap: 10px; color: #64748b; font-weight: 700; }
  .me-search-area-btn {
    position: absolute;
    top: 14px;
    left: calc(50% + (var(--me-side-w) / 2));
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
  .me-bottom-grip { display: none; }
  .me-bottom-sheet--detail {
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    border-radius: 22px 22px 0 0;
    max-height: min(76%, 680px);
    transform: translateY(105%);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .me-bottom-sheet--detail[data-snap="peek"] {
    max-height: min(56%, 500px);
  }
  .me-bottom-sheet--detail[data-snap="full"] {
    max-height: calc(100% - 10px);
  }
  .me-bottom-sheet--detail .me-bottom-grip {
    position: sticky;
    top: 0;
    z-index: 2;
    display: block;
    width: 74px;
    height: 22px;
    margin: 0 auto -14px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }
  .me-bottom-sheet--detail .me-bottom-grip::before {
    content: "";
    display: block;
    width: 42px;
    height: 4px;
    margin: 9px auto 0;
    border-radius: 999px;
    background: rgba(100,116,139,.42);
  }
  .me-bottom-sheet--detail .me-bottom-grip:active { cursor: grabbing; }
  .me-bottom-sheet--detail.is-open { transform: translateY(0); }
  .me-bottom-sheet--detail .me-bottom-close {
    right: 12px;
    top: 12px;
    z-index: 4;
    background: rgba(255,255,255,.88);
    box-shadow: 0 6px 16px rgba(15,23,42,.16);
  }
  .me-bottom-detail .me-detail-hero {
    min-height: 176px;
    border-radius: 22px 22px 0 0;
  }
  .me-bottom-detail .me-detail-hero-photo img { min-height: 176px; }
  .me-bottom-detail .me-detail-hero strong { font-size: 21px; }
  .me-bottom-detail .me-detail-actions {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding-inline: 12px;
  }
  .me-bottom-detail .me-detail-action:nth-child(n+5) { display: none; }
  .me-bottom-detail .me-detail-stats { padding-inline: 12px; }
  .me-bottom-detail .me-detail-section { margin-inline: 12px; }
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
  .me-contribution-panel { display: block; }
  .me-impact-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(240,249,255,.94));
    border: 1px solid rgba(20,184,166,.18);
    box-shadow: 0 8px 20px rgba(15,23,42,.05);
  }
  .me-impact-card.is-loading { color: #64748b; font-size: 12px; font-weight: 800; line-height: 1.5; }
  .me-impact-head { display: grid; gap: 3px; }
  .me-impact-head strong { font-size: 13px; line-height: 1.3; color: #064e3b; font-weight: 900; letter-spacing: 0; }
  .me-impact-head span { font-size: 10.5px; line-height: 1.45; color: #64748b; font-weight: 700; }
  .me-impact-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
  .me-impact-mini { min-width: 0; display: grid; gap: 2px; padding: 8px 7px; border-radius: 12px; background: rgba(255,255,255,.92); border: 1px solid rgba(148,163,184,.16); }
  .me-impact-mini > span { font-size: 16px; line-height: 1; }
  .me-impact-mini strong { font-size: 15px; line-height: 1.1; color: #0f172a; font-weight: 900; }
  .me-impact-mini small { font-size: 10px; line-height: 1.35; color: #475569; font-weight: 750; }
  .me-impact-next { display: grid; gap: 2px; padding: 9px 10px; border-radius: 12px; background: rgba(15,118,110,.08); }
  .me-impact-next span { font-size: 10px; color: #0f766e; font-weight: 900; letter-spacing: 0; }
  .me-impact-next strong { font-size: 12px; line-height: 1.45; color: #0f172a; font-weight: 850; }

  .me-area-cover {
    position: relative;
    overflow: hidden;
    margin: 0 0 12px;
    border-radius: 16px;
    min-height: 150px;
    aspect-ratio: 16 / 9;
    background: #ecfdf5;
    border: 1px solid rgba(15,23,42,.08);
  }
  .me-area-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .me-area-cover figcaption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    gap: 2px;
    padding: 34px 14px 12px;
    color: #fff;
    background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.78));
  }
  .me-area-cover span { width: fit-content; max-width: 100%; padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.18); font-size: 10px; line-height: 1.3; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .me-area-cover strong { font-size: 17px; line-height: 1.3; font-weight: 900; text-shadow: 0 1px 10px rgba(15,23,42,.45); overflow-wrap: anywhere; }
  .me-area-cover small { font-size: 11px; line-height: 1.35; font-weight: 750; color: rgba(255,255,255,.9); overflow-wrap: anywhere; }
  .me-area-hero {
    min-height: 190px;
    margin-bottom: 14px;
    border-radius: 0;
  }
  .me-area-hero figcaption {
    padding: 54px 16px 16px;
  }
  .me-area-hero strong {
    font-size: 23px;
    line-height: 1.18;
    font-weight: 950;
  }
  .me-area-hero-map {
    display: grid;
    align-content: end;
    background:
      radial-gradient(circle at 28% 28%, rgba(20,184,166,.24), transparent 34%),
      radial-gradient(circle at 78% 20%, rgba(14,165,233,.18), transparent 30%),
      linear-gradient(135deg, #ecfeff, #f0fdf4 58%, #f8fafc);
  }
  .me-area-hero-map::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.68));
  }
  .me-area-hero-mark {
    position: absolute;
    top: 34px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
    display: grid;
    place-items: center;
    width: 70px;
    height: 70px;
    border-radius: 999px;
    background: rgba(255,255,255,.72);
    border: 1px solid rgba(20,184,166,.2);
    color: #0f766e;
    font-size: 36px;
    box-shadow: 0 18px 38px rgba(15,23,42,.12);
  }
  .me-area-hero-copy {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 3px;
    padding: 56px 16px 16px;
    color: #fff;
  }
  .me-area-hero-copy span { background: rgba(255,255,255,.2); }

  .me-place-story {
    display: grid;
    gap: 10px;
    padding: 12px;
    margin: 0 0 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(240,253,244,.94), rgba(239,246,255,.9));
    border: 1px solid rgba(16,185,129,.2);
  }
  .me-place-story-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .me-place-story-head span { font-size: 12px; font-weight: 900; color: #064e3b; }
  .me-place-story-head strong { min-width: 0; font-size: 10px; font-weight: 900; color: #0f766e; background: rgba(20,184,166,.12); padding: 3px 8px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .me-place-story-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .me-place-story-card { min-width: 0; display: grid; gap: 4px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.92); border: 1px solid rgba(148,163,184,.16); }
  .me-place-story-card span { font-size: 10px; line-height: 1.25; color: #64748b; font-weight: 850; }
  .me-place-story-card strong { font-size: 12px; line-height: 1.45; color: #0f172a; font-weight: 850; overflow-wrap: anywhere; }
  .me-area-gallery {
    display: grid;
    gap: 10px;
    padding: 12px;
    margin: 0 0 12px;
    border-radius: 16px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(14,165,233,.18);
    box-shadow: 0 8px 22px rgba(15,23,42,.06);
  }
  .me-area-gallery-head { display: grid; gap: 2px; }
  .me-area-gallery-head span { font-size: 12px; font-weight: 950; color: #0f172a; }
  .me-area-gallery-head strong { font-size: 11px; line-height: 1.45; color: #64748b; font-weight: 780; }
  .me-area-gallery-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .me-area-gallery-card {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px;
    border-radius: 12px;
    background: rgba(248,250,252,.92);
    border: 1px solid rgba(148,163,184,.16);
    color: #0f172a !important;
    text-decoration: none;
  }
  .me-area-gallery-card:hover { background: rgba(236,253,245,.92); border-color: rgba(20,184,166,.28); }
  .me-area-gallery-card img,
  .me-area-gallery-placeholder {
    width: 100%;
    height: 92px;
    border-radius: 10px;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e0f2fe, #ecfdf5);
    color: #0f766e;
    font-size: 22px;
  }
  .me-area-gallery-card strong {
    min-width: 0;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .me-area-gallery-card small {
    font-size: 10px;
    line-height: 1.3;
    color: #64748b;
    font-weight: 760;
    overflow-wrap: anywhere;
  }
  .me-area-gallery-season {
    width: fit-content;
    max-width: 100%;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(14,165,233,.10);
    color: #0369a1;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 900;
  }
  .me-area-gallery-season.is-current {
    background: rgba(20,184,166,.14);
    color: #0f766e;
  }
  .me-school-albums {
    display: grid;
    gap: 10px;
    padding: 12px;
    margin: 0 0 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(255,251,235,.96), rgba(240,249,255,.96));
    border: 1px solid rgba(245,158,11,.22);
  }
  .me-school-albums-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .me-school-album-card {
    display: grid;
    gap: 5px;
    min-width: 0;
    min-height: 112px;
    padding: 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(148,163,184,.16);
    color: #0f172a !important;
    text-decoration: none;
  }
  .me-school-album-card:hover { border-color: rgba(14,165,233,.32); background: #fff; }
  .me-school-album-card span { width: fit-content; max-width: 100%; padding: 2px 7px; border-radius: 999px; background: rgba(245,158,11,.14); color: #92400e; font-size: 10px; line-height: 1.2; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .me-school-album-card strong { font-size: 12px; line-height: 1.35; font-weight: 900; overflow-wrap: anywhere; }
  .me-school-album-card small { color: #64748b; font-size: 10.5px; line-height: 1.45; font-weight: 720; overflow-wrap: anywhere; }
  .me-area-access {
    display: grid;
    gap: 4px;
    padding: 11px 12px;
    margin: 0 0 12px;
    border-radius: 14px;
    background: rgba(255,251,235,.92);
    border: 1px solid rgba(245,158,11,.26);
    color: #78350f;
  }
  .me-area-access span { font-size: 11px; font-weight: 950; }
  .me-area-access p { margin: 0; font-size: 11.5px; line-height: 1.55; font-weight: 720; overflow-wrap: anywhere; }
  .me-area-access-public_access { background: rgba(236,253,245,.92); border-color: rgba(16,185,129,.24); color: #064e3b; }
  .me-area-gallery-empty-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: fit-content;
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 12px;
    background: #0f766e;
    color: #fff !important;
    text-decoration: none;
    font-size: 12px;
    font-weight: 900;
  }
  .me-area-public-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    margin: 0 0 12px;
    padding: 9px 14px;
    border-radius: 14px;
    background: rgba(15,23,42,.92);
    color: #fff !important;
    text-decoration: none;
    font-size: 12px;
    font-weight: 950;
  }
  .me-area-story-tabs {
    display: grid;
    gap: 9px;
    padding: 12px;
    margin: 0 0 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.92));
    border: 1px solid rgba(20,184,166,.18);
  }
  .me-area-story-tablist {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .me-area-story-tablist button {
    min-height: 34px;
    padding: 5px 7px;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 10px;
    background: rgba(255,255,255,.82);
    color: #475569;
    font-size: 11px;
    font-weight: 900;
    cursor: pointer;
  }
  .me-area-story-tablist button.is-active {
    background: #0f766e;
    color: #fff;
    border-color: #0f766e;
  }
  .me-area-story-panel {
    display: none;
    gap: 7px;
    flex-wrap: wrap;
  }
  .me-area-story-panel.is-active { display: flex; }
  .me-area-story-chip,
  .me-area-season-gap {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 32px;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(255,255,255,.88);
    border: 1px solid rgba(148,163,184,.18);
    color: #0f172a;
    font-size: 11px;
    font-weight: 900;
    text-decoration: none;
  }
  .me-area-story-chip b,
  .me-area-season-gap strong {
    color: #0f766e;
    font-size: 10px;
  }
  .me-area-story-note {
    flex-basis: 100%;
    margin: 0;
    color: #475569;
    font-size: 11.5px;
    line-height: 1.5;
    font-weight: 760;
  }

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
  .me-site-brief-environment { padding-left: 0 !important; list-style: none; gap: 5px !important; }
  .me-site-brief-environment li { display: grid; gap: 1px; padding: 7px 8px; border-radius: 8px; background: rgba(240,253,250,.76); border: 1px solid rgba(20,184,166,.16); }
  .me-site-brief-environment strong { color: #0f766e; font-size: 11px; line-height: 1.25; }
  .me-site-brief-environment span { color: #0f172a; font-size: 11.5px; font-weight: 800; line-height: 1.35; }
  .me-site-brief-environment em { color: #64748b; font-size: 10.5px; font-style: normal; line-height: 1.35; }
  .me-detail-panel {
    display: grid;
    gap: 14px;
    min-height: 100%;
    background: #fff;
  }
  .me-detail-hero {
    position: relative;
    min-height: 214px;
    overflow: hidden;
    background: linear-gradient(135deg, #ecfeff, #f0fdf4 52%, #f8fafc);
    border-bottom: 1px solid rgba(15,23,42,.08);
  }
  .me-detail-hero-photo img { width: 100%; height: 100%; min-height: 214px; object-fit: cover; display: block; }
  .me-detail-hero-photo figcaption,
  .me-detail-hero-map .me-detail-hero-copy {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    gap: 3px;
    padding: 58px 18px 18px;
    background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.82));
    color: #fff;
  }
  .me-detail-hero-map .me-detail-hero-copy {
    background: linear-gradient(180deg, rgba(15,23,42,0), rgba(15,23,42,.72));
  }
  .me-detail-hero span {
    width: fit-content;
    max-width: 100%;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.18);
    font-size: 10px;
    line-height: 1.3;
    font-weight: 900;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-detail-hero strong {
    font-size: 25px;
    line-height: 1.18;
    font-weight: 950;
    letter-spacing: 0;
    text-shadow: 0 1px 12px rgba(15,23,42,.5);
    overflow-wrap: anywhere;
  }
  .me-detail-hero small { font-size: 12px; line-height: 1.35; font-weight: 750; color: rgba(255,255,255,.9); overflow-wrap: anywhere; }
  .me-detail-hero-mark {
    position: absolute;
    top: 34px;
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
    border-radius: 999px;
    background: rgba(255,255,255,.78);
    border: 1px solid rgba(20,184,166,.22);
    color: #0f766e;
    font-size: 44px;
    box-shadow: 0 18px 38px rgba(15,23,42,.14);
  }
  .me-detail-actions {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    padding: 0 14px;
  }
  .me-detail-action {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 6px;
    color: #0f766e;
    text-decoration: none;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 850;
  }
  .me-detail-action-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: rgba(20,184,166,.12);
    border: 1px solid rgba(20,184,166,.18);
    color: #0f766e;
    font-size: 18px;
  }
  .me-detail-action:hover .me-detail-action-icon { background: rgba(20,184,166,.2); border-color: rgba(20,184,166,.34); }
  .me-detail-action strong { max-width: 100%; overflow-wrap: anywhere; text-align: center; }
  .me-detail-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 0 14px;
  }
  .me-detail-stats div {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 11px 12px;
    border-radius: 12px;
    background: rgba(248,250,252,.92);
    border: 1px solid rgba(148,163,184,.16);
  }
  .me-detail-stats span { font-size: 10.5px; line-height: 1.3; color: #64748b; font-weight: 850; }
  .me-detail-stats strong { font-size: 12px; line-height: 1.45; color: #0f172a; font-weight: 850; overflow-wrap: anywhere; }
  .me-detail-section {
    margin: 0 14px 14px;
  }
  .me-detail-section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
  }
  .me-detail-section-head span { font-size: 13px; line-height: 1.3; font-weight: 950; color: #0f172a; }
  .me-detail-section-head strong { font-size: 10px; line-height: 1.3; font-weight: 900; color: #0f766e; background: rgba(20,184,166,.12); padding: 3px 8px; border-radius: 999px; }
  .me-detail-panel-area {
    gap: 0;
    min-height: 100%;
    padding-bottom: 14px;
  }
  .me-detail-panel-area .me-area-sheet-header,
  .me-detail-panel-area .me-area-follow-btn,
  .me-detail-panel-area .me-area-public-page,
  .me-detail-panel-area .me-area-gallery,
  .me-detail-panel-area .me-area-story-tabs,
  .me-detail-panel-area .me-place-story,
  .me-detail-panel-area .me-area-sheet-cta,
  .me-detail-panel-area .me-area-sheet-summary,
  .me-detail-panel-area .me-area-sheet-timeline,
  .me-detail-panel-area .me-area-effort,
  .me-detail-panel-area .me-area-sensitive,
  .me-detail-panel-area .me-area-sheet-loading {
    margin-left: 14px;
    margin-right: 14px;
  }
  .me-detail-panel-area .me-area-sheet-header {
    margin-top: 14px;
  }
  .me-detail-panel-area .me-area-cover {
    border-radius: 0;
    margin: 0 0 14px;
  }
  .me-detail-panel-area .me-area-sheet-loading {
    margin-top: 14px;
    padding: 14px;
    border-radius: 14px;
    background: rgba(248,250,252,.94);
    border: 1px solid rgba(148,163,184,.16);
    color: #64748b;
    font-size: 13px;
    font-weight: 800;
  }
  .me-detail-visit {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .me-detail-visit div {
    min-width: 0;
    display: grid;
    gap: 5px;
    padding: 11px 12px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(236,253,245,.94), rgba(240,249,255,.9));
    border: 1px solid rgba(20,184,166,.18);
  }
  .me-detail-visit span { font-size: 10px; line-height: 1.3; color: #0f766e; font-weight: 900; }
  .me-detail-visit strong { font-size: 12px; line-height: 1.45; color: #0f172a; font-weight: 850; overflow-wrap: anywhere; }
  .me-detail-recent-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .me-detail-recent-item {
    min-width: 0;
    display: grid;
    gap: 5px;
    align-content: start;
    padding: 8px;
    border: 1px solid rgba(148,163,184,.16);
    border-radius: 12px;
    background: rgba(248,250,252,.92);
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-detail-recent-item:hover { background: rgba(236,253,245,.92); border-color: rgba(20,184,166,.28); }
  .me-detail-recent-item img,
  .me-detail-recent-placeholder {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: 9px;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e0f2fe, #dcfce7);
    color: #0f766e;
    font-size: 22px;
  }
  .me-detail-recent-item strong {
    font-size: 11px;
    line-height: 1.35;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .me-detail-recent-item small { font-size: 10px; color: #64748b; font-weight: 750; }
  .me-detail-walk-list {
    display: grid;
    gap: 7px;
  }
  .me-detail-walk-item {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    width: 100%;
    padding: 8px;
    border: 1px solid rgba(148,163,184,.16);
    border-radius: 12px;
    background: rgba(255,255,255,.9);
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-detail-walk-item:hover { background: rgba(240,249,255,.96); border-color: rgba(14,165,233,.26); }
  .me-detail-walk-item img,
  .me-detail-walk-item > span {
    width: 42px;
    height: 42px;
    border-radius: 10px;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e0f2fe, #ecfeff);
    color: #0369a1;
    font-size: 18px;
  }
  .me-detail-walk-item strong {
    min-width: 0;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .me-detail-walk-item small {
    justify-self: end;
    max-width: 96px;
    font-size: 10px;
    line-height: 1.25;
    color: #64748b;
    font-weight: 800;
    text-align: right;
  }
  @media (max-width: 520px) {
    .me-site-brief-loop-grid { grid-template-columns: 1fr; }
    .me-impact-grid,
    .me-place-story-grid,
    .me-detail-stats,
    .me-detail-visit { grid-template-columns: 1fr; }
    .me-area-gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .me-school-albums-grid { grid-template-columns: 1fr; }
    .me-area-gallery-card img,
    .me-area-gallery-placeholder { height: 82px; }
    .me-detail-recent-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .me-detail-walk-item { grid-template-columns: 38px minmax(0, 1fr); }
    .me-detail-walk-item small { grid-column: 2; justify-self: start; text-align: left; max-width: none; }
  }
  ${OFFICIAL_NOTICE_CARD_STYLES}

  .me-side {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--me-side-w);
    z-index: 7;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: rgba(255,255,255,.98);
    border-right: 1px solid rgba(15,23,42,.08);
    box-shadow: 2px 0 18px rgba(15,23,42,.06);
    transition: width .25s ease;
    overflow: hidden;
  }
  .me-side-toggle {
    position: absolute;
    top: 50%;
    right: -16px;
    transform: translateY(-50%);
    width: 16px;
    height: 56px;
    border-radius: 0 8px 8px 0;
    border: 1px solid rgba(15,23,42,.08);
    border-left: 0;
    background: rgba(255,255,255,.98);
    color: #475569;
    cursor: pointer;
    box-shadow: 2px 0 6px rgba(15,23,42,.05);
    display: grid;
    place-items: center;
    font-size: 14px;
    font-weight: 800;
    z-index: 8;
    line-height: 1;
    padding: 0;
  }
  .me-side-toggle:hover { color: #0f172a; background: #fff; }
  .me-side-toggle-icon { display: inline-block; transition: transform .25s ease; }
  .me-section[data-side="rail"] .me-side-toggle-icon { transform: rotate(180deg); }

  .me-side-tabs {
    display: flex;
    gap: 0;
    padding: 8px 12px 0;
    border-bottom: 1px solid rgba(15,23,42,.06);
    flex: 0 0 auto;
  }
  .me-side-tab {
    flex: 1 1 auto;
    min-height: 38px;
    padding: 6px 10px;
    border: 0;
    background: transparent;
    font-size: 12.5px;
    font-weight: 800;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color .15s ease, border-color .15s ease;
  }
  .me-side-tab.is-active { color: #0f172a; border-bottom-color: #0ea5e9; }
  .me-side-tab[disabled] { opacity: .38; cursor: not-allowed; }

  .me-side-body {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }
  .me-side-pane {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 14px 18px;
    overflow-y: auto;
  }
  .me-side[data-tab="results"] .me-side-pane-selection,
  .me-side[data-tab="selection"] .me-side-pane-results { display: none; }
  .me-side[data-tab="results"] .me-contribution-panel { display: none; }

  .me-section[data-side="rail"] .me-side-tabs,
  .me-section[data-side="rail"] .me-side-pane,
  .me-section[data-side="rail"] .me-side-head { display: none; }
  .me-section[data-side="rail"] .me-side-rail-icons { display: flex; }
  .me-side-rail-icons {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 18px 0;
    color: #475569;
  }
  .me-side-rail-icons span { font-size: 20px; line-height: 1; }
  .me-side-rail-count {
    display: inline-grid;
    place-items: center;
    min-width: 30px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(14,165,233,.14);
    color: #075985;
    font-size: 11px;
    font-weight: 900;
  }

  .me-side-head { padding: 0 2px; flex: 0 0 auto; }
  .me-side-title { margin: 0; font-size: 17px; line-height: 1.2; font-weight: 900; color: #0f172a; letter-spacing: -.01em; }
  .me-side-subtitle { margin-top: 4px; font-size: 11.5px; color: #64748b; font-weight: 700; }

  .me-side-pane-selection { gap: 0; padding: 0; }
  .me-side-pane-selection .me-map-panel-selection {
    position: static;
    width: 100%;
    max-width: none;
    opacity: 1;
    transform: none;
    pointer-events: auto;
  }
  .me-side-pane-selection .me-map-panel-selection .me-map-card {
    max-height: none;
    overflow: visible;
    box-shadow: none;
    border: 1px solid rgba(15,23,42,.06);
    background: #fff;
    backdrop-filter: none;
    padding: 14px;
  }
  .me-side-pane-selection-empty {
    padding: 20px 14px;
    border-radius: 14px;
    background: rgba(248,250,252,.8);
    border: 1px dashed rgba(15,23,42,.1);
    font-size: 12.5px;
    color: #64748b;
    line-height: 1.55;
    text-align: center;
  }

  .me-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
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
    .me-section { --me-side-w: 360px; }
    .me-map-panel-selection { width: clamp(260px, 30vw, 320px); }
  }

  @media (max-width: 900px) {
    .me-section {
      --me-side-w: 0px;
      --me-topbar-h: 94px;
    }
    .me-topbar {
      grid-template-columns: 1fr auto;
      grid-template-rows: 40px 38px;
      gap: 8px;
      padding: 5px 10px;
    }
    .me-topbar-primary { display: contents; }
    .me-search-shell { grid-column: 1; grid-row: 1; }
    .me-topbar-secondary { grid-column: 2; grid-row: 1; }
    .me-tabs {
      grid-column: 1 / -1;
      grid-row: 2;
      display: flex;
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .me-tabs::-webkit-scrollbar { display: none; }
    .me-tab { flex: 1 0 auto; min-height: 34px; padding: 4px 12px; font-size: 12px; }
    .me-filter-drawer { flex: 0 0 auto; }
    .me-filter-panel {
      position: fixed;
      top: calc(var(--me-header-h) + var(--me-topbar-h) + 8px);
      right: 8px;
      left: 8px;
      width: auto;
      max-width: none;
      max-height: min(680px, calc(100dvh - var(--me-header-h) - var(--me-topbar-h) - 18px));
      box-shadow: 0 10px 24px rgba(15,23,42,.16);
    }
    .me-main { display: block; }
    .me-map-wrap { position: relative; width: 100%; margin-left: 0; }
    .me-map { min-height: var(--me-map-height); height: var(--me-map-height); }
    .me-side { display: none; }
    .me-side-toggle { display: none; }
    .me-map-panel-selection { display: none; }
    .me-map-panel-insight {
      left: 12px;
      width: min(360px, calc(100% - 96px));
    }
    .me-enjoy-strip {
      top: 10px;
      left: 10px;
      right: 10px;
      width: auto;
      padding: 10px 12px;
      border-radius: 16px;
    }
    .me-enjoy-strip strong {
      font-size: 13px;
      line-height: 1.25;
    }
    .me-enjoy-strip > span {
      display: none;
    }
    .me-search-area-btn {
      top: 14px;
      left: 50%;
      width: max-content;
      max-width: calc(100% - 28px);
    }
    .me-map-status {
      left: 10px;
      right: auto;
      bottom: 54px;
      top: auto;
      max-width: calc(100% - 96px);
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
    .me-bottom-sheet--detail {
      max-height: 74%;
    }
    .me-bottom-sheet--detail[data-snap="peek"] {
      max-height: 56%;
    }
    .me-bottom-sheet--detail[data-snap="full"] {
      max-height: calc(100% - 8px);
    }
  }

  /* Area sidesheet (Phase 1: parks, OECM, symbiosis, TSUNAG, etc.) */
  .me-area-sheet-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  .me-area-sheet-title { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .me-area-sheet-source { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #0f766e; background: rgba(20,184,166,.12); padding: 2px 8px; border-radius: 999px; align-self: flex-start; }
  .me-area-sheet-title strong { font-size: 17px; font-weight: 800; color: #0f172a; }
  .me-area-sheet-loc { font-size: 11px; color: #64748b; font-weight: 600; }
  .me-area-sheet-url { font-size: 11px; font-weight: 700; color: #0f766e; text-decoration: none; align-self: center; padding: 6px 10px; border-radius: 8px; background: rgba(20,184,166,.08); white-space: nowrap; }
  .me-area-sheet-url:hover { background: rgba(20,184,166,.18); }
  .me-area-sheet-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .me-area-sheet-summary > div { padding: 8px 10px; border-radius: 12px; background: rgba(248,250,252,.94); border: 1px solid rgba(148,163,184,.16); display: flex; flex-direction: column; gap: 2px; }
  .me-area-sheet-summary span { font-size: 10px; color: #64748b; font-weight: 600; }
  .me-area-sheet-summary strong { font-size: 16px; font-weight: 800; color: #0f172a; }
  .me-area-sheet-timeline { padding: 10px 12px; border-radius: 14px; background: rgba(248,250,252,.94); border: 1px solid rgba(148,163,184,.16); margin-bottom: 12px; }
  .me-area-sheet-timeline.is-empty { font-size: 12px; color: #64748b; font-weight: 600; }
  .me-area-tl-title { font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; }
  .me-area-tl-row { display: flex; gap: 8px; align-items: flex-end; min-height: 60px; }
  .me-area-tl-bar { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; min-width: 0; }
  .me-area-tl-bar-fill { display: block; width: 100%; max-width: 28px; min-height: 2px; background: linear-gradient(180deg, #0ea5e9, #0f766e); border-radius: 4px 4px 0 0; }
  .me-area-tl-bar-label { font-size: 10px; color: #64748b; font-weight: 700; }
  .me-area-effort { padding: 10px 12px; border-radius: 14px; background: rgba(248,250,252,.94); border: 1px solid rgba(148,163,184,.16); margin-bottom: 12px; }
  .me-area-effort-title { font-size: 11px; font-weight: 800; color: #0f172a; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
  .me-area-effort-index { font-size: 10px; font-weight: 700; color: #0f766e; background: rgba(20,184,166,.12); padding: 2px 8px; border-radius: 999px; }
  .me-area-effort-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .me-area-effort-card { padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid rgba(148,163,184,.18); display: flex; flex-direction: column; gap: 4px; }
  .me-area-effort-label { font-size: 10px; font-weight: 700; color: #475569; }
  .me-area-effort-value { font-size: 16px; font-weight: 800; color: #0f172a; }
  .me-area-effort-bar { height: 4px; border-radius: 999px; background: rgba(148,163,184,.18); overflow: hidden; }
  .me-area-effort-bar > span { display: block; height: 100%; background: linear-gradient(90deg, #0ea5e9, #0f766e); }
  .me-area-effort-hint { font-size: 10px; color: #64748b; line-height: 1.3; }
  .me-area-sensitive { padding: 10px 12px; border-radius: 12px; background: rgba(254,243,199,.55); border: 1px solid rgba(217,119,6,.28); color: #78350f; font-size: 12px; font-weight: 600; line-height: 1.45; margin-bottom: 12px; }
  .me-area-sensitive.is-privileged { background: rgba(220,252,231,.55); border-color: rgba(22,163,74,.28); color: #14532d; }
  .me-area-follow-btn { width: 100%; min-height: 52px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin: 2px 0 12px; border-radius: 14px; border: 1px solid rgba(15,118,110,.22); background: #f0fdfa; color: #0f172a; cursor: pointer; text-align: left; box-shadow: 0 6px 16px rgba(15,23,42,.06); transition: background .15s ease, border-color .15s ease, transform .15s ease; }
  .me-area-follow-btn:hover { transform: translateY(-1px); background: #ecfdf5; border-color: rgba(5,150,105,.34); }
  .me-area-follow-btn[disabled] { cursor: wait; opacity: .86; transform: none; }
  .me-area-follow-btn.is-followed { background: #dcfce7; border-color: rgba(22,163,74,.30); cursor: default; }
  .me-area-follow-btn > span { width: 30px; height: 30px; flex: 0 0 30px; display: inline-grid; place-items: center; border-radius: 999px; background: #0f766e; color: #fff; font-size: 16px; font-weight: 900; }
  .me-area-follow-btn strong { display: block; font-size: 13px; line-height: 1.2; font-weight: 900; }
  .me-area-follow-btn small { display: block; margin-top: 1px; color: #64748b; font-size: 11px; line-height: 1.3; font-weight: 750; }
  .me-area-sheet-cta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 4px 0 14px; }
  .me-area-sheet-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 18px; border-radius: 14px; font-size: 14px; font-weight: 800; color: #fff !important; background: linear-gradient(135deg, #0ea5e9, #0f766e); text-decoration: none; box-shadow: 0 6px 16px rgba(15,118,110,.28); width: max-content; max-width: 100%; }
  .me-area-sheet-cta-btn:hover { filter: brightness(1.05); }
  .me-area-sheet-cta-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 999px; background: rgba(255,255,255,.22); font-size: 14px; font-weight: 800; }
  .me-area-sheet-cta-hint { flex-basis: 100%; font-size: 11px; color: #475569; line-height: 1.45; padding-left: 4px; }
  .me-area-effort-title { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; justify-content: space-between; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
  .me-area-effort-title > span:first-child { font-size: 13px; }
  .me-area-effort-explainer { margin: 0 0 10px; font-size: 11px; color: #475569; line-height: 1.5; padding: 8px 10px; border-radius: 10px; background: rgba(241,245,249,.7); border: 1px solid rgba(148,163,184,.18); }

  /* Area mode: PC では「この場所」タブの右隣に縦長サイドカードとして出す。
     左パネル (一覧/この場所) と被らないよう --me-side-w 分ずらす。
     フッター削除でナビ下〜画面下端まで使えるので、スクロールなしでヘッダ・CTA・
     サマリ・タイムライン・努力量カードまで一望できる。 */
  .me-bottom-sheet.me-bottom-sheet--area {
    width: 460px;
    max-width: calc(100vw - var(--me-side-w) - 32px);
    left: calc(var(--me-side-w) + 16px);
    right: auto;
    top: 88px;
    bottom: 16px;
    max-height: none;
    border-radius: 18px;
    box-shadow: 0 12px 36px rgba(15,23,42,.18);
  }

  /* 任意点シートの「観察会を開く / マイフィールド登録」シームレス CTA */
  .me-place-cta-row { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 12px; }
  .me-place-cta { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; text-decoration: none; transition: filter .15s; }
  .me-place-cta:hover { filter: brightness(1.04); }
  .me-place-cta-primary { background: linear-gradient(135deg, #0ea5e9, #0f766e); color: #fff !important; box-shadow: 0 6px 16px rgba(15,118,110,.28); }
  .me-place-cta-secondary { background: rgba(248,250,252,.94); border: 1px solid rgba(148,163,184,.28); color: #0f172a !important; }
  .me-place-cta-icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,.22); font-size: 18px; font-weight: 800; flex-shrink: 0; }
  .me-place-cta-secondary .me-place-cta-icon { background: rgba(15,118,110,.12); color: #0f766e; }
  .me-place-cta-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .me-place-cta-body strong { font-size: 14px; font-weight: 800; line-height: 1.2; }
  .me-place-cta-body span { font-size: 11px; line-height: 1.3; opacity: .85; }

  @media (max-width: 768px) {
    .me-bottom-sheet.me-bottom-sheet--area {
      width: auto;
      max-width: none;
      left: 0;
      right: 0;
      top: auto;
      bottom: 0;
      max-height: 86%;
      border-radius: 22px 22px 0 0;
    }
    .me-bottom-sheet.me-bottom-sheet--area[data-snap="peek"] {
      max-height: 64%;
    }
    .me-bottom-sheet.me-bottom-sheet--area[data-snap="full"] {
      max-height: calc(100% - 8px);
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-hero {
      min-height: 154px;
      aspect-ratio: auto;
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-hero strong {
      font-size: 20px;
      line-height: 1.22;
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-sheet-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-sheet-cta-btn,
    .me-bottom-sheet.me-bottom-sheet--area .me-area-sheet-url {
      flex: 1 1 100%;
      width: 100%;
      justify-content: center;
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-story-tablist {
      gap: 4px;
    }
    .me-bottom-sheet.me-bottom-sheet--area .me-area-story-tablist button {
      padding: 5px 4px;
      font-size: 10px;
      line-height: 1.2;
    }
  }
`;
