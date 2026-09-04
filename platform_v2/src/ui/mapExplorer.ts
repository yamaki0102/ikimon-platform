import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import { overlaysForLang, type LocalizedOverlay } from "../services/layerCatalog.js";
import {
  buildOfficialNoticeClientRenderer,
  getOfficialNoticeRenderCopy,
  OFFICIAL_NOTICE_CARD_STYLES,
} from "./officialNoticeCard.js";
import {
  MAP_PLACE_ATLAS_PROFILE_RUNTIME,
  MAP_PLACE_ATLAS_PROFILE_STYLES,
} from "./mapPlaceAtlasProfile.js";
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
  activityRallyTitle: string;
  activityRallyBody: string;
  activityRallyMeta: string;
  activityRallyLinkLabel: string;
  enjoyTitle: string;
  enjoyLead: string;
  tabMarkers: string;
  tabHeatmap: string;
  tabPlaces: string;
  tabRain: string;
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
  areaTrustLegendLow: string;
  areaTrustLegendHigh: string;
  areaLegendConfirmedLabel: string;
  areaLegendConfirmedHint: string;
  areaLegendPendingLabel: string;
  areaLegendPendingHint: string;
  areaLegendParkLabel: string;
  areaLegendParkHint: string;
  areaLegendSchoolLabel: string;
  areaLegendSchoolHint: string;
  areaLegendWaterLabel: string;
  areaLegendWaterHint: string;
  layerHintPlaces: string;
  layerHintFrontier: string;
  layerHintHeatmap: string;
  layerHintJump: string;
  layerHintDismiss: string;
  purposeHintTitle: string;
  purposeHintBody: string;
  purposeHintDismiss: string;
  loading: string;
  recordsLoading: string;
  statsLabel: (returned: number, total: number) => string;
  empty: string;
  emptyTitle: string;
  emptyLead: string;
  emptyActionAreas: string;
  emptyActionWiden: string;
  emptyActionRecord: string;
  personalPulseTitle: string;
  personalPulseBody: string;
  personalPulseProfile: string;
  personalPulseRecords: string;
  personalMemoryTitle: string;
  personalMemoryBody: string;
  personalMemoryRecords: string;
  personalMemoryOpen: string;
  personalMemoryFallbackLabel: string;
  sideRecentLabel: string;
  recentFindsHint: string;
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
  bottomSheetCloseLabel: string;
  bottomSheetExpandLabel: string;
  bottomSheetCollapseLabel: string;
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
  unknownHypothesisLabel: string;
  recordingGapLabel: string;
  selectedPointName: string;
  areaRestrictedActionLabel: string;
  areaRestrictedActionHint: string;
  areaSafeRecordLabel: string;
  areaGalleryEmptyPublicLead: string;
  areaGalleryEmptyPublicSafety: string;
  areaGalleryEmptyPublicWiden: string;
  areaGalleryEmptyRestrictedLead: string;
  areaGalleryEmptyRestrictedCheck: string;
  areaGalleryEmptyRestrictedWiden: string;
  areaGalleryEmptySchoolLead: string;
  areaGalleryEmptySchoolWiden: string;
  areaNextStepEyebrow: string;
  areaNextStepRecordTitle: string;
  areaNextStepRestrictedTitle: string;
  areaNextStepScopeLine: string;
  areaNextStepRecordLine: string;
  areaNextStepFirstRecordLine: string;
  areaNextStepBrowseLine: string;
  areaNextStepGuideLine: string;
  areaNextStepRestrictedLine: string;
  areaNextStepRecordCta: string;
  areaSchoolNotice: string;
  cellAggregateTitle: string;
  cellAggregateBadge: string;
  cellAggregateSafety: string;
  gbifAreaTitle: string;
  gbifAreaBadge: string;
  gbifAreaLoading: string;
  gbifAreaEmpty: string;
  gbifAreaSafety: string;
  gbifAreaLatestYearLabel: string;
  gbifAreaRecordCountLabel: string;
  gbifAreaTopTaxaLabel: string;
  gbifAreaSourceLabel: string;
  gbifAreaSourceLink: string;
  mapPointSafety: string;
  osmAreaFallbackName: string;
  osmAreaSourceLabel: string;
  areaLoading: string;
  unregisteredAreaText: string;
  mapLoadErrorTitle: string;
  mapLoadErrorBody: string;
  mapLoadRetryLabel: string;
  mapLoadRecordsLabel: string;
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

function renderMapLayerTab(tab: string, label: string, mobileLabel: string, active = false): string {
  return `<button type="button" class="me-tab${active ? " is-active" : ""}" role="tab" aria-selected="${active ? "true" : "false"}" aria-label="${escapeHtml(label)}" data-tab="${escapeHtml(tab)}"><span class="me-tab-full">${escapeHtml(label)}</span><span class="me-tab-short" aria-hidden="true">${escapeHtml(mobileLabel)}</span></button>`;
}

export const MAP_EXPLORER_COPY: Record<SiteLang, MapExplorerCopy> = {
  ja: {
    activityRallyTitle: "このエリアの活動・ラリー",
    activityRallyBody: "観察会や投稿ラリーなど、外で見つけた記録を地域に残す入口です。掲載や開催相談は主催者向け案内から受け付けます。",
    activityRallyMeta: "イベント / 投稿ラリー",
    activityRallyLinkLabel: "主催者の方へ",
    enjoyTitle: "近くを探索する",
    enjoyLead: "記録・ガイド・散策候補を見ながら、今いる場所から探索できます。",
    tabMarkers: "近くの記録",
    tabHeatmap: "季節",
    tabPlaces: "現地ガイド",
    tabRain: "雨雲",
    tabCoverage: "記録の空白",
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
    coverageLegendHigh: "記録多め",
    heatmapLegendLow: "少ない",
    heatmapLegendHigh: "多い",
    areaTrustLegendLow: "公式確認待ち・立入不明",
    areaTrustLegendHigh: "確認済み範囲",
    areaLegendConfirmedLabel: "確認済み",
    areaLegendConfirmedHint: "公開範囲を確認して記録",
    areaLegendPendingLabel: "確認待ち",
    areaLegendPendingHint: "許可や案内がなければ入らない",
    areaLegendParkLabel: "公園・緑地",
    areaLegendParkHint: "入れる範囲で観察",
    areaLegendSchoolLabel: "学校・教育施設",
    areaLegendSchoolHint: "敷地外から観察・立入らない",
    areaLegendWaterLabel: "水辺・水路",
    areaLegendWaterHint: "危険な水辺に近づかず足元確認",
    layerHintPlaces: "ズームするとエリア図鑑の範囲が見えます。",
    layerHintFrontier: "ズームするとまだ少ない場所が面で見えます。",
    layerHintHeatmap: "ズームすると季節の気配の濃淡が見えます。",
    layerHintJump: "見える場所へ",
    layerHintDismiss: "閉じる",
    purposeHintTitle: "記録・ガイド・散策",
    purposeHintBody: "",
    purposeHintDismiss: "この案内を閉じる",
    loading: "読み込み中…",
    recordsLoading: "記録を読み込み中…",
    statsLabel: (returned, total) => `${returned.toLocaleString("ja-JP")} / ${total.toLocaleString("ja-JP")} 件`,
    empty: "記録が少ない場所でも、近くの記録や季節を変えると手がかりが見つかります。",
    emptyTitle: "近くを探索中",
    emptyLead: "少し広げると近くの記録や場所が出ます。今いる場所で見えたものも残せます。",
    emptyActionAreas: "エリア",
    emptyActionWiden: "広げる",
    emptyActionRecord: "記録",
    personalPulseTitle: "自分の記録へすぐ戻る",
    personalPulseBody: "投稿したあとは、マイページや自分の記録一覧から開けます。地図には最近の記録も重なります。",
    personalPulseProfile: "マイページ",
    personalPulseRecords: "自分の記録",
    personalMemoryTitle: "濃く撮った場所",
    personalMemoryBody: "公園や旅先でまとまって残した写真を、あとで戻れる場所にします。",
    personalMemoryRecords: "件",
    personalMemoryOpen: "開く",
    personalMemoryFallbackLabel: "よく撮った場所",
    sideRecentLabel: "この範囲の記録",
    recentFindsHint: "記録",
    sideRevisitLabel: "選んだ場所",
    crossEyebrow: "この場所で、次の自然体験を残す",
    crossLensLabel: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    crossScanLabel: JA_PUBLIC_SHARED_COPY.cta.openScan,
    crossNotesLabel: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    popupOpenLabel: "詳細を開く →",
    bottomSheetRecord: JA_PUBLIC_SHARED_COPY.cta.record,
    bottomSheetNotes: JA_PUBLIC_SHARED_COPY.cta.openNotebook,
    bottomSheetLens: JA_PUBLIC_SHARED_COPY.cta.openGuide,
    bottomSheetScan: JA_PUBLIC_SHARED_COPY.cta.openScan,
    bottomSheetCloseLabel: "閉じる",
    bottomSheetExpandLabel: "詳細を広げる",
    bottomSheetCollapseLabel: "詳細を半分に戻す",
    siteBriefHeading: "地図だけではわからないこと",
    siteBriefReasonsLabel: "記録",
    siteBriefChecksLabel: "現地で安全に確かめること",
    siteBriefCapturesLabel: "撮るなら",
    siteBriefEnvironmentLabel: "衛星・地図の手がかり",
    siteBriefWhyHereLabel: "記録",
    siteBriefWhyNowLabel: "季節",
    siteBriefOneVisitLabel: "今日できること",
    siteBriefNextHookLabel: "次の手がかり",
    siteBriefLoading: "この地点を読み解き中…",
    siteBriefError: "地図だけでは読み解けません。立入可否と現地の安全を優先してください。",
    searchPlaceholder: "場所や生きものを探す（例: 静岡市 谷津山、モンシロチョウ）",
    searchAriaLabel: "場所または種を検索",
    searchNoResult: "見つからなかった。もう一語ゆるめてみる。",
    searchError: "検索に失敗した。しばらく待ってから試す。",
    searchResultSpecies: "種",
    searchResultPlace: "場所",
    unknownHypothesisLabel: "地図の手がかり",
    recordingGapLabel: "まだ少ない場所",
    selectedPointName: "地図の手がかり",
    areaRestrictedActionLabel: "地域のルールを確認",
    areaRestrictedActionHint: "学校・立入制限・未確認の場所では、許可された観察だけを扱います。",
    areaSafeRecordLabel: "公開範囲を確認して記録",
    areaGalleryEmptyPublicLead: "まだ記録がありません。現地の表示と公開範囲を確認できる場所なら、最初の手がかりを残せます。",
    areaGalleryEmptyPublicSafety: "案内板・保護区域・管理者のルールを優先して、公開範囲で見えたものだけを記録する。",
    areaGalleryEmptyPublicWiden: "表示範囲や季節を広げて近くの記録を探す。",
    areaGalleryEmptyRestrictedLead: "安全とプライバシーのため、このエリアでは直接の記録導線を出していません。",
    areaGalleryEmptyRestrictedCheck: "看板、管理者、公開範囲、立入制限を先に確認する。",
    areaGalleryEmptyRestrictedWiden: "表示範囲や季節を広げて、近くの安全な公開場所を探す。",
    areaGalleryEmptySchoolLead: "学校・教育施設の敷地内や周辺では撮影や探索を促しません。近くの公共の公園や公開された自然エリアで観察してください。",
    areaGalleryEmptySchoolWiden: "この範囲にこだわらず、近くの公開エリアへ移動して安全に記録する。",
    areaNextStepEyebrow: "次にできること",
    areaNextStepRecordTitle: "安全に、この場所の記録を残す",
    areaNextStepRestrictedTitle: "まず安全と許可を確認",
    areaNextStepScopeLine: "現地の案内板・公開範囲・管理者のルールを優先する。",
    areaNextStepRecordLine: "公開範囲で見つけたものだけを記録し、正確な立入場所を無理に残さない。",
    areaNextStepFirstRecordLine: "まだ記録が少ない場所です。公開範囲で見つけたものが最初の手がかりになります。",
    areaNextStepBrowseLine: "先に公開記録や季節の記録を見て、場所の状態をつかむ。",
    areaNextStepGuideLine: "現地ガイドがある場所は、近づいてから音声や説明を開く。",
    areaNextStepRestrictedLine: "学校・私有地・未確認区域では、敷地内へ入らず、許可された観察だけを扱う。",
    areaNextStepRecordCta: "安全に記録する",
    areaSchoolNotice: "学校・キャンパスは関係者区域を含みます。無許可で敷地内に入らず、公開範囲と学校・管理者の許可がある観察だけを扱います。",
    cellAggregateTitle: "この範囲の記録",
    cellAggregateBadge: "地域単位の集計",
    cellAggregateSafety: "地域全体のまとまりとして表示しています。記録を足すときは、公開範囲と現地のルールを確認してください。",
    gbifAreaTitle: "この周辺で記録されたイキモノ",
    gbifAreaBadge: "GBIF公開記録",
    gbifAreaLoading: "GBIFの公開記録サマリを確認中…",
    gbifAreaEmpty: "この範囲のGBIF公開記録サマリはまだありません。",
    gbifAreaSafety: "GBIFの公開データを地域単位で集計しています。現在の生息や個体数を保証するものではありません。希少種の正確な地点や第三者写真は表示しません。",
    gbifAreaLatestYearLabel: "最新記録年",
    gbifAreaRecordCountLabel: "公開記録数",
    gbifAreaTopTaxaLabel: "記録が多い分類",
    gbifAreaSourceLabel: "出典",
    gbifAreaSourceLink: "GBIFで確認",
    mapPointSafety: "地図だけでは現地の安全や立入可否は判断できません。案内板、管理者、公開範囲を優先してください。",
    osmAreaFallbackName: "OSMの公園・緑地",
    osmAreaSourceLabel: "公園・緑地 (OSM live)",
    areaLoading: "エリア情報を読み込み中…",
    unregisteredAreaText: "このエリアはまだ登録されていません。まずは地図上の手がかりとして扱います。",
    mapLoadErrorTitle: "地図を表示できませんでした",
    mapLoadErrorBody: "公開記録の一覧から探すこともできます。",
    mapLoadRetryLabel: "再読み込み",
    mapLoadRecordsLabel: "公開記録を見る",
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
    activityRallyTitle: "Activities and rallies in this area",
    activityRallyBody: "Observation events, posting rallies, and outdoor local activities can be tied to the regional guide here. Organizer inquiries start from this guide.",
    activityRallyMeta: "Events / posting rallies",
    activityRallyLinkLabel: "For organizers",
    enjoyTitle: "Look nearby and look back",
    enjoyLead: "This map is a tool for reviewing local records by place. It helps you see nearby records, places you visited before, and where the guide is thick or still thin.",
    tabMarkers: "Photos",
    tabHeatmap: "Season",
    tabPlaces: "Guides",
    tabRain: "Rain",
    tabCoverage: "Open areas",
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
    areaTrustLegendLow: "Source/access pending",
    areaTrustLegendHigh: "Verified area",
    areaLegendConfirmedLabel: "Verified",
    areaLegendConfirmedHint: "Record within public scope",
    areaLegendPendingLabel: "Pending",
    areaLegendPendingHint: "No entry without signs or permission",
    areaLegendParkLabel: "Parks / green",
    areaLegendParkHint: "Observe in open areas",
    areaLegendSchoolLabel: "Schools",
    areaLegendSchoolHint: "Observe from outside; do not enter",
    areaLegendWaterLabel: "Waterways",
    areaLegendWaterHint: "Keep distance and watch footing",
    layerHintPlaces: "Zoom in to see area encyclopedia boundaries.",
    layerHintFrontier: "Zoom in to see recording gaps as areas.",
    layerHintHeatmap: "Zoom in to see seasonal intensity.",
    layerHintJump: "Show visible layer",
    layerHintDismiss: "Close",
    purposeHintTitle: "Find a scene to keep",
    purposeHintBody: "Pick a place to see recent finds and why it may be worth visiting.",
    purposeHintDismiss: "Close this hint",
    loading: "Loading…",
    recordsLoading: "Loading records…",
    statsLabel: (returned, total) => `${returned.toLocaleString("en-US")} / ${total.toLocaleString("en-US")}`,
    empty: "Try nearby photos, guides, or another season.",
    emptyTitle: "Checking nearby",
    emptyLead: "Nearby public areas or another season may show photos and places.",
    emptyActionAreas: "Areas",
    emptyActionWiden: "Widen",
    emptyActionRecord: "Record a find",
    personalPulseTitle: "Return to your records",
    personalPulseBody: "After posting, My page and your record list are one tap away. Recent public finds keep adding life to the map.",
    personalPulseProfile: "My page",
    personalPulseRecords: "My records",
    personalMemoryTitle: "Places you photographed often",
    personalMemoryBody: "Parks and trip areas with many saved photos become quick return points.",
    personalMemoryRecords: " records",
    personalMemoryOpen: "Open",
    personalMemoryFallbackLabel: "Frequent photo area",
    sideRecentLabel: "Nearby finds",
    recentFindsHint: "Seen here",
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
    bottomSheetCloseLabel: "Close",
    bottomSheetExpandLabel: "Expand details",
    bottomSheetCollapseLabel: "Return details to half height",
    siteBriefHeading: "What you may find here",
    siteBriefReasonsLabel: "Records",
    siteBriefChecksLabel: "Check on the ground",
    siteBriefCapturesLabel: "If you shoot",
    siteBriefEnvironmentLabel: "Satellite/map clues",
    siteBriefWhyHereLabel: "records",
    siteBriefWhyNowLabel: "season",
    siteBriefOneVisitLabel: "what to do",
    siteBriefNextHookLabel: "next clue",
    siteBriefLoading: "Reading this place…",
    siteBriefError: "Could not read this place. Trust your field sense.",
    searchPlaceholder: "Find a place or species (e.g. Shizuoka, swallowtail)",
    searchAriaLabel: "Search place or species",
    searchNoResult: "No match. Try a looser term.",
    searchError: "Search failed. Wait a moment and retry.",
    searchResultSpecies: "Species",
    searchResultPlace: "Place",
    unknownHypothesisLabel: "A place the map alone cannot explain",
    recordingGapLabel: "Open recording gap",
    selectedPointName: "Map-selected point",
    areaRestrictedActionLabel: "Check local rules",
    areaRestrictedActionHint: "For schools, restricted, or unverified places, only permitted observations are handled.",
    areaSafeRecordLabel: "Record after checking scope",
    areaGalleryEmptyPublicLead: "No records yet. If the public scope and on-site rules are clear, a photo can show this place.",
    areaGalleryEmptyPublicSafety: "Follow signs, protected areas, and manager rules; record only what you see from public scope.",
    areaGalleryEmptyPublicWiden: "If this spot feels thin, widen the visible area or season to find nearby records.",
    areaGalleryEmptyRestrictedLead: "For safety and privacy, direct recording is not offered for this area.",
    areaGalleryEmptyRestrictedCheck: "Check signs, managers, public scope, and entry restrictions first.",
    areaGalleryEmptyRestrictedWiden: "Widen the area or season and choose a safer nearby public place.",
    areaGalleryEmptySchoolLead: "Near schools or educational facilities, do not photograph or search around the site. Move to a nearby public park or open nature area instead.",
    areaGalleryEmptySchoolWiden: "Do not focus on this boundary; move to a nearby public area and record safely there.",
    areaNextStepEyebrow: "Next step",
    areaNextStepRecordTitle: "Grow this area guide safely",
    areaNextStepRestrictedTitle: "Check safety and permission first",
    areaNextStepScopeLine: "Follow signs, public scope, and manager rules before acting.",
    areaNextStepRecordLine: "Record only what you find from public scope; do not force an exact entry point.",
    areaNextStepFirstRecordLine: "This place has few records. A public-scope photo can show the place.",
    areaNextStepBrowseLine: "Scan photos and seasonal records first, then decide why to visit.",
    areaNextStepGuideLine: "If an on-site guide is available, open audio or notes only when you are nearby.",
    areaNextStepRestrictedLine: "For schools, private land, or unverified areas, do not enter; handle only permitted observations.",
    areaNextStepRecordCta: "Record safely",
    areaSchoolNotice: "Schools and campuses may include restricted areas. Do not enter without permission; only handle observations within approved public scope.",
    cellAggregateTitle: "Record density in this area",
    cellAggregateBadge: "Area aggregate",
    cellAggregateSafety: "This view shows the area as a whole. Before adding a record, check public scope and local rules.",
    gbifAreaTitle: "Organisms recorded around this area",
    gbifAreaBadge: "GBIF public records",
    gbifAreaLoading: "Checking GBIF public record summary…",
    gbifAreaEmpty: "No GBIF public record summary is cached for this area yet.",
    gbifAreaSafety: "This is an area-level summary of public GBIF records. It does not guarantee current presence or population size. Exact sensitive locations and third-party photos are not shown.",
    gbifAreaLatestYearLabel: "Latest record year",
    gbifAreaRecordCountLabel: "Public records",
    gbifAreaTopTaxaLabel: "Top recorded taxa",
    gbifAreaSourceLabel: "Source",
    gbifAreaSourceLink: "View on GBIF",
    mapPointSafety: "The map alone cannot confirm safety or access. Follow signs, managers, and public-scope rules first.",
    osmAreaFallbackName: "OSM park or green space",
    osmAreaSourceLabel: "Park / green space (OSM live)",
    areaLoading: "Loading area information…",
    unregisteredAreaText: "This area is not registered in ZUKAN's field database yet. For now, it stays as a field-guide clue on the map.",
    mapLoadErrorTitle: "Could not display the map",
    mapLoadErrorBody: "You can also explore the public records list.",
    mapLoadRetryLabel: "Reload",
    mapLoadRecordsLabel: "Browse public records",
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
    activityRallyTitle: "Actividades y rallies de esta área",
    activityRallyBody: "Las salidas, los rallies de publicaciones y las actividades locales al aire libre pueden vincularse a la guía regional desde aquí. Las consultas empiezan en la guía para organizadores.",
    activityRallyMeta: "Eventos / rallies",
    activityRallyLinkLabel: "Para organizadores",
    enjoyTitle: "Mirar cerca y volver",
    enjoyLead: "El mapa es una herramienta para revisar registros por lugar; no es el tema principal de la guía regional.",
    tabMarkers: "Fotos",
    tabHeatmap: "Estación",
    tabPlaces: "Guías",
    tabRain: "Lluvia",
    tabCoverage: "Zonas abiertas",
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
    areaTrustLegendLow: "Fuente/acceso pendiente",
    areaTrustLegendHigh: "Área verificada",
    areaLegendConfirmedLabel: "Verificada",
    areaLegendConfirmedHint: "Registra dentro del área pública",
    areaLegendPendingLabel: "Pendiente",
    areaLegendPendingHint: "No entrar sin señales o permiso",
    areaLegendParkLabel: "Parques / verde",
    areaLegendParkHint: "Observa en zonas abiertas",
    areaLegendSchoolLabel: "Escuelas",
    areaLegendSchoolHint: "Observar desde fuera; no entrar",
    areaLegendWaterLabel: "Agua",
    areaLegendWaterHint: "Mantén distancia y cuida el suelo",
    layerHintPlaces: "Acércate para ver los límites del álbum del área.",
    layerHintFrontier: "Acércate para ver los huecos de registro como áreas.",
    layerHintHeatmap: "Acércate para ver la intensidad de temporada.",
    layerHintJump: "Ver capa",
    layerHintDismiss: "Cerrar",
    purposeHintTitle: "Busca una escena para guardar",
    purposeHintBody: "Elige un lugar para ver hallazgos recientes y motivos para visitarlo.",
    purposeHintDismiss: "Cerrar esta pista",
    loading: "Cargando…",
    recordsLoading: "Cargando registros…",
    statsLabel: (returned, total) => `${returned.toLocaleString("es-ES")} / ${total.toLocaleString("es-ES")}`,
    empty: "Prueba fotos, guías o otra estación cerca.",
    emptyTitle: "Buscando cerca",
    emptyLead: "Zonas públicas cercanas u otra estación pueden mostrar fotos y lugares.",
    emptyActionAreas: "Áreas",
    emptyActionWiden: "Ampliar",
    emptyActionRecord: "Registrar hallazgo",
    personalPulseTitle: "Volver a tus registros",
    personalPulseBody: "Después de publicar, tu página y tu lista de registros quedan a un toque. Los hallazgos recientes dan vida al mapa.",
    personalPulseProfile: "Mi página",
    personalPulseRecords: "Mis registros",
    personalMemoryTitle: "Lugares más fotografiados",
    personalMemoryBody: "Parques y zonas de viaje con muchas fotos quedan como accesos de regreso.",
    personalMemoryRecords: " registros",
    personalMemoryOpen: "Abrir",
    personalMemoryFallbackLabel: "Zona frecuente",
    sideRecentLabel: "Hallazgos cercanos",
    recentFindsHint: "Visto aquí",
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
    bottomSheetCloseLabel: "Cerrar",
    bottomSheetExpandLabel: "Ampliar detalles",
    bottomSheetCollapseLabel: "Volver a media altura",
    siteBriefHeading: "Qué puedes encontrar aquí",
    siteBriefReasonsLabel: "Registros",
    siteBriefChecksLabel: "Verifica en el sitio",
    siteBriefCapturesLabel: "Si disparas",
    siteBriefEnvironmentLabel: "Pistas de satélite/mapa",
    siteBriefWhyHereLabel: "registros",
    siteBriefWhyNowLabel: "estación",
    siteBriefOneVisitLabel: "qué hacer",
    siteBriefNextHookLabel: "siguiente pista",
    siteBriefLoading: "Leyendo este lugar…",
    siteBriefError: "No pude leer este lugar. Confía en tu campo.",
    searchPlaceholder: "Buscar lugar o especie (p. ej. Shizuoka, mariposa)",
    searchAriaLabel: "Buscar lugar o especie",
    searchNoResult: "Sin resultados. Prueba con menos palabras.",
    searchError: "Fallo al buscar. Espera y reintenta.",
    searchResultSpecies: "Especie",
    searchResultPlace: "Lugar",
    unknownHypothesisLabel: "Un lugar que el mapa solo no puede explicar",
    recordingGapLabel: "Hueco de registros",
    selectedPointName: "Punto elegido en el mapa",
    areaRestrictedActionLabel: "Revisar reglas locales",
    areaRestrictedActionHint: "En escuelas, zonas restringidas o no verificadas, solo se tratan observaciones permitidas.",
    areaSafeRecordLabel: "Registrar tras revisar alcance",
    areaGalleryEmptyPublicLead: "Aun no hay registros. Si el alcance publico y las reglas del sitio son claras, tu registro puede ser la primera pista.",
    areaGalleryEmptyPublicSafety: "Sigue senales, areas protegidas y reglas del gestor; registra solo lo visible desde alcance publico.",
    areaGalleryEmptyPublicWiden: "Si este punto esta vacio, amplia el area visible o la estacion para encontrar registros cercanos.",
    areaGalleryEmptyRestrictedLead: "Por seguridad y privacidad, no ofrecemos registro directo en esta area.",
    areaGalleryEmptyRestrictedCheck: "Revisa primero senales, gestores, alcance publico y restricciones de entrada.",
    areaGalleryEmptyRestrictedWiden: "Amplia el area o la estacion y elige un lugar publico cercano mas seguro.",
    areaGalleryEmptySchoolLead: "Cerca de escuelas o centros educativos, no fotografies ni busques alrededor del sitio. Ve a un parque publico o area natural abierta cercana.",
    areaGalleryEmptySchoolWiden: "No te centres en este limite; muévete a un area publica cercana y registra alli con seguridad.",
    areaNextStepEyebrow: "Siguiente paso",
    areaNextStepRecordTitle: "Hacer crecer esta guia de forma segura",
    areaNextStepRestrictedTitle: "Revisa seguridad y permiso primero",
    areaNextStepScopeLine: "Prioriza senales, alcance publico y reglas del administrador.",
    areaNextStepRecordLine: "Registra solo lo que encuentres desde un alcance publico; no fuerces un punto exacto de entrada.",
    areaNextStepFirstRecordLine: "Este lugar tiene pocos registros. Un hallazgo desde un alcance publico puede ser la primera pista.",
    areaNextStepBrowseLine: "Mira fotos y registros estacionales antes de decidir por que visitar.",
    areaNextStepGuideLine: "Si hay guia en sitio, abre audio o notas solo cuando estes cerca.",
    areaNextStepRestrictedLine: "En escuelas, terrenos privados o areas no verificadas, no entres; trata solo observaciones permitidas.",
    areaNextStepRecordCta: "Registrar con seguridad",
    areaSchoolNotice: "Las escuelas y campus pueden incluir zonas restringidas. No entres sin permiso; usa solo observaciones aprobadas para publicar.",
    cellAggregateTitle: "Densidad de registros en esta zona",
    cellAggregateBadge: "Agregado de zona",
    cellAggregateSafety: "Esta vista muestra la zona en conjunto. Antes de registrar, revisa el alcance público y las reglas locales.",
    gbifAreaTitle: "Organismos registrados cerca de esta zona",
    gbifAreaBadge: "Registros públicos GBIF",
    gbifAreaLoading: "Consultando resumen público de GBIF…",
    gbifAreaEmpty: "Aún no hay resumen público GBIF en caché para esta zona.",
    gbifAreaSafety: "Es un resumen por zona de registros públicos de GBIF. No garantiza presencia actual ni tamaño de población. No se muestran ubicaciones sensibles exactas ni fotos de terceros.",
    gbifAreaLatestYearLabel: "Último año",
    gbifAreaRecordCountLabel: "Registros públicos",
    gbifAreaTopTaxaLabel: "Taxones más registrados",
    gbifAreaSourceLabel: "Fuente",
    gbifAreaSourceLink: "Ver en GBIF",
    mapPointSafety: "El mapa solo no confirma seguridad ni acceso. Prioriza señales, gestores y reglas de alcance público.",
    osmAreaFallbackName: "Parque o zona verde de OSM",
    osmAreaSourceLabel: "Parque / zona verde (OSM live)",
    areaLoading: "Cargando información del área…",
    unregisteredAreaText: "Esta área aún no está registrada en la base de campos de ZUKAN. Por ahora queda como pista del mapa-guía.",
    mapLoadErrorTitle: "No se pudo mostrar el mapa",
    mapLoadErrorBody: "También puedes explorar la lista de registros públicos.",
    mapLoadRetryLabel: "Recargar",
    mapLoadRecordsLabel: "Ver registros públicos",
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
    activityRallyTitle: "Atividades e rallies desta área",
    activityRallyBody: "Eventos de observação, rallies de publicações e atividades locais ao ar livre podem ser vinculados ao guia regional aqui. Consultas começam pela página para organizadores.",
    activityRallyMeta: "Eventos / rallies",
    activityRallyLinkLabel: "Para organizadores",
    enjoyTitle: "Ver perto e rever",
    enjoyLead: "O mapa e uma ferramenta para rever registros por lugar; o assunto principal continua sendo o guia regional.",
    tabMarkers: "Fotos",
    tabHeatmap: "Estação",
    tabPlaces: "Guias",
    tabRain: "Chuva",
    tabCoverage: "Áreas abertas",
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
    areaTrustLegendLow: "Fonte/acesso pendente",
    areaTrustLegendHigh: "Área verificada",
    areaLegendConfirmedLabel: "Verificada",
    areaLegendConfirmedHint: "Registre na área pública",
    areaLegendPendingLabel: "Pendente",
    areaLegendPendingHint: "Não entre sem placa ou permissão",
    areaLegendParkLabel: "Parques / verde",
    areaLegendParkHint: "Observe em áreas abertas",
    areaLegendSchoolLabel: "Escolas",
    areaLegendSchoolHint: "Observe de fora; não entre",
    areaLegendWaterLabel: "Água",
    areaLegendWaterHint: "Mantenha distância e atenção ao piso",
    layerHintPlaces: "Aproxime o zoom para ver os limites do álbum da área.",
    layerHintFrontier: "Aproxime o zoom para ver os vazios de registro como áreas.",
    layerHintHeatmap: "Aproxime o zoom para ver a intensidade da estação.",
    layerHintJump: "Mostrar camada",
    layerHintDismiss: "Fechar",
    purposeHintTitle: "Encontre uma paisagem para guardar",
    purposeHintBody: "Escolha um lugar para ver achados recentes e motivos para visitar.",
    purposeHintDismiss: "Fechar esta dica",
    loading: "Carregando…",
    recordsLoading: "Carregando registros…",
    statsLabel: (returned, total) => `${returned.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`,
    empty: "Veja fotos, guias ou outra estação por perto.",
    emptyTitle: "Buscando por perto",
    emptyLead: "Áreas públicas próximas ou outra estação podem mostrar fotos e lugares.",
    emptyActionAreas: "Áreas",
    emptyActionWiden: "Ampliar",
    emptyActionRecord: "Registrar achado",
    personalPulseTitle: "Voltar aos seus registros",
    personalPulseBody: "Depois de publicar, sua página e sua lista de registros ficam a um toque. Descobertas recentes dão vida ao mapa.",
    personalPulseProfile: "Minha página",
    personalPulseRecords: "Meus registros",
    personalMemoryTitle: "Lugares mais fotografados",
    personalMemoryBody: "Parques e áreas de viagem com muitas fotos viram atalhos de retorno.",
    personalMemoryRecords: " registros",
    personalMemoryOpen: "Abrir",
    personalMemoryFallbackLabel: "Área frequente",
    sideRecentLabel: "Descobertas por perto",
    recentFindsHint: "Visto aqui",
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
    bottomSheetCloseLabel: "Fechar",
    bottomSheetExpandLabel: "Expandir detalhes",
    bottomSheetCollapseLabel: "Voltar para meia altura",
    siteBriefHeading: "O que você pode encontrar aqui",
    siteBriefReasonsLabel: "Registros",
    siteBriefChecksLabel: "Verifique no campo",
    siteBriefCapturesLabel: "Se for fotografar",
    siteBriefEnvironmentLabel: "Pistas de satélite/mapa",
    siteBriefWhyHereLabel: "registros",
    siteBriefWhyNowLabel: "estação",
    siteBriefOneVisitLabel: "o que fazer",
    siteBriefNextHookLabel: "próxima pista",
    siteBriefLoading: "Lendo este lugar…",
    siteBriefError: "Não consegui ler este lugar. Confie no campo.",
    searchPlaceholder: "Buscar local ou espécie (ex.: Shizuoka, borboleta)",
    searchAriaLabel: "Buscar local ou espécie",
    searchNoResult: "Sem resultados. Tente um termo mais amplo.",
    searchError: "Falha na busca. Aguarde e tente novamente.",
    searchResultSpecies: "Espécie",
    searchResultPlace: "Lugar",
    unknownHypothesisLabel: "Um lugar que o mapa sozinho não explica",
    recordingGapLabel: "Lacuna de registros",
    selectedPointName: "Ponto escolhido no mapa",
    areaRestrictedActionLabel: "Ver regras locais",
    areaRestrictedActionHint: "Em escolas, áreas restritas ou não verificadas, apenas observações permitidas são tratadas.",
    areaSafeRecordLabel: "Registrar após revisar escopo",
    areaGalleryEmptyPublicLead: "Ainda nao ha registros. Se o escopo publico e as regras locais estiverem claros, seu registro pode virar a primeira pista.",
    areaGalleryEmptyPublicSafety: "Siga placas, areas protegidas e regras do gestor; registre apenas o que ve em escopo publico.",
    areaGalleryEmptyPublicWiden: "Se este ponto estiver vazio, amplie a area visivel ou a estacao para encontrar registros proximos.",
    areaGalleryEmptyRestrictedLead: "Por seguranca e privacidade, o registro direto nao e oferecido nesta area.",
    areaGalleryEmptyRestrictedCheck: "Confira primeiro placas, gestores, escopo publico e restricoes de entrada.",
    areaGalleryEmptyRestrictedWiden: "Amplie a area ou a estacao e escolha um local publico proximo mais seguro.",
    areaGalleryEmptySchoolLead: "Perto de escolas ou instalacoes educacionais, nao fotografe nem procure ao redor do local. Va a um parque publico ou area natural aberta proxima.",
    areaGalleryEmptySchoolWiden: "Nao foque neste limite; va a uma area publica proxima e registre com seguranca.",
    areaNextStepEyebrow: "Proximo passo",
    areaNextStepRecordTitle: "Fazer este guia crescer com seguranca",
    areaNextStepRestrictedTitle: "Verifique seguranca e permissao primeiro",
    areaNextStepScopeLine: "Priorize placas, escopo publico e regras do gestor.",
    areaNextStepRecordLine: "Registre apenas o que encontrar em escopo publico; nao force um ponto exato de entrada.",
    areaNextStepFirstRecordLine: "Este lugar tem poucos registros. Um achado em escopo publico pode virar a primeira pista.",
    areaNextStepBrowseLine: "Veja fotos e registros sazonais antes de decidir por que visitar.",
    areaNextStepGuideLine: "Se houver guia no local, abra audio ou notas somente quando estiver perto.",
    areaNextStepRestrictedLine: "Em escolas, areas privadas ou nao verificadas, nao entre; trate apenas observacoes permitidas.",
    areaNextStepRecordCta: "Registrar com seguranca",
    areaSchoolNotice: "Escolas e campus podem incluir áreas restritas. Não entre sem permissão; use apenas observações aprovadas para publicação.",
    cellAggregateTitle: "Densidade de registros nesta área",
    cellAggregateBadge: "Agregado da área",
    cellAggregateSafety: "Esta visão mostra a área como um todo. Antes de registrar, verifique o escopo público e as regras locais.",
    gbifAreaTitle: "Organismos registrados perto desta área",
    gbifAreaBadge: "Registros públicos GBIF",
    gbifAreaLoading: "Verificando resumo público do GBIF…",
    gbifAreaEmpty: "Ainda não há resumo público GBIF em cache para esta área.",
    gbifAreaSafety: "Este é um resumo por área de registros públicos do GBIF. Não garante presença atual nem tamanho populacional. Locais sensíveis exatos e fotos de terceiros não são exibidos.",
    gbifAreaLatestYearLabel: "Último ano",
    gbifAreaRecordCountLabel: "Registros públicos",
    gbifAreaTopTaxaLabel: "Táxons mais registrados",
    gbifAreaSourceLabel: "Fonte",
    gbifAreaSourceLink: "Ver no GBIF",
    mapPointSafety: "O mapa sozinho não confirma segurança ou acesso. Priorize placas, gestores e regras de escopo público.",
    osmAreaFallbackName: "Parque ou área verde do OSM",
    osmAreaSourceLabel: "Parque / área verde (OSM live)",
    areaLoading: "Carregando informações da área…",
    unregisteredAreaText: "Esta área ainda não está registrada no banco de campos do ZUKAN. Por enquanto, fica como pista do mapa guia.",
    mapLoadErrorTitle: "Não foi possível exibir o mapa",
    mapLoadErrorBody: "Você também pode explorar a lista de registros públicos.",
    mapLoadRetryLabel: "Recarregar",
    mapLoadRecordsLabel: "Ver registros públicos",
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
  return { heading: "重ねて見る", intro: "地図に必要な手がかりだけ重ねます。", opacityLabel: "濃さ" };
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
      { value: "note", label: "記録", icon: "📖" },
      { value: "guide", label: "その場で調べる", icon: "🔍" },
      { value: "scan", label: "探索", icon: "📡" },
      { value: "mixed", label: "ひと通り見る", icon: "🧭" },
    ],
    selfLabel: "自分の記録",
    communityLabel: "みんなの記録",
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
    actorLabel: "見る人",
    actors: [
      { value: "all", label: "すべて", icon: "🧭" },
      { value: "local_steward", label: "地域で暮らす人", icon: "🏡" },
      { value: "traveler", label: "訪れた人", icon: "🧳" },
      { value: "casual", label: "散歩中の人", icon: "🚶" },
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
  const guideHref = appendLangToHref(withBasePath(props.basePath, "/guide"), props.lang);
  const communityRecordsHref = appendLangToHref(withBasePath(props.basePath, "/records"), props.lang);
  const routeHintsHref = appendLangToHref(withBasePath(props.basePath, "/walk-maps"), props.lang);
  const asahataWalkHref = appendLangToHref(withBasePath(props.basePath, "/walk-maps/jp-shizuoka-asahata-waterfront-sample-v0"), props.lang);
  const yatsuyamaWalkHref = appendLangToHref(withBasePath(props.basePath, "/walk-maps/jp-shizuoka-yatsuyama-sample-v0"), props.lang);
  const notesHref = appendLangToHref(withBasePath(props.basePath, "/records?view=mine"), props.lang);
  const profileHref = appendLangToHref(withBasePath(props.basePath, "/profile"), props.lang);
  const lensHref = appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang);
  const mobileTabLabels = lang === "ja"
    ? { markers: "記録", heatmap: "季節", places: "現地ガイド", rain: "雨雲", frontier: "空白" }
    : lang === "es"
      ? { markers: "Hoy", heatmap: "Est.", places: "Área", rain: "Lluvia", frontier: "Huecos" }
      : lang === "pt-BR"
        ? { markers: "Hoje", heatmap: "Est.", places: "Área", rain: "Chuva", frontier: "Lacunas" }
        : { markers: "Finds", heatmap: "Signs", places: "Areas", rain: "Rain", frontier: "Gaps" };
  const apiCells = withBasePath(props.basePath, "/api/v1/map/cells");
  const apiObservations = withBasePath(props.basePath, "/api/v1/map/observations");
  const apiPlaceProfile = withBasePath(props.basePath, "/api/v1/map/place-profile");
  const apiPlaceSearch = withBasePath(props.basePath, "/api/v1/map/place-search");
  const apiMyObservations = withBasePath(props.basePath, "/api/v1/map/my-observations");
  const apiSiteBrief = withBasePath(props.basePath, "/api/v1/map/site-brief");
  const apiTraces = withBasePath(props.basePath, "/api/v1/map/traces");
  const apiFrontier = withBasePath(props.basePath, "/api/v1/map/frontier");
  const apiEffortSummary = withBasePath(props.basePath, "/api/v1/map/effort-summary");
  const apiAreaPolygons = withBasePath(props.basePath, "/api/v1/map/area-polygons");
  const apiGuideSpots = withBasePath(props.basePath, "/api/v1/map/guide-spots");
  const apiGbifAreaSummary = withBasePath(props.basePath, "/api/v1/map/gbif-area-summary");
  const apiJmaNowcastTimes = withBasePath(props.basePath, "/api/v1/weather/jma-nowcast/times");
  const apiAreaSnapshotTemplate = withBasePath(props.basePath, "/api/v1/fields/__FIELD_ID__/area-snapshot");
  const apiAreaFollow = withBasePath(props.basePath, "/api/v1/me/area-subscriptions");
  const apiWalkMapCandidates = withBasePath(props.basePath, "/api/v1/municipal-walk-maps");
  const walkMapHrefPrefix = appendLangToHref(withBasePath(props.basePath, "/walk-maps/"), props.lang);
  const eventsOrganizerHref = appendLangToHref(
    withBasePath(props.basePath, "/community/events"),
    props.lang,
  );
  const activityRallyPanelHtml = "";
  const ownOnlyLabel = lang === "ja"
    ? "自分だけに表示"
    : lang === "es"
      ? "Solo para ti"
      : lang === "pt-BR"
        ? "So para voce"
        : "Only you see this";
  const communityBlurLabel = lang === "ja"
    ? "みんなの記録は地点ではなくエリアで表示"
    : lang === "es"
      ? "Community photos are blurred by area"
      : lang === "pt-BR"
        ? "Fotos da comunidade aparecem por area"
        : "Community photos are shown by area";
  const personalPulsePanelHtml = `<section class="me-personal-pulse" data-testid="map-personal-pulse-panel">
      <div class="me-personal-pulse-head">
        <span aria-hidden="true">●</span>
        <strong>${escapeHtml(copy.personalPulseTitle)}</strong>
      </div>
      <p>${escapeHtml(copy.personalPulseBody)}</p>
      <div class="me-map-privacy-strip" aria-label="${escapeHtml(ownOnlyLabel + " / " + communityBlurLabel)}">
        <span>${escapeHtml(ownOnlyLabel)}</span>
        <span>${escapeHtml(communityBlurLabel)}</span>
      </div>
      <div class="me-personal-memory is-hidden" id="me-personal-memory" aria-hidden="true">
        <div class="me-personal-memory-head">
          <strong>${escapeHtml(copy.personalMemoryTitle)}</strong>
          <small>${escapeHtml(copy.personalMemoryBody)}</small>
        </div>
        <div class="me-personal-memory-list" id="me-personal-memory-list"></div>
      </div>
      <div class="me-personal-pulse-actions">
        <a href="${escapeHtml(profileHref)}" data-kpi-action="map:personal_pulse_profile">${escapeHtml(copy.personalPulseProfile)}</a>
        <a href="${escapeHtml(notesHref)}" data-kpi-action="map:personal_pulse_records">${escapeHtml(copy.personalPulseRecords)}</a>
      </div>
    </section>`;
  const startPanelTitle = lang === "ja"
    ? "地図メニュー"
    : lang === "es"
      ? "Qué hacer cerca"
      : lang === "pt-BR"
        ? "O que fazer por perto"
        : "What you can do nearby";
  const startPanelCloseLabel = lang === "ja"
    ? "地図メニューを開く"
    : lang === "es"
      ? "Cerrar guía"
      : lang === "pt-BR"
        ? "Fechar guia"
        : "Close guide";
  const startPanelLocationLabel = lang === "ja"
    ? "近く"
    : lang === "es"
      ? "Ver cerca"
      : lang === "pt-BR"
        ? "Ver perto"
        : "Show nearby";
  const startPanelLocationNote = lang === "ja"
    ? "許可済みなら近くから始めます。押すと現在地へ移動します。"
    : lang === "es"
      ? "Si ya diste permiso, empieza cerca. Toca para ir a tu ubicación."
      : lang === "pt-BR"
        ? "Se já permitiu, começa por perto. Toque para ir à sua localização."
        : "If already allowed, the map starts nearby. Tap to use your current place.";
  const startPanelBrief = lang === "ja"
    ? "記録・ガイド"
    : lang === "es"
      ? "Fotos · guías · paseos"
      : lang === "pt-BR"
        ? "Fotos · guias · passeios"
        : "Photos · guides · walks";
  const startPanelRouteHeading = lang === "ja"
    ? "静岡の散策候補"
    : lang === "es"
      ? "Paseos de Shizuoka"
      : lang === "pt-BR"
        ? "Passeios de Shizuoka"
        : "Shizuoka walks";
  const startPanelRouteHeadingAny = lang === "ja"
    ? "散策候補"
    : lang === "es"
      ? "Paseos"
      : lang === "pt-BR"
        ? "Passeios"
        : "Walks";
  const topWalkLabel = lang === "ja"
    ? "散策"
    : lang === "es"
      ? "Paseos"
      : lang === "pt-BR"
        ? "Passeios"
        : "Walks";
  const startPanelRouteLinks = [
    { label: lang === "ja" ? "水辺" : lang === "es" ? "Agua" : lang === "pt-BR" ? "Agua" : "Waterfront", href: asahataWalkHref, action: "map:start_panel:route_asahata", region: "shizuoka" },
    { label: lang === "ja" ? "谷津山" : lang === "es" ? "Yatsuyama" : lang === "pt-BR" ? "Yatsuyama" : "Yatsuyama", href: yatsuyamaWalkHref, action: "map:start_panel:route_yatsuyama", region: "shizuoka" },
    { label: lang === "ja" ? "一覧" : lang === "es" ? "Lista" : lang === "pt-BR" ? "Lista" : "All", href: routeHintsHref, action: "map:start_panel:route_list", region: "all" },
  ];
  const displayFilterLabel = lang === "ja"
    ? "レイヤー"
    : lang === "es"
      ? "Vista"
      : lang === "pt-BR"
        ? "Vista"
        : "View";
  const filterDisplayTabs = [
    { tab: "markers", label: copy.tabMarkers },
    { tab: "places", label: copy.tabPlaces },
    { tab: "heatmap", label: copy.tabHeatmap },
    { tab: "rain", label: copy.tabRain },
    { tab: "frontier", label: copy.tabCoverage },
  ];
  const filterDisplayTabsHtml = filterDisplayTabs
    .map((item) => `<button type="button" class="me-chip me-filter-tab-chip${item.tab === "places" ? " is-active" : ""}" data-filter-tab="${escapeHtml(item.tab)}" aria-pressed="${item.tab === "places" ? "true" : "false"}">${escapeHtml(item.label)}</button>`)
    .join("");
  const startCards = [
    {
      icon: "📷",
      title: lang === "ja" ? "記録" : lang === "es" ? "Fotos" : lang === "pt-BR" ? "Fotos" : "Photos",
      href: communityRecordsHref,
      action: "map:start_panel:photos",
    },
    {
      icon: "🧭",
      title: lang === "ja" ? "現地ガイド" : lang === "es" ? "Guías" : lang === "pt-BR" ? "Guias" : "Guides",
      href: guideHref,
      action: "map:start_panel:guide",
    },
    {
      icon: "🚶",
      title: lang === "ja" ? "散策" : lang === "es" ? "Paseo" : lang === "pt-BR" ? "Passeio" : "Walk",
      href: routeHintsHref,
      action: "map:start_panel:route_hints",
    },
  ];
  const startPanelHtml = `<section class="me-start-panel is-collapsed" id="me-start-panel" data-testid="map-start-panel" aria-label="${escapeHtml(startPanelTitle)}" aria-hidden="false">
      <div class="me-start-panel-head">
        <strong>${escapeHtml(startPanelTitle)}</strong>
        <button type="button" class="me-start-panel-close" id="me-start-panel-close" aria-label="${escapeHtml(startPanelCloseLabel)}" aria-expanded="false">
          <span class="me-start-panel-brief">${escapeHtml(startPanelBrief)}</span>
          <span class="me-start-panel-symbol" aria-hidden="true">⌄</span>
        </button>
      </div>
      <div class="me-start-panel-grid">
        <button type="button" class="me-start-panel-location" id="me-start-panel-location" aria-label="${escapeHtml(startPanelLocationNote)}"><span aria-hidden="true">📍</span><strong>${escapeHtml(startPanelLocationLabel)}</strong></button>
        ${startCards.map((card) => `<a href="${escapeHtml(card.href)}" aria-label="${escapeHtml(card.title)}" title="${escapeHtml(card.title)}" data-kpi-action="${escapeHtml(card.action)}">
          <span aria-hidden="true">${escapeHtml(card.icon)}</span>
          <strong>${escapeHtml(card.title)}</strong>
        </a>`).join("")}
      </div>
      <div class="me-start-panel-routes" aria-label="${escapeHtml(startPanelRouteHeading)}" data-shizuoka-heading="${escapeHtml(startPanelRouteHeading)}" data-any-heading="${escapeHtml(startPanelRouteHeadingAny)}" data-walk-map-prefix="${escapeHtml(walkMapHrefPrefix)}">
        <strong id="me-start-panel-routes-heading">${escapeHtml(startPanelRouteHeading)}</strong>
        <nav>
          ${startPanelRouteLinks.map((link) => `<a href="${escapeHtml(link.href)}" data-kpi-action="${escapeHtml(link.action)}" data-route-region="${escapeHtml(link.region)}">${escapeHtml(link.label)}</a>`).join("")}
        </nav>
      </div>
    </section>`;

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
      value: "osm_named_area",
      label: lang === "ja" ? "施設・観光・文化" : lang === "es" ? "Instalaciones/turismo" : lang === "pt-BR" ? "Instalações/turismo" : "Facilities/tourism",
      icon: "🏛️",
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
    ? "詳しく絞る"
    : lang === "es"
      ? "Más filtros"
      : lang === "pt-BR"
        ? "Mais filtros"
        : "More filters";
  const listHeading = lang === "ja"
    ? "この範囲の記録"
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
  const safetyCue = lang === "ja"
    ? "公開記録は地点ではなく、おおよそのエリアで表示"
    : lang === "es"
      ? "Los registros publicos usan ubicacion aproximada"
      : lang === "pt-BR"
        ? "Registros publicos usam local aproximado"
        : "Public records use approximate location";
  const sideTabResultsLabel = lang === "ja"
    ? "記録"
    : lang === "es"
      ? "Lista"
      : lang === "pt-BR"
        ? "Lista"
        : "List";
  const sideTabSelectionLabel = lang === "ja"
    ? "この場所"
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
    ? "エリアや記録を選ぶと、この地域で見えているものが出ます。公開表示は地域単位でまとめています。"
    : lang === "es"
      ? "Toca un pin o una celda del mapa para ver los detalles aquí."
      : lang === "pt-BR"
        ? "Toque em um pino ou célula no mapa para ver os detalhes aqui."
        : "Tap a pin or cell on the map to see details here.";
  const rainLabels = {
    panel: lang === "ja" ? "レーダー" : lang === "es" ? "Radar" : lang === "pt-BR" ? "Radar" : "Radar",
    refresh: lang === "ja" ? "更新" : lang === "es" ? "Actualizar" : lang === "pt-BR" ? "Atualizar" : "Refresh",
    source: lang === "ja" ? "気象庁" : lang === "es" ? "JMA" : lang === "pt-BR" ? "JMA" : "JMA",
    current: lang === "ja" ? "現在地" : lang === "es" ? "Mi ubicación" : lang === "pt-BR" ? "Minha localização" : "Current place",
    target: lang === "ja" ? "行き先" : lang === "es" ? "Destino" : lang === "pt-BR" ? "Destino" : "Target",
    timeline: lang === "ja" ? "表示時刻" : lang === "es" ? "Hora" : lang === "pt-BR" ? "Hora" : "Time",
    status: lang === "ja"
      ? "現在から6時間先まで見られます。"
      : lang === "es"
        ? "Mira desde ahora hasta seis horas."
        : lang === "pt-BR"
          ? "Veja de agora até seis horas à frente."
          : "View now through six hours ahead.",
  };
  const mapRegionLabel = lang === "ja"
    ? "地図で場所を探す"
    : lang === "es"
      ? "Explorar lugares en el mapa"
      : lang === "pt-BR"
        ? "Explorar locais no mapa"
        : "Explore places on the map";

  return `<section class="section me-section map-explorer" data-side="rail" aria-label="${escapeHtml(mapRegionLabel)}">
    <div class="me-topbar">
      <div class="me-topbar-primary">
        <span class="me-map-kicker">${escapeHtml(lang === "ja" ? "探索する" : lang === "es" ? "Guia regional" : lang === "pt-BR" ? "Guia regional" : "Regional guide")}</span>
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
        <div class="me-tabs" role="tablist" aria-label="${escapeHtml(copy.tabAriaLabel)}" data-mobile-primary-map-controls>
          ${renderMapLayerTab("markers", copy.tabMarkers, mobileTabLabels.markers)}
          ${renderMapLayerTab("places", copy.tabPlaces, mobileTabLabels.places, true)}
          ${renderMapLayerTab("heatmap", copy.tabHeatmap, mobileTabLabels.heatmap)}
          ${renderMapLayerTab("rain", copy.tabRain, mobileTabLabels.rain)}
          ${renderMapLayerTab("frontier", copy.tabCoverage, mobileTabLabels.frontier)}
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
            <div class="me-filter-group me-filter-display-group">
              <span class="me-filter-label">${escapeHtml(displayFilterLabel)}</span>
              <div class="me-chip-row" role="group" aria-label="${escapeHtml(displayFilterLabel)}">${filterDisplayTabsHtml}</div>
            </div>
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
              <label class="me-trace-toggle-label" title="${escapeHtml(lang === "ja" ? "歩いた軌跡を地図に表示する" : lang === "es" ? "Mostrar rutas recorridas" : lang === "pt-BR" ? "Mostrar trilhas percorridas" : "Show walk traces")}">
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

    <div class="me-map-role-strip" aria-label="${escapeHtml(copy.enjoyTitle)}">
      <strong>${escapeHtml(copy.enjoyTitle)}</strong>
      <span>${escapeHtml(copy.enjoyLead)}</span>
      <em>${escapeHtml(safetyCue)}</em>
    </div>

    <div class="me-main">
      <aside class="me-side" id="me-side" data-tab="results" aria-label="result panel">
        <button type="button" class="me-side-toggle" id="me-side-toggle" aria-label="${escapeHtml(sideToggleLabel)}" title="${escapeHtml(sideToggleLabel)}" aria-expanded="false">
          <span class="me-side-toggle-icon" aria-hidden="true">‹</span>
        </button>
        <div class="me-side-rail-icons" aria-hidden="true">
          <span class="me-side-rail-mark"></span>
          <span class="me-side-rail-signal" id="me-side-rail-count" data-signal="neutral"><i></i><i></i><i></i></span>
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
            ${personalPulsePanelHtml}
            <div class="me-contribution-panel" id="me-contribution-panel" data-testid="map-contribution-panel"></div>
            ${activityRallyPanelHtml}
            <div class="me-results-list" id="me-results-list" data-testid="map-result-list"></div>
          </div>
          <div class="me-side-pane me-side-pane-selection" role="tabpanel">
            <div class="me-map-panel me-map-panel-selection" id="me-map-selection-card"></div>
            <div class="me-side-pane-selection-empty" id="me-side-selection-empty">${escapeHtml(sideSelectionEmptyLabel)}</div>
          </div>
        </div>
      </aside>
      <div class="me-map-wrap">
        <div id="map-explorer" class="me-map" data-results-pending="0" data-api-cells="${escapeHtml(apiCells)}" data-api-observations="${escapeHtml(apiObservations)}" data-api-place-profile="${escapeHtml(apiPlaceProfile)}" data-api-place-search="${escapeHtml(apiPlaceSearch)}" data-api-my-observations="${escapeHtml(apiMyObservations)}" data-api-site-brief="${escapeHtml(apiSiteBrief)}" data-api-traces="${escapeHtml(apiTraces)}" data-api-frontier="${escapeHtml(apiFrontier)}" data-api-effort-summary="${escapeHtml(apiEffortSummary)}" data-api-area-polygons="${escapeHtml(apiAreaPolygons)}" data-api-guide-spots="${escapeHtml(apiGuideSpots)}" data-api-gbif-area-summary="${escapeHtml(apiGbifAreaSummary)}" data-api-jma-nowcast-times="${escapeHtml(apiJmaNowcastTimes)}" data-api-area-snapshot="${escapeHtml(apiAreaSnapshotTemplate)}" data-api-area-follow="${escapeHtml(apiAreaFollow)}" data-api-walk-map-candidates="${escapeHtml(apiWalkMapCandidates)}"></div>
        ${startPanelHtml}
        <section class="me-purpose-hint" id="me-purpose-hint" data-testid="map-purpose-hint" aria-label="${escapeHtml(copy.purposeHintTitle)}" aria-hidden="true" hidden>
          <button type="button" class="me-purpose-hint-close" id="me-purpose-hint-close" aria-label="${escapeHtml(copy.purposeHintDismiss)}">×</button>
          <strong>${escapeHtml(copy.purposeHintTitle)}</strong>
          <p>${escapeHtml(copy.purposeHintBody)}</p>
        </section>
        <section class="me-rain-card" id="me-rain-card" data-enabled="0" aria-label="${escapeHtml(copy.tabRain)}" hidden>
          <div class="me-rain-head">
            <strong>${escapeHtml(rainLabels.panel)}</strong>
            <button type="button" class="me-rain-toggle" id="me-rain-toggle" aria-pressed="false">${escapeHtml(rainLabels.refresh)}</button>
            <span>${escapeHtml(rainLabels.source)}</span>
          </div>
          <div class="me-rain-timeline" id="me-rain-timeline" role="group" aria-label="${escapeHtml(rainLabels.timeline)}"></div>
          <div class="me-rain-actions">
            <button type="button" id="me-rain-current">${escapeHtml(rainLabels.current)}</button>
            <button type="button" id="me-rain-target">${escapeHtml(rainLabels.target)}</button>
          </div>
          <p class="me-rain-status" id="me-rain-status">${escapeHtml(rainLabels.status)}</p>
        </section>
        <button type="button" class="me-search-area-btn is-hidden" id="me-search-area-btn">${escapeHtml(searchAreaLabel)}</button>
        <button type="button" class="me-locate-fab" id="me-locate-fab" aria-label="${escapeHtml(copy.locateLabel)}" title="${escapeHtml(copy.locateLabel)}">
          <span aria-hidden="true">📍</span>
        </button>
        <div class="me-map-status" id="me-map-status" role="status" aria-live="polite">${escapeHtml(copy.loading)}</div>
        <section class="me-own-trail is-hidden" id="me-own-trail" aria-hidden="true">
          <div class="me-own-trail-head">
            <strong>${escapeHtml(props.lang === "ja" ? "自分の撮影" : props.lang === "es" ? "Tus fotos" : props.lang === "pt-BR" ? "Suas fotos" : "Your photos")}</strong>
            <small>${escapeHtml(ownOnlyLabel)}</small>
            <span id="me-own-trail-count"></span>
          </div>
          <div class="me-own-trail-list" id="me-own-trail-list"></div>
        </section>
        <div class="me-legend is-hidden" id="me-legend" aria-hidden="true">
          <div class="me-legend-main">
            <button type="button" class="me-legend-toggle" id="me-legend-toggle" aria-expanded="false">${escapeHtml(copy.legendLabel)}</button>
            <span class="me-legend-gradient" id="me-legend-gradient"></span>
            <span class="me-legend-range"><span id="me-legend-low">${escapeHtml(copy.heatmapLegendLow)}</span><span id="me-legend-high">${escapeHtml(copy.heatmapLegendHigh)}</span></span>
          </div>
          <div class="me-legend-detail is-hidden" id="me-legend-detail" aria-hidden="true"></div>
        </div>
        <div class="me-layer-hint is-hidden" id="me-layer-hint" aria-hidden="true" role="status">
          <span id="me-layer-hint-text"></span>
          <button type="button" class="me-layer-hint-jump" id="me-layer-hint-jump">${escapeHtml(copy.layerHintJump)}</button>
          <button type="button" class="me-layer-hint-close" id="me-layer-hint-close" aria-label="${escapeHtml(copy.layerHintDismiss)}">×</button>
        </div>
        <div class="me-bottom-sheet" id="me-bottom-sheet" aria-hidden="true">
          <button type="button" class="me-bottom-close" id="me-bottom-close" aria-label="${escapeHtml(copy.bottomSheetCloseLabel)}">×</button>
          <button type="button" class="me-bottom-grip" id="me-bottom-grip" aria-label="${escapeHtml(copy.bottomSheetExpandLabel)}"></button>
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
  var mapShellEl = root.closest('.me-section') || root.parentElement;
  var statusEl = document.getElementById('me-map-status');
  var legendEl = document.getElementById('me-legend');
  var legendToggleEl = document.getElementById('me-legend-toggle');
  var legendLowEl = document.getElementById('me-legend-low');
  var legendHighEl = document.getElementById('me-legend-high');
  var legendDetailEl = document.getElementById('me-legend-detail');
  var ownTrailEl = document.getElementById('me-own-trail');
  var ownTrailListEl = document.getElementById('me-own-trail-list');
  var ownTrailCountEl = document.getElementById('me-own-trail-count');
  var personalMemoryEl = document.getElementById('me-personal-memory');
  var personalMemoryListEl = document.getElementById('me-personal-memory-list');
  var layerHintEl = document.getElementById('me-layer-hint');
  var layerHintTextEl = document.getElementById('me-layer-hint-text');
  var layerHintJumpEl = document.getElementById('me-layer-hint-jump');
  var layerHintCloseEl = document.getElementById('me-layer-hint-close');
  var purposeHintEl = document.getElementById('me-purpose-hint');
  var purposeHintCloseEl = document.getElementById('me-purpose-hint-close');
  var startPanelEl = document.getElementById('me-start-panel');
  var startPanelCloseEl = document.getElementById('me-start-panel-close');
  var startPanelLocationEl = document.getElementById('me-start-panel-location');
  var startPanelRoutesEl = document.querySelector('.me-start-panel-routes');
  var startPanelRoutesHeadingEl = document.getElementById('me-start-panel-routes-heading');
  var startPanelRoutesStaticHtml = startPanelRoutesEl && startPanelRoutesEl.querySelector('nav')
    ? startPanelRoutesEl.querySelector('nav').innerHTML
    : '';
  var filterDrawerEl = document.querySelector('.me-filter-drawer');
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
  var rainCardEl = document.getElementById('me-rain-card');
  var rainToggleEl = document.getElementById('me-rain-toggle');
  var rainTimelineEl = document.getElementById('me-rain-timeline');
  var rainStatusEl = document.getElementById('me-rain-status');
  var rainCurrentEl = document.getElementById('me-rain-current');
  var rainTargetEl = document.getElementById('me-rain-target');
  var apiCells = root.getAttribute('data-api-cells') || '';
  var apiObservations = root.getAttribute('data-api-observations') || '';
  var apiPlaceProfile = root.getAttribute('data-api-place-profile') || '';
  var apiPlaceSearch = root.getAttribute('data-api-place-search') || '';
  var apiMyObservations = root.getAttribute('data-api-my-observations') || '';
  var apiSiteBrief = root.getAttribute('data-api-site-brief') || '';
  var apiTraces = root.getAttribute('data-api-traces') || '';
  var apiFrontier = root.getAttribute('data-api-frontier') || '';
  var apiEffortSummary = root.getAttribute('data-api-effort-summary') || '';
  var apiAreaPolygons = root.getAttribute('data-api-area-polygons') || '';
  var apiGuideSpots = root.getAttribute('data-api-guide-spots') || '';
  var apiGbifAreaSummary = root.getAttribute('data-api-gbif-area-summary') || '';
  var apiJmaNowcastTimes = root.getAttribute('data-api-jma-nowcast-times') || '';
  var apiAreaSnapshotTemplate = root.getAttribute('data-api-area-snapshot') || '';
  var apiAreaFollow = root.getAttribute('data-api-area-follow') || '';
  var apiWalkMapCandidates = root.getAttribute('data-api-walk-map-candidates') || '';
  var placeAtlasSeq = 0;
  var placeAtlasAbort = null;

  var COPY = ${JSON.stringify({
    loading: copy.loading,
    recordsLoading: copy.recordsLoading,
    empty: copy.empty,
    emptyTitle: copy.emptyTitle,
    emptyLead: copy.emptyLead,
    emptyActionAreas: copy.emptyActionAreas,
    emptyActionWiden: copy.emptyActionWiden,
    emptyActionRecord: copy.emptyActionRecord,
    statsTemplate: "__RETURNED__ / __TOTAL__",
    recentFindsHint: copy.recentFindsHint,
    coverageLegendLow: copy.coverageLegendLow,
    coverageLegendHigh: copy.coverageLegendHigh,
    heatmapLegendLow: copy.heatmapLegendLow,
    heatmapLegendHigh: copy.heatmapLegendHigh,
    areaTrustLegendLow: copy.areaTrustLegendLow,
    areaTrustLegendHigh: copy.areaTrustLegendHigh,
    areaLegendConfirmedLabel: copy.areaLegendConfirmedLabel,
    areaLegendConfirmedHint: copy.areaLegendConfirmedHint,
    areaLegendPendingLabel: copy.areaLegendPendingLabel,
    areaLegendPendingHint: copy.areaLegendPendingHint,
    areaLegendParkLabel: copy.areaLegendParkLabel,
    areaLegendParkHint: copy.areaLegendParkHint,
    areaLegendSchoolLabel: copy.areaLegendSchoolLabel,
    areaLegendSchoolHint: copy.areaLegendSchoolHint,
    areaLegendWaterLabel: copy.areaLegendWaterLabel,
    areaLegendWaterHint: copy.areaLegendWaterHint,
    layerHintPlaces: copy.layerHintPlaces,
    layerHintFrontier: copy.layerHintFrontier,
    layerHintHeatmap: copy.layerHintHeatmap,
    layerHintJump: copy.layerHintJump,
    purposeHintTitle: copy.purposeHintTitle,
    purposeHintBody: copy.purposeHintBody,
    purposeHintDismiss: copy.purposeHintDismiss,
    legendLabel: copy.legendLabel,
    popupOpenLabel: copy.popupOpenLabel,
    bottomSheetRecord: copy.bottomSheetRecord,
    bottomSheetNotes: copy.bottomSheetNotes,
    bottomSheetLens: copy.bottomSheetLens,
    bottomSheetScan: copy.bottomSheetScan,
    bottomSheetCloseLabel: copy.bottomSheetCloseLabel,
    bottomSheetExpandLabel: copy.bottomSheetExpandLabel,
    bottomSheetCollapseLabel: copy.bottomSheetCollapseLabel,
    ownObservationStackSuffix: props.lang === "ja" ? "件" : props.lang === "es" ? " registros" : props.lang === "pt-BR" ? " registros" : " records",
    ownObservationStackMore: props.lang === "ja" ? "ほか__COUNT__件" : props.lang === "es" ? "__COUNT__ más" : props.lang === "pt-BR" ? "mais __COUNT__" : "__COUNT__ more",
    ownObservationStackHeading: props.lang === "ja" ? "この場所で残した記録" : props.lang === "es" ? "Registros guardados aquí" : props.lang === "pt-BR" ? "Registros salvos aqui" : "Records saved here",
    ownObservationStackHint: props.lang === "ja" ? "自分にだけ正確な位置で表示しています。" : props.lang === "es" ? "Only you see these exact locations." : props.lang === "pt-BR" ? "Somente voce ve estes locais exatos." : "Only you see these exact locations.",
    ownObservationPublicApproxHint: props.lang === "ja" ? "公開マップではおおよその位置で表示されます。" : props.lang === "es" ? "On the public map, this is shown at an approximate location." : props.lang === "pt-BR" ? "No mapa publico, isto aparece em uma localizacao aproximada." : "On the public map, this is shown at an approximate location.",
    ownObservationExactBadge: props.lang === "ja" ? "自分にだけ正確な位置" : props.lang === "es" ? "Exacto solo para ti" : props.lang === "pt-BR" ? "Exato so para voce" : "Exact for you only",
    ownObservationStackOpen: props.lang === "ja" ? "開く" : props.lang === "es" ? "Abrir" : props.lang === "pt-BR" ? "Abrir" : "Open",
    ownObservationTrailHeading: props.lang === "ja" ? "自分の撮影" : props.lang === "es" ? "Tus fotos" : props.lang === "pt-BR" ? "Suas fotos" : "Your photos",
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
    loopHookLocalFallback: props.lang === "ja" ? "次の人の手がかりを 1 行残す" : props.lang === "es" ? "Deja una pista breve para la siguiente persona" : props.lang === "pt-BR" ? "Deixe uma pista curta para a próxima pessoa" : "Leave one short clue for the next person",
    loopHookLocalPrefix: props.lang === "ja" ? "次は " : props.lang === "es" ? "Lo siguiente: " : props.lang === "pt-BR" ? "Próximo: " : "Next: ",
    searchNoResult: copy.searchNoResult,
    searchError: copy.searchError,
    searchResultSpecies: copy.searchResultSpecies,
    searchResultPlace: copy.searchResultPlace,
    unknownHypothesisLabel: copy.unknownHypothesisLabel,
    recordingGapLabel: copy.recordingGapLabel,
    selectedPointName: copy.selectedPointName,
    areaRestrictedActionLabel: copy.areaRestrictedActionLabel,
    areaRestrictedActionHint: copy.areaRestrictedActionHint,
    areaSafeRecordLabel: copy.areaSafeRecordLabel,
    areaGalleryEmptyPublicLead: copy.areaGalleryEmptyPublicLead,
    areaGalleryEmptyPublicSafety: copy.areaGalleryEmptyPublicSafety,
    areaGalleryEmptyPublicWiden: copy.areaGalleryEmptyPublicWiden,
    areaGalleryEmptyRestrictedLead: copy.areaGalleryEmptyRestrictedLead,
    areaGalleryEmptyRestrictedCheck: copy.areaGalleryEmptyRestrictedCheck,
    areaGalleryEmptyRestrictedWiden: copy.areaGalleryEmptyRestrictedWiden,
    areaGalleryEmptySchoolLead: copy.areaGalleryEmptySchoolLead,
    areaGalleryEmptySchoolWiden: copy.areaGalleryEmptySchoolWiden,
    areaNextStepEyebrow: copy.areaNextStepEyebrow,
    areaNextStepRecordTitle: copy.areaNextStepRecordTitle,
    areaNextStepRestrictedTitle: copy.areaNextStepRestrictedTitle,
    areaNextStepScopeLine: copy.areaNextStepScopeLine,
    areaNextStepRecordLine: copy.areaNextStepRecordLine,
    areaNextStepFirstRecordLine: copy.areaNextStepFirstRecordLine,
    areaNextStepBrowseLine: copy.areaNextStepBrowseLine,
    areaNextStepGuideLine: copy.areaNextStepGuideLine,
    areaNextStepRestrictedLine: copy.areaNextStepRestrictedLine,
    areaNextStepRecordCta: copy.areaNextStepRecordCta,
    areaSchoolNotice: copy.areaSchoolNotice,
    cellAggregateTitle: copy.cellAggregateTitle,
    cellAggregateBadge: copy.cellAggregateBadge,
    cellAggregateSafety: copy.cellAggregateSafety,
    gbifAreaTitle: copy.gbifAreaTitle,
    gbifAreaBadge: copy.gbifAreaBadge,
    gbifAreaLoading: copy.gbifAreaLoading,
    gbifAreaEmpty: copy.gbifAreaEmpty,
    gbifAreaSafety: copy.gbifAreaSafety,
    gbifAreaLatestYearLabel: copy.gbifAreaLatestYearLabel,
    gbifAreaRecordCountLabel: copy.gbifAreaRecordCountLabel,
    gbifAreaTopTaxaLabel: copy.gbifAreaTopTaxaLabel,
    gbifAreaSourceLabel: copy.gbifAreaSourceLabel,
    gbifAreaSourceLink: copy.gbifAreaSourceLink,
    mapPointSafety: copy.mapPointSafety,
    osmAreaFallbackName: copy.osmAreaFallbackName,
    osmAreaSourceLabel: copy.osmAreaSourceLabel,
    areaLoading: copy.areaLoading,
    unregisteredAreaText: copy.unregisteredAreaText,
    mapLoadErrorTitle: copy.mapLoadErrorTitle,
    mapLoadErrorBody: copy.mapLoadErrorBody,
    mapLoadRetryLabel: copy.mapLoadRetryLabel,
    mapLoadRecordsLabel: copy.mapLoadRecordsLabel,
    locateError: copy.locateError,
    yearAll: copy.yearAll,
    seasonAll: copy.seasonAll,
    seasonSpring: copy.seasonSpring,
    seasonSummer: copy.seasonSummer,
    seasonAutumn: copy.seasonAutumn,
    seasonWinter: copy.seasonWinter,
    shareCopied: copy.shareCopied,
    shareError: copy.shareError,
    rainNow: props.lang === "ja" ? "現在" : props.lang === "es" ? "Ahora" : props.lang === "pt-BR" ? "Agora" : "Now",
    rainMinute: props.lang === "ja" ? "__MIN__分後" : props.lang === "es" ? "+__MIN__ min" : props.lang === "pt-BR" ? "+__MIN__ min" : "+__MIN__ min",
    rainHour: props.lang === "ja" ? "__HOUR__時間後" : props.lang === "es" ? "+__HOUR__ h" : props.lang === "pt-BR" ? "+__HOUR__ h" : "+__HOUR__ h",
    rainLoading: props.lang === "ja" ? "気象庁データを読み込み中…" : props.lang === "es" ? "Cargando datos JMA…" : props.lang === "pt-BR" ? "Carregando dados JMA…" : "Loading JMA data…",
    rainUnavailable: props.lang === "ja" ? "雨雲を取得できませんでした。時間をおいて確認してください。" : props.lang === "es" ? "No se pudo cargar la lluvia. Inténtalo más tarde." : props.lang === "pt-BR" ? "Não foi possível carregar a chuva. Tente mais tarde." : "Rain data could not be loaded. Try again later.",
    rainCheckLoading: props.lang === "ja" ? "この地点の雨雲を確認中…" : props.lang === "es" ? "Comprobando este punto…" : props.lang === "pt-BR" ? "Verificando este ponto…" : "Checking this point…",
    rainAtNow: props.lang === "ja" ? "この地点は現在、降水域に重なっています。" : props.lang === "es" ? "Este punto está bajo precipitación ahora." : props.lang === "pt-BR" ? "Este ponto está sob precipitação agora." : "This point is under precipitation now.",
    rainWithin: props.lang === "ja" ? "この地点は__TIME__までに降水域へ入る見込みです。" : props.lang === "es" ? "Este punto entrará en precipitación hacia __TIME__." : props.lang === "pt-BR" ? "Este ponto deve entrar em precipitação em __TIME__." : "This point is expected to enter precipitation by __TIME__.",
    rainClear: props.lang === "ja" ? "この地点に重なる降水域は6時間先まで見当たりません。" : props.lang === "es" ? "No se ve precipitación sobre este punto hasta 6 h." : props.lang === "pt-BR" ? "Não há precipitação sobre este ponto até 6 h." : "No precipitation is shown over this point through 6 h.",
    rainIndeterminate: props.lang === "ja" ? "この地点の雨雲判定を完了できませんでした。" : props.lang === "es" ? "No se pudo completar la comprobación de este punto." : props.lang === "pt-BR" ? "Não foi possível completar a verificação deste ponto." : "This point check could not be completed.",
    rainMapCenter: props.lang === "ja" ? "地図中心" : props.lang === "es" ? "centro del mapa" : props.lang === "pt-BR" ? "centro do mapa" : "map center",
    rainLocationFallback: props.lang === "ja" ? "現在地を使えないため、地図中心の雨雲を確認します。" : props.lang === "es" ? "No se pudo usar tu ubicación; se comprobará el centro del mapa." : props.lang === "pt-BR" ? "Não foi possível usar sua localização; vamos verificar o centro do mapa." : "Location is unavailable, so the map center will be checked.",
    rainForecastNotice: props.lang === "ja" ? "ZUKAN独自予報ではありません。強い雨・雷は公式情報も確認してください。" : props.lang === "es" ? "No es un pronóstico de ZUKAN. Revisa avisos oficiales si hay lluvia fuerte o tormentas." : props.lang === "pt-BR" ? "Não é previsão do ZUKAN. Consulte alertas oficiais em chuva forte ou trovoadas." : "This is not a ZUKAN forecast. Check official alerts for heavy rain or thunder.",
    rainAttribution: props.lang === "ja" ? "出典: 気象庁。ZUKAN独自予報ではありません。強い雨・雷は公式情報も確認してください。" : props.lang === "es" ? "Source: JMA. This is not a ZUKAN forecast. Check official alerts for storms." : props.lang === "pt-BR" ? "Fonte: JMA. Não é previsão do ZUKAN. Consulte alertas oficiais." : "Source: JMA. This is not a ZUKAN forecast. Check official alerts.",
    selfLabel: ambient.selfLabel,
    communityLabel: ambient.communityLabel,
    frontierLabel: ambient.frontierLabel,
    roleCardLabel: ambient.roleCardLabel,
    roleLabel: ambient.roleLabel,
    roleOptions: ambient.roles,
    actorLabel: actor.actorLabel,
    actorOptions: actor.actors,
    actorLensLabel: props.lang === "ja" ? "見る人" : props.lang === "es" ? "Lente elegido" : props.lang === "pt-BR" ? "Lente ativa" : "Active lens",
    actor_all: props.lang === "ja" ? "すべて" : props.lang === "es" ? "Todo" : props.lang === "pt-BR" ? "Tudo" : "All",
    actor_local_steward: props.lang === "ja" ? "地域で暮らす人" : props.lang === "es" ? "Cuidador local" : props.lang === "pt-BR" ? "Guardião local" : "Local steward",
    actor_traveler: props.lang === "ja" ? "訪れた人" : props.lang === "es" ? "Viajero" : props.lang === "pt-BR" ? "Viajante" : "Traveler",
    actor_casual: props.lang === "ja" ? "散歩中の人" : props.lang === "es" ? "Casual" : props.lang === "pt-BR" ? "Casual" : "Casual",
    actorHint_all: props.lang === "ja" ? "地図全体のまだ知らない場所を眺める" : props.lang === "es" ? "Mirar lugares por conocer en todo el mapa" : props.lang === "pt-BR" ? "Ver lugares a conhecer no mapa todo" : "Browse unknown places across the map",
    actorHint_local_steward: props.lang === "ja" ? "同じ場所を続けて見る" : props.lang === "es" ? "Mirar para volver y cuidar" : props.lang === "pt-BR" ? "Olhar para voltar e cuidar" : "Look as someone who will return",
    actorHint_traveler: props.lang === "ja" ? "一度の訪問で開ける空白を探す" : props.lang === "es" ? "Buscar huecos para una sola visita" : props.lang === "pt-BR" ? "Buscar vazios de visita única" : "Look for gaps to open in one visit",
    actorHint_casual: props.lang === "ja" ? "生活動線の近くにある余白を見る" : props.lang === "es" ? "Ver lugares pendientes cerca de la rutina" : props.lang === "pt-BR" ? "Ver lugares pendentes perto da rotina" : "Look for nearby everyday gaps",
    roleHintScan: props.lang === "ja" ? "気になる余白を見に行くなら周辺を散歩" : props.lang === "es" ? "Pasea alrededor para conocer huecos" : props.lang === "pt-BR" ? "Caminhe ao redor para conhecer vazios" : "Walk nearby to explore the blank spots",
    roleHintGuide: props.lang === "ja" ? "確度を上げるならその場で調べる" : props.lang === "es" ? "Consulta en el sitio para subir la certeza" : props.lang === "pt-BR" ? "Verifique no local para subir a certeza" : "Check on site to raise certainty",
    roleHintNote: props.lang === "ja" ? "比較可能にするなら記録に残す" : props.lang === "es" ? "Deja una nota para hacerlo comparable" : props.lang === "pt-BR" ? "Registre em nota para tornar comparável" : "Leave a note to make it revisitable",
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
    communityStrengthLabel: props.lang === "ja" ? "最近記録が増えた帯" : props.lang === "es" ? "Áreas reforzadas" : props.lang === "pt-BR" ? "Faixas fortalecidas" : "strengthened bands",
    communityProgressLabel: props.lang === "ja" ? "共同前進" : props.lang === "es" ? "Progreso colectivo" : props.lang === "pt-BR" ? "Progresso coletivo" : "collective progress",
    aggregateContributorLabel: props.lang === "ja" ? "集計された記録者" : props.lang === "es" ? "personas agregadas" : props.lang === "pt-BR" ? "pessoas agregadas" : "aggregated contributors",
    frontierBlankLabel: props.lang === "ja" ? "まだ知らない場所" : props.lang === "es" ? "lugares por conocer" : props.lang === "pt-BR" ? "lugares a conhecer" : "unknown places",
    frontierBuildingLabel: props.lang === "ja" ? "記録少なめ" : props.lang === "es" ? "en construcción" : props.lang === "pt-BR" ? "em construção" : "building",
    frontierRepeatableLabel: props.lang === "ja" ? "比較可能" : props.lang === "es" ? "comparables" : props.lang === "pt-BR" ? "comparáveis" : "repeatable",
    frontierMatureLabel: props.lang === "ja" ? "記録多め" : props.lang === "es" ? "maduras" : props.lang === "pt-BR" ? "maduras" : "mature",
    campaign_scan_blank: props.lang === "ja" ? "まだ知らない場所をひとつ見に行く" : props.lang === "es" ? "Visitar un lugar por conocer" : props.lang === "pt-BR" ? "Visitar um lugar a conhecer" : "Visit one unknown place",
    campaign_guide_building: props.lang === "ja" ? "記録が少ない場所を確かめる" : props.lang === "es" ? "Subir la certeza de zonas en crecimiento" : props.lang === "pt-BR" ? "Aumentar a certeza das zonas em crescimento" : "Raise certainty in building areas",
    campaign_note_repeatable: props.lang === "ja" ? "比較できる場所に記録を足す" : props.lang === "es" ? "Hacer más densa una zona repetible" : props.lang === "pt-BR" ? "Tornar mais espessa uma zona repetível" : "Thicken one repeatable area",
    campaign_mixed_frontier: props.lang === "ja" ? "気になる場所の見え方を少し増やす" : props.lang === "es" ? "Añadir más mirada a un lugar curioso" : props.lang === "pt-BR" ? "Adicionar mais olhar a um lugar curioso" : "Add another view to a curious place",
    priorityCueLabel: props.lang === "ja" ? "優先理由" : props.lang === "es" ? "prioridad" : props.lang === "pt-BR" ? "prioridade" : "priority",
    priority_steady_revisit: props.lang === "ja" ? "同じ場所で比べる" : props.lang === "es" ? "Engrosar con revisitas" : props.lang === "pt-BR" ? "Espessar com revisitas" : "Thicken by revisiting",
    priority_fresh_gap: props.lang === "ja" ? "新しい空白を開く" : props.lang === "es" ? "Abrir un hueco nuevo" : props.lang === "pt-BR" ? "Abrir um vazio novo" : "Open a fresh gap",
    priority_nearby_gap: props.lang === "ja" ? "近くにまだ知らない場所がある" : props.lang === "es" ? "Hay lugares cercanos por conocer" : props.lang === "pt-BR" ? "Há lugares perto para conhecer" : "There are unknown places nearby",
    remainingLabel: props.lang === "ja" ? "まだ知らない場所" : props.lang === "es" ? "lugares por conocer" : props.lang === "pt-BR" ? "lugares a conhecer" : "unknown places",
    aggregateModeNote: props.lang === "ja" ? "他ユーザー個別ではなく、地域の集計だけを表示中" : props.lang === "es" ? "Solo agregados del área, no personas concretas" : props.lang === "pt-BR" ? "Somente agregados da área, sem pessoas específicas" : "Area aggregate only, no individual people shown",
    impactPanelTitleMine: props.lang === "ja" ? "自分の記録から見えること" : props.lang === "es" ? "Cómo ayudan tus registros" : props.lang === "pt-BR" ? "Como seus registros ajudam" : "How your records help",
    impactPanelTitleGuest: props.lang === "ja" ? "この地域で見えてきたこと" : props.lang === "es" ? "Lo que se ve en esta zona" : props.lang === "pt-BR" ? "O que aparece nesta área" : "What appears in this area",
    impactPanelLoading: props.lang === "ja" ? "この範囲の記録を読み込み中…" : props.lang === "es" ? "Leyendo registros de esta zona…" : props.lang === "pt-BR" ? "Lendo registros desta área…" : "Loading records in this area…",
    impactRevisitStory: props.lang === "ja" ? "同じ場所を比べられるようになった" : props.lang === "es" ? "Hizo posible comparar el mismo lugar" : props.lang === "pt-BR" ? "Tornou possível comparar o mesmo lugar" : "Made the same place comparable",
    impactGuideStory: props.lang === "ja" ? "ガイド記録で季節の手がかりが増えた" : props.lang === "es" ? "La guía añadió pistas de temporada" : props.lang === "pt-BR" ? "O guia adicionou pistas da estação" : "Guide records added seasonal clues",
    impactScanStory: props.lang === "ja" ? "スキャンで未調査エリアが見えた" : props.lang === "es" ? "El escaneo mostró huecos por explorar" : props.lang === "pt-BR" ? "O escaneamento mostrou áreas a explorar" : "Scans revealed places still to explore",
    impactBlankStory: props.lang === "ja" ? "この場所の空白を埋める候補が見えた" : props.lang === "es" ? "Aparecieron huecos que se pueden completar" : props.lang === "pt-BR" ? "Apareceram vazios que podem ser preenchidos" : "Found gaps that can be filled",
    impactCommunityStory: props.lang === "ja" ? "最近、記録が増えた場所" : props.lang === "es" ? "Lugares que se hicieron más claros hace poco" : props.lang === "pt-BR" ? "Lugares que ficaram mais claros recentemente" : "Places that became clearer recently",
    impactPrivateNote: props.lang === "ja" ? "個人名ではなく、地域の集計だけで表示しています。" : props.lang === "es" ? "Se muestra solo agregado del área, no nombres." : props.lang === "pt-BR" ? "Mostramos apenas agregados da área, sem nomes." : "Only area aggregates are shown, not names.",
    searchArea: props.lang === "ja" ? "この範囲で再検索" : props.lang === "es" ? "Buscar en esta área" : props.lang === "pt-BR" ? "Buscar nesta área" : "Search this area",
    resultHeading: props.lang === "ja" ? "近くの発見" : props.lang === "es" ? "Hallazgos cercanos" : props.lang === "pt-BR" ? "Descobertas por perto" : "Nearby finds",
    resultCountLabel: props.lang === "ja" ? "件を表示中" : props.lang === "es" ? "resultados visibles" : props.lang === "pt-BR" ? "resultados visíveis" : "results visible",
    movedHint: props.lang === "ja" ? "地図を動かした。結果を更新するには押す。" : props.lang === "es" ? "Moviste el mapa. Pulsa para actualizar resultados." : props.lang === "pt-BR" ? "Você moveu o mapa. Toque para atualizar." : "Map moved. Press to refresh results.",
    areaActivityRallyTitle: copy.activityRallyTitle,
    areaActivityRallyBody: copy.activityRallyBody,
    areaActivityRallyMeta: copy.activityRallyMeta,
    areaActivityRallyLinkLabel: copy.activityRallyLinkLabel,
    selectHint: props.lang === "ja" ? "エリアか一覧を選ぶと、ここに写真と次の行動が出る。" : props.lang === "es" ? "Elige un área o una fila para ver foto y siguiente acción." : props.lang === "pt-BR" ? "Escolha uma área ou item para ver foto e próxima ação." : "Pick an area or row to see the photo and next action.",
    overlapChoiceTitle: props.lang === "ja" ? "どちらを開く？" : props.lang === "es" ? "¿Qué abrir?" : props.lang === "pt-BR" ? "O que abrir?" : "What should open?",
    overlapChoiceCell: props.lang === "ja" ? "四角を選ぶ" : props.lang === "es" ? "Elegir celda" : props.lang === "pt-BR" ? "Escolher célula" : "Select cell",
    overlapChoiceArea: props.lang === "ja" ? "エリアを開く" : props.lang === "es" ? "Abrir área" : props.lang === "pt-BR" ? "Abrir área" : "Open area",
    placeHint: props.lang === "ja" ? "地図を押すと、その地点の仮説と次の行動をここに出す。" : props.lang === "es" ? "Toca el mapa para ver la hipótesis del lugar y la siguiente acción." : props.lang === "pt-BR" ? "Toque no mapa para ver a hipótese do lugar e a próxima ação." : "Tap the map to see the place hypothesis and next action.",
    selectedCardLabel: props.lang === "ja" ? "詳細を見る" : props.lang === "es" ? "Ver detalle" : props.lang === "pt-BR" ? "Ver detalhes" : "Open detail",
    identifyLabel: props.lang === "ja" ? "名前を手伝う" : props.lang === "es" ? "Identificar" : props.lang === "pt-BR" ? "Identificar" : "Identify",
    selectedFieldLabel: props.lang === "ja" ? "この場所の見え方" : props.lang === "es" ? "Cómo se ve este lugar" : props.lang === "pt-BR" ? "Como este lugar aparece" : "How this place reads",
    selectedRoleLead: props.lang === "ja" ? "手がかり" : props.lang === "es" ? "Pistas" : props.lang === "pt-BR" ? "Pistas" : "Clues",
    selectionObservationLabel: props.lang === "ja" ? "選択中の観察" : props.lang === "es" ? "Observación seleccionada" : props.lang === "pt-BR" ? "Observação selecionada" : "Selected observation",
    selectionPlaceLabel: props.lang === "ja" ? "地図の手がかり" : props.lang === "es" ? "Pistas del mapa" : props.lang === "pt-BR" ? "Pistas do mapa" : "Map clues",
    awaitingIdLabel: props.lang === "ja" ? "名前はあとで確認" : props.lang === "es" ? "Sin identificar" : props.lang === "pt-BR" ? "Sem identificação" : "Needs name",
    aiCandidateLabel: props.lang === "ja" ? "AI候補" : props.lang === "es" ? "Candidato IA" : props.lang === "pt-BR" ? "Candidato de IA" : "AI candidate",
    recentDiscoveryFallback: props.lang === "ja" ? "最近の発見" : props.lang === "es" ? "Hallazgo reciente" : props.lang === "pt-BR" ? "Descoberta recente" : "Recent find",
    discoveryFallback: props.lang === "ja" ? "発見" : props.lang === "es" ? "Hallazgo" : props.lang === "pt-BR" ? "Descoberta" : "Find",
    resultGroupedByDate: props.lang === "ja" ? "日付ごと" : props.lang === "es" ? "por fecha" : props.lang === "pt-BR" ? "por data" : "by date",
    resultGroupUnknownDate: props.lang === "ja" ? "日付不明" : props.lang === "es" ? "Fecha desconocida" : props.lang === "pt-BR" ? "Data desconhecida" : "Unknown date",
    searchGroupCurrent: props.lang === "ja" ? "この範囲" : props.lang === "es" ? "En esta zona" : props.lang === "pt-BR" ? "Nesta área" : "In this area",
    searchGroupOther: props.lang === "ja" ? "他の地域" : props.lang === "es" ? "Otras zonas" : props.lang === "pt-BR" ? "Outras áreas" : "Other areas",
    searchRecentPrefix: props.lang === "ja" ? "直近" : props.lang === "es" ? "Último" : props.lang === "pt-BR" ? "Recente" : "Latest",
    openDiscoverySuffix: props.lang === "ja" ? "を開く" : props.lang === "es" ? ": abrir" : props.lang === "pt-BR" ? ": abrir" : " - open",
    walkableFindsAria: props.lang === "ja" ? "徒歩5分圏の発見" : props.lang === "es" ? "Hallazgos a cinco minutos a pie" : props.lang === "pt-BR" ? "Descobertas a cinco minutos a pé" : "Finds within a five-minute walk",
    walkableFindsTitle: props.lang === "ja" ? "近くの記録" : props.lang === "es" ? "Lo visto cerca" : props.lang === "pt-BR" ? "O que apareceu por perto" : "What appeared nearby",
    nearDistanceImmediate: props.lang === "ja" ? "すぐ近く" : props.lang === "es" ? "muy cerca" : props.lang === "pt-BR" ? "bem perto" : "nearby",
    nearDistanceApproxPrefix: props.lang === "ja" ? "約" : props.lang === "es" ? "aprox. " : props.lang === "pt-BR" ? "aprox. " : "about ",
    placeStoryTitle: props.lang === "ja" ? "この場所" : props.lang === "es" ? "Historia del lugar" : props.lang === "pt-BR" ? "História do local" : "Place story",
    placeStoryNow: props.lang === "ja" ? "今見られるもの" : props.lang === "es" ? "Lo que se puede ver ahora" : props.lang === "pt-BR" ? "O que dá para ver agora" : "What you may find now",
    placeStoryRecent: props.lang === "ja" ? "最近の発見" : props.lang === "es" ? "Hallazgos recientes" : props.lang === "pt-BR" ? "Descobertas recentes" : "Recent finds",
    placeStoryMissing: props.lang === "ja" ? "この場所で足りない記録" : props.lang === "es" ? "Registros que faltan aquí" : props.lang === "pt-BR" ? "Registros que faltam aqui" : "What is missing here",
    placeStoryActions: props.lang === "ja" ? "次にできること" : props.lang === "es" ? "Qué hacer después" : props.lang === "pt-BR" ? "O que fazer a seguir" : "What to do next",
    placeStoryNoTaxa: props.lang === "ja" ? "まだ代表種は少ない。まず写真で場所の様子を残せます。" : props.lang === "es" ? "Aún hay pocos taxones destacados. Una foto puede mostrar el lugar." : props.lang === "pt-BR" ? "Ainda há poucos grupos destacados. Uma foto pode mostrar o local." : "Few featured taxa yet. A photo can show the place.",
    placeStoryNeedSeason: props.lang === "ja" ? "季節をまたいだ記録があると、変化が見えやすくなります。" : props.lang === "es" ? "Más estaciones hacen más visible el cambio." : props.lang === "pt-BR" ? "Mais estações tornam a mudança mais visível." : "More seasons make change easier to see.",
    placeStoryNeedGuide: props.lang === "ja" ? "現地ガイドがある場所は、その場の手がかりを開けます。" : props.lang === "es" ? "Donde hay guía, puedes abrir pistas del lugar." : props.lang === "pt-BR" ? "Onde há guia, você pode abrir pistas do local." : "Where guides exist, you can open place clues.",
    guideStopEyebrow: props.lang === "ja" ? "現地ガイド" : props.lang === "es" ? "Guía en sitio" : props.lang === "pt-BR" ? "Guia no local" : "On-site guide",
    guideStopNearLabel: props.lang === "ja" ? "この場所で聞けます" : props.lang === "es" ? "Disponible aquí" : props.lang === "pt-BR" ? "Disponível aqui" : "Available here",
    guideStopFarLabel: props.lang === "ja" ? "近づくと聞けます" : props.lang === "es" ? "Acércate para escuchar" : props.lang === "pt-BR" ? "Aproxime-se para ouvir" : "Move closer to listen",
    guideStopLocate: props.lang === "ja" ? "現在地で確認" : props.lang === "es" ? "Comprobar ubicación" : props.lang === "pt-BR" ? "Verificar localização" : "Check location",
    guideStopPlay: props.lang === "ja" ? "この場所で聞く" : props.lang === "es" ? "Escuchar aquí" : props.lang === "pt-BR" ? "Ouvir aqui" : "Listen here",
    guideStopStop: props.lang === "ja" ? "停止" : props.lang === "es" ? "Detener" : props.lang === "pt-BR" ? "Parar" : "Stop",
    guideStopPermissionPrompt: props.lang === "ja" ? "現在地を許可すると、再生できる距離か確認します。" : props.lang === "es" ? "Permite la ubicación para saber si puedes reproducirlo." : props.lang === "pt-BR" ? "Permita a localização para saber se já pode reproduzir." : "Allow location to check whether this can play.",
    guideStopDistanceTemplate: props.lang === "ja" ? "近さを粗く確認して、再生できる状態だけ表示します。" : props.lang === "es" ? "La cercanía se comprueba de forma aproximada." : props.lang === "pt-BR" ? "A proximidade é verificada de forma aproximada." : "Nearby access is checked approximately.",
    guideStopFarTemplate: props.lang === "ja" ? "もう少し近づくと聞けます。" : props.lang === "es" ? "Acércate un poco más para escucharlo." : props.lang === "pt-BR" ? "Aproxime-se um pouco mais para ouvir." : "Move a little closer to listen.",
    guideStopVeryNearLabel: props.lang === "ja" ? "すぐ近くです" : props.lang === "es" ? "Muy cerca" : props.lang === "pt-BR" ? "Bem perto" : "Very nearby",
    guideSpotClusterLabel: props.lang === "ja" ? "この周辺のガイド" : props.lang === "es" ? "Guías cercanas" : props.lang === "pt-BR" ? "Guias próximos" : "Nearby guides",
    guideStopApprovalOwner: props.lang === "ja" ? "管理者承認済み" : props.lang === "es" ? "Aprobado por el gestor" : props.lang === "pt-BR" ? "Aprovado pelo gestor" : "Manager approved",
    guideStopUnsupported: props.lang === "ja" ? "このブラウザでは音声再生に対応していません。" : props.lang === "es" ? "Este navegador no admite reproducción por voz." : props.lang === "pt-BR" ? "Este navegador não oferece reprodução por voz." : "This browser does not support speech playback.",
    areaBadgeGuideLabel: props.lang === "ja" ? "ガイド" : props.lang === "es" ? "Guía" : props.lang === "pt-BR" ? "Guia" : "Guide",
    coverSourceAdmin: props.lang === "ja" ? "管理者が選んだ代表写真" : props.lang === "es" ? "Foto destacada por el gestor" : props.lang === "pt-BR" ? "Foto escolhida pelo gestor" : "Manager-picked cover photo",
    coverSourceCommunity: props.lang === "ja" ? "みんなが選んだ代表写真" : props.lang === "es" ? "Foto destacada por la comunidad" : props.lang === "pt-BR" ? "Foto escolhida pela comunidade" : "Community-picked cover photo",
    coverSourceAuto: props.lang === "ja" ? "最近の発見から自動選定" : props.lang === "es" ? "Elegida automáticamente de hallazgos recientes" : props.lang === "pt-BR" ? "Escolhida automaticamente de descobertas recentes" : "Auto-picked from recent finds",
    coverFallbackTitle: props.lang === "ja" ? "代表写真" : props.lang === "es" ? "Foto del lugar" : props.lang === "pt-BR" ? "Foto do local" : "Place photo",
    areaGalleryTitle: props.lang === "ja" ? "このエリアで観察されたもの" : props.lang === "es" ? "Observado en esta zona" : props.lang === "pt-BR" ? "Observado nesta área" : "Observed in this area",
    areaGalleryLead: props.lang === "ja" ? "写真と記録から、この場所の顔をざっと見る。" : props.lang === "es" ? "Ver rápidamente la cara del lugar desde fotos y registros." : props.lang === "pt-BR" ? "Ver rapidamente a cara do lugar por fotos e registros." : "Scan the place through photos and records.",
    areaGalleryEmpty: props.lang === "ja" ? "まだ記録がありません。近くの写真やガイドを探せます。" : props.lang === "es" ? "Aún no hay registros. Puedes buscar fotos o guías cercanas." : props.lang === "pt-BR" ? "Ainda não há registros. Você pode buscar fotos ou guias próximos." : "No records yet. Browse nearby photos or guides.",
    areaGalleryCountSuffix: props.lang === "ja" ? "件" : props.lang === "es" ? " registros" : props.lang === "pt-BR" ? " registros" : " records",
    areaSeasonNow: props.lang === "ja" ? "今の季節" : props.lang === "es" ? "Temporada actual" : props.lang === "pt-BR" ? "Estação atual" : "This season",
    areaTabRepresentative: props.lang === "ja" ? "代表種" : props.lang === "es" ? "Representativas" : props.lang === "pt-BR" ? "Representativas" : "Representative",
    areaTabRecent: props.lang === "ja" ? "最近増えた" : props.lang === "es" ? "Recientes" : props.lang === "pt-BR" ? "Recentes" : "Recent rise",
    areaTabMissing: props.lang === "ja" ? "未記録季節" : props.lang === "es" ? "Temporadas vacías" : props.lang === "pt-BR" ? "Estações vazias" : "Season gaps",
    areaMissingSeasonLead: props.lang === "ja" ? "まだ少ない季節があります。近くの写真や記録を探せます。" : props.lang === "es" ? "Faltan algunas estaciones. Puedes buscar fotos o registros cercanos." : props.lang === "pt-BR" ? "Faltam algumas estações. Você pode buscar fotos ou registros próximos." : "Some seasons are sparse. Browse nearby photos or records.",
    areaCompleteSeasonLead: props.lang === "ja" ? "四季の記録があります。同じ季節の違いも見られます。" : props.lang === "es" ? "Hay registros de las cuatro estaciones. También se ven diferencias dentro de una estación." : props.lang === "pt-BR" ? "Há registros das quatro estações. Também aparecem diferenças dentro da mesma estação." : "All seasons have records. Same-season differences can also show.",
    areaPublicPageLabel: props.lang === "ja" ? "エリア図鑑を見る" : props.lang === "es" ? "Ver álbum del área" : props.lang === "pt-BR" ? "Ver álbum da área" : "Open area album",
    areaEventCreateLabel: props.lang === "ja" ? "主催者の方へ" : props.lang === "es" ? "Para organizadores" : props.lang === "pt-BR" ? "Para organizadores" : "For organizers",
    areaBadgeEventLabel: props.lang === "ja" ? "主催者" : props.lang === "es" ? "Organizadores" : props.lang === "pt-BR" ? "Organizadores" : "Organizers",
    areaBadgeAlbumLabel: props.lang === "ja" ? "エリア図鑑" : props.lang === "es" ? "Álbum" : props.lang === "pt-BR" ? "Álbum" : "Area album",
    areaEventCreateHint: props.lang === "ja" ? "観察会や投稿ラリーを、地域の活動として扱う入口です。" : props.lang === "es" ? "Entrada para tratar salidas y rallies como actividades locales." : props.lang === "pt-BR" ? "Entrada para tratar eventos e rallies como atividades locais." : "A guide for handling events and posting rallies as local activities.",
    areaPositiveTitleMine: props.lang === "ja" ? "このエリアで見えてきたこと" : props.lang === "es" ? "Lo que se va viendo aquí" : props.lang === "pt-BR" ? "O que começou a aparecer aqui" : "What is coming into view here",
    areaPositiveTitleGuest: props.lang === "ja" ? "みんなの記録で見えてきたこと" : props.lang === "es" ? "Lo que los registros muestran" : props.lang === "pt-BR" ? "O que os registros mostram" : "What records are revealing",
    areaPositiveViewer: props.lang === "ja" ? "あなたの視点" : props.lang === "es" ? "Tu mirada" : props.lang === "pt-BR" ? "Seu olhar" : "Your perspective",
    areaPositiveViewerGuest: props.lang === "ja" ? "このエリアの視点" : props.lang === "es" ? "Miradas de esta zona" : props.lang === "pt-BR" ? "Olhares desta área" : "Area perspective",
    areaPositiveThanks: props.lang === "ja" ? "あなたの記録から" : props.lang === "es" ? "Gracias a tus registros" : props.lang === "pt-BR" ? "Graças aos seus registros" : "Because of your records",
    areaPositiveThanksGuest: props.lang === "ja" ? "みんなの記録から" : props.lang === "es" ? "Gracias a todos" : props.lang === "pt-BR" ? "Graças a todos" : "Because of everyone",
    areaPositiveCommunity: props.lang === "ja" ? "みんなの視点" : props.lang === "es" ? "Mirada colectiva" : props.lang === "pt-BR" ? "Olhar coletivo" : "Everyone's perspective",
    areaPositiveOverlap: props.lang === "ja" ? "重なると見えること" : props.lang === "es" ? "Lo que aparece al combinarse" : props.lang === "pt-BR" ? "O que aparece quando se junta" : "What overlap reveals",
    areaPositiveMineRecords: props.lang === "ja" ? "自分の記録を見る" : props.lang === "es" ? "Revisar mis registros" : props.lang === "pt-BR" ? "Rever meus registros" : "Review my records",
    areaPositiveCommunityRecords: props.lang === "ja" ? "みんなの記録を見る" : props.lang === "es" ? "Ver registros de todos" : props.lang === "pt-BR" ? "Ver registros de todos" : "Browse community records",
    areaPositiveEyebrow: props.lang === "ja" ? "記録の手応え" : props.lang === "es" ? "Eco de tus registros" : props.lang === "pt-BR" ? "Sinal dos registros" : "Record feedback",
    areaPositivePeopleSuffix: props.lang === "ja" ? "人" : props.lang === "es" ? " personas" : props.lang === "pt-BR" ? " pessoas" : " people",
    areaPositiveVisitSuffix: props.lang === "ja" ? "回" : props.lang === "es" ? " visitas" : props.lang === "pt-BR" ? " visitas" : " visits",
    placeActionRecord: props.lang === "ja" ? "この場所で記録" : props.lang === "es" ? "Registrar aquí" : props.lang === "pt-BR" ? "Registrar aqui" : "Record here",
    placeActionNearby: props.lang === "ja" ? "近くを探索" : props.lang === "es" ? "Explorar cerca" : props.lang === "pt-BR" ? "Explorar perto" : "Explore nearby",
    placeActionGuide: props.lang === "ja" ? "ガイドで探す" : props.lang === "es" ? "Buscar con guía" : props.lang === "pt-BR" ? "Buscar com guia" : "Explore with guide",
    placeActionScan: props.lang === "ja" ? "スキャンする" : props.lang === "es" ? "Escanear" : props.lang === "pt-BR" ? "Escanear" : "Scan here",
    placeActionFollow: props.lang === "ja" ? "この場所をフォロー" : props.lang === "es" ? "Seguir este lugar" : props.lang === "pt-BR" ? "Seguir este local" : "Follow this place",
    nearbyAreasStatusTemplate: props.lang === "ja" ? "現在地の近くで __COUNT__ 件のエリアを見つけられます" : props.lang === "es" ? "__COUNT__ áreas visibles cerca de tu ubicación" : props.lang === "pt-BR" ? "__COUNT__ áreas visíveis perto da sua localização" : "__COUNT__ discoverable areas near you",
    nearbyAreasNoneStatus: props.lang === "ja" ? "近くのエリアはまだ薄いです。少し広げると入口が見つかるかもしれません。" : props.lang === "es" ? "Todavía hay pocas áreas cerca. Amplía un poco para encontrar entradas." : props.lang === "pt-BR" ? "Ainda há poucas áreas perto. Amplie um pouco para encontrar entradas." : "Nearby areas are still thin. Widen the view to find entries.",
    nearbyAreaMarkerLabel: props.lang === "ja" ? "近くのエリア" : props.lang === "es" ? "Área cercana" : props.lang === "pt-BR" ? "Área próxima" : "Nearby area",
    nearbyAreaPublicLabel: props.lang === "ja" ? "一般公開" : props.lang === "es" ? "Acceso público" : props.lang === "pt-BR" ? "Acesso público" : "Public",
    nearbyAreaSchoolLabel: props.lang === "ja" ? "安全確認" : props.lang === "es" ? "Revisar seguridad" : props.lang === "pt-BR" ? "Verificar segurança" : "Check safety",
    nearbyAreaRestrictedLabel: props.lang === "ja" ? "要確認" : props.lang === "es" ? "Revisar" : props.lang === "pt-BR" ? "Verificar" : "Check",
    insightHeading: props.lang === "ja" ? "見えてきた範囲" : props.lang === "es" ? "Lo que ya se ve" : props.lang === "pt-BR" ? "O que já aparece" : "What is coming into view",
    insightSubhead: props.lang === "ja" ? "この表示範囲の発見の気配を眺める。" : props.lang === "es" ? "Mira las señales de esta ventana." : props.lang === "pt-BR" ? "Veja os sinais nesta janela." : "Browse the signs in this viewport.",
  })};
  ${MAP_EXPLORER_STATE_RUNTIME}
  ${MAP_PLACE_ATLAS_PROFILE_RUNTIME}
  var SEARCH_LANG = ${JSON.stringify(props.lang)};
  var YEAR_VALUES = [];
  try {
    YEAR_VALUES = JSON.parse((yearRangeEl && yearRangeEl.getAttribute('data-year-values')) || '[]');
  } catch (_) { YEAR_VALUES = []; }
  var OBSERVATION_HREF_TPL = ${JSON.stringify(observationHrefTpl)};
  var RECORD_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/record"), props.lang))};
  var NOTES_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/records?view=mine"), props.lang))};
  var COMMUNITY_RECORDS_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/records?view=public"), props.lang))};
  var LENS_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/lens"), props.lang))};
  var SCAN_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/map?tab=frontier"), props.lang))};
  var EVENTS_ORGANIZER_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/community/events"), props.lang))};
  var FIELDS_ALBUM_TPL = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/community/fields/__FIELD_ID__"), props.lang))};
  var LOGIN_HREF = ${JSON.stringify(appendLangToHref(withBasePath(props.basePath, "/login"), props.lang))};
  var UI_KPI_ENDPOINT = ${JSON.stringify(withBasePath(props.basePath, "/api/v1/ui-kpi/events"))};
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

  var SIMPLE_MID_LANDMARK_CLASSES = ['school', 'kindergarten', 'college', 'university', 'park', 'garden', 'playground'];
  var SIMPLE_HIGH_LANDMARK_CLASSES = ['railway', 'town_hall', 'library', 'hospital'];
  var SIMPLE_COMMERCIAL_LANDMARK_CLASSES = ['shop', 'grocery', 'cafe', 'restaurant'];
  var SIMPLE_LOCALITY_CLASSES = ['town', 'village', 'hamlet', 'suburb', 'quarter', 'neighbourhood'];

  var BASEMAPS = {
    standard: {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      sources: {
        openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: 'OpenFreeMap / OpenStreetMap contributors' },
      },
      layers: [
        { id: 'simple-bg', type: 'background', paint: { 'background-color': '#edf4ef' } },
        {
          id: 'simple-water',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'water',
          paint: { 'fill-color': '#b8dce7', 'fill-opacity': 0.86 },
        },
        {
          id: 'simple-wood',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'landcover',
          filter: ['==', ['get', 'class'], 'wood'],
          paint: { 'fill-color': '#c7dfbf', 'fill-opacity': 0.72 },
        },
        {
          id: 'simple-grass',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'landcover',
          filter: ['match', ['get', 'class'], ['grass', 'scrub'], true, false],
          paint: { 'fill-color': '#d4e8c9', 'fill-opacity': 0.62 },
        },
        {
          id: 'simple-wetland',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'landcover',
          filter: ['==', ['get', 'class'], 'wetland'],
          paint: { 'fill-color': '#c5ded3', 'fill-opacity': 0.62 },
        },
        {
          id: 'simple-landuse-soft',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'landuse',
          minzoom: 11,
          filter: ['match', ['get', 'class'], ['residential', 'commercial', 'industrial', 'school', 'hospital'], true, false],
          paint: {
            'fill-color': ['match', ['get', 'class'], 'school', '#dfe7c7', 'hospital', '#ead7dc', 'commercial', '#ece1cd', 'industrial', '#e4d8dc', '#e8e5d7'],
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.12, 15, 0.2, 17, 0.26],
          },
        },
        {
          id: 'simple-school-landuse-outline',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'landuse',
          minzoom: 13,
          filter: ['match', ['get', 'class'], ['school', 'kindergarten', 'college', 'university'], true, false],
          paint: {
            'line-color': '#c4a248',
            'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 16, 1.1, 18, 1.8],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.18, 16, 0.36, 18, 0.5],
          },
        },
        {
          id: 'simple-park',
          type: 'fill',
          source: 'openmaptiles',
          'source-layer': 'park',
          paint: { 'fill-color': '#c9e4bf', 'fill-opacity': 0.72 },
        },
        {
          id: 'simple-park-outline',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'park',
          minzoom: 12,
          paint: {
            'line-color': '#80b878',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 15, 0.85, 18, 1.35],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 15, 0.38, 18, 0.52],
          },
        },
        {
          id: 'simple-waterway',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'waterway',
          minzoom: 10,
          filter: ['match', ['get', 'class'], ['river', 'canal'], true, false],
          paint: {
            'line-color': '#9ed3df',
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.45, 14, 1.0, 17, 2.0],
            'line-opacity': 0.48,
          },
        },
        {
          id: 'simple-road-major',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false],
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 2.1, 14, 4.8],
            'line-opacity': 0.88,
          },
        },
        {
          id: 'simple-road-local-casing',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 13.2,
          filter: ['match', ['get', 'class'], ['tertiary', 'minor', 'service', 'track'], true, false],
          paint: {
            'line-color': '#cfd8d2',
            'line-width': ['interpolate', ['linear'], ['zoom'], 13.2, 0.75, 15, 1.45, 17.5, 2.9],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0.3, 15.5, 0.44, 17.5, 0.55],
          },
        },
        {
          id: 'simple-road-local',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 13.2,
          filter: ['match', ['get', 'class'], ['tertiary', 'minor', 'service', 'track'], true, false],
          paint: {
            'line-color': '#ffffff',
            'line-width': ['interpolate', ['linear'], ['zoom'], 13.2, 0.55, 15, 1.05, 17.5, 2.2],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0.42, 15.5, 0.62, 17.5, 0.78],
          },
        },
        {
          id: 'simple-place-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'place',
          minzoom: 5,
          maxzoom: 12.8,
          filter: ['has', 'name'],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 10, 13, 14, 15, 17, 16],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': '#51666a',
            'text-halo-color': 'rgba(237,244,239,0.92)',
            'text-halo-width': 1.4,
          },
        },
        {
          id: 'simple-locality-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'place',
          minzoom: 12.4,
          maxzoom: 18,
          filter: ['all', ['has', 'name'], ['match', ['get', 'class'], SIMPLE_LOCALITY_CLASSES, true, false]],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 12.4, 10.2, 15, 11.2, 17.5, 12.2],
            'text-max-width': 7,
            'text-padding': 10,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': '#566a6b',
            'text-halo-color': 'rgba(237,244,239,0.9)',
            'text-halo-width': 1.15,
            'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.4, 0.72, 14.5, 0.9],
          },
        },
        {
          id: 'simple-landmark-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 15.9,
          filter: ['match', ['get', 'class'], SIMPLE_MID_LANDMARK_CLASSES, true, false],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 15.9, 9.6, 17.2, 11.2],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': ['match', ['get', 'class'], ['school', 'kindergarten', 'college', 'university'], '#687d8d', '#5d805c'],
            'text-halo-color': 'rgba(237,244,239,0.9)',
            'text-halo-width': 1.15,
          },
        },
        {
          id: 'simple-civic-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 17,
          filter: ['match', ['get', 'class'], SIMPLE_HIGH_LANDMARK_CLASSES, true, false],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 17, 9.8, 18, 11.2],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': ['match', ['get', 'class'], 'railway', '#71758c', 'hospital', '#8f6370', '#647f8f'],
            'text-halo-color': 'rgba(237,244,239,0.9)',
            'text-halo-width': 1.15,
          },
        },
        {
          id: 'simple-commercial-label',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'poi',
          minzoom: 15.8,
          filter: ['match', ['get', 'class'], SIMPLE_COMMERCIAL_LANDMARK_CLASSES, true, false],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 15.8, 9.6, 17, 11.2],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': '#746d58',
            'text-halo-color': 'rgba(237,244,239,0.88)',
            'text-halo-width': 1.05,
          },
        },
        {
          id: 'simple-park-name',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'park',
          minzoom: 13,
          filter: ['has', 'name'],
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10.5, 16, 13],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': '#5b7d5b',
            'text-halo-color': 'rgba(237,244,239,0.88)',
            'text-halo-width': 1.1,
          },
        },
        {
          id: 'simple-water-name',
          type: 'symbol',
          source: 'openmaptiles',
          'source-layer': 'water_name',
          minzoom: 10,
          layout: {
            'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 12],
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': '#4f91a5',
            'text-halo-color': 'rgba(237,244,239,0.88)',
            'text-halo-width': 1.1,
          },
        },
      ],
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
    'nature_symbiosis_site', 'tsunag', 'school', 'osm_named_area',
    'protected_area', 'oecm', 'osm_park', 'user_defined',
  ];
  var VIEWPORT_RECORD_LIMIT = 600;
  var CELL_RECORD_LIMIT = 1500;
  var DEFAULT_MAP_CENTER = [138.383, 34.975];
  var DEFAULT_MAP_ZOOM = 13.6;
  var STARTUP_LOCATION_ZOOM = 15.0;
  var SHIZUOKA_PREF_BBOX = [137.47, 34.57, 139.16, 35.65];
  var LAST_LOCATION_STORAGE_KEY = 'ikimon-map-last-startup-location-v1';
  var LAST_LOCATION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

  var state = {
    tab: 'places',
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
    maplibreRuntime: null,
    features: [],
    records: [],
    myObservations: [],
    myObservationClusters: [],
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
    guideSpotsAbort: null,
    areaPolygonsDebounce: null,
    namedAreaDiscoveryUntil: 0,
    pendingPlaceSearchRef: null,
    viewportRefreshTimer: null,
    waterwayAbort: null,
    waterwayDebounce: null,
    waterwaySearchKey: '',
    recordsLoadWatchdog: null,
    recordsLoadWatchdogSeq: 0,
    recordsHardSettleWatchdog: null,
    recordsRecoveryKey: '',
    recordsRecoveryAttempts: 0,
    startPanelRouteKey: '',
    startPanelRouteTimer: null,
    initialDataLoadTimer: null,
    initialDataLoadAttempts: 0,
    initialDataLoaded: false,
    areaPolygonFeatures: [],
    areaPolygonsLoaded: false,
    discoveryPreviewMarkers: [],
    ownObservationMarkers: [],
    areaBadgeMarkers: [],
    nearbyAreaMarkers: [],
    walkMapCandidateMarkers: [],
    nearbyAreaOrigin: null,
    nearbyAreaLocateMovePending: false,
    startupLocationRequestActive: false,
    startupLocationUserMoved: false,
    suppressViewportSearchUntil: 0,
    suppressNextViewportSearch: false,
    guideSpotMarkers: [],
    rainEnabled: false,
    rainTimes: [],
    rainSelectedIndex: 0,
    rainLoading: false,
    rainTileTemplate: '',
    overlapChoicePopup: null,
    _cellsRequestSeq: 0,
    _cellsAppliedSeq: 0,
    _recordsRequestSeq: 0,
    _recordsAppliedSeq: 0,
    _restoredCenter: null,
    _restoredZoom: null,
    _restoredCellId: null,
    _fittedOnce: false,
    _ownObservationFirstViewApplied: false,
    _meMarker: null,
  };
  var areaGuideWatchId = null;
  var activeGuideStopContext = null;
  var activeGuideSpeech = null;
  var activeGuideAudio = null;
  var rainTimesPromise = null;
  var SIDE_RAIL_SIGNAL_MIN_RECORDS = 6;
  var SIDE_RAIL_SIGNAL_MAX_ZOOM = 14;
  var RECORDS_LOAD_WATCHDOG_MS = 8000;
  var RECORDS_HARD_SETTLE_MS = 20000;
  var PURPOSE_HINT_STORAGE_KEY = 'ikimon-map-purpose-hint-v1';
  var purposeHintDismissed = false;
  try { purposeHintDismissed = window.localStorage.getItem(PURPOSE_HINT_STORAGE_KEY) === '1'; } catch (_) {}

  function isBottomSheetOpen() {
    return !!(sheetEl && sheetEl.classList.contains('is-open') && sheetEl.getAttribute('aria-hidden') !== 'true');
  }
  function setPurposeHintVisible(visible) {
    if (!purposeHintEl) return;
    purposeHintEl.hidden = !visible;
    purposeHintEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  function canShowPurposeHint() {
    return false;
  }
  function refreshPurposeHint() {
    setPurposeHintVisible(false);
  }
  function dismissPurposeHint() {
    purposeHintDismissed = true;
    try { window.localStorage.setItem(PURPOSE_HINT_STORAGE_KEY, '1'); } catch (_) {}
    setPurposeHintVisible(false);
  }
  function dismissStartPanel() {
    if (!startPanelEl) return;
    startPanelEl.hidden = true;
    startPanelEl.setAttribute('aria-hidden', 'true');
  }
  function setStartPanelCollapsed(collapsed) {
    if (!startPanelEl) return;
    startPanelEl.classList.toggle('is-collapsed', !!collapsed);
    startPanelEl.setAttribute('aria-hidden', 'false');
    if (startPanelCloseEl) {
      startPanelCloseEl.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      var startPanelSymbolEl = startPanelCloseEl.querySelector('.me-start-panel-symbol');
      if (startPanelSymbolEl) {
        startPanelSymbolEl.textContent = collapsed ? '⌄' : '×';
      } else {
        startPanelCloseEl.textContent = collapsed ? '⌄' : '×';
      }
    }
  }
  function closeFilterDrawer() {
    if (!filterDrawerEl) return;
    filterDrawerEl.removeAttribute('open');
    if (mapShellEl) mapShellEl.classList.remove('me-filter-open');
  }

  function mapCenterIsInShizuoka() {
    if (!state.map) return true;
    var center = state.map.getCenter();
    var lng = Number(center && center.lng);
    var lat = Number(center && center.lat);
    return isFinite(lng) && isFinite(lat)
      && lng >= SHIZUOKA_PREF_BBOX[0] && lng <= SHIZUOKA_PREF_BBOX[2]
      && lat >= SHIZUOKA_PREF_BBOX[1] && lat <= SHIZUOKA_PREF_BBOX[3];
  }

  function refreshStartPanelRoutes() {
    if (!startPanelRoutesEl) return;
    var inShizuoka = mapCenterIsInShizuoka();
    var heading = inShizuoka
      ? (startPanelRoutesEl.getAttribute('data-shizuoka-heading') || '')
      : (startPanelRoutesEl.getAttribute('data-any-heading') || '');
    if (startPanelRoutesHeadingEl && heading) startPanelRoutesHeadingEl.textContent = heading;
    startPanelRoutesEl.querySelectorAll('[data-route-region]').forEach(function (link) {
      var region = link.getAttribute('data-route-region') || 'all';
      link.hidden = region !== 'all' && region !== 'candidate' && !(region === 'shizuoka' && inShizuoka);
    });
  }

  function walkMapHrefForId(walkMapId) {
    var prefix = startPanelRoutesEl ? (startPanelRoutesEl.getAttribute('data-walk-map-prefix') || '/walk-maps/') : '/walk-maps/';
    return prefix + encodeURIComponent(String(walkMapId || ''));
  }

  function clearWalkMapCandidateMarkers() {
    (state.walkMapCandidateMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.walkMapCandidateMarkers = [];
  }

  function walkMapCandidateAreaHint(summary) {
    var hint = summary && summary.areaHint ? summary.areaHint : null;
    var lat = Number(hint && hint.lat);
    var lng = Number(hint && hint.lng);
    if (!hint || !isFinite(lat) || !isFinite(lng)) return null;
    if (hint.precision !== 'area_hint') return null;
    return {
      lat: lat,
      lng: lng,
      label: String(hint.label || '').trim()
    };
  }

  function refreshWalkMapCandidateMarkers(summaries) {
    clearWalkMapCandidateMarkers();
    if (!state.map || !window.maplibregl || !Array.isArray(summaries) || state.tab !== 'places') return;
    var maxMarkers = 2;
    summaries.slice(0, maxMarkers).forEach(function (summary, index) {
      var id = String(summary && summary.walkMapId || '');
      var title = String(summary && summary.title || '').trim();
      var hint = walkMapCandidateAreaHint(summary);
      if (!id || !title || !hint) return;
      var shortTitle = (hint.label || title)
        .replace(/サンプル/g, '')
        .replace(/周辺周辺/g, '周辺')
        .trim() || title;
      var el = document.createElement('a');
      el.className = 'me-walk-map-marker';
      el.href = walkMapHrefForId(id);
      el.setAttribute('data-testid', 'map-walk-map-candidate-marker');
      el.setAttribute('data-kpi-action', 'map:walk_map_candidate_marker');
      el.setAttribute('aria-label', shortTitle + ' 散策候補');
      el.innerHTML = '<span>散策</span><strong>' + escapeHtml(shortTitle.slice(0, 14)) + '</strong>';
      el.addEventListener('click', function () {
        sendMapKpi('map_walk_map_candidate_click', 'map:walk_map_candidate_marker', {
          walkMapId: id,
          label: hint.label || '',
        });
      });
      var marker = new window.maplibregl.Marker({ element: el, anchor: 'center', offset: [index * 12, 0] })
        .setLngLat([hint.lng, hint.lat])
        .addTo(state.map);
      state.walkMapCandidateMarkers.push(marker);
    });
  }

  function renderStartPanelRouteCandidates(summaries) {
    if (!startPanelRoutesEl || !Array.isArray(summaries)) return false;
    var nav = startPanelRoutesEl.querySelector('nav');
    if (!nav) return false;
    refreshWalkMapCandidateMarkers(summaries);
    if (!summaries.length) {
      if (startPanelRoutesStaticHtml) nav.innerHTML = startPanelRoutesStaticHtml;
      refreshStartPanelRoutes();
      return false;
    }
    var max = Math.min(3, summaries.length);
    var html = '';
    for (var i = 0; i < max; i++) {
      var summary = summaries[i] || {};
      var id = String(summary.walkMapId || '');
      var title = String(summary.title || '').trim();
      if (!id || !title) continue;
      var shortTitle = title.replace(/サンプル/g, '').replace(/周辺を歩く/g, '').replace(/を歩く/g, '').trim() || title;
      html += '<a href="' + escapeAttr(walkMapHrefForId(id)) + '" data-kpi-action="map:start_panel:route_candidate" data-route-region="candidate">' + escapeHtml(shortTitle.slice(0, 14)) + '</a>';
    }
    var listHref = (startPanelRoutesEl ? (startPanelRoutesEl.getAttribute('data-walk-map-prefix') || '/walk-maps/') : '/walk-maps/').replace(/\\/$/, '');
    var listLabel = SEARCH_LANG === 'ja' ? '一覧' : 'All';
    html += '<a href="' + escapeAttr(listHref) + '" data-kpi-action="map:start_panel:route_list" data-route-region="all">' + listLabel + '</a>';
    if (!html) return false;
    nav.innerHTML = html;
    if (startPanelRoutesHeadingEl) startPanelRoutesHeadingEl.textContent = startPanelRoutesEl.getAttribute('data-any-heading') || '散策候補';
    return true;
  }

  function scheduleStartPanelRouteCandidates(delayMs) {
    if (!apiWalkMapCandidates || !state.map) return;
    if (state.startPanelRouteTimer) clearTimeout(state.startPanelRouteTimer);
    state.startPanelRouteTimer = setTimeout(function () {
      state.startPanelRouteTimer = null;
      try {
        var center = state.map.getCenter();
        var lng = Number(center && center.lng);
        var lat = Number(center && center.lat);
        if (!isFinite(lng) || !isFinite(lat)) return;
        var key = lat.toFixed(3) + ',' + lng.toFixed(3);
        if (state.startPanelRouteKey === key) return;
        state.startPanelRouteKey = key;
        var endpoint = apiWalkMapCandidates + '?lat=' + encodeURIComponent(String(lat)) + '&lng=' + encodeURIComponent(String(lng)) + '&limit=3';
        fetch(endpoint, { credentials: 'same-origin', headers: { accept: 'application/json' } })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (json) {
            if (!json || !Array.isArray(json.summaries)) return;
            renderStartPanelRouteCandidates(json.summaries);
          })
          .catch(function () {});
      } catch (_) {}
    }, Math.max(0, delayMs || 0));
  }

  function sendMapKpi(eventName, actionKey, metadata) {
    try {
      if (!UI_KPI_ENDPOINT) return;
      var payload = {
        eventName: eventName,
        pagePath: window.location.pathname + window.location.search,
        routeKey: '/map',
        actionKey: String(actionKey || 'map:interaction').slice(0, 128),
        metadata: Object.assign({
          tab: state.tab || '',
          zoom: state.map && typeof state.map.getZoom === 'function' ? Number(state.map.getZoom().toFixed(2)) : null,
          lang: document.documentElement.lang || SEARCH_LANG || 'ja',
          ts: new Date().toISOString()
        }, metadata || {})
      };
      fetch(UI_KPI_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin'
      }).catch(function () {});
      if (window.ikimonExternalAnalytics && typeof window.ikimonExternalAnalytics.track === 'function') {
        window.ikimonExternalAnalytics.track(eventName, payload);
      }
    } catch (_) {}
  }

  document.addEventListener('ikimon:place-atlas-image-error', function (event) {
    var detail = event && event.detail ? event.detail : {};
    sendMapKpi('place_image_error', 'map:place_atlas:image_error', {
      src: String(detail.src || '').slice(0, 256)
    });
  });
  document.addEventListener('ikimon:place-atlas-theme-open', function (event) {
    var detail = event && event.detail ? event.detail : {};
    if (detail.open === false) return;
    sendMapKpi('place_theme_open', 'map:place_atlas:theme:' + String(detail.theme || 'unknown'), {
      theme: String(detail.theme || 'unknown').slice(0, 80)
    });
  });

  function trackAreaDetailOpen(kind, props) {
    var p = props || {};
    sendMapKpi('map_area_detail_open', 'map:area_detail_open:' + String(kind || 'area'), {
      areaKind: String(kind || 'area'),
      fieldId: String(p.field_id || p.fieldId || '').slice(0, 128),
      source: String(p.source || p.sourceLabel || '').slice(0, 80),
      verificationLevel: String(p.verification_level || p.verificationLevel || '').slice(0, 80),
      transient: kind === 'transient_area'
    });
  }

  function sideRailSignalCanUseRecords(records) {
    var count = Array.isArray(records) ? records.length : 0;
    if (count < SIDE_RAIL_SIGNAL_MIN_RECORDS) return false;
    if (!state.map || typeof state.map.getZoom !== 'function') return false;
    var zoom = Number(state.map.getZoom());
    return zoom <= SIDE_RAIL_SIGNAL_MAX_ZOOM;
  }

  function updateSideRailSignal(records) {
    if (!sideRailCountEl) return;
    var active = sideRailSignalCanUseRecords(records);
    sideRailCountEl.classList.toggle('is-active', active);
    sideRailCountEl.setAttribute('data-signal', active ? 'broad-activity' : 'neutral');
  }

  function setStatus(text) { if (statusEl) statusEl.textContent = text || ''; }
  function setStatusMeta(meta) { if (statusEl) statusEl.title = meta || ''; }
  function rainStatusWithNotice(text) {
    var out = String(text || '');
    var notice = String(COPY.rainForecastNotice || '');
    if (!notice) return out;
    if (!out) return notice;
    return out.indexOf(notice) >= 0 ? out : out + ' ' + notice;
  }
  function setRainStatus(text) {
    var value = rainStatusWithNotice(text);
    if (rainStatusEl) rainStatusEl.textContent = value;
  }
  function syncRainModeClass() {
    try { document.documentElement.classList.toggle('me-rain-mode', state.tab === 'rain'); } catch (_) {}
  }
  function syncRainUi() {
    syncRainModeClass();
    var sheetOpen = isBottomSheetOpen();
    try { document.documentElement.classList.toggle('me-sheet-open', Boolean(sheetOpen)); } catch (_) {}
    if (rainCardEl) {
      rainCardEl.hidden = state.tab !== 'rain';
      rainCardEl.setAttribute('data-enabled', state.rainEnabled ? '1' : '0');
      rainCardEl.setAttribute('data-sheet-open', sheetOpen ? '1' : '0');
    }
    if (rainToggleEl) rainToggleEl.setAttribute('aria-pressed', state.rainEnabled ? 'true' : 'false');
    refreshPurposeHint();
  }
  function enableRainLayer() {
    state.rainEnabled = true;
    syncRainUi();
    return loadRainTimes().then(updateRainLayer);
  }
  function disableRainLayer() {
    state.rainEnabled = false;
    syncRainUi();
    removeRainLayer();
  }
  function rainTimeLabel(offsetMinutes) {
    var n = Number(offsetMinutes || 0);
    if (n >= 60 && n % 60 === 0) return String(COPY.rainHour || '+__HOUR__ h').replace('__HOUR__', String(Math.round(n / 60)));
    return n <= 0 ? COPY.rainNow : String(COPY.rainMinute || '+__MIN__ min').replace('__MIN__', String(n));
  }
  function selectedRainTime() {
    if (!Array.isArray(state.rainTimes) || !state.rainTimes.length) return null;
    return state.rainTimes[Math.max(0, Math.min(state.rainSelectedIndex || 0, state.rainTimes.length - 1))] || null;
  }
  function renderRainTimeline() {
    if (!rainTimelineEl) return;
    if (!state.rainTimes.length) {
      rainTimelineEl.innerHTML = '';
      return;
    }
    rainTimelineEl.innerHTML = state.rainTimes.map(function (entry, index) {
      var active = index === state.rainSelectedIndex;
      return '<button type="button" class="me-rain-time' + (active ? ' is-active' : '') + '" data-rain-time-index="' + index + '" aria-pressed="' + (active ? 'true' : 'false') + '">' + escapeHtml(rainTimeLabel(entry.offsetMinutes)) + '</button>';
    }).join('');
    rainTimelineEl.querySelectorAll('[data-rain-time-index]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.rainSelectedIndex = Number(btn.getAttribute('data-rain-time-index') || '0') || 0;
        renderRainTimeline();
        updateRainLayer();
      });
    });
  }
  var JMA_RAIN_TILE_MAX_ZOOM = 10;
  function rainTileUrl(entry, z, x, y) {
    var tpl = state.rainTileTemplate || '/api/v1/weather/jma-nowcast/tile?product={product}&member={member}&basetime={basetime}&validtime={validtime}&z={z}&x={x}&y={y}';
    return tpl
      .replace('{product}', encodeURIComponent(entry.product || 'nowcast'))
      .replace('{member}', encodeURIComponent(entry.member || 'none'))
      .replace('{basetime}', encodeURIComponent(entry.basetime || ''))
      .replace('{validtime}', encodeURIComponent(entry.validtime || ''))
      .replace('{z}', String(z))
      .replace('{x}', String(x))
      .replace('{y}', String(y));
  }
  function removeRainLayer() {
    if (!state.map) return;
    try {
      if (state.map.getLayer('jma-rain-nowcast-layer')) state.map.removeLayer('jma-rain-nowcast-layer');
      if (state.map.getSource('jma-rain-nowcast')) state.map.removeSource('jma-rain-nowcast');
    } catch (e) {}
  }
  function updateRainLayer() {
    if (!state.map) return;
    removeRainLayer();
    if (!state.rainEnabled || state.tab !== 'rain') return;
    var entry = selectedRainTime();
    if (!entry) return;
    try {
      state.map.addSource('jma-rain-nowcast', {
        type: 'raster',
        tiles: [rainTileUrl(entry, '{z}', '{x}', '{y}')],
        tileSize: 256,
        minzoom: 0,
        maxzoom: JMA_RAIN_TILE_MAX_ZOOM,
        attribution: 'JMA High-resolution Precipitation Nowcast'
      });
      state.map.addLayer({
        id: 'jma-rain-nowcast-layer',
        type: 'raster',
        source: 'jma-rain-nowcast',
        paint: {
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 0.62, 14, 0.68, 18, 0.74],
          'raster-resampling': 'nearest',
          'raster-fade-duration': 0
        }
      });
      setRainStatus(COPY.rainAttribution);
    } catch (err) {
      console.warn('rain layer add failed', err);
      setRainStatus(COPY.rainUnavailable);
    }
  }
  function loadRainTimes() {
    if (!apiJmaNowcastTimes) return Promise.resolve(state.rainTimes);
    if (state.rainLoading && rainTimesPromise) return rainTimesPromise;
    state.rainLoading = true;
    setRainStatus(COPY.rainLoading);
    rainTimesPromise = fetch(apiJmaNowcastTimes, { credentials: 'same-origin', headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('rain_times_failed');
        return res.json();
      })
      .then(function (json) {
        state.rainTimes = Array.isArray(json && json.times) ? json.times : [];
        state.rainTileTemplate = String(json && json.tileUrlTemplate || state.rainTileTemplate || '');
        state.rainSelectedIndex = Math.max(0, Math.min(state.rainSelectedIndex || 0, state.rainTimes.length - 1));
        renderRainTimeline();
        if (state.rainEnabled) updateRainLayer();
        setRainStatus(COPY.rainAttribution);
        return state.rainTimes;
      })
      .catch(function () {
        state.rainTimes = [];
        renderRainTimeline();
        setRainStatus(COPY.rainUnavailable);
        return [];
      })
      .finally(function () {
        state.rainLoading = false;
        rainTimesPromise = null;
      });
    return rainTimesPromise;
  }
  function lngLatToTile(lng, lat, z) {
    var latRad = lat * Math.PI / 180;
    var n = Math.pow(2, z);
    var xFloat = (lng + 180) / 360 * n;
    var yFloat = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return {
      x: Math.floor(xFloat),
      y: Math.floor(yFloat),
      px: Math.floor((xFloat - Math.floor(xFloat)) * 256),
      py: Math.floor((yFloat - Math.floor(yFloat)) * 256)
    };
  }
  function imageHasRainAt(url, px, py) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          var ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          for (var dy = -2; dy <= 2; dy++) {
            for (var dx = -2; dx <= 2; dx++) {
              var sx = Math.max(0, Math.min(255, px + dx));
              var sy = Math.max(0, Math.min(255, py + dy));
              var data = ctx.getImageData(sx, sy, 1, 1).data;
              if (data[3] > 20 && (data[0] + data[1] + data[2]) > 20) {
                resolve(true);
                return;
              }
            }
          }
          resolve(false);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = function () { resolve(null); };
      img.decoding = 'async';
      img.src = url;
    });
  }
  function checkRainAt(lng, lat) {
    var z = 10;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    loadRainTimes().then(function () {
      if (!state.rainTimes.length) {
        setRainStatus(COPY.rainUnavailable);
        return;
      }
      setRainStatus(COPY.rainCheckLoading);
      var tile = lngLatToTile(lng, lat, z);
      var sequence = state.rainTimes.slice().sort(function (a, b) {
        return Number(a.offsetMinutes || 0) - Number(b.offsetMinutes || 0);
      });
      var checkState = { incomplete: false };
      var chain = Promise.resolve(null);
      sequence.forEach(function (entry) {
        chain = chain.then(function (found) {
          if (found) return found;
          return imageHasRainAt(rainTileUrl(entry, z, tile.x, tile.y), tile.px, tile.py)
            .then(function (hasRain) {
              if (hasRain === null) checkState.incomplete = true;
              return hasRain === true ? entry : null;
            });
        });
      });
      chain.then(function (found) {
        if (!found) {
          setRainStatus(checkState.incomplete ? COPY.rainIndeterminate : COPY.rainClear);
          return;
        }
        var offset = Number(found.offsetMinutes || 0);
        if (offset <= 0) setRainStatus(COPY.rainAtNow);
        else setRainStatus(String(COPY.rainWithin).replace('__TIME__', rainTimeLabel(offset)));
      });
    });
  }
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
  function areaSourcesQueryValueForMap() {
    var sources = normalizeAreaSources(state.areaSources);
    var zoom = state.map && typeof state.map.getZoom === 'function' ? Number(state.map.getZoom()) : 0;
    if (
      Number(state.namedAreaDiscoveryUntil || 0) > Date.now() &&
      zoom >= 12.5 &&
      sources.indexOf('osm_named_area') < 0
    ) {
      sources.push('osm_named_area');
    }
    if (state.tab === 'heatmap' && sources.length && sources.indexOf('osm_park') < 0) {
      sources.push('osm_park');
    }
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
    return [recordDisplayName(record, '')]
      .filter(Boolean)
      .map(function (value) { return String(value); });
  }
  function localizedDisplayName(value, fallback) {
    var text = String(value || '').trim();
    if (!text || /^(同定待ち|名前待ち|名前を確認中|名前確認中|名前はあとで確認|確認中)$/i.test(text) || /awaiting id|unknown|unidentified|unresolved/i.test(text)) return fallback || COPY.awaitingIdLabel;
    return friendlyTaxonLabel(text);
  }
  function recordDisplayName(record, fallback) {
    return localizedDisplayName(record && record.displayName, fallback);
  }
  function isMeaningfulMapRecordLabel(value) {
    var text = String(value || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length < 2) return false;
    if (/^(同定待ち|名前を確認中|未同定|不明|unknown|unidentified|unresolved|awaiting id)$/i.test(text)) return false;
    if (/^(記録|写真|動画|画像|撮影|メモ|スキャン|scan|photo|video|record|memo)$/i.test(text)) return false;
    if (/^(test|dummy|sample|fixture|placeholder|regression)([-_\s]|$)/i.test(text)) return false;
    return true;
  }
  function isRenderableMapRecord(record) {
    if (!record || !isMeaningfulMapRecordLabel(record.displayName)) return false;
    if (record.photoUrl) return true;
    return String(record.displayName || '') === '大切な生きもの';
  }
  function normalizeMapMediaKey(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try {
      var parsed = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, window.location.origin);
      raw = parsed.pathname || raw;
    } catch (_) {
      raw = raw.split('?')[0].split('#')[0];
    }
    raw = raw.split('?')[0].split('#')[0];
    try { raw = decodeURIComponent(raw); } catch (_) {}
    raw = raw.replace(/^\\/thumb\\/(?:sm|md|lg)\\//i, '/media/');
    raw = raw.replace(/^\\/(?:uploads|data\\/uploads)\\//i, '/media/');
    return raw.toLowerCase();
  }
  function mapVisitKey(record) {
    var visitId = String(record && record.visitId || '').trim();
    return visitId ? 'visit:' + visitId : '';
  }
  function mapOccurrenceKey(record) {
    var occurrenceId = String(record && record.occurrenceId || '').trim();
    return occurrenceId ? 'occ:' + occurrenceId : '';
  }
  function mapMediaKey(record) {
    var media = normalizeMapMediaKey(record && record.photoUrl);
    return media ? 'media:' + media : '';
  }
  function mapMarkerDisplayKey(record) {
    return mapVisitKey(record) || mapOccurrenceKey(record) || mapMediaKey(record);
  }
  function mapCardDisplayKey(record) {
    var visit = mapVisitKey(record);
    var media = mapMediaKey(record);
    if (visit && media) return visit + '|' + media;
    return visit || mapOccurrenceKey(record) || media;
  }
  function mapSuppressionKeys(record) {
    var keys = [mapVisitKey(record), mapOccurrenceKey(record)].filter(Boolean);
    if (!keys.length) {
      var media = mapMediaKey(record);
      if (media) keys.push(media);
    }
    return keys;
  }
  function recordHasExactCoordinateDisclosure(record) {
    var exactLat = Number(record && record.exactLatitude);
    var exactLng = Number(record && record.exactLongitude);
    return !!(record && (record.isViewerOwned || (Number.isFinite(exactLat) && Number.isFinite(exactLng))));
  }
  function dedupeRecordsForSurface(records, mode) {
    var seen = {};
    var output = [];
    var keyFn = mode === 'card' ? mapCardDisplayKey : mapMarkerDisplayKey;
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var key = keyFn(record);
      if (!key) {
        output.push(record);
        return;
      }
      if (seen[key]) return;
      seen[key] = true;
      output.push(record);
    });
    return output;
  }
  function ownedDisplayKeySet(records) {
    var set = {};
    (Array.isArray(records) ? records : []).forEach(function (record) {
      mapSuppressionKeys(record).forEach(function (key) { set[key] = true; });
    });
    return set;
  }
  function suppressOwnerRepresentedPublicRecords(publicRecords, ownedRecords) {
    var owned = ownedDisplayKeySet(ownedRecords);
    return (Array.isArray(publicRecords) ? publicRecords : []).filter(function (record) {
      if (!record || recordHasExactCoordinateDisclosure(record)) return false;
      var keys = mapSuppressionKeys(record);
      return !keys.length || !keys.some(function (key) { return !!owned[key]; });
    });
  }
  function publicRecordsForSignedInSurface(records) {
    return suppressOwnerRepresentedPublicRecords(records, state.myObservations);
  }
  function recordRepresentedByOwnObservations(record) {
    var owned = ownedDisplayKeySet(state.myObservations);
    var keys = mapSuppressionKeys(record);
    return !!keys.length && keys.some(function (key) { return !!owned[key]; });
  }
  var TAXON_GENUS_JA_FALLBACK = {
    Chloris: 'カワラヒワ属',
    Monticola: 'イソヒヨドリ属',
    Gamochaeta: 'チチコグサモドキ属',
    Oxalis: 'カタバミ属',
    Abraxas: 'エダシャク属',
    Spilosoma: 'ヒトリガ属',
    Vicia: 'ソラマメ属',
    Rubus: 'キイチゴ属',
    Mallotus: 'アカメガシワ属',
    Ligustrum: 'イボタノキ属',
    Pittosporum: 'トベラ属',
    Erigeron: 'ムカシヨモギ属',
  };
  function friendlyTaxonLabel(label) {
    var text = String(label || '').trim();
    if (SEARCH_LANG !== 'ja' || !text) return text;
    var genusMatch = text.match(/^([A-Z][a-z-]+)属の一種$/);
    if (genusMatch && TAXON_GENUS_JA_FALLBACK[genusMatch[1]]) {
      return TAXON_GENUS_JA_FALLBACK[genusMatch[1]] + 'の一種';
    }
    var sciMatch = text.match(/^([A-Z][a-z-]+)(?:\\s+[a-z][a-z-]+)?$/);
    if (sciMatch && TAXON_GENUS_JA_FALLBACK[sciMatch[1]]) {
      return TAXON_GENUS_JA_FALLBACK[sciMatch[1]];
    }
    return text;
  }
  function maxZoomForGrid(gridM) {
    if (isFinite(gridM) && gridM <= 500) return 15.4;
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
  function renderAreaLegendDetail() {
    var items = [
      { kind: 'school', label: COPY.areaLegendSchoolLabel, hint: COPY.areaLegendSchoolHint },
      { kind: 'water', label: COPY.areaLegendWaterLabel, hint: COPY.areaLegendWaterHint },
      { kind: 'pending', label: COPY.areaLegendPendingLabel, hint: COPY.areaLegendPendingHint },
      { kind: 'park', label: COPY.areaLegendParkLabel, hint: COPY.areaLegendParkHint },
      { kind: 'confirmed', label: COPY.areaLegendConfirmedLabel, hint: COPY.areaLegendConfirmedHint },
    ];
    return '<dl class="me-legend-list">'
      + items.map(function (item) {
        return '<div class="me-legend-chip is-' + escapeHtml(item.kind) + '">'
          + '<dt><i aria-hidden="true"></i><strong>' + escapeHtml(item.label) + '</strong></dt>'
          + '<dd>' + escapeHtml(item.hint) + '</dd>'
          + '</div>';
      }).join('')
      + '</dl>';
  }

  function setLegendMode(mode) {
    if (!legendDetailEl) return;
    if (mode === 'areas') {
      legendEl.setAttribute('data-legend-mode', 'areas');
      legendDetailEl.innerHTML = renderAreaLegendDetail();
      legendDetailEl.classList.remove('is-hidden');
      legendDetailEl.setAttribute('aria-hidden', 'false');
      return;
    }
    legendEl.setAttribute('data-legend-mode', 'scale');
    legendDetailEl.classList.add('is-hidden');
    legendDetailEl.setAttribute('aria-hidden', 'true');
    legendDetailEl.innerHTML = '';
  }

  function showLegend(lowLabel, highLabel, gradient, mode) {
    if (!legendEl) return;
    legendEl.classList.remove('is-hidden');
    legendEl.classList.add('is-collapsed');
    legendEl.setAttribute('aria-hidden', 'false');
    if (legendToggleEl) legendToggleEl.setAttribute('aria-expanded', 'false');
    if (legendLowEl) legendLowEl.textContent = lowLabel;
    if (legendHighEl) legendHighEl.textContent = highLabel;
    var gradEl = document.getElementById('me-legend-gradient');
    if (gradEl) gradEl.style.background = gradient;
    setLegendMode(mode || 'scale');
  }
  function hideLegend() {
    if (!legendEl) return;
    legendEl.classList.add('is-hidden');
    legendEl.classList.add('is-collapsed');
    legendEl.setAttribute('aria-hidden', 'true');
    if (legendToggleEl) legendToggleEl.setAttribute('aria-expanded', 'false');
    setLegendMode('scale');
  }
  function layerHintInfo(tab) {
    if (tab === 'places') return { minZoom: 8.1, text: COPY.layerHintPlaces, maxZoom: 11.8 };
    if (tab === 'frontier') return { minZoom: 10.2, text: COPY.layerHintFrontier, maxZoom: 12.2 };
    if (tab === 'heatmap') return { minZoom: 8.4, text: COPY.layerHintHeatmap, maxZoom: 12.2 };
    return null;
  }
  function hideLayerHint() {
    if (!layerHintEl) return;
    layerHintEl.classList.add('is-hidden');
    layerHintEl.setAttribute('aria-hidden', 'true');
    layerHintEl.removeAttribute('data-tab');
    refreshPurposeHint();
  }
  function maybeShowLayerHint(tab) {
    var info = layerHintInfo(tab);
    if (!info || !state.map || !layerHintEl || !layerHintTextEl) {
      hideLayerHint();
      return;
    }
    if (!purposeHintDismissed && tab === 'places') {
      hideLayerHint();
      return;
    }
    if (state.map.getZoom() >= info.minZoom) {
      hideLayerHint();
      return;
    }
    layerHintTextEl.textContent = info.text;
    layerHintEl.setAttribute('data-tab', tab);
    layerHintEl.classList.remove('is-hidden');
    layerHintEl.setAttribute('aria-hidden', 'false');
    refreshPurposeHint();
  }
  function extendBoundsWithCoordinates(bounds, coords) {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))) {
      bounds.extend([Number(coords[0]), Number(coords[1])]);
      return;
    }
    coords.forEach(function (child) { extendBoundsWithCoordinates(bounds, child); });
  }
  function fitFeatureBounds(features, maxZoom) {
    if (!state.map || !window.maplibregl || !Array.isArray(features) || !features.length) return false;
    var bounds = new window.maplibregl.LngLatBounds();
    features.forEach(function (feature) {
      if (!feature || !feature.geometry) return;
      extendBoundsWithCoordinates(bounds, feature.geometry.coordinates);
    });
    if (bounds.isEmpty()) return false;
    state.map.fitBounds(bounds, { padding: 56, maxZoom: maxZoom || 12.2, duration: 620 });
    return true;
  }
  function fallbackRegionBounds() {
    var regionBtns = Array.prototype.slice.call(document.querySelectorAll('.me-region-chip[data-bounds]'));
    var preferred = regionBtns.find(function (btn) {
      return /浜松|Hamamatsu/i.test((btn.textContent || '').trim());
    }) || regionBtns[2] || regionBtns[1] || regionBtns[0];
    if (!preferred) return null;
    var bs = (preferred.getAttribute('data-bounds') || '').split(',').map(Number);
    return bs.length === 4 && !bs.some(function (n) { return !Number.isFinite(n); }) ? bs : null;
  }
  function jumpToVisibleLayer(tab) {
    if (!state.map) return;
    var info = layerHintInfo(tab) || { maxZoom: 12.2 };
    var features = tab === 'places'
      ? state.areaPolygonFeatures
      : tab === 'frontier'
        ? (state.frontier && state.frontier.features)
        : state.features;
    if (fitFeatureBounds(features, info.maxZoom)) {
      hideLayerHint();
      return;
    }
    var bs = fallbackRegionBounds();
    if (bs) {
      state.map.fitBounds([[bs[0], bs[1]], [bs[2], bs[3]]], { padding: 48, maxZoom: info.maxZoom, duration: 650 });
      hideLayerHint();
    }
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
    var privacy = stats.privacy || null;
    if (privacy && privacy.policy === 'k_anonymous_cell_aggregate') {
      return '位置を保護した集計を表示しています';
    }
    var visible = stats.provenance.visible || {};
    var total = Number(visible.manual || 0) + Number(visible.legacy || 0) + Number(visible.track || 0) + Number(visible.other || 0);
    return total > 0 ? 'この範囲の記録を表示しています' : '';
  }

  function shouldUseBottomSheet() {
    return !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  }
  function isRainInteractionMode() {
    return state.tab === 'rain' && state.rainEnabled;
  }
  function checkRainTap(lngLat) {
    if (!lngLat) return false;
    var lng = Number(lngLat.lng);
    var lat = Number(lngLat.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
    closeBottomSheet();
    checkRainAt(lng, lat);
    return true;
  }
  function shouldKeepMapClearForRain() {
    return isRainInteractionMode() && shouldUseBottomSheet();
  }

  function updateSearchAreaUi() {
    if (!searchAreaBtnEl) return;
    searchAreaBtnEl.classList.toggle('is-hidden', !state.pendingViewportSearch);
    searchAreaBtnEl.textContent = state.pendingViewportSearch ? COPY.searchArea : COPY.searchArea;
  }

  function clearViewportRefreshTimer() {
    if (!state.viewportRefreshTimer) return;
    clearTimeout(state.viewportRefreshTimer);
    state.viewportRefreshTimer = null;
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

  function setResultsLoadState(stateName, count) {
    if (!root) return;
    root.setAttribute('data-results-state', stateName || 'idle');
    if (typeof count === 'number' && Number.isFinite(count)) {
      root.setAttribute('data-results-count', String(count));
    }
  }

  updatePendingMapResultsState();
  setResultsLoadState('idle', 0);

  function clearRecordsLoadWatchdog(requestSeq) {
    if (!state.recordsLoadWatchdog) return;
    if (requestSeq != null && state.recordsLoadWatchdogSeq !== requestSeq) return;
    clearTimeout(state.recordsLoadWatchdog);
    state.recordsLoadWatchdog = null;
    state.recordsLoadWatchdogSeq = 0;
  }

  function clearRecordsHardSettleWatchdog() {
    if (!state.recordsHardSettleWatchdog) return;
    clearTimeout(state.recordsHardSettleWatchdog);
    state.recordsHardSettleWatchdog = null;
  }

  function settleCurrentRecordsRequest(requestSeq) {
    if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) return false;
    state._recordsAppliedSeq = requestSeq;
    state.recordAbort = null;
    clearRecordsLoadWatchdog(requestSeq);
    if (state._recordsAppliedSeq === state._recordsRequestSeq) clearRecordsHardSettleWatchdog();
    updatePendingMapResultsState();
    return true;
  }

  function renderAppliedRecordsState(stats) {
    renderResultList();
    renderSelectedCard();
    renderSidePanels();
    syncViewerOwnedRecordSource(state.map);
    refreshDiscoveryPreviewMarkers();
    updateSearchAreaUi();
    var records = Array.isArray(state.records) ? state.records : [];
    var totalAll = stats && Number.isFinite(stats.totalAll) ? stats.totalAll : records.length;
    if (!records.length) setStatus(COPY.empty);
    else setStatus(fmtStatsLabel(records.length, totalAll));
    setStatusMeta(stats ? fmtProvenanceMeta(stats) : '');
  }

  function forceSettleRecordsRequest(requestSeq, stats) {
    if (!settleCurrentRecordsRequest(requestSeq)) return false;
    renderAppliedRecordsState(stats || state.lastStats);
    return true;
  }

  function recoverRecordsLoad(requestSeq, requestKey, scope) {
    if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) return;
    if (state._recordsAppliedSeq === requestSeq) return;
    if (state.recordsRecoveryKey !== requestKey) {
      state.recordsRecoveryKey = requestKey;
      state.recordsRecoveryAttempts = 0;
    }
    if (state.recordsRecoveryAttempts < 1) {
      state.recordsRecoveryAttempts += 1;
      scheduleRecordsLoadWatchdog(requestSeq, requestKey, scope);
      return;
    }
    state.recordsRecoveryAttempts = 0;
    if (state.recordAbort) { try { state.recordAbort.abort(); } catch (_) {} }
    forceSettleRecordsRequest(requestSeq, state.lastStats);
  }

  function scheduleRecordsLoadWatchdog(requestSeq, requestKey, scope) {
    clearRecordsLoadWatchdog();
    state.recordsLoadWatchdogSeq = requestSeq;
    state.recordsLoadWatchdog = setTimeout(function () {
      state.recordsLoadWatchdog = null;
      recoverRecordsLoad(requestSeq, requestKey, scope);
    }, RECORDS_LOAD_WATCHDOG_MS);
  }

  function scheduleRecordsHardSettleWatchdog() {
    if (state.recordsHardSettleWatchdog) return;
    state.recordsHardSettleWatchdog = setTimeout(function () {
      state.recordsHardSettleWatchdog = null;
      if (state._recordsAppliedSeq === state._recordsRequestSeq) return;
      if (state.recordAbort) { try { state.recordAbort.abort(); } catch (_) {} }
      state.recordsRecoveryAttempts = 0;
      forceSettleRecordsRequest(state._recordsRequestSeq, state.lastStats);
    }, RECORDS_HARD_SETTLE_MS);
  }

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
    if (state.selectedPoint && (
      state.selectedPoint.kind === 'place' ||
      state.selectedPoint.kind === 'area' ||
      state.selectedPoint.kind === 'cell' ||
      state.selectedPoint.kind === 'guide_spot'
    )) return state.selectedPoint;
    var cellFeature = getSelectedCellFeature();
    var record = getSelectedRecord();
    if (record && cellFeature) {
      var center = recordCellCenter(record) || cellCenter(cellFeature);
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

  function resultGroupDate(record) {
    return record && record.observedAt ? String(record.observedAt).slice(0, 10) : '';
  }

  function summarizeLocalities(records) {
    var counts = {};
    (records || []).forEach(function (record) {
      var label = String(record && record.localityLabel || '').trim();
      if (!label || label === '—') return;
      counts[label] = (counts[label] || 0) + 1;
    });
    var ranked = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (!ranked.length) return '';
    var first = ranked[0];
    return ranked.length > 1 ? first + ' +' + String(ranked.length - 1) : first;
  }

  function groupResultRecords(records) {
    var groups = [];
    var byDate = {};
    (records || []).forEach(function (record) {
      var date = resultGroupDate(record);
      var key = date || 'unknown';
      if (!byDate[key]) {
        byDate[key] = { key: key, date: date, records: [] };
        groups.push(byDate[key]);
      }
      byDate[key].records.push(record);
    });
    return groups;
  }

  function renderResultBadges(record) {
    var badges = [];
    if (record && record.isAwaitingId) badges.push('<span class="me-result-badge me-result-awaiting">' + escapeHtml(COPY.awaitingIdLabel) + '</span>');
    else if (record && record.isAiCandidate) badges.push('<span class="me-result-badge me-result-ai">' + escapeHtml(COPY.aiCandidateLabel) + '</span>');
    return badges.length ? '<span class="me-result-badges">' + badges.join('') + '</span>' : '';
  }

  function renderResultsEmptyState() {
    return ''
      + '<section class="me-results-empty" aria-label="' + escapeHtml(COPY.emptyTitle) + '">'
      +   '<span class="me-results-empty-kicker">' + escapeHtml(COPY.recordingGapLabel) + '</span>'
      +   '<strong>' + escapeHtml(COPY.emptyTitle) + '</strong>'
      +   '<p>' + escapeHtml(COPY.emptyLead) + '</p>'
      +   '<div class="me-results-empty-actions">'
      +     '<button type="button" class="me-results-empty-action is-primary" data-results-empty-areas>' + escapeHtml(COPY.emptyActionAreas) + '</button>'
      +     '<button type="button" class="me-results-empty-action" data-results-empty-widen>' + escapeHtml(COPY.emptyActionWiden) + '</button>'
      +     '<a class="me-results-empty-action" href="' + escapeHtml(RECORD_HREF) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:results_empty_record" data-kpi-funnel="map_empty_results" data-kpi-target="' + escapeHtml(RECORD_HREF) + '">' + escapeHtml(COPY.emptyActionRecord) + '</a>'
      +   '</div>'
      +   '<small>' + escapeHtml(COPY.empty) + '</small>'
      + '</section>';
  }

  function renderResultsLoadingState() {
    var rows = [
      { primary: '72%', secondary: '46%' },
      { primary: '84%', secondary: '62%' },
      { primary: '58%', secondary: '38%' },
    ];
    return '<section class="me-results-loading" aria-label="' + escapeHtml(COPY.recordsLoading) + '">' +
      rows.map(function (row) {
        return '<div class="me-results-loading-row">' +
          '<i class="me-results-loading-thumb" aria-hidden="true"></i>' +
          '<span class="me-results-loading-lines" aria-hidden="true">' +
            '<b style="--skeleton-w:' + escapeHtml(row.primary) + '"></b>' +
            '<b style="--skeleton-w:' + escapeHtml(row.secondary) + '"></b>' +
          '</span>' +
        '</div>';
      }).join('') +
    '</section>';
  }

  function setMapEmptyInviteVisible(visible) {
    void visible;
  }

  function renderResultList() {
    var records = publicRecordsForSignedInSurface(Array.isArray(state.records) ? state.records : []);
    var totalAll = state.lastStats && Number.isFinite(state.lastStats.totalAll) ? state.lastStats.totalAll : records.length;
    setResultsLoadState(records.length ? 'ready' : 'empty', records.length);
    updateSideRailSignal(records);
    if (!resultsListEl || !sideStatusEl) return;
    if (!records.length) {
      sideStatusEl.textContent = COPY.empty;
      resultsListEl.innerHTML = renderResultsEmptyState();
      setMapEmptyInviteVisible(true);
      return;
    }
    setMapEmptyInviteVisible(false);
    sideStatusEl.textContent = records.length + ' ' + COPY.resultCountLabel + ' · ' + totalAll + ' · ' + COPY.resultGroupedByDate;
    try {
      resultsListEl.innerHTML = groupResultRecords(records.slice(0, 120)).map(function (group) {
        var locality = summarizeLocalities(group.records);
        var label = group.date || COPY.resultGroupUnknownDate;
        var meta = [locality, String(group.records.length) + ' ' + COPY.resultCountLabel].filter(Boolean).join(' · ');
        var rows = group.records.map(function (record) {
          var active = record.occurrenceId === state.selectedOccurrenceId;
          var thumb = record.photoUrl
            ? '<img class="me-result-thumb" src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" width="64" height="64" loading="lazy" decoding="async" fetchpriority="low" onerror="this.outerHTML=&quot;<div class=\\&quot;me-result-thumb me-result-thumb-placeholder\\&quot;>\ud83c\udf3f</div>&quot;" />'
            : '<div class="me-result-thumb me-result-thumb-placeholder">🌿</div>';
          var displayLabel = recordDisplayName(record);
          var titleMeta = [record.localityLabel || '', resultGroupDate(record)].filter(Boolean).join(' · ');
          return '<button type="button" class="me-result-row' + (active ? ' is-active' : '') + '" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '" title="' + escapeHtml(titleMeta) + '">' +
            thumb +
            '<span class="me-result-body">' +
              '<strong>' + escapeHtml(displayLabel) + '</strong>' +
              renderResultBadges(record) +
            '</span>' +
          '</button>';
        }).join('');
        return '<section class="me-result-group">' +
          '<div class="me-result-group-head"><strong>' + escapeHtml(label) + '</strong>' +
          (meta ? '<span>' + escapeHtml(meta) + '</span>' : '') + '</div>' +
          rows +
        '</section>';
      }).join('');
    } catch (err) {
      resultsListEl.innerHTML = records.slice(0, 40).map(function (record) {
        return '<button type="button" class="me-result-row" data-occurrence-id="' + escapeHtml(record && record.occurrenceId || '') + '">' +
          '<div class="me-result-thumb me-result-thumb-placeholder">🌿</div>' +
          '<span class="me-result-body"><strong>' + escapeHtml(recordDisplayName(record)) + '</strong></span>' +
        '</button>';
      }).join('');
      try { console.warn('[map] result list fallback render', err); } catch (_) {}
    }
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
    if (record && record.isViewerOwned) {
      var exactLat = Number(record.exactLatitude);
      var exactLng = Number(record.exactLongitude);
      if (Number.isFinite(exactLat) && Number.isFinite(exactLng)) return { lat: exactLat, lng: exactLng };
    }
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
    return dedupeRecordsForSurface(publicRecordsForSignedInSurface(Array.isArray(state.records) ? state.records.slice() : []), 'card')
      .sort(function (a, b) {
        var photoDelta = (b && b.photoUrl ? 1 : 0) - (a && a.photoUrl ? 1 : 0);
        if (photoDelta) return photoDelta;
        return recordTimestamp(b) - recordTimestamp(a);
      });
  }

  function pickDiscoveryPreviewRecords() {
    var picked = [];
    var cellCounts = {};
    var seenGroups = {};
    var candidates = sortedDiscoveryPreviewCandidates();
    var zoom = state.map && typeof state.map.getZoom === 'function' ? Number(state.map.getZoom()) : 12;
    var maxCards = zoom >= 16 ? 18 : (zoom >= 15 ? 14 : 10);
    var pushIfUsable = function (record, preferNewGroup) {
      if (!record || picked.length >= maxCards || !record.cellId) return;
      var cellCount = cellCounts[record.cellId] || 0;
      if (cellCount >= (zoom >= 15 ? 5 : 3)) return;
      var group = record.taxonGroup || record.dominantTaxonGroup || '';
      if (preferNewGroup && group && seenGroups[group]) return;
      var center = recordCellCenter(record);
      if (!center) return;
      cellCounts[record.cellId] = cellCount + 1;
      var offset = [
        [0, 0],
        [0.0022, 0.0016],
        [-0.0022, -0.0016],
        [0.0016, -0.0022],
        [-0.0016, 0.0022],
      ][cellCount] || [0, 0];
      if (group) seenGroups[group] = true;
      picked.push({ record: record, center: { lng: center.lng + offset[0], lat: center.lat + offset[1] } });
    };
    candidates.forEach(function (record) { pushIfUsable(record, true); });
    candidates.forEach(function (record) { pushIfUsable(record, false); });
    return picked;
  }

  function refreshDiscoveryPreviewMarkers() {
    clearDiscoveryPreviewMarkers();
    if (!state.map || !window.maplibregl || (state.tab !== 'markers' && state.tab !== 'places')) return;
    var zoom = state.map.getZoom();
    if (!Number.isFinite(zoom) || zoom < 11.5) return;
    pickDiscoveryPreviewRecords().forEach(function (item) {
      var record = item.record;
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'me-discovery-preview me-community-photo-marker' + (record.photoUrl ? ' has-photo' : '') + ' is-grid';
      var placementBadge = '範囲表示';
      var previewLabel = recordDisplayName(record, COPY.discoveryFallback);
      el.setAttribute('aria-label', recordDisplayName(record, COPY.recentDiscoveryFallback) + ' ' + placementBadge + COPY.openDiscoverySuffix);
      el.innerHTML = record.photoUrl
        ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-discovery-preview&quot;).classList.remove(&quot;has-photo&quot;);this.remove()" /><span>' + escapeHtml(previewLabel) + '</span><em>' + escapeHtml(placementBadge) + '</em>'
        : '<i aria-hidden="true">✦</i><span>' + escapeHtml(previewLabel) + '</span><em>' + escapeHtml(placementBadge) + '</em>';
      el.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        sendMapKpi('funnel_step', 'map:discovery_preview_open', {
          funnel: 'map_discovery_preview',
          step: 'open_marker',
          recordId: String(record.id || '').slice(0, 128),
          approximate: true
        });
        selectRecord(record, { focusMap: false, openSheet: shouldUseBottomSheet(), preserveSurroundings: true });
      });
      var marker = new window.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] })
        .setLngLat([item.center.lng, item.center.lat])
        .addTo(state.map);
      state.discoveryPreviewMarkers.push(marker);
    });
  }

  function clearOwnObservationMarkers() {
    (state.ownObservationMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.ownObservationMarkers = [];
    setOwnObservationMarkerState(null);
  }

  function setOwnObservationMarkerState(status, count) {
    if (!root) return;
    if (status) root.setAttribute('data-own-observations-state', status);
    if (typeof count === 'number') root.setAttribute('data-own-observation-marker-count', String(count));
  }

  function ownObservationHref(record) {
    return NOTES_HREF;
  }

  function validOwnObservationRecords() {
    return (Array.isArray(state.myObservations) ? state.myObservations : [])
      .slice(0, 48)
      .filter(function (record) {
        var lat = Number(record && record.latitude);
        var lng = Number(record && record.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && !!record.photoUrl && isMeaningfulMapRecordLabel(record && record.displayName);
      });
  }

  function hideOwnObservationTrail() {
    if (!ownTrailEl) return;
    ownTrailEl.classList.add('is-hidden');
    ownTrailEl.setAttribute('aria-hidden', 'true');
    if (ownTrailListEl) ownTrailListEl.innerHTML = '';
    if (ownTrailCountEl) ownTrailCountEl.textContent = '';
  }

  function isRenderableMapCluster(cluster) {
    var lat = Number(cluster && cluster.latitude);
    var lng = Number(cluster && cluster.longitude);
    var count = Number(cluster && cluster.recordCount);
    return !!cluster && Number.isFinite(lat) && Number.isFinite(lng) && count >= 3 && Array.isArray(cluster.occurrenceIds);
  }

  function hidePersonalMemoryClusters() {
    if (!personalMemoryEl) return;
    personalMemoryEl.classList.add('is-hidden');
    personalMemoryEl.setAttribute('aria-hidden', 'true');
    if (personalMemoryListEl) personalMemoryListEl.innerHTML = '';
  }

  function recordsForPersonalMemoryCluster(cluster) {
    var ids = Array.isArray(cluster && cluster.occurrenceIds) ? cluster.occurrenceIds.map(String) : [];
    if (!ids.length) return [];
    var idSet = {};
    ids.forEach(function (id) { if (id) idSet[id] = true; });
    return validOwnObservationRecords()
      .filter(function (record) { return !!idSet[String(record && record.occurrenceId || '')]; })
      .sort(function (a, b) { return ids.indexOf(String(a && a.occurrenceId || '')) - ids.indexOf(String(b && b.occurrenceId || '')); });
  }

  function personalMemoryMeta(cluster) {
    var count = Number(cluster && cluster.recordCount) || 0;
    var suffix = COPY.personalMemoryRecords || '';
    var first = cluster && cluster.firstObservedAt ? String(cluster.firstObservedAt).slice(0, 10) : '';
    var last = cluster && cluster.lastObservedAt ? String(cluster.lastObservedAt).slice(0, 10) : '';
    var range = first && last && first !== last ? first + ' - ' + last : (last || first);
    return [String(count) + suffix, range].filter(Boolean).join(' / ');
  }

  function openPersonalMemoryCluster(cluster) {
    if (!cluster || !state.map) return;
    var lat = Number(cluster.latitude);
    var lng = Number(cluster.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    try {
      state.map.flyTo({ center: [lng, lat], zoom: Math.max(Number(state.map.getZoom && state.map.getZoom() || 0), 15.6), duration: 680, essential: true });
    } catch (_) {}
    sendMapKpi('map_interaction', 'map:personal_memory_cluster_open', {
      clusterId: String(cluster.clusterId || ''),
      recordCount: Number(cluster.recordCount || 0),
    });
    var records = recordsForPersonalMemoryCluster(cluster);
    if (records.length) openOwnObservationStackSheet(records);
  }

  function renderPersonalMemoryClusters() {
    if (!personalMemoryEl || !personalMemoryListEl) return;
    var clusters = (Array.isArray(state.myObservationClusters) ? state.myObservationClusters : [])
      .filter(isRenderableMapCluster)
      .slice(0, 3);
    if (!clusters.length) {
      hidePersonalMemoryClusters();
      return;
    }
    personalMemoryEl.classList.remove('is-hidden');
    personalMemoryEl.setAttribute('aria-hidden', 'false');
    personalMemoryListEl.innerHTML = clusters.map(function (cluster, index) {
      var label = String(cluster.label || cluster.localityLabel || COPY.personalMemoryFallbackLabel || '').trim();
      var photo = cluster.representativePhotoUrl ? '<img src="' + escapeHtml(toThumbUrl(cluster.representativePhotoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-personal-memory-item&quot;).classList.add(&quot;is-photo-missing&quot;);this.remove()" />' : '<i aria-hidden="true">●</i>';
      return '<button type="button" class="me-personal-memory-item" data-personal-memory-index="' + String(index) + '">' +
        photo +
        '<span><strong>' + escapeHtml(label || COPY.personalMemoryFallbackLabel || '') + '</strong><small>' + escapeHtml(personalMemoryMeta(cluster)) + '</small></span>' +
        '<b>' + escapeHtml(COPY.personalMemoryOpen || COPY.popupOpenLabel) + '</b>' +
      '</button>';
    }).join('');
    personalMemoryListEl.querySelectorAll('.me-personal-memory-item').forEach(function (button) {
      button.addEventListener('click', function () {
        var index = Number(button.getAttribute('data-personal-memory-index'));
        if (!Number.isFinite(index)) return;
        openPersonalMemoryCluster(clusters[index]);
      });
    });
  }

  function renderOwnObservationTrail(records) {
    if (!ownTrailEl || !ownTrailListEl) return;
    var list = dedupeRecordsForSurface((Array.isArray(records) ? records : [])
      .filter(function (record) {
        var lat = Number(record && record.latitude);
        var lng = Number(record && record.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && !!record.photoUrl;
      }), 'card')
      .slice(0, 6);
    if (state.tab === 'rain' || !list.length) {
      hideOwnObservationTrail();
      return;
    }
    if (ownTrailCountEl) {
      ownTrailCountEl.textContent = String(list.length) + (COPY.ownObservationStackSuffix || '');
    }
    ownTrailListEl.innerHTML = list.map(function (record) {
      var label = recordDisplayName(record, COPY.discoveryFallback);
      var meta = ownObservationMeta(record);
      return '<button type="button" class="me-own-trail-item" data-own-trail-id="' + escapeHtml(String(record && record.occurrenceId || '')) + '" data-own-trail-lat="' + escapeHtml(String(record && record.latitude || '')) + '" data-own-trail-lng="' + escapeHtml(String(record && record.longitude || '')) + '">' +
        '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-own-trail-item&quot;).classList.add(&quot;is-photo-missing&quot;);this.remove()" />' +
        '<span><strong>' + escapeHtml(label) + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</span>' +
      '</button>';
    }).join('');
    ownTrailListEl.querySelectorAll('.me-own-trail-item').forEach(function (button) {
      button.addEventListener('click', function () {
        var lat = Number(button.getAttribute('data-own-trail-lat'));
        var lng = Number(button.getAttribute('data-own-trail-lng'));
        var id = String(button.getAttribute('data-own-trail-id') || '');
        if (!state.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
        try {
          state.map.flyTo({ center: [lng, lat], zoom: Math.max(Number(state.map.getZoom && state.map.getZoom() || 0), 16), duration: 620, essential: true });
          sendMapKpi('map_interaction', 'map:own_observation_trail_focus', { occurrenceId: id || null });
        } catch (_) {}
      });
    });
    ownTrailEl.classList.remove('is-hidden');
    ownTrailEl.setAttribute('aria-hidden', 'false');
  }

  function currentOwnObservationCenter() {
    if (state._restoredCenter && state._restoredCenter.length >= 2) {
      var restoredLng = Number(state._restoredCenter[0]);
      var restoredLat = Number(state._restoredCenter[1]);
      if (Number.isFinite(restoredLng) && Number.isFinite(restoredLat)) return { lng: restoredLng, lat: restoredLat };
    }
    try {
      if (state.map && typeof state.map.getCenter === 'function') {
        var center = state.map.getCenter();
        var lng = Number(center && center.lng);
        var lat = Number(center && center.lat);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng: lng, lat: lat };
      }
    } catch (_) {}
    return null;
  }

  function ownObservationDistanceScore(record, center) {
    if (!center) return 0;
    var lat = Number(record && record.latitude);
    var lng = Number(record && record.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;
    var latScale = Math.max(0.2, Math.cos(Number(center.lat) * Math.PI / 180));
    var dx = (lng - Number(center.lng)) * latScale;
    var dy = lat - Number(center.lat);
    return dx * dx + dy * dy;
  }

  function prioritizeOwnObservationRecordsForView(records) {
    var list = Array.isArray(records) ? records.slice() : [];
    var center = currentOwnObservationCenter();
    if (!center) return list;
    return list
      .map(function (record, index) {
        return { record: record, index: index, score: ownObservationDistanceScore(record, center) };
      })
      .sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return a.index - b.index;
      })
      .map(function (item) { return item.record; });
  }

  function maybeFitOwnObservationsOnFirstOpen() {
    if (!state.map || state._ownObservationFirstViewApplied) return;
    if (state.tab === 'rain') return;
    if (state._restoredCenter || state._restoredCellId) return;
    if (state.selectedPoint || state._meMarker) return;
    var records = validOwnObservationRecords();
    if (!records.length) return;
    state._ownObservationFirstViewApplied = true;
    if (records.length === 1) {
      var oneLat = Number(records[0].latitude);
      var oneLng = Number(records[0].longitude);
      if (Number.isFinite(oneLat) && Number.isFinite(oneLng)) {
        state.map.flyTo({ center: [oneLng, oneLat], zoom: 15, duration: 720, essential: true });
      }
      return;
    }
    var minLng = Infinity;
    var minLat = Infinity;
    var maxLng = -Infinity;
    var maxLat = -Infinity;
    records.forEach(function (record) {
      var lat = Number(record.latitude);
      var lng = Number(record.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
    if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return;
    if (Math.abs(maxLng - minLng) > 2.2 || Math.abs(maxLat - minLat) > 1.8) {
      var latestLat = Number(records[0].latitude);
      var latestLng = Number(records[0].longitude);
      if (Number.isFinite(latestLat) && Number.isFinite(latestLng)) {
        state.map.flyTo({ center: [latestLng, latestLat], zoom: 12.2, duration: 720, essential: true });
      }
      return;
    }
    if (Math.abs(maxLng - minLng) < 0.0008) {
      minLng -= 0.0008;
      maxLng += 0.0008;
    }
    if (Math.abs(maxLat - minLat) < 0.0008) {
      minLat -= 0.0008;
      maxLat += 0.0008;
    }
    state.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 74, maxZoom: 15.2, duration: 760 });
  }

  function ownObservationGroups(records) {
    if (!state.map || typeof state.map.project !== 'function') {
      return ownObservationCoordinateGroups(records);
    }
    var groups = [];
    records.forEach(function (record) {
      var lat = Number(record.latitude);
      var lng = Number(record.longitude);
      var point = state.map.project([lng, lat]);
      var matched = null;
      for (var i = 0; i < groups.length; i += 1) {
        var g = groups[i];
        var dx = Number(point.x) - Number(g.point.x);
        var dy = Number(point.y) - Number(g.point.y);
        if (Math.sqrt(dx * dx + dy * dy) <= 72) {
          matched = g;
          break;
        }
      }
      if (!matched) {
        groups.push({ records: [record], point: point, lat: lat, lng: lng });
        return;
      }
      matched.records.push(record);
      matched.lat = matched.records.reduce(function (sum, item) { return sum + Number(item.latitude || 0); }, 0) / matched.records.length;
      matched.lng = matched.records.reduce(function (sum, item) { return sum + Number(item.longitude || 0); }, 0) / matched.records.length;
    });
    return groups;
  }

  function ownObservationCoordinateGroups(records) {
    var fallbackGroups = [];
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var lat = Number(record && record.latitude);
      var lng = Number(record && record.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      var matched = null;
      for (var i = 0; i < fallbackGroups.length; i += 1) {
        var g = fallbackGroups[i];
        if (Math.abs(Number(g.lat) - lat) <= 0.02 && Math.abs(Number(g.lng) - lng) <= 0.02) {
          matched = g;
          break;
        }
      }
      if (!matched) {
        fallbackGroups.push({ records: [record], lat: lat, lng: lng });
        return;
      }
      matched.records.push(record);
      matched.lat = matched.records.reduce(function (sum, item) { return sum + Number(item.latitude || 0); }, 0) / matched.records.length;
      matched.lng = matched.records.reduce(function (sum, item) { return sum + Number(item.longitude || 0); }, 0) / matched.records.length;
    });
    return fallbackGroups;
  }

  function safeOwnObservationGroups(records) {
    try {
      return ownObservationGroups(records);
    } catch (_) {
      return ownObservationCoordinateGroups(records);
    }
  }

  function prioritizeOwnObservationGroupsForView(groups) {
    var list = Array.isArray(groups) ? groups.slice() : [];
    var center = currentOwnObservationCenter();
    if (!center) return list;
    return list
      .map(function (group, index) {
        return {
          group: group,
          index: index,
          score: ownObservationDistanceScore({ latitude: group && group.lat, longitude: group && group.lng }, center),
        };
      })
      .sort(function (a, b) {
        if (a.score !== b.score) return a.score - b.score;
        return a.index - b.index;
      })
      .map(function (item) { return item.group; });
  }

  function ownObservationGroupLabel(records) {
    var labels = records.map(function (record) { return recordDisplayName(record, COPY.discoveryFallback); }).filter(Boolean);
    var visible = labels.slice(0, 2).join(' / ');
    if (labels.length <= 2) return visible;
    return visible + ' / ' + String(COPY.ownObservationStackMore || '__COUNT__ more').replace('__COUNT__', String(labels.length - 2));
  }

  function ownObservationMeta(record) {
    var parts = [];
    parts.push(String(COPY.ownObservationExactBadge || COPY.ownObservationStackHint || ''));
    if (record && record.observedAt) parts.push(String(record.observedAt).slice(0, 10));
    return parts.join(' · ');
  }

  function renderOwnObservationDetailSheet(record) {
    var label = recordDisplayName(record, COPY.discoveryFallback);
    return '<article class="me-detail-panel me-bottom-detail me-own-observation-detail" data-own-observation-detail="1">' +
      renderDetailHero({
        title: label,
        meta: ownObservationMeta(record),
        badge: COPY.ownObservationTrailHeading,
        photoUrl: record && record.photoUrl ? record.photoUrl : '',
      }) +
      '<p class="me-own-stack-hint">' + escapeHtml(COPY.ownObservationStackHint || '') + '</p>' +
      '<p class="me-own-stack-hint">' + escapeHtml(COPY.ownObservationPublicApproxHint || '') + '</p>' +
      renderDetailActions([
        { icon: '📖', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:own_observation:notes' },
      ]) +
    '</article>';
  }

  function openOwnObservationDetail(record) {
    if (!record) return;
    var lat = Number(record.latitude);
    var lng = Number(record.longitude);
    if (state.map && Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        state.map.flyTo({ center: [lng, lat], zoom: Math.max(Number(state.map.getZoom && state.map.getZoom() || 0), 16), duration: 620, essential: true });
      } catch (_) {}
    }
    if (!sheetEl || !sheetInnerEl) return;
    resetAreaGuideStopSession();
    sheetInnerEl.innerHTML = renderOwnObservationDetailSheet(record);
    showDetailBottomSheet();
    setSheetSnap('full');
    sendMapKpi('map_interaction', 'map:own_observation_exact_open', { occurrenceId: String(record && record.occurrenceId || '') || null });
  }

  function renderOwnObservationStackSheet(records) {
    var list = (Array.isArray(records) ? records : []).filter(Boolean).slice(0, 12);
    var title = COPY.ownObservationStackHeading || COPY.sideRecentLabel;
    var meta = props.lang === "ja" ? String(list.length) + '件' : String(list.length) + ' ' + (COPY.ownObservationStackSuffix || 'records');
    return '<article class="me-detail-panel me-bottom-detail me-own-stack-sheet" data-own-observation-stack-sheet="1">' +
      renderDetailHero({
        title: title,
        meta: meta,
        badge: COPY.sideRecentLabel,
        photoUrl: list[0] && list[0].photoUrl ? list[0].photoUrl : '',
      }) +
      '<p class="me-own-stack-hint">' + escapeHtml(COPY.ownObservationStackHint || '') + '</p>' +
      '<p class="me-own-stack-hint">' + escapeHtml(COPY.ownObservationPublicApproxHint || '') + '</p>' +
      '<div class="me-own-stack-list">' + list.map(function (record) {
        var label = recordDisplayName(record, COPY.discoveryFallback);
        var metaText = ownObservationMeta(record);
        return '<button type="button" class="me-own-stack-item" data-own-observation-choice="' + escapeHtml(String(record && record.occurrenceId || '')) + '">' +
          '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-own-stack-item&quot;).classList.add(&quot;is-photo-missing&quot;);this.remove()" />' +
          '<span><strong>' + escapeHtml(label) + '</strong>' + (metaText ? '<small>' + escapeHtml(metaText) + '</small>' : '') + '</span>' +
          '<b>' + escapeHtml(COPY.ownObservationStackOpen || COPY.popupOpenLabel) + '</b>' +
        '</button>';
      }).join('') + '</div>' +
    '</article>';
  }

  function openOwnObservationStackSheet(records) {
    if (!sheetEl || !sheetInnerEl) return;
    resetAreaGuideStopSession();
    sheetInnerEl.innerHTML = renderOwnObservationStackSheet(records);
    sheetInnerEl.querySelectorAll('[data-own-observation-choice]').forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var id = String(button.getAttribute('data-own-observation-choice') || '');
        var match = (Array.isArray(records) ? records : []).filter(function (item) {
          return String(item && item.occurrenceId || '') === id;
        })[0];
        if (match) openOwnObservationDetail(match);
      });
    });
    showDetailBottomSheet();
    setSheetSnap('full');
  }

  function renderOwnObservationMarkers() {
    clearOwnObservationMarkers();
    var maplibre = state.maplibreRuntime || window.maplibregl;
    if (!state.map || state.tab === 'rain') {
      hideOwnObservationTrail();
      return;
    }
    var records = prioritizeOwnObservationRecordsForView(validOwnObservationRecords());
    if (root) root.setAttribute('data-own-observation-record-count', String(records.length));
    if (!records.length) {
      setOwnObservationMarkerState('empty', 0);
      hideOwnObservationTrail();
      return;
    }
    renderOwnObservationTrail(records);
    setOwnObservationMarkerState('rendering', 0);
    function addOwnObservationFallbackMarker(el, lng, lat) {
      if (!root || !el) return null;
      var point = null;
      try {
        if (state.map && typeof state.map.project === 'function') point = state.map.project([lng, lat]);
      } catch (_) { point = null; }
      el.style.position = 'absolute';
      el.style.left = Number.isFinite(Number(point && point.x)) ? Math.round(Number(point.x)) + 'px' : '50%';
      el.style.top = Number.isFinite(Number(point && point.y)) ? Math.round(Number(point.y)) + 'px' : '50%';
      el.style.transform = 'translate(-50%, -100%)';
      el.style.zIndex = '8';
      root.appendChild(el);
      return {
        remove: function () {
          if (el && el.parentElement) el.parentElement.removeChild(el);
        },
      };
    }
    var renderedOwnObservationIds = {};
    function markOwnObservationGroupRendered(group) {
      (group && Array.isArray(group.records) ? group.records : []).forEach(function (item) {
        var id = String(item && item.occurrenceId || '');
        if (id) renderedOwnObservationIds[id] = true;
      });
    }
    function ownObservationGroupWasRendered(group) {
      var ids = (group && Array.isArray(group.records) ? group.records : [])
        .map(function (item) { return String(item && item.occurrenceId || ''); })
        .filter(Boolean);
      return !!ids.length && ids.every(function (id) { return !!renderedOwnObservationIds[id]; });
    }
    function ownObservationIdExistsInDom(occurrenceId) {
      var id = String(occurrenceId || '');
      if (!root || !id) return false;
      var markers = root.querySelectorAll('.me-own-observation-marker[data-own-observation-ids]');
      for (var i = 0; i < markers.length; i += 1) {
        var ids = String(markers[i].getAttribute('data-own-observation-ids') || '').split(',');
        if (ids.indexOf(id) >= 0) return true;
      }
      return false;
    }
    function renderNearCenterOwnObservationPins(records) {
      if (!state._restoredCenter) return;
      var center = currentOwnObservationCenter();
      if (!center) return;
      (Array.isArray(records) ? records : []).slice(0, 8).forEach(function (record) {
        var id = String(record && record.occurrenceId || '');
        if (!id || ownObservationIdExistsInDom(id)) return;
        var score = ownObservationDistanceScore(record, center);
        if (!Number.isFinite(score) || score > 0.0016) return;
        var lat = Number(record && record.latitude);
        var lng = Number(record && record.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        try { renderOwnObservationGroup({ records: [record], lat: lat, lng: lng }, true); } catch (_) {}
      });
    }
    function renderOwnObservationGroup(group, forceDomFallback) {
      var record = group.records[0];
      var lat = Number(group.lat);
      var lng = Number(group.lng);
      if (!record || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
      var label = recordDisplayName(record, COPY.discoveryFallback);
      var count = group.records.length;
      var groupLabel = count > 1 ? ownObservationGroupLabel(group.records) : label;
      var allLabels = group.records.map(function (item) { return recordDisplayName(item, COPY.discoveryFallback); }).filter(Boolean).join(' / ');
      var allOccurrenceIds = group.records.map(function (item) { return String(item && item.occurrenceId || ''); }).filter(Boolean).join(',');
      var el = document.createElement('a');
      el.className = 'me-own-observation-marker me-my-photo-marker' + (count > 1 ? ' is-stack' : '');
      el.href = ownObservationHref(record);
      el.setAttribute('aria-label', (count > 1 ? (props.lang === "ja" ? String(count) + '件: ' : String(count) + ' ' + COPY.ownObservationStackSuffix + ': ') + groupLabel : label) + COPY.openDiscoverySuffix);
      el.setAttribute('title', count > 1 ? groupLabel : label);
      el.setAttribute('data-own-observation-count', String(count));
      el.setAttribute('data-own-observation-ids', allOccurrenceIds);
      el.innerHTML = '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-own-observation-marker&quot;).classList.add(&quot;is-photo-missing&quot;);this.remove()" />'
        + (count > 1 ? '<b aria-hidden="true">' + escapeHtml(String(count)) + '</b>' : '')
        + '<span>' + escapeHtml(count > 1 ? groupLabel : label) + '</span>'
        + (count > 1 ? '<em>' + escapeHtml(allLabels) + '</em>' : '');
      if (count > 1) {
        el.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          openOwnObservationStackSheet(group.records);
        });
      } else {
        el.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          openOwnObservationDetail(record);
        });
      }
      var marker = null;
      if (!forceDomFallback && maplibre && typeof maplibre.Marker === 'function') try {
        marker = new maplibre.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
          .setLngLat([lng, lat])
          .addTo(state.map);
        if (root && !root.contains(el)) {
          try { marker.remove(); } catch (_) {}
          marker = addOwnObservationFallbackMarker(el, lng, lat);
        }
      } catch (_) {
        marker = addOwnObservationFallbackMarker(el, lng, lat);
      }
      if (!marker) marker = addOwnObservationFallbackMarker(el, lng, lat);
      if (marker) {
        state.ownObservationMarkers.push(marker);
        markOwnObservationGroupRendered(group);
      }
    }
    var groups = prioritizeOwnObservationGroupsForView(safeOwnObservationGroups(records));
    groups.forEach(function (group) {
      try { renderOwnObservationGroup(group, false); } catch (_) {
        try { renderOwnObservationGroup(group, true); } catch (_) {}
      }
    });
    groups.forEach(function (group) {
      if (ownObservationGroupWasRendered(group)) return;
      try { renderOwnObservationGroup(group, true); } catch (_) {}
    });
    renderNearCenterOwnObservationPins(records);
    if (!state.ownObservationMarkers.length) {
      ownObservationCoordinateGroups(records).slice(0, 6).forEach(function (group) {
        try { renderOwnObservationGroup(group); } catch (_) {}
      });
    }
    setOwnObservationMarkerState(state.ownObservationMarkers.length ? 'ready' : 'render-empty', state.ownObservationMarkers.length);
  }

  function clearAreaBadgeMarkers() {
    (state.areaBadgeMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.areaBadgeMarkers = [];
  }

  function clearNearbyAreaMarkers() {
    (state.nearbyAreaMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.nearbyAreaMarkers = [];
  }

  function clearGuideSpotMarkers() {
    (state.guideSpotMarkers || []).forEach(function (marker) {
      try { marker.remove(); } catch (_) {}
    });
    state.guideSpotMarkers = [];
  }

  function areaFeatureDisplayName(feature) {
    var props = (feature && feature.properties) || {};
    return String(props.name || props.label || props.field_name || props.fieldId || props.field_id || COPY.nearbyAreaMarkerLabel || '').trim();
  }

  function areaMarkerState(feature) {
    var props = (feature && feature.properties) || {};
    var status = areaAccessStatus(props, null);
    if (status === 'school') return 'school';
    if (status === 'public_access') return 'public';
    return 'restricted';
  }

  function areaMarkerBadge(feature) {
    var stateName = areaMarkerState(feature);
    if (stateName === 'school') return COPY.nearbyAreaSchoolLabel;
    if (stateName === 'public') return COPY.nearbyAreaPublicLabel;
    return COPY.nearbyAreaRestrictedLabel;
  }

  function nearbyDiscoverableAreaCandidates(origin) {
    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];
    return (Array.isArray(state.areaPolygonFeatures) ? state.areaPolygonFeatures : [])
      .map(function (feature) {
        var props = feature && feature.properties ? feature.properties : {};
        var center = areaFeatureCenter(feature, null, null);
        var meters = distanceMeters(origin, center);
        var access = areaMarkerState(feature);
        return { feature: feature, props: props, center: center, meters: meters, access: access };
      })
      .filter(function (item) {
        if (!item.feature || !item.props || !item.center || !Number.isFinite(item.meters)) return false;
        if (item.meters > 1800) return false;
        if (isAdministrativeAreaFeature(item.feature)) return false;
        if (!areaFeatureDisplayName(item.feature)) return false;
        return true;
      })
      .sort(function (a, b) {
        var accessDelta = (a.access === 'public' ? 0 : a.access === 'restricted' ? 1 : 2) -
          (b.access === 'public' ? 0 : b.access === 'restricted' ? 1 : 2);
        if (accessDelta) return accessDelta;
        var areaA = Number(a.props.area_ha);
        var areaB = Number(b.props.area_ha);
        var distanceDelta = a.meters - b.meters;
        if (Math.abs(distanceDelta) > 8) return distanceDelta;
        return (Number.isFinite(areaA) ? areaA : 999999) - (Number.isFinite(areaB) ? areaB : 999999);
      })
      .slice(0, 5);
  }

  function refreshNearbyAreaMarkers(origin) {
    clearNearbyAreaMarkers();
    if (!state.map || !window.maplibregl || state.tab !== 'places') return;
    var candidates = nearbyDiscoverableAreaCandidates(origin);
    if (!candidates.length) {
      if (origin && state.areaPolygonsLoaded) setStatus(COPY.nearbyAreasNoneStatus);
      return;
    }
    setStatus(String(COPY.nearbyAreasStatusTemplate || '').replace('__COUNT__', String(candidates.length)));
    candidates.forEach(function (item) {
      var feature = item.feature;
      var center = item.center;
      var name = areaFeatureDisplayName(feature);
      var access = areaMarkerState(feature);
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'me-nearby-area-marker is-' + access;
      el.setAttribute('aria-label', (COPY.nearbyAreaMarkerLabel || '') + ': ' + name);
      el.innerHTML = '<span>' + escapeHtml(areaMarkerBadge(feature)) + '</span><strong>' + escapeHtml(name) + '</strong>';
      el.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        openAreaFeatureSheet(feature, center.lat, center.lng);
      });
      var marker = new window.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -10] })
        .setLngLat([center.lng, center.lat])
        .addTo(state.map);
      state.nearbyAreaMarkers.push(marker);
    });
  }

  function guideSpotCenter(feature) {
    var coords = feature && feature.geometry && Array.isArray(feature.geometry.coordinates)
      ? feature.geometry.coordinates
      : [];
    var lng = Number(coords[0]);
    var lat = Number(coords[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat, lng: lng } : null;
  }

  function guideStopSourceLinks(stop) {
    var links = stop && (stop.sourceLinks || stop.source_links || stop.sources);
    if (!Array.isArray(links)) return [];
    return links.filter(function (item) {
      return item && item.url && item.label;
    }).slice(0, 4);
  }

  function renderGuideSourceLinks(stop) {
    var links = guideStopSourceLinks(stop);
    if (!links.length) return '';
    return '<div class="me-area-guide-sources"><span>出典</span>' +
      links.map(function (link) {
        return '<a href="' + escapeHtml(link.url) + '" target="_blank" rel="noreferrer noopener">' + escapeHtml(link.label) + '</a>';
      }).join('') +
    '</div>';
  }

  var GUIDE_LANG_ORDER = ['ja', 'en', 'zh-TW', 'zh-CN'];
  var GUIDE_LANG_LABELS = { ja: '日本語', en: 'English', 'zh-TW': '繁體', 'zh-CN': '简体' };
  var GUIDE_LANG_STORAGE_KEY = 'ikimon:map-guide-lang';

  function guideVariantKeys(stop) {
    var variants = stop && stop.variants && typeof stop.variants === 'object' ? stop.variants : null;
    if (!variants) return [];
    return GUIDE_LANG_ORDER.filter(function (lang) { return !!variants[lang]; });
  }

  function readPreferredGuideLang(stop) {
    var keys = guideVariantKeys(stop);
    if (!keys.length) return '';
    var paramLang = '';
    try { paramLang = new URLSearchParams(window.location.search || '').get('guideLang') || ''; } catch (_) {}
    if (keys.indexOf(paramLang) >= 0) return paramLang;
    var storedLang = '';
    try { storedLang = window.localStorage ? window.localStorage.getItem(GUIDE_LANG_STORAGE_KEY) || '' : ''; } catch (_) {}
    if (keys.indexOf(storedLang) >= 0) return storedLang;
    if (SEARCH_LANG === 'en' && keys.indexOf('en') >= 0) return 'en';
    return keys.indexOf('ja') >= 0 ? 'ja' : keys[0];
  }

  function localizedGuideStop(stop) {
    if (!stop) return null;
    var lang = readPreferredGuideLang(stop);
    var variant = lang && stop.variants ? stop.variants[lang] : null;
    if (!variant) return stop;
    var merged = {};
    Object.keys(stop).forEach(function (key) { merged[key] = stop[key]; });
    Object.keys(variant).forEach(function (key) { merged[key] = variant[key]; });
    merged.variants = stop.variants;
    merged.source_links = stop.source_links || [];
    merged.trigger_radius_m = stop.trigger_radius_m;
    merged.unlocked_radius_m = stop.unlocked_radius_m;
    merged.approved_by = stop.approved_by || '';
    merged.approval_state = stop.approval_state || '';
    merged.content_version = stop.content_version || '';
    merged._guide_lang = lang;
    return merged;
  }

  function renderGuideLanguageSelector(stop, activeLang) {
    var keys = guideVariantKeys(stop);
    if (keys.length <= 1) return '';
    return '<div class="me-area-guide-langs" role="group" aria-label="Guide language">' +
      keys.map(function (lang) {
        var selected = lang === activeLang;
        return '<button type="button" data-guide-lang-option="' + escapeHtml(lang) + '"' +
          (selected ? ' aria-pressed="true"' : ' aria-pressed="false"') +
          ' class="' + (selected ? 'is-active' : '') + '">' + escapeHtml(GUIDE_LANG_LABELS[lang] || lang) + '</button>';
      }).join('') +
    '</div>';
  }

  function renderGuideSpotContent(spot) {
    var sourceHtml = renderGuideSourceLinks(spot);
    var points = Array.isArray(spot.storyPoints) ? spot.storyPoints : [];
    var pointsHtml = points.length
      ? '<ul class="me-guide-spot-points">' + points.slice(0, 5).map(function (point) { return '<li>' + escapeHtml(point) + '</li>'; }).join('') + '</ul>'
      : '';
    return '<article class="me-guide-spot-detail">' +
      renderDetailHero({
        title: spot.title || COPY.selectedFieldLabel,
        meta: spot.subtitle || COPY.guideStopEyebrow,
        badge: COPY.areaBadgeGuideLabel,
      }) +
      '<section class="me-detail-section me-guide-spot-body">' +
        '<p>' + escapeHtml(spot.script || spot.preview || '') + '</p>' +
        pointsHtml +
        '<div class="me-area-guide-stop" data-area-guide-stop data-guide-state="unknown">' +
          '<div class="me-area-guide-status">' +
            '<span data-area-guide-status>' + escapeHtml(COPY.guideStopPermissionPrompt) + '</span>' +
            '<small>' + escapeHtml(COPY.guideStopDistanceTemplate) + '</small>' +
          '</div>' +
          '<div class="me-area-guide-actions">' +
            '<button type="button" class="me-area-guide-locate" data-area-guide-locate>' + escapeHtml(COPY.guideStopLocate) + '</button>' +
            '<button type="button" class="me-area-guide-play" data-area-guide-play disabled>' + escapeHtml(COPY.guideStopPlay) + '</button>' +
          '</div>' +
        '</div>' +
        sourceHtml +
      '</section>' +
    '</article>';
  }

  function renderGuideSpotGroupContent(features) {
    var items = (Array.isArray(features) ? features : [])
      .map(function (feature, index) {
        var spot = feature && feature.properties ? feature.properties : {};
        return '<button type="button" class="me-guide-spot-list-item" data-guide-spot-index="' + index + '">' +
          '<strong>' + escapeHtml(String(spot.title || COPY.guideStopEyebrow)) + '</strong>' +
          '<span>' + escapeHtml(String(spot.subtitle || COPY.guideStopFarLabel)) + '</span>' +
        '</button>';
      })
      .join('');
    return '<article class="me-guide-spot-detail me-guide-spot-cluster-detail">' +
      renderDetailHero({
        title: COPY.guideSpotClusterLabel,
        meta: String((features || []).length) + ' ' + COPY.areaBadgeGuideLabel,
        badge: COPY.areaBadgeGuideLabel,
      }) +
      '<section class="me-detail-section me-guide-spot-list">' + items + '</section>' +
    '</article>';
  }

  function openGuideSpotSheet(feature) {
    var center = guideSpotCenter(feature);
    var spot = feature && feature.properties ? feature.properties : null;
    if (!center || !spot) return;
    closeOverlapChoice();
    resetAreaGuideStopSession();
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = {
      lat: center.lat,
      lng: center.lng,
      kind: 'guide_spot',
      guideSpot: spot,
    };
    if (!shouldUseBottomSheet()) {
      if (sheetEl) {
        sheetEl.classList.remove('is-open');
        sheetEl.classList.remove('me-bottom-sheet--area');
        sheetEl.classList.remove('me-bottom-sheet--detail');
        sheetEl.removeAttribute('data-snap');
        sheetEl.setAttribute('aria-hidden', 'true');
      }
      setSideRailMode(false);
      renderSelectedCard();
      renderSidePanels();
      setSideTab('selection');
      saveMapState();
      return;
    }
    if (!sheetEl || !sheetInnerEl) return;
    sheetInnerEl.innerHTML = renderGuideSpotContent(spot);
    hydrateAreaGuideStopControls(sheetInnerEl);
    showAreaBottomSheet();
    renderSidePanels();
    saveMapState();
  }

  function openGuideSpotGroupSheet(features) {
    var list = Array.isArray(features) ? features.filter(Boolean) : [];
    if (list.length === 1) {
      openGuideSpotSheet(list[0]);
      return;
    }
    var firstCenter = guideSpotCenter(list[0]);
    if (!firstCenter) return;
    if (!shouldUseBottomSheet()) {
      openGuideSpotSheet(list[0]);
      return;
    }
    if (!sheetEl || !sheetInnerEl) return;
    closeOverlapChoice();
    resetAreaGuideStopSession();
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = {
      lat: firstCenter.lat,
      lng: firstCenter.lng,
      kind: 'guide_spot_cluster',
      guideSpots: list.map(function (feature) { return feature && feature.properties ? feature.properties : {}; }),
    };
    sheetInnerEl.innerHTML = renderGuideSpotGroupContent(list);
    sheetInnerEl.querySelectorAll('[data-guide-spot-index]').forEach(function (button) {
      button.addEventListener('click', function () {
        var index = Number(button.getAttribute('data-guide-spot-index'));
        if (Number.isFinite(index) && list[index]) openGuideSpotSheet(list[index]);
      });
    });
    showAreaBottomSheet();
    renderSidePanels();
    saveMapState();
  }

  function refreshAreaBadgeMarkers() {
    clearAreaBadgeMarkers();
    refreshNearbyAreaMarkers(state.nearbyAreaOrigin);
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
    var compact = !!(options && options.compact);
    if (photoUrl) {
      return '<figure class="me-detail-hero me-detail-hero-photo">' +
        '<img src="' + escapeHtml(toThumbUrl(photoUrl, 'lg')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-detail-hero&quot;).classList.add(&quot;is-empty&quot;);this.remove()" />' +
        '<figcaption><span>' + escapeHtml(badge) + '</span><strong>' + escapeHtml(title) + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</figcaption>' +
      '</figure>';
    }
    return '<div class="me-detail-hero me-detail-hero-map' + (compact ? ' me-detail-hero-compact' : '') + '">' +
      (compact ? '' : '<div class="me-detail-hero-mark" aria-hidden="true">⌖</div>') +
      '<div class="me-detail-hero-copy"><span>' + escapeHtml(badge) + '</span><strong>' + escapeHtml(title) + '</strong>' + (meta ? '<small>' + escapeHtml(meta) + '</small>' : '') + '</div>' +
    '</div>';
  }
  function renderDetailActions(items) {
    return '<div class="me-detail-actions">' + items.map(function (item) {
      var actionKey = String(item.actionKey || 'map:selected_place:cta').slice(0, 128);
      return '<a class="me-detail-action" href="' + escapeHtml(item.href) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="' + escapeHtml(actionKey) + '" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(item.href) + '">' +
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
  function gbifTaxonIcon(group) {
    if (group === 'bird') return '鳥';
    if (group === 'insect') return '虫';
    if (group === 'plant') return '植';
    if (group === 'amphibian_reptile') return '両';
    if (group === 'mammal') return '哺';
    if (group === 'fungi') return '菌';
    return '生';
  }
  function renderGbifAreaSummarySlot(slotId) {
    return '<section id="' + escapeHtml(slotId) + '" class="me-gbif-area-summary me-detail-section is-loading" aria-live="polite">' +
      '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.gbifAreaBadge) + '</span><strong>' + escapeHtml(COPY.gbifAreaTitle) + '</strong></div>' +
      '<p class="me-gbif-area-note">' + escapeHtml(COPY.gbifAreaLoading) + '</p>' +
    '</section>';
  }
  function renderGbifAreaSummary(summary) {
    if (!summary || summary.unavailable || !Number(summary.totalRecords || 0)) {
      return '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.gbifAreaBadge) + '</span><strong>' + escapeHtml(COPY.gbifAreaTitle) + '</strong></div>' +
        '<p class="me-gbif-area-note">' + escapeHtml(COPY.gbifAreaEmpty) + '</p>';
    }
    var taxa = Array.isArray(summary.topTaxa) ? summary.topTaxa.slice(0, 6) : [];
    var total = Number(summary.totalRecords || 0).toLocaleString();
    var latest = summary.latestYear ? String(summary.latestYear) : '—';
    var sourceUrl = String(summary.sourceUrl || '');
    var taxonRows = taxa.length
      ? '<div class="me-gbif-taxa-list" aria-label="' + escapeHtml(COPY.gbifAreaTopTaxaLabel) + '">' + taxa.map(function (taxon) {
          var label = taxon.displayNameJa || taxon.commonNameJa || taxon.canonicalName || taxon.scientificName || 'GBIF taxon';
          var scientific = taxon.scientificName || taxon.canonicalName || '';
          var scientificHtml = scientific && scientific !== label ? '<em>' + escapeHtml(scientific) + '</em>' : '';
          var count = Number(taxon.recordCount || 0).toLocaleString();
          return '<div class="me-gbif-taxon"><span aria-hidden="true">' + escapeHtml(gbifTaxonIcon(taxon.taxonGroup)) + '</span><strong>' + escapeHtml(label) + scientificHtml + '</strong><small>' + escapeHtml(count) + '</small></div>';
        }).join('') + '</div>'
      : '';
    return '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.gbifAreaBadge) + '</span><strong>' + escapeHtml(COPY.gbifAreaTitle) + '</strong></div>' +
      '<p class="me-gbif-area-note">' + escapeHtml(COPY.gbifAreaSafety) + '</p>' +
      '<div class="me-gbif-area-stats">' +
        '<div><span>' + escapeHtml(COPY.gbifAreaRecordCountLabel) + '</span><strong>' + escapeHtml(total) + '</strong></div>' +
        '<div><span>' + escapeHtml(COPY.gbifAreaLatestYearLabel) + '</span><strong>' + escapeHtml(latest) + '</strong></div>' +
      '</div>' +
      taxonRows +
      '<div class="me-gbif-area-source"><span>' + escapeHtml(COPY.gbifAreaSourceLabel) + ': GBIF / CC0・CC BY</span>' +
        (sourceUrl ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener">' + escapeHtml(COPY.gbifAreaSourceLink) + ' ↗</a>' : '') +
      '</div>';
  }
  function fetchGbifAreaSummary(cellId, target) {
    if (!apiGbifAreaSummary || !cellId || !target) return;
    var url = apiGbifAreaSummary + '?cell_id=' + encodeURIComponent(cellId);
    fetch(url, { headers: { accept: 'application/json' } })
      .then(function (response) {
        if (!response.ok) throw new Error('gbif area summary ' + response.status);
        return response.json();
      })
      .then(function (payload) {
        target.classList.remove('is-loading');
        target.innerHTML = renderGbifAreaSummary(payload);
      })
      .catch(function () {
        target.classList.remove('is-loading');
        target.innerHTML = renderGbifAreaSummary(null);
      });
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
      '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.sideRecentLabel) + '</span><strong>' + escapeHtml(COPY.recentFindsHint) + '</strong></div>' +
      '<div class="me-detail-recent-grid">' + records.map(function (record) {
        var date = record.observedAt ? String(record.observedAt).slice(0, 10) : '';
        var thumb = record.photoUrl
          ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.closest(&quot;.me-detail-recent-item&quot;).classList.add(&quot;is-photoless&quot;);this.remove()" />'
          : '<span class="me-detail-recent-placeholder" aria-hidden="true">✦</span>';
        return '<button type="button" class="me-detail-recent-item" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '">' +
          thumb +
          '<strong>' + escapeHtml(recordDisplayName(record)) + '</strong>' +
          (date ? '<small>' + escapeHtml(date) + '</small>' : '') +
        '</button>';
      }).join('') + '</div>' +
    '</section>';
  }

  function renderDetailWalkableFinds(context) {
    var items = nearbyRecordsForContext(context, 650);
    if (!items.length) return '';
    return '<section class="me-detail-section me-detail-walk" aria-label="' + escapeHtml(COPY.walkableFindsAria) + '">' +
      '<div class="me-detail-section-head"><span>' + escapeHtml(COPY.walkableFindsAria) + '</span><strong>' + escapeHtml(COPY.walkableFindsTitle) + '</strong></div>' +
      '<div class="me-detail-walk-list">' + items.map(function (item) {
        var record = item.record;
        var date = record.observedAt ? String(record.observedAt).slice(0, 10) : '';
        var distance = item.meters < 100 ? COPY.nearDistanceImmediate : COPY.nearDistanceApproxPrefix + String(Math.round(item.meters / 50) * 50) + 'm';
        var thumb = record.photoUrl
          ? '<img src="' + escapeHtml(toThumbUrl(record.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />'
          : '<span aria-hidden="true">✦</span>';
        return '<button type="button" class="me-detail-walk-item" data-occurrence-id="' + escapeHtml(record.occurrenceId || '') + '">' +
          thumb +
          '<strong>' + escapeHtml(recordDisplayName(record)) + '</strong>' +
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
  function renderSiteBriefSlot(slotId, context) {
    return '<div id="' + escapeHtml(slotId) + '" class="me-site-brief-slot" data-brief-fallback="1" aria-live="polite">' +
      renderDetailVisitReasons(context) +
    '</div>';
  }
  function placeAtlasRefForContext(context) {
    if (!context) return null;
    if (context.kind === 'cell') {
      var cellProps = context.cellFeature && context.cellFeature.properties ? context.cellFeature.properties : {};
      var cellId = String(cellProps.cellId || state.selectedCellId || '');
      return cellId ? { kind: 'public_cell', cellId: cellId } : null;
    }
    if (context.kind !== 'area') return null;
    var props = context.areaFeature && context.areaFeature.properties ? context.areaFeature.properties : {};
    var fieldId = String(context.fieldId || props.field_id || '');
    if (!context.transient && fieldId && fieldId.indexOf('osm-live:') !== 0) {
      return { kind: 'field', fieldId: fieldId };
    }
    var entityKey = String(props.entity_key || '');
    var entityMatch = entityKey.match(/^osm:(way|relation):([0-9]+)$/);
    var osmType = String(props.osm_type || (entityMatch && entityMatch[1]) || '');
    var osmId = Number(props.osm_id || (entityMatch && entityMatch[2]) || 0);
    if ((osmType === 'way' || osmType === 'relation') && Number.isSafeInteger(osmId) && osmId > 0) {
      return { kind: 'osm_area', entityKey: 'osm:' + osmType + ':' + String(osmId), osmType: osmType, osmId: osmId };
    }
    return null;
  }
  function placeAtlasRefKey(ref) {
    if (!ref) return '';
    if (ref.kind === 'field') return 'field:' + ref.fieldId;
    if (ref.kind === 'public_cell') return 'public_cell:' + ref.cellId;
    return ref.entityKey;
  }
  function placeAtlasUrl(ref) {
    if (!apiPlaceProfile || !ref) return '';
    var query = new URLSearchParams();
    query.set('kind', ref.kind);
    if (ref.kind === 'field') query.set('fieldId', ref.fieldId);
    if (ref.kind === 'public_cell') query.set('cellId', ref.cellId);
    if (ref.kind === 'osm_area') {
      query.set('entityKey', ref.entityKey);
      query.set('osmType', ref.osmType);
      query.set('osmId', String(ref.osmId));
    }
    return apiPlaceProfile + (apiPlaceProfile.indexOf('?') >= 0 ? '&' : '?') + query.toString();
  }
  function placeAtlasNameForContext(context) {
    var props = context && context.areaFeature && context.areaFeature.properties ? context.areaFeature.properties : {};
    if (context && context.kind === 'cell') return COPY.cellAggregateTitle;
    return String(props.name || COPY.osmAreaFallbackName || '');
  }
  function placeAtlasRenderOptions() {
    return {
      lang: SEARCH_LANG,
      recordHref: RECORD_HREF,
      recordsHref: COMMUNITY_RECORDS_HREF,
    };
  }
  function renderPlaceAtlasContent(context, fallbackHtml) {
    var ref = placeAtlasRefForContext(context);
    if (!ref || !apiPlaceProfile) return fallbackHtml || '';
    if (context.placeAtlasProfile) {
      return MapPlaceAtlasProfile.render(context.placeAtlasProfile, placeAtlasRenderOptions());
    }
    if (context.placeAtlasStatus === 'error') {
      return MapPlaceAtlasProfile.error(SEARCH_LANG) + (fallbackHtml || '');
    }
    return MapPlaceAtlasProfile.loading(SEARCH_LANG, placeAtlasNameForContext(context));
  }
  function bindPlaceAtlasContent(rootEl) {
    MapPlaceAtlasProfile.bind(rootEl || document);
  }
  function renderPlaceAtlasMobileSelection() {
    if (!shouldUseBottomSheet() || !sheetInnerEl || !state.selectedPoint) return;
    var context = state.selectedPoint;
    if (context.kind !== 'area' && context.kind !== 'cell') return;
    var fallback = '';
    if (context.kind === 'area' && context.areaSnapshot) fallback = renderAreaSheet(context.areaSnapshot);
    sheetInnerEl.innerHTML = renderPlaceAtlasContent(context, fallback);
    bindPlaceAtlasContent(sheetInnerEl);
    if (context.kind === 'area') hydrateAreaGuideStopControls(sheetInnerEl);
  }
  function rerenderPlaceAtlasSelection() {
    if (shouldUseBottomSheet()) {
      renderPlaceAtlasMobileSelection();
      return;
    }
    renderSelectedCard();
    renderSidePanels();
  }
  function requestPlaceAtlasForSelection(context) {
    var ref = placeAtlasRefForContext(context);
    if (!ref || !apiPlaceProfile) return;
    if (placeAtlasAbort) {
      try { placeAtlasAbort.abort(); } catch (_) {}
    }
    var controller = new AbortController();
    placeAtlasAbort = controller;
    var seq = ++placeAtlasSeq;
    var refKey = placeAtlasRefKey(ref);
    var requestStartedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    context.placeAtlasProfile = null;
    context.placeAtlasStatus = 'loading';
    context.placeAtlasRefKey = refKey;
    rerenderPlaceAtlasSelection();
    var timedOut = false;
    var timeout = setTimeout(function () {
      timedOut = true;
      try { controller.abort(); } catch (_) {}
    }, 8000);
    fetch(placeAtlasUrl(ref), {
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then(function (response) {
        if (!response.ok) throw new Error('place_atlas_' + String(response.status));
        return response.json();
      })
      .then(function (payload) {
        if (seq !== placeAtlasSeq) return;
        var selected = state.selectedPoint;
        if (!selected || placeAtlasRefKey(placeAtlasRefForContext(selected)) !== refKey) return;
        if (!payload || !payload.profile || payload.profile.version !== 1) throw new Error('place_atlas_contract');
        selected.placeAtlasProfile = payload.profile;
        selected.placeAtlasStatus = 'success';
        var completedAt = typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
        sendMapKpi('place_profile_open', 'map:place_atlas:profile_open', {
          placeKind: String(payload.profile && payload.profile.place && payload.profile.place.type || ref.kind || 'place').slice(0, 80),
          publicationStatus: String(payload.profile && payload.profile.publication && payload.profile.publication.status || 'partial').slice(0, 40),
          latencyMs: Math.max(0, Math.round(completedAt - requestStartedAt)),
          source: 'place_profile_api'
        });
        rerenderPlaceAtlasSelection();
      })
      .catch(function (error) {
        if (seq !== placeAtlasSeq) return;
        if (controller.signal.aborted && !timedOut) return;
        var selected = state.selectedPoint;
        if (!selected || placeAtlasRefKey(placeAtlasRefForContext(selected)) !== refKey) return;
        selected.placeAtlasProfile = null;
        selected.placeAtlasStatus = 'error';
        selected.placeAtlasError = String(error && error.message || 'place_atlas_unavailable');
        rerenderPlaceAtlasSelection();
      })
      .finally(function () {
        clearTimeout(timeout);
        if (placeAtlasAbort === controller) placeAtlasAbort = null;
      });
  }
  function renderPlaceDetailActions(context) {
    var hasCoord = context && Number.isFinite(context.lat) && Number.isFinite(context.lng);
    var eventHref = context && context.memoryPlace ? buildPlaceMemoryRecordHref(context.memoryPlace) : RECORD_HREF;
    var fieldHref = context && context.memoryPlace && hasCoord ? buildPlaceMemoryRecordHref(context.memoryPlace) : NOTES_HREF;
    var recordLabel = context && context.memoryPlace ? COPY.placeActionRecord : COPY.areaSafeRecordLabel;
    if (context && context.kind === 'cell') {
      return renderDetailActions([
        { icon: '＋', label: COPY.areaSafeRecordLabel, href: RECORD_HREF, actionKey: 'map:selected_cell:record' },
        { icon: '🔍', label: COPY.placeActionGuide, href: LENS_HREF, actionKey: 'map:selected_cell:lens' },
        { icon: '📡', label: COPY.placeActionScan, href: SCAN_HREF, actionKey: 'map:selected_cell:scan' },
        { icon: '↗', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:selected_cell:notes' },
      ]);
    }
    if (!context || !context.memoryPlace) {
      return renderDetailActions([
        { icon: '＋', label: COPY.areaSafeRecordLabel, href: RECORD_HREF, actionKey: 'map:selected_place:record' },
        { icon: '🔍', label: COPY.placeActionGuide, href: LENS_HREF, actionKey: 'map:selected_place:lens' },
        { icon: '📡', label: COPY.placeActionScan, href: SCAN_HREF, actionKey: 'map:selected_place:scan' },
        { icon: '↗', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:selected_place:notes' },
      ]);
    }
    return renderDetailActions([
      { icon: '＋', label: recordLabel, href: eventHref, actionKey: 'map:memory_place:record' },
      { icon: '☆', label: COPY.placeActionFollow, href: fieldHref, actionKey: 'map:memory_place:follow' },
      { icon: '🔍', label: COPY.placeActionGuide, href: LENS_HREF, actionKey: 'map:memory_place:lens' },
      { icon: '📡', label: COPY.placeActionScan, href: SCAN_HREF, actionKey: 'map:memory_place:scan' },
      { icon: '↗', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:memory_place:notes' },
    ]);
  }
  function renderSelectedCard() {
    if (!selectedCardEl) return;
    if (shouldUseBottomSheet()) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      clearSideSelection();
      resetAreaGuideStopSession();
      return;
    }
    var context = getSelectedContext();
    if (!context) {
      selectedCardEl.innerHTML = '';
      selectedCardEl.classList.remove('is-visible');
      clearSideSelection();
      resetAreaGuideStopSession();
      return;
    }
    if (context.kind === 'area') {
      var areaFallbackContent = context.areaSnapshot
        ? renderAreaSheet(context.areaSnapshot)
        : context.areaFeature
          ? renderTransientAreaContent(context.areaFeature, { lat: context.lat, lng: context.lng })
          : '<div class="me-area-sheet-loading">' + escapeHtml(COPY.areaLoading) + '</div>';
      var areaContent = renderPlaceAtlasContent(context, areaFallbackContent);
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-area">' +
          areaContent +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      bindPlaceAtlasContent(selectedCardEl);
      hydrateAreaGuideStopControls(selectedCardEl);
      return;
    }
    if (context.kind === 'guide_spot') {
      resetAreaGuideStopSession();
      selectedCardEl.innerHTML = renderGuideSpotContent(context.guideSpot || {});
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      hydrateAreaGuideStopControls(selectedCardEl);
      return;
    }
    if (context.kind === 'place') {
      resetAreaGuideStopSession();
      var seq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-place">' +
          renderDetailHero({ title: COPY.selectedPointName, meta: '', badge: COPY.selectionPlaceLabel }) +
          renderAggregateSafety(COPY.mapPointSafety) +
          renderDetailVisitReasons(context) +
          renderSiteBriefSlot('me-selected-brief-slot', context) +
          renderDetailRecentFinds(context) +
          renderDetailWalkableFinds(context) +
          renderPlaceDetailActions(context) +
          renderDetailStats([
            { label: COPY.placeStoryNow, value: COPY.placeStoryNoTaxa },
            { label: COPY.placeStoryMissing, value: COPY.placeStoryNeedSeason },
          ]) +
          '<section id="me-selected-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient(context) + '</section>' +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      bindDetailRecentFinds(selectedCardEl);
      fetchSiteBrief(context.lat, context.lng, seq, document.getElementById('me-selected-brief-slot'));
      return;
    }
    if (context.kind === 'cell') {
      if (apiPlaceProfile) {
        resetAreaGuideStopSession();
        selectedCardEl.innerHTML =
          '<article class="me-detail-panel me-detail-panel-cell">' +
            renderPlaceAtlasContent(context, '') +
          '</article>';
        selectedCardEl.classList.add('is-visible');
        markSideSelection();
        bindPlaceAtlasContent(selectedCardEl);
        return;
      }
      resetAreaGuideStopSession();
      var feature = context.cellFeature;
      var cellProps = feature && feature.properties ? feature.properties : {};
      var countLabel = Number(cellProps.count || 0) + ' ' + COPY.resultCountLabel;
      var latest = cellProps.latestObservedAt ? String(cellProps.latestObservedAt).slice(0, 10) : '';
      var era = cellProps.nameEraLabel ? String(cellProps.nameEraLabel) : '';
      var gbifSlotId = 'me-selected-gbif-area-slot';
      var cellSeq = ++siteBriefSeq;
      selectedCardEl.innerHTML =
        '<article class="me-detail-panel me-detail-panel-cell">' +
          renderDetailHero({ title: COPY.cellAggregateTitle, meta: countLabel + (latest ? ' · ' + latest : '') + (era ? ' · ' + era : ''), badge: COPY.cellAggregateBadge }) +
          renderAggregateSafety(COPY.cellAggregateSafety) +
          renderGbifAreaSummarySlot(gbifSlotId) +
          renderDetailVisitReasons(context) +
          renderSiteBriefSlot('me-selected-brief-slot', context) +
          renderDetailRecentFinds(context) +
          renderDetailWalkableFinds(context) +
          renderPlaceDetailActions(context) +
          renderDetailStats([
            { label: COPY.placeStoryRecent, value: countLabel },
            { label: COPY.placeStoryActions, value: latest || COPY.placeStoryNeedSeason },
          ]) +
          '<section id="me-selected-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient(context) + '</section>' +
        '</article>';
      selectedCardEl.classList.add('is-visible');
      markSideSelection();
      bindDetailRecentFinds(selectedCardEl);
      fetchGbifAreaSummary(cellProps.cellId, document.getElementById(gbifSlotId));
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
          title: recordDisplayName(record),
          meta: (record.localityLabel || '—') + (record.observedAt ? ' · ' + String(record.observedAt).slice(0, 10) : ''),
          badge: COPY.selectionObservationLabel + (record.isAiCandidate ? ' · ' + COPY.aiCandidateLabel : record.isAwaitingId ? ' · ' + COPY.awaitingIdLabel : ''),
          photoUrl: record.photoUrl || '',
        }) +
        renderDetailVisitReasons(context) +
        renderDetailRecentFinds(context) +
        renderDetailWalkableFinds(context) +
        renderDetailActions([
          { icon: '↗', label: COPY.selectedCardLabel, href: href, actionKey: 'map:selected_observation:open' },
          { icon: '✓', label: COPY.identifyLabel, href: identifyHref, actionKey: 'map:selected_observation:identify' },
          { icon: '＋', label: COPY.bottomSheetRecord, href: RECORD_HREF, actionKey: 'map:selected_observation:record' },
          { icon: '📖', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:selected_observation:notes' },
        ]) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: recordDisplayName(record) },
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

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  function isIkimonSourceUrl(url) {
    var text = String(url || '').trim();
    if (!text) return false;
    try {
      var parsed = new URL(text, window.location.origin);
      return parsed.hostname === 'zukan.earth' || parsed.hostname.endsWith('.zukan.earth') || parsed.hostname === 'ikimon.life' || /\\.ikimon\\.life$/.test(parsed.hostname);
    } catch (_) {
      return /^https?:\\/\\/(?:[^/]+\\.)?ikimon\\.life(?:[/:?#]|$)/i.test(text);
    }
  }

  function sourceConfidenceLabel(score, label, level) {
    var cleanLabel = String(label || '').trim();
    if (cleanLabel) return cleanLabel;
    if (level === 'registry_matched') return '公的台帳と一致';
    if (level === 'page_verified') return '公式ページで確認';
    if (level === 'owner_verified') return '設置者により確認済み';
    if (level === 'staff_verified') return '担当者確認済み';
    var n = Number(score);
    if (!Number.isFinite(n)) n = 0;
    if (n >= 0.95) return '一次情報: 強い外部根拠あり';
    if (n >= 0.75) return '一次情報: 公式ページ候補あり';
    if (n >= 0.45) return '一次情報: 外部情報確認中';
    return '一次情報: 未確認';
  }

  function renderAreaSourceTrust(score, label, level) {
    return '<span class="me-area-sheet-source-trust">' + escapeHtml(sourceConfidenceLabel(score, label, level)) + '</span>';
  }

  function renderAreaSourceLinks(source) {
    var items = [];
    var ownerUrl = String(source.ownerUrl || source.owner_url || '');
    var certificationUrl = String(source.certificationUrl || source.certification_url || '');
    var storyUrl = String(source.storyUrl || source.story_url || '');
    var officialUrl = String(source.officialUrl || source.official_url || '');
    if (ownerUrl) items.push({ label: '公式', url: ownerUrl });
    if (certificationUrl) items.push({ label: '認定情報', url: certificationUrl });
    if (storyUrl) items.push({ label: '事例', url: storyUrl });
    if (!items.length && officialUrl) {
      items.push({ label: isIkimonSourceUrl(officialUrl) ? '事例' : '公式', url: officialUrl });
    }
    var seen = {};
    return items.filter(function (item) {
      var key = item.url.trim();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    }).map(function (item) {
      return '<a class="me-area-sheet-url" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">' + escapeHtml(item.label) + ' ↗</a>';
    }).join('');
  }

  function parseGuideStopValue(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (_) { return null; }
    }
    if (typeof raw === 'object') return raw;
    return null;
  }

  function areaGuideStopFrom(source) {
    var raw = source && (source.guideStop || source.guide_stop || source.guideStopJson || source.guide_stop_json);
    var item = parseGuideStopValue(raw);
    if (!item || item.enabled !== true) return null;
    var variants = {};
    if (item.variants && typeof item.variants === 'object' && !Array.isArray(item.variants)) {
      GUIDE_LANG_ORDER.forEach(function (lang) {
        var variant = item.variants[lang];
        if (!variant || typeof variant !== 'object') return;
        var variantTitle = String(variant.title || '').trim();
        var variantPreview = String(variant.preview || '').trim();
        var variantScript = String(variant.script || '').trim();
        var variantPoints = Array.isArray(variant.story_points)
          ? variant.story_points.map(function (point) { return String(point || '').trim(); }).filter(Boolean).slice(0, 6)
          : [];
        if (!variantTitle || (!variantPreview && !variantScript && !variantPoints.length)) return;
        variants[lang] = {
          language: String(variant.language || lang).trim(),
          title: variantTitle,
          subtitle: String(variant.subtitle || '').trim(),
          preview: variantPreview,
          script: variantScript,
          tts_script: String(variant.tts_script || '').trim(),
          audio_url: String(variant.audio_url || '').trim(),
          audio_provider: String(variant.audio_provider || '').trim(),
          audio_voice: String(variant.audio_voice || '').trim(),
          audio_generated_at: String(variant.audio_generated_at || '').trim(),
          story_points: variantPoints,
        };
      });
    }
    var fallbackVariant = variants.ja || variants.en || variants['zh-TW'] || variants['zh-CN'] || null;
    var title = String(item.title || (fallbackVariant && fallbackVariant.title) || '').trim();
    if (!title) return null;
    var points = Array.isArray(item.story_points)
      ? item.story_points.map(function (point) { return String(point || '').trim(); }).filter(Boolean).slice(0, 5)
      : [];
    var preview = String(item.preview || (fallbackVariant && fallbackVariant.preview) || '').trim();
    var script = String(item.script || (fallbackVariant && fallbackVariant.script) || '').trim();
    var sourceLinks = guideStopSourceLinks(item);
    if (!preview && !script && !points.length) return null;
    var triggerRadius = Number(item.trigger_radius_m || item.triggerRadiusM || 90);
    if (!Number.isFinite(triggerRadius)) triggerRadius = 90;
    triggerRadius = Math.max(20, Math.min(300, Math.round(triggerRadius)));
    var unlockRadius = Number(item.unlocked_radius_m || item.unlockedRadiusM || triggerRadius);
    if (!Number.isFinite(unlockRadius)) unlockRadius = triggerRadius;
    unlockRadius = Math.max(20, Math.min(triggerRadius, Math.round(unlockRadius)));
    return {
      enabled: true,
      title: title,
      subtitle: String(item.subtitle || (fallbackVariant && fallbackVariant.subtitle) || '').trim(),
      language: String(item.language || (fallbackVariant && fallbackVariant.language) || SEARCH_LANG || 'ja').trim(),
      preview: preview,
      script: script,
      tts_script: String(item.tts_script || (fallbackVariant && fallbackVariant.tts_script) || '').trim(),
      audio_url: String(item.audio_url || (fallbackVariant && fallbackVariant.audio_url) || '').trim(),
      audio_provider: String(item.audio_provider || (fallbackVariant && fallbackVariant.audio_provider) || '').trim(),
      audio_voice: String(item.audio_voice || (fallbackVariant && fallbackVariant.audio_voice) || '').trim(),
      audio_generated_at: String(item.audio_generated_at || (fallbackVariant && fallbackVariant.audio_generated_at) || '').trim(),
      story_points: points,
      variants: Object.keys(variants).length ? variants : undefined,
      trigger_radius_m: triggerRadius,
      unlocked_radius_m: unlockRadius,
      approved_by: String(item.approved_by || item.approvedBy || '').trim(),
      approval_state: String(item.approval_state || item.approvalState || '').trim(),
      content_version: String(item.content_version || item.contentVersion || '').trim(),
      source_links: sourceLinks,
    };
  }

  function renderAreaGuideStop(source, center) {
    var baseStop = areaGuideStopFrom(source);
    var stop = localizedGuideStop(baseStop);
    if (!stop || !center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return '';
    var points = stop.story_points.length
      ? '<ul class="me-area-guide-points">' + stop.story_points.map(function (point) { return '<li>' + escapeHtml(point) + '</li>'; }).join('') + '</ul>'
      : '';
    var body = stop.subtitle || stop.preview;
    var approval = stop.approval_state === 'owner_verified'
      ? COPY.guideStopApprovalOwner
      : (stop.approval_state || COPY.guideStopFarLabel);
    if (stop.approved_by) approval += ' / ' + stop.approved_by;
    return ''
      + '<section class="me-area-guide-stop" data-area-guide-stop data-guide-state="unknown" aria-label="' + escapeHtml(COPY.guideStopEyebrow) + '">'
      +   '<div class="me-area-guide-head">'
      +     '<span>' + escapeHtml(COPY.guideStopEyebrow) + '</span>'
      +     '<strong>' + escapeHtml(stop.title) + '</strong>'
      +   '</div>'
      +   renderGuideLanguageSelector(baseStop, stop._guide_lang || stop.language)
      +   (body ? '<p class="me-area-guide-lead">' + escapeHtml(body) + '</p>' : '')
      +   points
      +   '<div class="me-area-guide-status">'
      +     '<span data-area-guide-status>' + escapeHtml(COPY.guideStopPermissionPrompt) + '</span>'
      +     '<small>' + escapeHtml(COPY.guideStopDistanceTemplate) + '</small>'
      +   '</div>'
      +   '<div class="me-area-guide-actions">'
      +     '<button type="button" class="me-area-guide-locate" data-area-guide-locate>' + escapeHtml(COPY.guideStopLocate) + '</button>'
      +     '<button type="button" class="me-area-guide-play" data-area-guide-play disabled>' + escapeHtml(COPY.guideStopPlay) + '</button>'
      +   '</div>'
      +   renderGuideSourceLinks(stop)
      +   '<div class="me-area-guide-approval">' + escapeHtml(approval) + '</div>'
      + '</section>';
  }

  function currentAreaGuideStopContext() {
    var selected = state.selectedPoint || null;
    if (selected && selected.kind === 'guide_spot' && selected.guideSpot) {
      var spot = selected.guideSpot;
      var trigger = Number(spot.triggerRadiusM || spot.trigger_radius_m || 220);
      if (!Number.isFinite(trigger)) trigger = 220;
      trigger = Math.max(20, Math.min(300, Math.round(trigger)));
      var unlocked = Number(spot.unlockedRadiusM || spot.unlocked_radius_m || trigger);
      if (!Number.isFinite(unlocked)) unlocked = trigger;
      unlocked = Math.max(20, Math.min(trigger, Math.round(unlocked)));
      return {
        stop: {
          title: String(spot.title || ''),
          subtitle: String(spot.subtitle || ''),
          preview: String(spot.preview || ''),
          script: String(spot.script || ''),
          story_points: Array.isArray(spot.storyPoints) ? spot.storyPoints : [],
          trigger_radius_m: trigger,
          unlocked_radius_m: unlocked,
          language: SEARCH_LANG || 'ja',
        },
        center: { lat: selected.lat, lng: selected.lng },
        panel: null,
        lastDistance: null,
        unlocked: false,
      };
    }
    var feature = selected && selected.areaFeature ? selected.areaFeature : null;
    var source = feature && feature.properties
      ? feature.properties
      : (selected && selected.areaSnapshot && selected.areaSnapshot.field ? selected.areaSnapshot.field : null);
    var stop = localizedGuideStop(areaGuideStopFrom(source));
    if (!stop) return null;
    var center = feature
      ? areaFeatureCenter(feature, selected && selected.lat, selected && selected.lng)
      : (selected && Number.isFinite(selected.lat) && Number.isFinite(selected.lng) ? { lat: selected.lat, lng: selected.lng } : null);
    if (!center) return null;
    return { stop: stop, center: center, panel: null, lastDistance: null, unlocked: false };
  }

  function stopAreaGuideStopWatch() {
    if (areaGuideWatchId == null) return;
    try {
      if (navigator.geolocation && navigator.geolocation.clearWatch) navigator.geolocation.clearWatch(areaGuideWatchId);
    } catch (_) {}
    areaGuideWatchId = null;
  }

  function setGuideStopPlaying(panel, playing) {
    if (!panel) return;
    var playBtn = panel.querySelector('[data-area-guide-play]');
    if (playBtn) playBtn.textContent = playing ? COPY.guideStopStop : COPY.guideStopPlay;
    panel.classList.toggle('is-speaking', !!playing);
  }

  function stopAreaGuideSpeech() {
    if (!activeGuideSpeech && !activeGuideAudio) return;
    if (activeGuideAudio) {
      try {
        activeGuideAudio.pause();
        activeGuideAudio.currentTime = 0;
      } catch (_) {}
      activeGuideAudio = null;
    }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
    activeGuideSpeech = null;
    setGuideStopPlaying(activeGuideStopContext && activeGuideStopContext.panel, false);
  }

  function resetAreaGuideStopSession() {
    stopAreaGuideStopWatch();
    stopAreaGuideSpeech();
    activeGuideStopContext = null;
  }

  function updateAreaGuideStopStatus(coords) {
    var context = activeGuideStopContext;
    if (!context || !context.panel) return;
    var panel = context.panel;
    var statusEl = panel.querySelector('[data-area-guide-status]');
    var playBtn = panel.querySelector('[data-area-guide-play]');
    var hintEl = panel.querySelector('.me-area-guide-status small');
    var radius = context.stop.unlocked_radius_m || context.stop.trigger_radius_m || 90;
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      context.lastDistance = null;
      context.unlocked = false;
      panel.setAttribute('data-guide-state', 'unknown');
      if (statusEl) statusEl.textContent = COPY.guideStopPermissionPrompt;
      if (hintEl) hintEl.textContent = COPY.guideStopDistanceTemplate;
      if (playBtn) playBtn.setAttribute('disabled', 'disabled');
      return;
    }
    var distance = distanceMeters(coords, context.center);
    var unlocked = Number.isFinite(distance) && distance <= radius;
    context.lastDistance = distance;
    context.unlocked = unlocked;
    panel.setAttribute('data-guide-state', unlocked ? 'unlocked' : 'locked');
    if (statusEl) {
      if (unlocked) {
        statusEl.textContent = COPY.guideStopNearLabel;
      } else {
        statusEl.textContent = distance <= radius * 2 ? COPY.guideStopVeryNearLabel : COPY.guideStopFarTemplate;
      }
    }
    if (hintEl) hintEl.textContent = COPY.guideStopDistanceTemplate;
    if (playBtn) {
      if (unlocked) playBtn.removeAttribute('disabled');
      else playBtn.setAttribute('disabled', 'disabled');
    }
  }

  function startAreaGuideStopWatch() {
    var context = activeGuideStopContext;
    if (!context || !context.panel) return;
    if (!navigator.geolocation || !navigator.geolocation.watchPosition) {
      var statusEl = context.panel.querySelector('[data-area-guide-status]');
      if (statusEl) statusEl.textContent = COPY.locateError;
      return;
    }
    if (areaGuideWatchId != null) return;
    areaGuideWatchId = navigator.geolocation.watchPosition(function (pos) {
      var coords = pos && pos.coords ? { lat: Number(pos.coords.latitude), lng: Number(pos.coords.longitude) } : null;
      updateAreaGuideStopStatus(coords);
    }, function () {
      var statusEl = context.panel.querySelector('[data-area-guide-status]');
      if (statusEl) statusEl.textContent = COPY.locateError;
      updateAreaGuideStopStatus(null);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
  }

  function speakAreaGuideStop() {
    var context = activeGuideStopContext;
    if (!context || !context.panel || !context.unlocked) return;
    if (activeGuideSpeech || activeGuideAudio) {
      stopAreaGuideSpeech();
      return;
    }
    var stop = context.stop;
    if (stop.audio_url) {
      if (!window.Audio) {
        var unsupportedEl = context.panel.querySelector('[data-area-guide-status]');
        if (unsupportedEl) unsupportedEl.textContent = COPY.guideStopUnsupported;
        return;
      }
      var audio = new window.Audio(stop.audio_url);
      audio.preload = 'auto';
      audio.onended = function () {
        if (activeGuideAudio === audio) activeGuideAudio = null;
        setGuideStopPlaying(context.panel, false);
      };
      audio.onerror = function () {
        if (activeGuideAudio === audio) activeGuideAudio = null;
        setGuideStopPlaying(context.panel, false);
        var statusEl = context.panel.querySelector('[data-area-guide-status]');
        if (statusEl) statusEl.textContent = COPY.guideStopUnsupported;
      };
      activeGuideAudio = audio;
      setGuideStopPlaying(context.panel, true);
      var playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () { audio.onerror(); });
      }
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      var statusEl = context.panel.querySelector('[data-area-guide-status]');
      if (statusEl) statusEl.textContent = COPY.guideStopUnsupported;
      return;
    }
    var text = [stop.title, stop.script || stop.preview].concat(stop.story_points || []).filter(Boolean).join('。');
    if (!text) return;
    var utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = stop.language || (SEARCH_LANG === 'ja' ? 'ja-JP' : SEARCH_LANG);
    utterance.rate = 0.96;
    utterance.onend = function () {
      if (activeGuideSpeech === utterance) activeGuideSpeech = null;
      setGuideStopPlaying(context.panel, false);
    };
    utterance.onerror = utterance.onend;
    activeGuideSpeech = utterance;
    setGuideStopPlaying(context.panel, true);
    try { window.speechSynthesis.cancel(); } catch (_) {}
    window.speechSynthesis.speak(utterance);
  }

  function hydrateAreaGuideStopControls(scope) {
    stopAreaGuideStopWatch();
    var host = scope || document;
    var panel = host.querySelector ? host.querySelector('[data-area-guide-stop]') : null;
    if (!panel) {
      stopAreaGuideSpeech();
      activeGuideStopContext = null;
      return;
    }
    var context = currentAreaGuideStopContext();
    if (!context) {
      stopAreaGuideSpeech();
      activeGuideStopContext = null;
      return;
    }
    context.panel = panel;
    activeGuideStopContext = context;
    updateAreaGuideStopStatus(null);
    var locateBtn = panel.querySelector('[data-area-guide-locate]');
    var playBtn = panel.querySelector('[data-area-guide-play]');
    panel.querySelectorAll('[data-guide-lang-option]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-guide-lang-option') || '';
        if (!lang) return;
        try { if (window.localStorage) window.localStorage.setItem(GUIDE_LANG_STORAGE_KEY, lang); } catch (_) {}
        stopAreaGuideSpeech();
        if (shouldUseBottomSheet() && sheetInnerEl && state.selectedPoint && state.selectedPoint.areaSnapshot) {
          sheetInnerEl.innerHTML = renderAreaSheet(state.selectedPoint.areaSnapshot);
          hydrateAreaGuideStopControls(sheetInnerEl);
        } else {
          renderSelectedCard();
        }
      });
    });
    if (locateBtn) locateBtn.addEventListener('click', function () { startAreaGuideStopWatch(); });
    if (playBtn) playBtn.addEventListener('click', function () { speakAreaGuideStop(); });
  }

  function areaText(area) {
    var a = area || {};
    return [
      a.source,
      a.source_kind,
      a.sourceLabel,
      a.source_label,
      a.admin_level,
      a.fieldSource,
      a.name,
      a.label,
      a.ownerName,
      a.owner_name
    ].filter(function (value) { return value != null && value !== ''; }).join(' ');
  }

  function areaSourceKind(area) {
    var a = area || {};
    return String(a.source || a.source_kind || a.admin_level || a.fieldSource || a.sourceLabel || a.source_label || '').toLowerCase();
  }

  function isSchoolArea(area) {
    var source = areaSourceKind(area);
    if (source === 'school' || source === 'university' || source === 'kindergarten') return true;
    return /(学校|校|大学|幼稚園|保育園|こども園|学園|学院|教習所|school|campus|university|college|kindergarten|nursery)/i.test(areaText(area));
  }

  function hasSensitiveMasking(masking) {
    return !!(masking && Number(masking.maskedSpecies || 0) > 0 && !masking.viewerCanSeeExact);
  }

  function areaAccessStatus(area, masking) {
    if (isSchoolArea(area)) return 'school';
    if (hasSensitiveMasking(masking)) return 'sensitive';
    var a = area || {};
    var guidance = a.accessGuidance || {};
    var guidanceStatus = String(guidance.status || a.access_status || '').toLowerCase();
    var access = String(a.access || a.accessStatus || '').toLowerCase();
    var recordingPolicy = String(a.recording_policy || a.recordingPolicy || '').toLowerCase();
    var ctaMode = String(a.contribution_cta_mode || a.contributionCtaMode || '').toLowerCase();
    if (recordingPolicy === 'prohibited' || recordingPolicy === 'permission_required' || ctaMode === 'suppressed') {
      return 'private_or_restricted';
    }
    if (recordingPolicy === 'customers_only' || recordingPolicy === 'check_rules' || recordingPolicy === 'unknown' || ctaMode === 'check_rules') {
      return 'unknown';
    }
    if (recordingPolicy === 'allowed' && ctaMode === 'record') return 'public_access';
    if (guidanceStatus === 'private_or_restricted' || access === 'private' || access === 'no' || access === 'restricted') {
      return 'private_or_restricted';
    }
    if (guidanceStatus === 'public_access' || access === 'yes' || access === 'public' || access === 'permissive') {
      return 'public_access';
    }
    return 'unknown';
  }

  function canSuggestAreaEvent(area, masking) {
    return areaAccessStatus(area, masking) === 'public_access';
  }

  function canSuggestDirectAreaRecord(area, masking) {
    var a = area || {};
    return String(a.recording_policy || a.recordingPolicy || '').toLowerCase() === 'allowed'
      && String(a.contribution_cta_mode || a.contributionCtaMode || '').toLowerCase() === 'record'
      && areaAccessStatus(area, masking) === 'public_access';
  }

  function renderAreaSafetyNotice(area, masking) {
    var status = areaAccessStatus(area, masking);
    if (status === 'school') {
      return '<div class="me-area-sensitive me-area-safety"><strong>' + escapeHtml(COPY.areaRestrictedActionLabel) + '</strong><br>' + escapeHtml(COPY.areaSchoolNotice) + '</div>';
    }
    if (status === 'private_or_restricted' || status === 'unknown') {
      return '<div class="me-area-sensitive me-area-safety"><strong>' + escapeHtml(COPY.areaRestrictedActionLabel) + '</strong><br>' + escapeHtml(COPY.areaRestrictedActionHint) + '</div>';
    }
    return '';
  }

  function renderRestrictedAreaAction() {
    return '<div class="me-area-sensitive me-area-action-note"><strong>' + escapeHtml(COPY.areaRestrictedActionLabel) + '</strong><br>' + escapeHtml(COPY.areaRestrictedActionHint) + '</div>';
  }

  function renderAreaNextStepCard(options) {
    var canRecord = !!(options && options.canRecord);
    var hasRecords = Number(options && options.observationCount || 0) > 0 || !!(options && options.hasGallery);
    var hasGuide = !!(options && options.hasGuide);
    var title = canRecord ? COPY.areaNextStepRecordTitle : COPY.areaNextStepRestrictedTitle;
    var lines = [COPY.areaNextStepScopeLine];
    if (canRecord) {
      lines.push(hasRecords ? COPY.areaNextStepRecordLine : COPY.areaNextStepFirstRecordLine);
    } else {
      lines.push(COPY.areaNextStepRestrictedLine);
    }
    if (hasRecords) lines.push(COPY.areaNextStepBrowseLine);
    if (hasGuide) lines.push(COPY.areaNextStepGuideLine);
    var cta = canRecord
      ? '<a class="me-area-next-step-cta" href="' + escapeHtml(RECORD_HREF) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:next_step_record" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(RECORD_HREF) + '">' + escapeHtml(COPY.areaNextStepRecordCta) + '</a>'
      : '';
    return ''
      + '<section class="me-area-next-step' + (canRecord ? '' : ' is-restricted') + '" aria-label="' + escapeHtml(COPY.areaNextStepEyebrow) + '">'
      +   '<div class="me-area-next-step-head">'
      +     '<span>' + escapeHtml(COPY.areaNextStepEyebrow) + '</span>'
      +     '<strong>' + escapeHtml(title) + '</strong>'
      +   '</div>'
      +   '<ul>'
      +     lines.map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('')
      +   '</ul>'
      +   cta
      + '</section>';
  }

  function renderAggregateSafety(text) {
    return '<section class="me-aggregate-safety me-detail-section">' + escapeHtml(text) + '</section>';
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
    var displayLabel = friendlyHypothesisLabel(publicBriefText(h.label, COPY.unknownHypothesisLabel));
    var confPct = Math.round((h.confidence || 0) * 100);
    var reasons = (brief.reasons || []).map(function (r) {
      var text = publicBriefText(r, '');
      return text ? '<li>' + escapeHtml(text) + '</li>' : '';
    }).join('');
    var checks = (brief.checks || []).map(function (c) {
      var text = publicBriefText(c, '');
      return text ? '<li>' + escapeHtml(text) + '</li>' : '';
    }).join('');
    var caps = (brief.captureHints || []).map(function (c) {
      var text = publicBriefText(c, '');
      return text ? '<li>' + escapeHtml(text) + '</li>' : '';
    }).join('');
    var environment = (brief.environmentEvidence || []).slice(0, 4).map(function (item) {
      var label = publicBriefText(item.label || 'environment', 'environment');
      var meta = [publicBriefText(item.value, ''), publicBriefText(item.source, '')].filter(Boolean).join(' · ');
      var limitationText = publicBriefText(item.limitation, '');
      var limitation = limitationText ? '<em>' + escapeHtml(limitationText) + '</em>' : '';
      return meta || limitation ? '<li><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(meta) + '</span>' + limitation + '</li>' : '';
    }).join('');
    var notices = renderMapOfficialNotices(brief.officialNotices || []);
    var context = getSelectedContext();
    var frontier = context ? findFrontierAt(context.lng, context.lat) : null;
    var missingAxes = frontier && frontier.properties && Array.isArray(frontier.properties.missingAxes)
      ? frontier.properties.missingAxes.map(axisLabel).join(' · ')
      : '';
    var whyHere = publicBriefText((brief.reasons && brief.reasons[0]) || displayLabel, displayLabel);
    var whyNow = frontier && frontier.properties
      ? priorityCueLabel(frontier.properties.priorityCue)
      : publicBriefText((brief.checks && brief.checks[0]) || displayLabel, displayLabel);
    var oneVisit = frontier && frontier.properties
      ? roleHintLabel(frontier.properties.recommendedRole) + (missingAxes ? ' · ' + missingAxes : '')
      : publicBriefText((brief.captureHints && brief.captureHints[0]) || displayLabel, displayLabel);
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
      return '<div class="me-site-brief-loop-card"><div class="me-site-brief-loop-label">' + escapeHtml(item.label) + '</div><div class="me-site-brief-loop-body">' + escapeHtml(publicBriefText(item.body, COPY.awaitingIdLabel)) + '</div></div>';
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
    if (/現地確認|空白地点|空白地帯/.test(text)) return COPY.unknownHypothesisLabel;
    if (/未記録|記録不足|低カバー|カバー不足/.test(text)) return COPY.recordingGapLabel;
    return text;
  }

  function isInternalMigrationCopy(value) {
    var text = String(value || '').trim();
    if (!text) return false;
    return /Cloudflare|互換表示|移行中|migration|compatibility|read-?model|materiali[sz]e|worker|origin fallback|vps/i.test(text);
  }

  function publicBriefText(value, fallback) {
    var text = String(value || '').trim();
    if (!text || isInternalMigrationCopy(text)) return fallback || '';
    return text;
  }

  function fetchSiteBrief(lat, lng, seq, target) {
    if (!apiSiteBrief) return;
    var url = apiSiteBrief + '?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng) + '&lang=' + encodeURIComponent(SEARCH_LANG === 'ja' ? 'ja' : 'en');
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (brief) {
        if (seq !== siteBriefSeq) return; // stale
        if (!target) return;
        target.removeAttribute('data-brief-fallback');
        target.classList.remove('is-loading');
        target.innerHTML = renderSiteBriefCard(brief);
      })
      .catch(function () {
        if (seq !== siteBriefSeq || !target) return;
        if (target.getAttribute('data-brief-fallback') === '1') {
          target.setAttribute('data-brief-state', 'error');
          return;
        }
        target.classList.remove('is-loading');
        target.innerHTML = '<div class="me-site-brief me-site-brief-error">' + escapeHtml(COPY.siteBriefError) + '</div>';
      });
  }

  function renderObservationActions(record) {
    var photo = record.photoUrl ? '<img class="me-bottom-photo" src="' + escapeHtml(toThumbUrl(record.photoUrl, 'md')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />' : '';
    var href = OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId));
    var identifyHref = href + '#identify';
    var bottomBadge = record.isAiCandidate
      ? '<span class="me-result-ai">' + escapeHtml(COPY.aiCandidateLabel) + '</span>'
      : record.isAwaitingId
        ? '<span class="me-result-awaiting">' + escapeHtml(COPY.awaitingIdLabel) + '</span>'
        : '';
    var bottomName = record.isAwaitingId ? '' : '<strong>' + escapeHtml(recordDisplayName(record)) + '</strong>';
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
    return '<div class="me-bottom-actions">' +
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

  function sheetSupportsSnap() {
    return !!(sheetEl && (
      sheetEl.classList.contains('me-bottom-sheet--detail') ||
      sheetEl.classList.contains('me-bottom-sheet--area')
    ));
  }
  function setSheetSnap(snap) {
    if (!sheetSupportsSnap()) return;
    var next = snap === 'full' ? 'full' : 'peek';
    sheetEl.classList.remove('is-dragging');
    sheetEl.style.removeProperty('--me-sheet-drag-height');
    sheetEl.setAttribute('data-snap', next);
    if (sheetGripEl) {
        sheetGripEl.setAttribute('aria-label', next === 'full' ? COPY.bottomSheetCollapseLabel : COPY.bottomSheetExpandLabel);
    }
  }
  function setDetailSheetSnap(snap) {
    if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--detail')) return;
    setSheetSnap(snap);
  }
  function setAreaSheetSnap(snap) {
    if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--area')) return;
    setSheetSnap(snap);
  }
  function toggleDetailSheetSnap() {
    if (!sheetEl || !sheetEl.classList.contains('me-bottom-sheet--detail')) return;
    setDetailSheetSnap(sheetEl.getAttribute('data-snap') === 'full' ? 'peek' : 'full');
  }
  function toggleSheetSnap() {
    if (!sheetSupportsSnap()) return;
    setSheetSnap(sheetEl.getAttribute('data-snap') === 'full' ? 'peek' : 'full');
  }
  function showDetailBottomSheet() {
    if (!sheetEl) return;
    closeFilterDrawer();
    if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
    if (shouldKeepMapClearForRain()) {
      closeBottomSheet();
      return;
    }
    dismissPurposeHint();
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.remove('me-bottom-sheet--area');
    sheetEl.classList.add('me-bottom-sheet--detail');
    sheetEl.classList.add('is-open');
    setDetailSheetSnap('peek');
    syncRainUi();
    if (sheetInnerEl) sheetInnerEl.scrollTop = 0;
  }
  function showAreaBottomSheet() {
    if (!sheetEl) return;
    closeFilterDrawer();
    if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
    if (shouldKeepMapClearForRain()) {
      closeBottomSheet();
      return;
    }
    dismissPurposeHint();
    sheetEl.setAttribute('aria-hidden', 'false');
    sheetEl.classList.remove('me-bottom-sheet--detail');
    sheetEl.classList.add('me-bottom-sheet--area');
    sheetEl.classList.add('is-open');
    setAreaSheetSnap('peek');
    syncRainUi();
    try { sheetEl.scrollTop = 0; } catch (_) {}
    if (sheetInnerEl) sheetInnerEl.scrollTop = 0;
  }

  function focusCellFeature(feature) {
    if (!state.map || !feature) return;
    state.ignoreNextMoveEnd = true;
    fitToCellSet([feature], { openSheet: false });
  }

  function closeOverlapChoice() {
    if (!state.overlapChoicePopup) return;
    try { state.overlapChoicePopup.remove(); } catch (_) {}
    state.overlapChoicePopup = null;
  }

  function areaChoiceLabel(areaFeature) {
    var props = areaFeature && areaFeature.properties ? areaFeature.properties : {};
    return String(props.name || props.source_label || COPY.osmAreaFallbackName);
  }

  function cellChoiceLabel(cellFeature) {
    var props = cellFeature && cellFeature.properties ? cellFeature.properties : {};
    var count = Number(props.count || 0);
    var countLabel = count > 0 ? String(count) + ' ' + COPY.resultCountLabel : '';
    return [props.albumName || props.label || COPY.selectedFieldLabel, countLabel].filter(Boolean).join(' · ');
  }

  function showCellAreaChoice(cellFeature, areaFeature, lngLat, options) {
    if (!state.map || !window.maplibregl || !cellFeature || !areaFeature || !lngLat) {
      selectCell(cellFeature, options || {});
      return;
    }
    closeOverlapChoice();
    var node = document.createElement('div');
    node.className = 'me-overlap-choice';
    node.innerHTML =
      '<div class="me-overlap-choice-title">' + escapeHtml(COPY.overlapChoiceTitle) + '</div>' +
      '<button type="button" class="me-overlap-choice-btn me-overlap-choice-cell">' +
        '<strong>' + escapeHtml(COPY.overlapChoiceCell) + '</strong>' +
        '<span>' + escapeHtml(cellChoiceLabel(cellFeature)) + '</span>' +
      '</button>' +
      '<button type="button" class="me-overlap-choice-btn me-overlap-choice-area">' +
        '<strong>' + escapeHtml(COPY.overlapChoiceArea) + '</strong>' +
        '<span>' + escapeHtml(areaChoiceLabel(areaFeature)) + '</span>' +
      '</button>';
    node.querySelector('.me-overlap-choice-cell').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeOverlapChoice();
      selectCell(cellFeature, options || {});
    });
    node.querySelector('.me-overlap-choice-area').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeOverlapChoice();
      openAreaFeatureSheet(areaFeature, lngLat.lat, lngLat.lng);
    });
    state.overlapChoicePopup = new window.maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      className: 'me-overlap-choice-popup',
      offset: 12,
      maxWidth: '260px',
    })
      .setLngLat([lngLat.lng, lngLat.lat])
      .setDOMContent(node)
      .addTo(state.map);
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
    closeOverlapChoice();
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
    requestPlaceAtlasForSelection(state.selectedPoint);
    saveMapState();
  }

  function selectRecord(record, options) {
    if (!record) return;
    closeOverlapChoice();
    var preserveSurroundings = !!(options && options.preserveSurroundings);
    state.selectedOccurrenceId = record.occurrenceId || null;
    var recordCellId = record.cellId || null;
    state.selectedCellId = preserveSurroundings ? null : recordCellId;
    var feature = findSelectableCellFeatureById(recordCellId);
    if (recordCellId && (!feature || feature.properties.cellId !== recordCellId)) {
      for (var i = 0; i < state.features.length; i += 1) {
        if (state.features[i] && state.features[i].properties && state.features[i].properties.cellId === recordCellId) {
          feature = state.features[i];
          break;
        }
      }
    }
    if (!feature) return;
    var center = recordCellCenter(record) || cellCenter(feature);
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
    if (!shouldUseBottomSheet()) {
      if (preserveSurroundings) {
        state.suppressViewportSearchUntil = Date.now() + 5000;
        state.suppressNextViewportSearch = true;
        state.pendingViewportSearch = false;
        clearViewportRefreshTimer();
        updateSearchAreaUi();
      }
      setSideRailMode(false);
      setSideTab('selection');
    }
    if (state.map && options && options.focusMap !== false) {
      if (record.isViewerOwned && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
        state.map.easeTo({ center: [center.lng, center.lat], zoom: Math.max(state.map.getZoom(), 15.2), duration: 520 });
      } else {
        focusCellFeature(feature);
      }
    }
    if (!preserveSurroundings && state.lastStats && state.lastStats.selectedCellId !== state.selectedCellId) {
      loadRecords({ cellId: state.selectedCellId });
    }
    if (options && options.openSheet && shouldUseBottomSheet()) openBottomSheet(record);
    else if (!shouldUseBottomSheet()) closeBottomSheet();
    saveMapState();
  }

  function openBottomSheet(record) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!shouldUseBottomSheet()) return;
    resetAreaGuideStopSession();
    var feature = getSelectedCellFeature();
    var exactCenter = recordCellCenter(record);
    var center = exactCenter || (feature ? cellCenter(feature) : { lat: null, lng: null });
    var detailContext = (center.lat != null && center.lng != null)
      ? { lat: center.lat, lng: center.lng, kind: 'observation', cellFeature: feature, record: record }
      : null;
    state.selectedPoint = detailContext;
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-observation">' +
        renderDetailHero({
          title: recordDisplayName(record),
          meta: (record.localityLabel || '—') + (record.observedAt ? ' · ' + String(record.observedAt).slice(0, 10) : ''),
          badge: COPY.selectionObservationLabel + (record.isAiCandidate ? ' · ' + COPY.aiCandidateLabel : record.isAwaitingId ? ' · ' + COPY.awaitingIdLabel : ''),
          photoUrl: record.photoUrl || '',
        }) +
        renderDetailVisitReasons(detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderDetailActions([
          { icon: '↗', label: COPY.selectedCardLabel, href: OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId)), actionKey: 'map:selected_observation:open' },
          { icon: '✓', label: COPY.identifyLabel, href: OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(record.occurrenceId)) + '#identify', actionKey: 'map:selected_observation:identify' },
          { icon: '＋', label: COPY.bottomSheetRecord, href: RECORD_HREF, actionKey: 'map:selected_observation:record' },
          { icon: '📖', label: COPY.bottomSheetNotes, href: NOTES_HREF, actionKey: 'map:selected_observation:notes' },
        ]) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: recordDisplayName(record) },
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
    resetAreaGuideStopSession();
    var center = cellCenter(feature);
    var detailContext = { lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature };
    state.selectedPoint = detailContext;
    if (apiPlaceProfile) {
      sheetInnerEl.innerHTML =
        '<article class="me-detail-panel me-bottom-detail me-detail-panel-cell">' +
          renderPlaceAtlasContent(detailContext, '') +
        '</article>';
      showAreaBottomSheet();
      bindPlaceAtlasContent(sheetInnerEl);
      return;
    }
    var seq = ++siteBriefSeq;
    var p = feature.properties || {};
    var gbifSlotId = 'me-sheet-gbif-area-slot';
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-cell">' +
        renderDetailHero({
          title: COPY.cellAggregateTitle,
          meta: String(p.count || 0) + ' ' + COPY.resultCountLabel + (p.latestObservedAt ? ' · ' + String(p.latestObservedAt).slice(0, 10) : '') + (p.nameEraLabel ? ' · ' + String(p.nameEraLabel) : ''),
          badge: COPY.cellAggregateBadge,
        }) +
        renderAggregateSafety(COPY.cellAggregateSafety) +
        renderGbifAreaSummarySlot(gbifSlotId) +
        renderDetailVisitReasons(detailContext) +
        renderSiteBriefSlot('me-site-brief-slot', detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderPlaceDetailActions(detailContext) +
        renderDetailStats([
          { label: COPY.placeStoryRecent, value: String(p.count || 0) + ' ' + COPY.resultCountLabel },
          { label: COPY.placeStoryActions, value: p.latestObservedAt ? String(p.latestObservedAt).slice(0, 10) : COPY.placeStoryNeedSeason },
        ]) +
        '<section id="me-sheet-ambient-slot" class="me-selected-ambient me-detail-section">' + renderSheetAmbient({ lat: center.lat, lng: center.lng, kind: 'cell', cellFeature: feature }) + '</section>' +
      '</article>';
    showDetailBottomSheet();
    bindDetailRecentFinds(sheetInnerEl);
    fetchGbifAreaSummary(p.cellId, document.getElementById(gbifSlotId));
    fetchSiteBrief(center.lat, center.lng, seq, document.getElementById('me-site-brief-slot'));
  }

  function buildPlaceMemoryRecordHref(place) {
    var params = [];
    function add(key, value) {
      if (value == null || value === '') return;
      params.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(value)));
    }
    add('placeId', place.placeId);
    add('revisitObservationId', place.latestVisitId);
    add('localityNote', place.placeName);
    add('municipality', place.municipality);
    add('latitude', place.latitude);
    add('longitude', place.longitude);
    var focus = place.nextLookFor || place.revisitReason || place.latestDisplayName || '';
    var mode = place.lastRecordMode === 'survey' ? 'survey' : 'quick';
    add('recordMode', mode);
    if (mode === 'survey') {
      add('targetTaxaScope', focus);
      add('revisitReason', place.revisitReason || focus);
      add('surveyResult', place.lastSurveyResult === 'no_detection_note' ? 'no_detection_note' : '');
    } else {
      add('quickCaptureState', place.absenceSemantics === 'protocol_note_only' || place.absenceSemantics === 'casual_note_only' ? 'no_detection_note' : place.absenceSemantics === 'needs_followup' ? 'unknown' : 'present');
      add('nextLookFor', focus);
    }
    return RECORD_HREF + (params.length ? (RECORD_HREF.indexOf('?') >= 0 ? '&' : '?') + params.join('&') : '');
  }

  function openPlaceSheet(lat, lng, memoryPlace) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    resetAreaGuideStopSession();
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    if (!shouldUseBottomSheet()) {
      state.selectedPoint = { lat: lat, lng: lng, kind: 'place', memoryPlace: memoryPlace || null };
      highlightSelectedCell();
      closeBottomSheet();
      renderResultList();
      renderSelectedCard();
      renderSidePanels();
      saveMapState();
      return;
    }
    var detailContext = { lat: lat, lng: lng, kind: 'place', memoryPlace: memoryPlace || null };
    state.selectedPoint = detailContext;
    highlightSelectedCell();
    var seq = ++siteBriefSeq;
    sheetInnerEl.innerHTML =
      '<article class="me-detail-panel me-bottom-detail me-detail-panel-place">' +
        renderDetailHero({ title: COPY.selectedPointName, meta: '', badge: COPY.selectionPlaceLabel }) +
        renderAggregateSafety(COPY.mapPointSafety) +
        renderDetailVisitReasons(detailContext) +
        renderSiteBriefSlot('me-site-brief-slot', detailContext) +
        renderDetailRecentFinds(detailContext) +
        renderDetailWalkableFinds(detailContext) +
        renderPlaceDetailActions(detailContext) +
        renderDetailStats([
          { label: COPY.placeStoryNow, value: COPY.placeStoryNoTaxa },
          { label: COPY.placeStoryMissing, value: COPY.placeStoryNeedSeason },
        ]) +
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
  function normalizeAreaPolygonsForContainment(geometry) {
    if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates)) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.filter(function (polygon) { return Array.isArray(polygon); });
    }
    return [];
  }
  function pointInAreaRing(point, ring) {
    if (!point || !Array.isArray(ring) || ring.length < 3) return false;
    var inside = false;
    var x = Number(point.lng);
    var y = Number(point.lat);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      var pi = ring[i];
      var pj = ring[j];
      if (!Array.isArray(pi) || !Array.isArray(pj)) continue;
      var xi = Number(pi[0]);
      var yi = Number(pi[1]);
      var xj = Number(pj[0]);
      var yj = Number(pj[1]);
      if (!Number.isFinite(xi) || !Number.isFinite(yi) || !Number.isFinite(xj) || !Number.isFinite(yj)) continue;
      var intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi));
      if (intersects) inside = !inside;
    }
    return inside;
  }
  function pointInAreaPolygon(point, polygon) {
    if (!Array.isArray(polygon) || !polygon.length) return false;
    if (!pointInAreaRing(point, polygon[0])) return false;
    for (var i = 1; i < polygon.length; i += 1) {
      if (pointInAreaRing(point, polygon[i])) return false;
    }
    return true;
  }
  function pointInAreaGeometry(point, geometry) {
    return normalizeAreaPolygonsForContainment(geometry).some(function (polygon) {
      return pointInAreaPolygon(point, polygon);
    });
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
  function renderAreaActivityRallyPanel(extraHtml) {
    return ''
      + '<section class="me-area-primary-actions me-area-activity-panel" aria-label="' + escapeHtml(COPY.areaActivityRallyTitle) + '">'
      +   '<div class="me-area-activity-head">'
      +     '<span>' + escapeHtml(COPY.areaActivityRallyMeta) + '</span>'
      +     '<strong>' + escapeHtml(COPY.areaActivityRallyTitle) + '</strong>'
      +   '</div>'
      +   '<p>' + escapeHtml(COPY.areaActivityRallyBody) + '</p>'
      +   '<a class="me-area-activity-link me-area-primary-action me-area-primary-action-event" href="' + escapeHtml(EVENTS_ORGANIZER_HREF) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:event_consult" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(EVENTS_ORGANIZER_HREF) + '">'
      +     '<span aria-hidden="true">↗</span>'
      +     escapeHtml(COPY.areaActivityRallyLinkLabel)
      +   '</a>'
      +   (extraHtml ? '<div class="me-area-activity-extra">' + extraHtml + '</div>' : '')
      + '</section>';
  }

  function renderTransientAreaContent(feature, center) {
    var props = (feature && feature.properties) || {};
    var safeCenter = center || areaFeatureCenter(feature, null, null);
    var sourceLabel = String(props.source_label || COPY.osmAreaSourceLabel);
    var sourceLinksHtml = renderAreaSourceLinks(props);
    var sourceTrustHtml = renderAreaSourceTrust(props.source_confidence, props.verification_label, props.verification_level);
    var areaName = String(props.name || COPY.osmAreaFallbackName);
    var locationLabel = [props.prefecture, props.city].filter(Boolean).join(' ') || COPY.cellAggregateBadge;
    var followId = String(props.entity_key || props.field_id || '');
    var guidance = transientAccessGuidance(props);
    var areaStatus = areaAccessStatus(props, null);
    var canRecord = canSuggestDirectAreaRecord(props, null);
    var guideStopHtml = renderAreaGuideStop(props, safeCenter);
    var galleryItems = transientAreaGalleryItems(feature, safeCenter);
    var nextStepHtml = renderAreaNextStepCard({
      canRecord: canRecord,
      observationCount: galleryItems.length,
      hasGallery: galleryItems.length > 0,
      hasGuide: !!guideStopHtml,
    });
    var metaHtml = sourceLinksHtml || sourceTrustHtml
      ? '<div class="me-area-primary-actions-meta">' + sourceLinksHtml + sourceTrustHtml + '</div>'
      : '';
    var activityHtml = canRecord
      ? renderAreaActivityRallyPanel(sourceLinksHtml + sourceTrustHtml + '<span class="me-area-sheet-cta-hint">' + escapeHtml(COPY.areaEventCreateHint) + '</span>')
      : metaHtml;
    return ''
      + renderAreaHero({ title: areaName, sourceLabel: sourceLabel, meta: locationLabel, photo: null })
      + renderAreaAccessGuidance(guidance)
      + renderAreaSafetyNotice(props, null)
      + nextStepHtml
      + activityHtml
      + guideStopHtml
      + (canRecord && followId ? renderAreaFollowButton('region', followId, areaName, mapFollowHref({ region: followId })) : '')
      + renderAreaObservationGallery(galleryItems, { label: COPY.areaGalleryTitle, canRecord: canRecord, areaStatus: areaStatus })
      + renderPlaceStoryHighlights({ sourceLabel: sourceLabel }, { totalObservations: 0, totalVisits: 0, seasonsCovered: 0, topTaxa: [] }, null)
      + '<div class="me-area-sheet-timeline is-empty">' + escapeHtml(COPY.unregisteredAreaText) + '</div>';
  }

  function openTransientAreaSheet(feature, lat, lng) {
    if (!sheetEl || !sheetInnerEl || !feature) return;
    closeOverlapChoice();
    resetAreaGuideStopSession();
    var props = feature.properties || {};
    var center = areaFeatureCenter(feature, lat, lng);
    if (!center) return;
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = { lat: center.lat, lng: center.lng, kind: 'area', fieldId: String(props.field_id || ''), areaFeature: feature, transient: true };
    trackAreaDetailOpen('transient_area', props);
    setSelectedAreaPolygonFilter(props.field_id || '__none__');
    if (!shouldUseBottomSheet()) {
      sheetEl.classList.remove('is-open');
      sheetEl.classList.remove('me-bottom-sheet--area');
      sheetEl.classList.remove('me-bottom-sheet--detail');
      sheetEl.removeAttribute('data-snap');
      sheetEl.setAttribute('aria-hidden', 'true');
      setSideRailMode(false);
      renderSelectedCard();
      renderSidePanels();
      setSideTab('selection');
      requestPlaceAtlasForSelection(state.selectedPoint);
      saveMapState();
      return;
    }
    sheetInnerEl.innerHTML = renderPlaceAtlasContent(state.selectedPoint, renderTransientAreaContent(feature, center));
    bindPlaceAtlasContent(sheetInnerEl);
    hydrateAreaGuideStopControls(sheetInnerEl);
    showAreaBottomSheet();
    renderSidePanels();
    requestPlaceAtlasForSelection(state.selectedPoint);
    saveMapState();
  }
  function openAreaFeatureSheet(feature, lat, lng) {
    if (!feature || !feature.properties) return;
    closeOverlapChoice();
    if (isTransientAreaFeature(feature)) {
      openTransientAreaSheet(feature, lat, lng);
      return;
    }
    var fieldId = feature.properties.field_id || '';
    if (fieldId) openAreaSheet(fieldId, lat, lng, feature);
  }
  function openAreaSheet(fieldId, lat, lng, feature) {
    if (!sheetEl || !sheetInnerEl) return;
    if (!fieldId) return;
    resetAreaGuideStopSession();
    state.selectedOccurrenceId = null;
    state.selectedCellId = null;
    state.selectedPoint = { lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, kind: 'area', fieldId: fieldId, areaFeature: feature || null };
    trackAreaDetailOpen('registered_area', Object.assign({ field_id: fieldId }, feature && feature.properties ? feature.properties : {}));
    setSelectedAreaPolygonFilter(fieldId);
    if (!shouldUseBottomSheet()) {
      sheetEl.classList.remove('is-open');
      sheetEl.classList.remove('me-bottom-sheet--area');
      sheetEl.classList.remove('me-bottom-sheet--detail');
      sheetEl.removeAttribute('data-snap');
      sheetEl.setAttribute('aria-hidden', 'true');
      setSideRailMode(false);
      renderSelectedCard();
      renderSidePanels();
      setSideTab('selection');
      saveMapState();
      requestPlaceAtlasForSelection(state.selectedPoint);
      if (!apiAreaSnapshotTemplate) return;
      var sideUrl = apiAreaSnapshotTemplate.replace('__FIELD_ID__', encodeURIComponent(fieldId));
      fetch(sideUrl, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (payload) {
          if (!payload || !payload.snapshot) return;
          if (!state.selectedPoint || state.selectedPoint.kind !== 'area' || state.selectedPoint.fieldId !== fieldId) return;
          state.selectedPoint.areaSnapshot = payload.snapshot;
          if (feature && !state.selectedPoint.areaFeature) state.selectedPoint.areaFeature = feature;
          rerenderPlaceAtlasSelection();
        })
        .catch(function () { /* noop */ });
      return;
    }
    sheetInnerEl.innerHTML = renderPlaceAtlasContent(state.selectedPoint, '<div class="me-bottom-meta"><strong>' + escapeHtml(COPY.areaLoading) + '</strong></div>');
    bindPlaceAtlasContent(sheetInnerEl);
    // PC では full-width だと地図を覆い隠して圧迫感が出るので area モード専用の狭幅版に。
    showAreaBottomSheet();
    requestPlaceAtlasForSelection(state.selectedPoint);
    if (!apiAreaSnapshotTemplate) return;
    var url = apiAreaSnapshotTemplate.replace('__FIELD_ID__', encodeURIComponent(fieldId));
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) {
        if (!payload || !payload.snapshot) return;
        if (!state.selectedPoint || state.selectedPoint.kind !== 'area' || state.selectedPoint.fieldId !== fieldId) return;
        state.selectedPoint.areaSnapshot = payload.snapshot;
        if (feature && !state.selectedPoint.areaFeature) state.selectedPoint.areaFeature = feature;
        sheetInnerEl.innerHTML = renderPlaceAtlasContent(state.selectedPoint, renderAreaSheet(payload.snapshot));
        bindPlaceAtlasContent(sheetInnerEl);
        hydrateAreaGuideStopControls(sheetInnerEl);
      })
      .catch(function () { /* noop */ });
  }

  function closeBottomSheet() {
    if (!sheetEl) return;
    resetAreaGuideStopSession();
    sheetEl.classList.remove('is-open');
    sheetEl.classList.remove('is-dragging');
    sheetEl.classList.remove('me-bottom-sheet--area');
    sheetEl.classList.remove('me-bottom-sheet--detail');
    sheetEl.style.removeProperty('--me-sheet-drag-height');
    sheetEl.removeAttribute('data-snap');
    sheetEl.setAttribute('aria-hidden', 'true');
    setSelectedAreaPolygonFilter('__none__');
    syncRainUi();
  }
  if (sheetCloseEl) sheetCloseEl.addEventListener('click', closeBottomSheet);
  if (sheetGripEl) {
    var sheetDragState = null;
    var sheetSuppressClick = false;
    function sheetDragClamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function mobileSheetDragEnabled() {
      return !window.matchMedia || window.matchMedia('(max-width: 900px)').matches;
    }
    function sheetMinHeight() {
      if (!sheetEl) return 180;
      var viewport = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 640);
      var header = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().height || 0);
      var available = Math.max(220, viewport - header - 112);
      if (sheetEl.classList.contains('me-bottom-sheet--area')) return sheetDragClamp(Math.round(viewport * 0.44), 240, Math.min(380, available));
      return sheetDragClamp(Math.round(viewport * 0.34), 210, Math.min(300, available));
    }
    function sheetMaxHeight() {
      var viewport = Math.max(320, window.innerHeight || document.documentElement.clientHeight || 640);
      var header = Math.max(0, document.querySelector('.site-header')?.getBoundingClientRect().height || 0);
      return Math.max(sheetMinHeight() + 80, viewport - header - 96);
    }
    function clearSheetDrag() {
      if (!sheetEl) return;
      sheetEl.classList.remove('is-dragging');
      sheetEl.style.removeProperty('--me-sheet-drag-height');
    }
    sheetGripEl.addEventListener('click', function (event) {
      if (sheetSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        sheetSuppressClick = false;
        return;
      }
      toggleSheetSnap();
    });
    sheetGripEl.addEventListener('pointerdown', function (event) {
      if (!sheetSupportsSnap()) return;
      if (!mobileSheetDragEnabled()) return;
      var rect = sheetEl.getBoundingClientRect();
      var minHeight = sheetMinHeight();
      var maxHeight = sheetMaxHeight();
      sheetDragState = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: sheetDragClamp(rect.height || minHeight, minHeight, maxHeight),
        currentHeight: sheetDragClamp(rect.height || minHeight, minHeight, maxHeight),
        minHeight: minHeight,
        maxHeight: maxHeight,
        moved: false,
      };
      sheetEl.classList.add('is-dragging');
      sheetEl.style.setProperty('--me-sheet-drag-height', sheetDragState.startHeight + 'px');
      try { sheetGripEl.setPointerCapture(event.pointerId); } catch (_) {}
    });
    sheetGripEl.addEventListener('pointermove', function (event) {
      if (!sheetDragState || sheetDragState.pointerId !== event.pointerId || !sheetEl) return;
      var deltaY = event.clientY - sheetDragState.startY;
      var nextHeight = sheetDragClamp(sheetDragState.startHeight - deltaY, 92, sheetDragState.maxHeight);
      sheetDragState.currentHeight = nextHeight;
      if (Math.abs(deltaY) > 5) sheetDragState.moved = true;
      sheetEl.style.setProperty('--me-sheet-drag-height', Math.round(nextHeight) + 'px');
      event.preventDefault();
    });
    sheetGripEl.addEventListener('pointerup', function (event) {
      if (!sheetDragState || sheetDragState.pointerId !== event.pointerId) return;
      var drag = sheetDragState;
      var deltaY = event.clientY - drag.startY;
      sheetDragState = null;
      if (drag.moved) {
        sheetSuppressClick = true;
        window.setTimeout(function () { sheetSuppressClick = false; }, 0);
      }
      if (drag.currentHeight < Math.max(110, drag.minHeight * 0.58) && sheetEl && sheetEl.getAttribute('data-snap') === 'peek') {
        closeBottomSheet();
      } else if (deltaY < -28 || drag.currentHeight > (drag.minHeight + drag.maxHeight) / 2) {
        setSheetSnap('full');
      } else if (deltaY > 30 || drag.currentHeight <= drag.minHeight + 28) {
        setSheetSnap('peek');
      } else {
        setSheetSnap(sheetEl && sheetEl.getAttribute('data-snap') === 'full' ? 'full' : 'peek');
      }
      try { sheetGripEl.releasePointerCapture(event.pointerId); } catch (_) {}
    });
    sheetGripEl.addEventListener('pointercancel', function () {
      sheetDragState = null;
      clearSheetDrag();
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

  function widenEmptyViewport() {
    if (!state.map || typeof state.map.getZoom !== 'function' || typeof state.map.easeTo !== 'function') return;
    var currentZoom = Number(state.map.getZoom());
    if (!Number.isFinite(currentZoom)) return;
    state.map.easeTo({ zoom: Math.max(10, currentZoom - 1.4), duration: 450 });
  }
  function widenAreaEmptyState() {
    widenEmptyViewport();
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var button = target.closest('[data-area-empty-widen]');
    if (!button) return;
    event.preventDefault();
    widenAreaEmptyState();
  });

  function switchMapTab(tab) {
    state.tab = tab || 'markers';
    if (state.tab !== 'places') clearWalkMapCandidateMarkers();
    document.querySelectorAll('.me-tab').forEach(function (b) {
      var active = b.getAttribute('data-tab') === state.tab;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.me-filter-tab-chip').forEach(function (b) {
      var active = b.getAttribute('data-filter-tab') === state.tab;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (state.tab === 'rain') {
      closeBottomSheet();
      setMapEmptyInviteVisible(false);
      hideLayerHint();
      enableRainLayer();
    }
    else disableRainLayer();
    if (state.map) {
      applyTab(state.map, state.tab);
      if (state.tab === 'frontier') loadFrontier(state.map);
      if (state.tab === 'places') loadAreaPolygons();
      maybeShowLayerHint(state.tab);
    }
    if (state.tab === 'rain') {
      sendMapKpi('funnel_step', 'map:rain:tab_open', {
        timeCount: Array.isArray(state.rainTimes) ? state.rainTimes.length : 0
      });
    }
    saveMapState();
  }
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var areasButton = target.closest('[data-results-empty-areas]');
    if (areasButton) {
      event.preventDefault();
      switchMapTab('places');
      return;
    }
    var widenButton = target.closest('[data-results-empty-widen]');
    if (widenButton) {
      event.preventDefault();
      widenEmptyViewport();
    }
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
      ? topTaxa.map(function (taxon) { return localizedDisplayName(taxon && taxon.name, ''); }).filter(Boolean).join(' / ')
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
      +     '<span>学校の記録を残す</span>'
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
    var canRecord = !options || options.canRecord !== false;
    var accessStatus = String(options && options.areaStatus || (canRecord ? 'public_access' : 'unknown'));
    if (!records.length) {
      var isSchool = accessStatus === 'school' || accessStatus === 'permission_required';
      var lead = canRecord
        ? COPY.areaGalleryEmptyPublicLead
        : (isSchool ? COPY.areaGalleryEmptySchoolLead : COPY.areaGalleryEmptyRestrictedLead);
      var primaryAction = canRecord
        ? '<a class="me-area-gallery-empty-action is-primary" href="' + escapeHtml(RECORD_HREF) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:gallery_empty_record" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(RECORD_HREF) + '">' + escapeHtml(COPY.areaSafeRecordLabel) + '</a>'
        : '<span class="me-area-gallery-empty-action is-safety">' + escapeHtml(isSchool ? COPY.areaRestrictedActionLabel : COPY.areaGalleryEmptyRestrictedCheck) + '</span>';
      var secondaryAction = '<button type="button" class="me-area-gallery-empty-action" data-area-empty-widen>' + escapeHtml(canRecord ? COPY.areaGalleryEmptyPublicWiden : (isSchool ? COPY.areaGalleryEmptySchoolWiden : COPY.areaGalleryEmptyRestrictedWiden)) + '</button>';
      var note = canRecord ? COPY.areaGalleryEmptyPublicSafety : (isSchool ? COPY.areaSchoolNotice : COPY.areaRestrictedActionHint);
      return ''
        + '<section class="me-area-gallery is-empty" aria-label="' + escapeHtml(label) + '">'
        +   '<div class="me-area-gallery-head">'
        +     '<span>' + escapeHtml(label) + '</span>'
        +     '<strong>' + escapeHtml(COPY.areaGalleryEmpty) + '</strong>'
        +   '</div>'
        +   '<p class="me-area-gallery-empty-lead">' + escapeHtml(lead) + '</p>'
        +   '<div class="me-area-gallery-empty-actions">' + primaryAction + secondaryAction + '</div>'
        +   '<p class="me-area-story-note">' + escapeHtml(note) + '</p>'
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
          +   '<strong>' + escapeHtml(localizedDisplayName(item && item.displayName)) + '</strong>'
          +   '<small>' + escapeHtml(meta) + '</small>'
          + '</a>';
      }).join('')
      +   '</div>'
      + '</section>';
  }

  function transientAreaGalleryItems(feature, center) {
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];
    var geometry = feature && feature.geometry ? feature.geometry : null;
    var hasAreaGeometry = normalizeAreaPolygonsForContainment(geometry).length > 0;
    return nearbyRecordsForContext({ lat: center.lat, lng: center.lng }, 900)
      .filter(function (entry) {
        return !hasAreaGeometry || pointInAreaGeometry(entry.center, geometry);
      })
      .map(function (entry) {
        var record = entry.record || {};
        return {
          occurrenceId: record.occurrenceId || '',
          visitId: record.visitId || '',
          displayName: recordDisplayName(record),
          observedAt: record.observedAt || null,
          photoUrl: record.photoUrl || null,
          localityLabel: record.localityLabel || '',
          observationCount: 1,
        };
      });
  }

  function renderAreaStoryTabs(snapshot, options) {
    var summary = (snapshot && snapshot.observationSummary) || {};
    var gallery = Array.isArray(snapshot && snapshot.observationGallery) ? snapshot.observationGallery : [];
    var seasonalCoverage = Array.isArray(snapshot && snapshot.seasonalCoverage) ? snapshot.seasonalCoverage : [];
    var canRecord = !options || options.canRecord !== false;
    var topTaxa = Array.isArray(summary.topTaxa) ? summary.topTaxa.slice(0, 8) : [];
    var taxaHtml = topTaxa.length
      ? topTaxa.map(function (taxon) {
          return '<span class="me-area-story-chip">' + escapeHtml(localizedDisplayName(taxon.name)) + '<b>' + escapeHtml(String(taxon.count || 0)) + '</b></span>';
        }).join('')
      : '<p class="me-area-story-note">' + escapeHtml(COPY.placeStoryNoTaxa) + '</p>';
    var recentItems = gallery.slice().sort(function (a, b) {
      return Number(b.recentObservationCount || 0) - Number(a.recentObservationCount || 0)
        || Number(b.observationCount || 0) - Number(a.observationCount || 0);
    }).filter(function (item) { return Number(item.recentObservationCount || 0) > 0; }).slice(0, 5);
    var recentHtml = recentItems.length
      ? recentItems.map(function (item) {
          return '<span class="me-area-story-chip">' + escapeHtml(localizedDisplayName(item.displayName)) + '<b>' + escapeHtml(String(item.recentObservationCount || 0)) + '</b></span>';
        }).join('')
      : '<p class="me-area-story-note">' + escapeHtml(COPY.areaGalleryLead) + '</p>';
    var missing = seasonalCoverage.filter(function (row) { return Number(row.observations || 0) <= 0; });
    var missingHtml = missing.length
      ? '<p class="me-area-story-note">' + escapeHtml(COPY.areaMissingSeasonLead) + '</p>'
        + missing.map(function (row) {
            if (!canRecord) {
              return '<span class="me-area-season-gap is-muted">'
                + '<span>' + escapeHtml(String(row.label || row.season || 'season')) + '</span>'
                + '<strong>' + escapeHtml(COPY.areaRestrictedActionLabel) + '</strong>'
                + '</span>';
            }
            return '<a class="me-area-season-gap" href="' + escapeHtml(RECORD_HREF) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:season_gap_record" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(RECORD_HREF) + '">'
              + '<span>' + escapeHtml(String(row.label || row.season || 'season')) + '</span>'
              + '<strong>' + escapeHtml(COPY.areaSafeRecordLabel) + '</strong>'
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
      ? topTaxa.map(function (taxon) { return localizedDisplayName(taxon && taxon.name, ''); }).filter(Boolean).join(' / ')
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

  function renderAreaPositiveFeedback(snapshot, fieldId) {
    var viewer = snapshot && snapshot.viewerContribution ? snapshot.viewerContribution : null;
    var community = snapshot && snapshot.communityPerspective ? snapshot.communityPerspective : null;
    var overlap = snapshot && snapshot.overlapInsight ? snapshot.overlapInsight : null;
    if (!viewer && !community && !overlap) return '';
    var hasViewer = !!(viewer && viewer.hasViewerRecords);
    var title = hasViewer ? COPY.areaPositiveTitleMine : COPY.areaPositiveTitleGuest;
    var viewerLine = hasViewer && viewer.dominantPerspective
      ? String(viewer.dominantPerspective.line || '')
      : (community && community.dominantPerspective ? String(community.dominantPerspective.line || '') : '');
    var thanksLine = hasViewer && viewer
      ? String(viewer.positiveFeedbackLine || '')
      : (community ? String(community.seasonCoverageLine || '') : '');
    var communityLine = community && community.dominantPerspective
      ? String(community.dominantPerspective.line || '')
      : '';
    var overlapLineText = overlap && overlap.line ? String(overlap.line) : '';
    var cards = [
      {
        label: hasViewer ? COPY.areaPositiveViewer : COPY.areaPositiveViewerGuest,
        body: viewerLine,
        stat: hasViewer && viewer ? String(viewer.recordCount || 0) + COPY.areaGalleryCountSuffix : (community ? String(community.observerCount || 0) + COPY.areaPositivePeopleSuffix : ''),
      },
      {
        label: hasViewer ? COPY.areaPositiveThanks : COPY.areaPositiveThanksGuest,
        body: thanksLine,
        stat: hasViewer && viewer ? String(viewer.visitCount || 0) + COPY.areaPositiveVisitSuffix : '',
      },
      {
        label: COPY.areaPositiveCommunity,
        body: communityLine || (community ? community.recentMomentumLine : ''),
        stat: community && community.secondaryPerspective ? community.secondaryPerspective.label : '',
      },
      {
        label: COPY.areaPositiveOverlap,
        body: overlapLineText,
        stat: '',
      },
    ].filter(function (card) { return card.body; });
    if (!cards.length) return '';
    var recordRows = [];
    if (hasViewer && viewer && Array.isArray(viewer.recordCards)) {
      recordRows = viewer.recordCards.slice(0, 3);
    } else if (community && Array.isArray(community.recordCards)) {
      recordRows = community.recordCards.slice(0, 3);
    }
    var recordHtml = recordRows.length
      ? '<div class="me-area-positive-records">'
        + recordRows.map(function (item) {
          var occurrenceId = String(item && item.occurrenceId || '');
          var href = occurrenceId ? OBSERVATION_HREF_TPL.replace('__ID__', encodeURIComponent(occurrenceId)) : NOTES_HREF;
          var photo = item && item.photoUrl
            ? '<img src="' + escapeHtml(toThumbUrl(item.photoUrl, 'sm')) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()" />'
            : '<span aria-hidden="true">✦</span>';
          var meta = [item && item.seasonLabel, item && item.observedAt ? String(item.observedAt).slice(0, 10) : ''].filter(Boolean).join(' / ');
          return '<a class="me-area-positive-record" href="' + escapeHtml(href) + '">'
            + photo
            + '<strong>' + escapeHtml(localizedDisplayName(item && item.displayName, '名前はあとで')) + '</strong>'
            + '<small>' + escapeHtml(meta) + '</small>'
            + '</a>';
        }).join('')
        + '</div>'
      : '';
    var albumHref = fieldId ? FIELDS_ALBUM_TPL.replace('__FIELD_ID__', encodeURIComponent(fieldId)) : '';
    var actions = ''
      + '<div class="me-area-positive-actions">'
      + (hasViewer ? '<a href="' + escapeHtml(NOTES_HREF) + '">' + escapeHtml(COPY.areaPositiveMineRecords) + '</a>' : '')
      + (albumHref ? '<a href="' + escapeHtml(albumHref) + '">' + escapeHtml(COPY.areaPublicPageLabel) + '</a>' : '')
      + '<a href="' + escapeHtml(NOTES_HREF.replace('view=mine', 'view=public')) + '">' + escapeHtml(COPY.areaPositiveCommunityRecords) + '</a>'
      + '</div>';
    return ''
      + '<section class="me-area-positive" aria-label="' + escapeHtml(title) + '">'
      +   '<div class="me-area-positive-head"><span>' + escapeHtml(COPY.areaPositiveEyebrow) + '</span><strong>' + escapeHtml(title) + '</strong></div>'
      +   '<div class="me-area-positive-grid">'
      + cards.map(function (card) {
        return '<article class="me-area-positive-card">'
          + '<span>' + escapeHtml(card.label) + '</span>'
          + (card.stat ? '<em>' + escapeHtml(card.stat) + '</em>' : '')
          + '<strong>' + escapeHtml(card.body) + '</strong>'
          + '</article>';
      }).join('')
      +   '</div>'
      +   recordHtml
      +   actions
      + '</section>';
  }

  function renderAreaPrimaryActions(fieldId, sourceLinksHtml, sourceTrustHtml, canSuggestEvent) {
    if (!fieldId) return '';
    var eventHref = EVENTS_ORGANIZER_HREF;
    var albumHref = FIELDS_ALBUM_TPL.replace('__FIELD_ID__', encodeURIComponent(fieldId));
    if (!albumHref) return '';
    var metaHtml = sourceLinksHtml || sourceTrustHtml
      ? '<div class="me-area-primary-actions-meta">' + sourceLinksHtml + sourceTrustHtml + '</div>'
      : '';
    if (canSuggestEvent === false || !eventHref) {
      return metaHtml;
    }
    var albumHtml = '<a class="me-area-primary-action me-area-primary-action-album" href="' + escapeHtml(albumHref) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:album" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(albumHref) + '">'
      + '<span aria-hidden="true">□</span>'
      + escapeHtml(COPY.areaPublicPageLabel)
      + '</a>';
    return renderAreaActivityRallyPanel(albumHtml + metaHtml);
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
    var sourceLinksHtml = renderAreaSourceLinks(f);
    var sourceTrustHtml = renderAreaSourceTrust(f.sourceConfidence, f.verificationLabel, f.verificationLevel);
    var fieldId = (state.selectedPoint && state.selectedPoint.fieldId) || '';
    var accessStatus = areaAccessStatus(f, masking);
    var canRecord = canSuggestDirectAreaRecord(f, masking);
    var followHtml = canRecord ? renderAreaFollowButton('field', fieldId, String(f.name || '観察エリア'), mapFollowHref({ field: fieldId })) : '';
    var selectedAreaFeature = state.selectedPoint && state.selectedPoint.areaFeature ? state.selectedPoint.areaFeature : null;
    var selectedAreaProps = selectedAreaFeature && selectedAreaFeature.properties ? selectedAreaFeature.properties : f;
    var selectedAreaCenter = selectedAreaFeature
      ? areaFeatureCenter(selectedAreaFeature, state.selectedPoint && state.selectedPoint.lat, state.selectedPoint && state.selectedPoint.lng)
      : (state.selectedPoint && Number.isFinite(state.selectedPoint.lat) && Number.isFinite(state.selectedPoint.lng) ? { lat: state.selectedPoint.lat, lng: state.selectedPoint.lng } : null);
    var guideStopHtml = renderAreaGuideStop(selectedAreaProps, selectedAreaCenter);
    var nextStepHtml = renderAreaNextStepCard({
      canRecord: canRecord,
      observationCount: summary.totalObservations || 0,
      hasGallery: gallery.length > 0,
      hasGuide: !!guideStopHtml,
    });
    var areaMeta = rawLocationLabel + (areaHa ? ' / ' + areaHa : '');
    var heroHtml = renderAreaHero({
      title: String(f.name || '観察エリア'),
      sourceLabel: String(f.sourceLabel || ''),
      meta: areaMeta,
      photo: representativePhoto,
    });
    var primaryActionsHtml = renderAreaPrimaryActions(fieldId, sourceLinksHtml, sourceTrustHtml, canRecord);
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
    var safetyNoticeHtml = renderAreaSafetyNotice(f, masking);
    var placeStoryHtml = renderPlaceStoryHighlights(f, summary, indicators, representativePhoto);
    var galleryHtml = renderAreaObservationGallery(gallery, { label: COPY.areaGalleryTitle, canRecord: canRecord, areaStatus: accessStatus });
    var schoolAlbumHtml = renderSchoolAlbumEntrypoints(f);
    var accessHtml = renderAreaAccessGuidance(f.accessGuidance);
    var storyTabsHtml = renderAreaStoryTabs(snapshot, { canRecord: canRecord });
    var positiveHtml = renderAreaPositiveFeedback(snapshot, fieldId);
    var publicPageHtml = fieldId
      ? '<a class="me-area-public-page" href="' + escapeHtml(FIELDS_ALBUM_TPL.replace('__FIELD_ID__', encodeURIComponent(fieldId))) + '" data-kpi-event="selected_place_cta_click" data-kpi-action="map:area:public_page" data-kpi-funnel="map_selected_place" data-kpi-target="' + escapeHtml(FIELDS_ALBUM_TPL.replace('__FIELD_ID__', encodeURIComponent(fieldId))) + '">' + escapeHtml(COPY.areaPublicPageLabel) + '</a>'
      : '';
    return heroHtml + accessHtml + maskingHtml + safetyNoticeHtml + nextStepHtml + primaryActionsHtml + positiveHtml + guideStopHtml + followHtml + publicPageHtml + schoolAlbumHtml + galleryHtml + storyTabsHtml + placeStoryHtml + summaryHtml + timelineHtml + indicatorsHtml;
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
    // 0% が並んだとき「エリアが悪い」のではなく「記録がまだ少ないだけ」と分かるように、
    // 各カードに「100% に近づくと何が言えるか」を hint として置く (eBird/iNaturalist 文献ベース)。
    var cards = [
      {
        label: '歩かれ方',
        value: indicators.effortReportedRate,
        hint: '歩いた時間や距離が添えられた記録。増えるほど、同じ場所の見え方を比べやすい',
      },
      {
        label: '見たものメモの量',
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
      : '季節差が見えている';
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

  function viewerOwnedRecordCenter(record) {
    var lat = Number(record && record.exactLatitude);
    var lng = Number(record && record.exactLongitude);
    return record && record.isViewerOwned && Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat: lat, lng: lng }
      : null;
  }

  function buildViewerOwnedRecordPointCollection(records) {
    return {
      type: 'FeatureCollection',
      features: (records || []).map(function (record) {
        var center = viewerOwnedRecordCenter(record);
        if (!center) return null;
        if (recordRepresentedByOwnObservations(record)) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [center.lng, center.lat] },
          properties: {
            occurrenceId: record.occurrenceId || '',
            visitId: record.visitId || '',
            cellId: record.cellId || '',
            label: recordDisplayName(record, COPY.discoveryFallback),
          },
        };
      }).filter(Boolean),
    };
  }

  function findRecordByOccurrenceId(occurrenceId) {
    for (var i = 0; i < state.records.length; i += 1) {
      var record = state.records[i];
      if (record && record.occurrenceId === occurrenceId) return record;
    }
    return null;
  }

  function syncViewerOwnedRecordSource(map) {
    if (!map) return;
    var sourceId = 'viewer-owned-observations';
    var collection = buildViewerOwnedRecordPointCollection(state.records || []);
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(collection);
      return;
    }
    map.addSource(sourceId, { type: 'geojson', data: collection });
    map.addLayer({
      id: 'viewer-owned-observation-halo',
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': 'rgba(255,255,255,0.92)',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 13],
        'circle-opacity': 0.92,
      },
    });
    map.addLayer({
      id: 'viewer-owned-observation-dot',
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': '#10b981',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 8],
        'circle-stroke-color': '#064e3b',
        'circle-stroke-width': 1.6,
      },
    });
    ['viewer-owned-observation-halo', 'viewer-owned-observation-dot'].forEach(function (layerId) {
      map.on('click', layerId, function (e) {
        if (hasPendingMapResults()) return;
        if (!e.features || !e.features[0]) return;
        var occurrenceId = e.features[0].properties && e.features[0].properties.occurrenceId;
        var record = findRecordByOccurrenceId(occurrenceId);
        if (record) selectRecord(record, { focusMap: false, openSheet: shouldUseBottomSheet() });
      });
      map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
    });
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
      syncViewerOwnedRecordSource(map);
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
      layout: { visibility: 'none' },
      paint: {
        'fill-color': 'rgba(14,165,233,0.12)',
        'fill-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 1, 0.04, 4, 0.07, 12, 0.10],
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
      layout: { visibility: 'none' },
      paint: {
        'circle-color': taxonColorExpression(0.12),
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          6, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 1], 1, 5, 8, 9, 24, 13],
          13, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 1], 1, 7, 8, 12, 24, 18],
        ],
        'circle-stroke-color': taxonColorExpression(0.22),
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 13, 1.1],
        'circle-opacity': 0.38,
      },
    });
    map.addLayer({
      id: 'observation-cell-dot',
      type: 'circle',
      source: 'observation-centroids',
      paint: {
        'circle-color': taxonColorExpression(0.95),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 13, 5.5],
        'circle-stroke-color': 'rgba(255,255,255,0.96)',
        'circle-stroke-width': 1.6,
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
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          5, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 0, 0.04, 2, 0.08, 6, 0.16, 12, 0.24],
          10, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 0, 0.08, 2, 0.16, 6, 0.34, 12, 0.52],
          14, ['interpolate', ['linear'], ['coalesce', ['get', 'count'], 0], 0, 0.12, 2, 0.22, 6, 0.44, 12, 0.64],
        ],
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
    syncViewerOwnedRecordSource(map);
    ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-bloom', 'observation-cell-dot', 'observation-cell-count', 'obs-cell-heat'].forEach(function (layerId) {
      map.on('click', layerId, function (e) {
        if (hasPendingMapResults()) return;
        if (!e.features || !e.features[0]) return;
        if (isRainInteractionMode() && checkRainTap(e.lngLat)) return;
        var selectedFeature = e.features[0];
        if (selectedFeature.geometry && selectedFeature.geometry.type === 'Point') {
          selectedFeature = findCellFeatureById(selectedFeature.properties && selectedFeature.properties.cellId) || selectedFeature;
        }
        // 公園・登録エリアのような具体的な場所が下に重なっているなら、選択肢を出す。
        // 行政区域はセルクリックを横取りさせない。
        var areaLayers = areaPolygonHitLayers();
        if (state.map && areaLayers.length) {
          var areaHits = state.map.queryRenderedFeatures(e.point, { layers: areaLayers });
          var pick = pickConcreteAreaHit(areaHits);
          if (pick) {
            showCellAreaChoice(selectedFeature, pick, e.lngLat, { focusMap: false, openSheet: true });
            return;
          }
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
    var markerLayers = ['observation-cell-dot', 'observation-cell-selected'];
    var markerDetailLayers = ['observation-cell-outline', 'observation-cell-count', 'observation-cell-label'];
    var viewerOwnedLayers = ['viewer-owned-observation-halo', 'viewer-owned-observation-dot'];
    var heatLayers = ['obs-cell-heat', 'obs-cell-heat-selected'];
    var frontierLayers = ['frontier-fill'];
    var areaLayers = ['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-selected-halo', 'area-polygon-selected'];
    var areaLabelLayers = ['area-polygon-name-priority', 'area-polygon-name'];
    var show = function (ids, visible) {
      ids.forEach(function (id) {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      });
    };
    var moveToTop = function (ids) {
      ids.forEach(function (id) {
        if (map.getLayer(id)) {
          try { map.moveLayer(id); } catch (_) {}
        }
      });
    };
    show(markerLayers, tab === 'markers');
    show(markerDetailLayers, tab === 'markers');
    show(viewerOwnedLayers, tab === 'markers');
    show(heatLayers, tab === 'heatmap');
    show(frontierLayers, tab === 'frontier');
    show(areaLayers, tab === 'heatmap' || tab === 'places' || tab === 'rain');
    show(areaLabelLayers, tab === 'places' || tab === 'rain');
    if (map.getLayer('waterway-hint-line')) {
      map.setLayoutProperty('waterway-hint-line', 'visibility', tab === 'places' || tab === 'rain' ? 'visible' : 'none');
    }
    if (map.getLayer('area-polygon-fill')) {
      map.setPaintProperty('area-polygon-fill', 'fill-opacity',
        tab === 'places' || tab === 'rain'
          ? ['interpolate', ['linear'], ['zoom'], 8, 0.11, 11, 0.15, 14, 0.28, 16.5, 0.42]
          : ['interpolate', ['linear'], ['zoom'], 8, 0.03, 14, 0.08]);
    }
    if (map.getLayer('area-polygon-outline')) {
      map.setPaintProperty('area-polygon-outline', 'line-opacity', tab === 'places' || tab === 'rain'
        ? ['interpolate', ['linear'], ['zoom'], 8, 0.55, 12, 0.72, 15, 0.96]
        : 0.42);
      map.setPaintProperty('area-polygon-outline', 'line-width', tab === 'places' || tab === 'rain'
        ? ['interpolate', ['linear'], ['zoom'],
          8, ['case', ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]], 1.4, 1.2],
          14, ['case', ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]], 2.4, 1.6],
          17, ['case', ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]], 3.2, 2.2]]
        : ['case', ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]], 2.4, 1.4]);
    }
    if (map.getLayer('area-polygon-approximate-outline')) {
      map.setPaintProperty('area-polygon-approximate-outline', 'line-opacity', tab === 'places' || tab === 'rain'
        ? ['interpolate', ['linear'], ['zoom'], 8, 0.48, 12, 0.74, 15, 0.92]
        : 0.5);
      map.setPaintProperty('area-polygon-approximate-outline', 'line-width', tab === 'places' || tab === 'rain'
        ? ['interpolate', ['linear'], ['zoom'], 8, 1.1, 14, 1.8, 17, 2.4]
        : 1.8);
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
      moveToTop(['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-name-priority', 'area-polygon-name', 'area-polygon-selected-halo', 'area-polygon-selected']);
      showLegend(COPY.areaTrustLegendLow, COPY.areaTrustLegendHigh,
        'linear-gradient(90deg, #f59e0b, #0ea5e9 48%, #059669)', 'areas');
      loadWaterwayHints();
    } else if (tab === 'rain') {
      moveToTop(['jma-rain-nowcast-layer', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox', 'area-polygon-name-priority', 'area-polygon-name']);
      hideLegend();
      loadWaterwayHints();
    } else {
      hideLegend();
    }
    if (tab === 'markers') moveToTop(['observation-cell-outline', 'observation-cell-dot', 'observation-cell-count', 'observation-cell-label', 'viewer-owned-observation-halo', 'viewer-owned-observation-dot', 'observation-cell-selected']);
    refreshDiscoveryPreviewMarkers();
    renderOwnObservationMarkers();
    refreshAreaBadgeMarkers();
    if (tab === 'markers' || tab === 'places' || tab === 'rain') loadGuideSpots();
    else clearGuideSpotMarkers();
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
        minzoom: 8,
        paint: {
          'fill-color': [
            'match', ['get', 'stage'],
            'blank', 'rgba(100,116,139,0.30)',
            'building', 'rgba(14,165,233,0.34)',
            'repeatable', 'rgba(20,184,166,0.38)',
            'rgba(5,150,105,0.44)',
          ],
          'fill-opacity': [
            'interpolate', ['linear'], ['zoom'],
            8, ['match', ['get', 'stage'], 'blank', 0.12, 'building', 0.16, 'repeatable', 0.19, 0.23],
            12, ['match', ['get', 'stage'], 'blank', 0.18, 'building', 0.24, 'repeatable', 0.30, 0.36],
            15, ['match', ['get', 'stage'], 'blank', 0.24, 'building', 0.32, 'repeatable', 0.40, 0.48],
          ],
          'fill-outline-color': 'rgba(15,118,110,0.30)',
        },
      });
      map.on('click', 'frontier-fill', function (e) {
        // Frontier cells can cover small park polygons. If the click also hits
        // a registered area, open the concrete area so the event creator keeps
        // its field_id instead of falling back to a generic coordinate. Broad
        // administrative areas should not swallow frontier-cell clicks.
        var areaLayers = areaPolygonHitLayers();
        if (state.map && areaLayers.length) {
          var areaHits = state.map.queryRenderedFeatures(e.point, { layers: areaLayers });
          var pick = pickConcreteAreaHit(areaHits);
          if (pick) {
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

  function isAdministrativeAreaFeature(feature) {
    var source = String((feature && feature.properties && feature.properties.source) || '');
    return source === 'admin_municipality' || source === 'admin_prefecture' || source === 'admin_country';
  }

  function pickConcreteAreaHit(areaHits) {
    if (!areaHits || !areaHits.length) return null;
    var pick = null;
    var pickArea = Infinity;
    for (var i = 0; i < areaHits.length; i += 1) {
      var feature = areaHits[i];
      if (!feature || !feature.properties || isAdministrativeAreaFeature(feature)) continue;
      var area = Number(feature.properties.area_ha);
      var comparableArea = Number.isFinite(area) ? area : Infinity;
      if (!pick || comparableArea < pickArea) {
        pick = feature;
        pickArea = comparableArea;
      }
    }
    return pick;
  }

  function areaPolygonHitLayers() {
    if (!state.map) return [];
    return ['area-polygon-hitbox', 'area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-selected-halo', 'area-polygon-selected'].filter(function (id) {
      return state.map.getLayer(id);
    });
  }

  var VISIBLE_AREA_POLYGON_FILTER = ['!', ['all', ['==', ['get', 'source'], 'school'], ['==', ['get', 'approximate_boundary'], true]]];
  function selectedAreaPolygonFilter(fieldId) {
    return ['all', ['==', ['get', 'field_id'], String(fieldId || '__none__')], VISIBLE_AREA_POLYGON_FILTER];
  }
  function setSelectedAreaPolygonFilter(fieldId) {
    if (!state.map) return;
    var filter = selectedAreaPolygonFilter(fieldId);
    ['area-polygon-selected-halo', 'area-polygon-selected'].forEach(function (layerId) {
      if (state.map.getLayer(layerId)) state.map.setFilter(layerId, filter);
    });
  }

  function pickSmallestAreaFeature(features) {
    if (!features || !features.length) return null;
    var pick = features[0];
    var pickArea = (pick.properties && Number(pick.properties.area_ha)) || Infinity;
    for (var i = 1; i < features.length; i += 1) {
      var feature = features[i];
      var area = (feature.properties && Number(feature.properties.area_ha));
      if (Number.isFinite(area) && area < pickArea) {
        pick = feature;
        pickArea = area;
      }
    }
    return pick;
  }

  function loadWaterwayHints() {
    if (!state.map || (state.tab !== 'places' && state.tab !== 'rain')) return;
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
        if (!json || !state.map || (state.tab !== 'places' && state.tab !== 'rain')) return;
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
      filter: VISIBLE_AREA_POLYGON_FILTER,
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
          'osm_named_area', 'rgba(139,92,246,0.14)',
          'admin_municipality', 'rgba(148,163,184,0.10)',
          'admin_prefecture', 'rgba(148,163,184,0.08)',
          'admin_country', 'rgba(148,163,184,0.06)',
          'rgba(148,163,184,0.10)',
        ],
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.10, 14, 0.22],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-outline',
      type: 'line',
      source: 'area-polygons',
      minzoom: 8,
      filter: VISIBLE_AREA_POLYGON_FILTER,
      paint: {
        'line-color': [
          'case',
          ['in', ['get', 'access'], ['literal', ['private', 'no', 'restricted']]],
          '#dc2626',
          ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]],
          '#059669',
          ['>=', ['coalesce', ['get', 'source_confidence'], 0], 0.75],
          '#0ea5e9',
          '#f59e0b',
        ],
        'line-width': [
          'case',
          ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]],
          2.4,
          1.4,
        ],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-approximate-outline',
      type: 'line',
      source: 'area-polygons',
      minzoom: 8,
      filter: ['all', ['==', ['get', 'approximate_boundary'], true], VISIBLE_AREA_POLYGON_FILTER],
      paint: {
        'line-color': '#b45309',
        'line-width': 1.8,
        'line-opacity': 0.82,
        'line-dasharray': [2, 1.4],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-hitbox',
      type: 'line',
      source: 'area-polygons',
      minzoom: 8,
      filter: VISIBLE_AREA_POLYGON_FILTER,
      paint: {
        'line-color': 'rgba(15,23,42,0)',
        'line-opacity': 0.01,
        'line-width': 14,
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-name-priority',
      type: 'symbol',
      source: 'area-polygons',
      minzoom: 13.2,
      maxzoom: 15.35,
      filter: ['all',
        ['has', 'name'],
        ['!', ['in', ['get', 'access'], ['literal', ['private', 'no', 'restricted']]]],
        ['any',
          ['all',
            ['match', ['get', 'source'], ['osm_park', 'protected_area', 'osm_named_area'], true, false],
            ['any',
              ['in', ['get', 'access'], ['literal', ['yes', 'public', 'permissive']]],
              ['in', ['get', 'verification_level'], ['literal', ['registry_matched', 'page_verified', 'owner_verified', 'staff_verified']]],
              ['>=', ['coalesce', ['get', 'source_confidence'], 0], 0.75],
            ],
          ],
          ['all',
            ['match', ['get', 'source'], ['oecm', 'nature_symbiosis_site'], true, false],
            ['in', ['get', 'access'], ['literal', ['yes', 'public', 'permissive']]],
          ],
        ],
        ['>=', ['coalesce', ['get', 'area_ha'], 0], 35],
        VISIBLE_AREA_POLYGON_FILTER,
      ],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13.2, 9.2, 15.4, 10.8],
        'text-max-width': 7,
        'text-padding': 18,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': ['coalesce', ['get', 'area_ha'], 9999],
      },
      paint: {
        'text-color': [
          'match', ['get', 'source'],
          'school', '#8a6a16',
          'osm_park', '#0f766e',
          'osm_named_area', '#6d28d9',
          'protected_area', '#047857',
          'oecm', '#4d7c0f',
          'nature_symbiosis_site', '#047857',
          '#475569',
        ],
        'text-halo-color': 'rgba(237,244,239,0.96)',
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 13.2, 0, 13.8, 0.72, 15.4, 0.88],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-name',
      type: 'symbol',
      source: 'area-polygons',
      minzoom: 15.4,
      filter: ['all', ['has', 'name'], VISIBLE_AREA_POLYGON_FILTER],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15.4, 10.4, 17.5, 12.2],
        'text-max-width': 8,
        'text-padding': 16,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-sort-key': ['-', 0, ['coalesce', ['get', 'area_ha'], 9999]],
      },
      paint: {
        'text-color': [
          'match', ['get', 'source'],
          'school', '#8a6a16',
          'osm_park', '#0f766e',
          'osm_named_area', '#6d28d9',
          'protected_area', '#047857',
          'oecm', '#4d7c0f',
          'nature_symbiosis_site', '#047857',
          '#475569',
        ],
        'text-halo-color': 'rgba(237,244,239,0.94)',
        'text-halo-width': 1.3,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 15.4, 0.54, 16.4, 0.92],
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-selected-halo',
      type: 'line',
      source: 'area-polygons',
      filter: selectedAreaPolygonFilter('__none__'),
      paint: {
        'line-color': 'rgba(255,255,255,0.94)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 5.6, 14, 8.2, 17, 10.5],
        'line-opacity': 0.92,
      },
    }, beforeId);
    map.addLayer({
      id: 'area-polygon-selected',
      type: 'line',
      source: 'area-polygons',
      filter: selectedAreaPolygonFilter('__none__'),
      paint: {
        'line-color': '#0f766e',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.2, 14, 4.8, 17, 6.2],
        'line-opacity': 0.98,
      },
    }, beforeId);
    ['area-polygon-fill', 'area-polygon-outline', 'area-polygon-approximate-outline', 'area-polygon-hitbox'].forEach(function (layerId) {
      map.on('click', layerId, function (e) {
        if (isRainInteractionMode() && checkRainTap(e.lngLat)) return;
        var hitLayers = areaPolygonHitLayers();
        var hits = hitLayers.length ? map.queryRenderedFeatures(e.point, { layers: hitLayers }) : e.features;
        var pick = pickSmallestAreaFeature(hits);
        if (!pick) return;
        openAreaFeatureSheet(pick, e.lngLat.lat, e.lngLat.lng);
      });
      map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
    });
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
      state.areaPolygonFeatures = [];
      state.areaPolygonsLoaded = true;
      clearAreaBadgeMarkers();
      clearNearbyAreaMarkers();
      return;
    }
    state.areaPolygonsLoaded = false;
    if (state.areaPolygonsAbort) { try { state.areaPolygonsAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.areaPolygonsAbort = controller;
    var qs = '?bbox=' + encodeURIComponent(bbox) + '&zoom=' + encodeURIComponent(zoom.toFixed(2));
    var selectedSources = areaSourcesQueryValueForMap();
    if (selectedSources) qs += '&sources=' + encodeURIComponent(selectedSources);
    fetch(apiAreaPolygons + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (collection) {
        if (!collection) return;
        ensureAreaPolygons(state.map);
        state.areaPolygonFeatures = Array.isArray(collection.features) ? collection.features : [];
        state.areaPolygonsLoaded = true;
        var src = state.map.getSource('area-polygons');
        if (src) src.setData(collection);
        applyTab(state.map, state.tab);
        refreshAreaBadgeMarkers();
        if (state.pendingPlaceSearchRef) {
          var pendingRef = state.pendingPlaceSearchRef;
          var pendingMatch = state.areaPolygonFeatures.find(function (feature) {
            var props = feature && feature.properties ? feature.properties : {};
            if (pendingRef.canonicalPlaceId && String(props.canonical_place_id || '') === pendingRef.canonicalPlaceId) return true;
            return pendingRef.osmType
              && pendingRef.osmId
              && String(props.osm_type || '') === pendingRef.osmType
              && String(props.osm_id || '') === pendingRef.osmId;
          });
          if (pendingMatch) {
            state.pendingPlaceSearchRef = null;
            var pendingOrigin = state.nearbyAreaOrigin || { lat: 0, lng: 0 };
            openAreaFeatureSheet(pendingMatch, pendingOrigin.lat, pendingOrigin.lng);
          }
        }
      })
      .catch(function (err) { if (err && err.name === 'AbortError') return; });
  }

  function renderGuideSpotMarker(feature) {
    var center = guideSpotCenter(feature);
    var spot = feature && feature.properties ? feature.properties : {};
    if (!center || !spot.title) return null;
    var el = document.createElement('div');
    el.className = 'me-guide-spot-marker is-pin';
    el.setAttribute('aria-label', String(spot.title || '') + ' ' + COPY.areaBadgeGuideLabel);
    el.innerHTML = '<button type="button" class="me-guide-spot-main" title="' + escapeHtml(String(spot.title || '') + ' ' + COPY.areaBadgeGuideLabel) + '" aria-label="' + escapeHtml(String(spot.title || '') + ' ' + COPY.areaBadgeGuideLabel) + '">' +
      '<span class="me-guide-dot" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"></path></svg></span>' +
    '</button>';
    el.querySelector('.me-guide-spot-main').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (isRainInteractionMode() && checkRainTap(center)) return;
      openGuideSpotSheet(feature);
    });
    return new window.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] })
      .setLngLat([center.lng, center.lat])
      .addTo(state.map);
  }

  function guideSpotClusterKey(feature) {
    var center = guideSpotCenter(feature);
    var spot = feature && feature.properties ? feature.properties : {};
    var areaId = String(spot.guideAreaId || spot.guide_area_id || '').trim();
    if (areaId) return 'area:' + areaId;
    if (!center) return 'unknown';
    var zoom = state.map && typeof state.map.getZoom === 'function' ? Number(state.map.getZoom()) : 14;
    var grid = !Number.isFinite(zoom) ? 0.012 : zoom < 10 ? 0.12 : zoom < 12 ? 0.04 : zoom < 14 ? 0.012 : 0.002;
    return 'grid:' + String(grid) + ':' + Math.round(center.lat / grid) + ':' + Math.round(center.lng / grid);
  }

  function groupGuideSpotFeatures(features) {
    var groups = {};
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      var key = guideSpotClusterKey(feature);
      if (!groups[key]) groups[key] = [];
      groups[key].push(feature);
    });
    return Object.keys(groups).map(function (key) { return groups[key]; });
  }

  function renderGuideSpotGroupMarker(features) {
    var list = Array.isArray(features) ? features : [];
    if (list.length <= 1) return renderGuideSpotMarker(list[0]);
    var centers = list.map(guideSpotCenter).filter(Boolean);
    if (!centers.length) return null;
    var center = centers.reduce(function (acc, item) {
      acc.lat += item.lat / centers.length;
      acc.lng += item.lng / centers.length;
      return acc;
    }, { lat: 0, lng: 0 });
    var el = document.createElement('div');
    el.className = 'me-guide-spot-marker is-cluster is-pin';
    el.setAttribute('aria-label', COPY.guideSpotClusterLabel + ' ' + String(list.length));
    el.innerHTML = '<button type="button" class="me-guide-spot-main" title="' + escapeHtml(COPY.guideSpotClusterLabel + ' ' + String(list.length)) + '" aria-label="' + escapeHtml(COPY.guideSpotClusterLabel + ' ' + String(list.length)) + '">' +
      '<span class="me-guide-cluster-count" aria-hidden="true">' + escapeHtml(String(list.length)) + '</span>' +
    '</button>';
    el.querySelector('.me-guide-spot-main').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (isRainInteractionMode() && checkRainTap(center)) return;
      openGuideSpotGroupSheet(list);
    });
    return new window.maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -8] })
      .setLngLat([center.lng, center.lat])
      .addTo(state.map);
  }

  function refreshGuideSpotMarkers(collection) {
    clearGuideSpotMarkers();
    if (!state.map || !window.maplibregl || !collection || !Array.isArray(collection.features)) return;
    if (state.tab !== 'markers' && state.tab !== 'places' && state.tab !== 'rain') return;
    groupGuideSpotFeatures(collection.features.slice(0, 80)).forEach(function (features) {
      var marker = renderGuideSpotGroupMarker(features);
      if (marker) state.guideSpotMarkers.push(marker);
    });
  }

  function loadGuideSpots() {
    if (!apiGuideSpots || !state.map) return;
    if (state.tab !== 'markers' && state.tab !== 'places' && state.tab !== 'rain') {
      clearGuideSpotMarkers();
      return;
    }
    var bbox = currentBboxString();
    if (!bbox) return;
    if (state.guideSpotsAbort) { try { state.guideSpotsAbort.abort(); } catch (_) {} }
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    state.guideSpotsAbort = controller;
    var qs = '?bbox=' + encodeURIComponent(bbox) + '&limit=80';
    fetch(apiGuideSpots + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (collection) {
        refreshGuideSpotMarkers(collection);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') return;
      });
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
    var recordLimit = scope && scope.cellId ? CELL_RECORD_LIMIT : VIEWPORT_RECORD_LIMIT;
    var qs = '?limit=' + encodeURIComponent(String(recordLimit));
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
    var requestKey = qs;
    if (state.recordsRecoveryKey !== requestKey) {
      state.recordsRecoveryKey = requestKey;
      state.recordsRecoveryAttempts = 0;
    }
    setStatus(COPY.recordsLoading);
    var visibleRecords = state.records && state.records.length ? state.records.length : 0;
    setResultsLoadState('loading', visibleRecords);
    if (!visibleRecords && resultsListEl) {
      resultsListEl.innerHTML = renderResultsLoadingState();
      setMapEmptyInviteVisible(false);
    }
    if (state.recordAbort) { try { state.recordAbort.abort(); } catch (_) {} }
    clearRecordsLoadWatchdog();
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var requestSeq = state._recordsRequestSeq + 1;
    state._recordsRequestSeq = requestSeq;
    state.recordAbort = controller;
    updatePendingMapResultsState();
    scheduleRecordsLoadWatchdog(requestSeq, requestKey, scope);
    scheduleRecordsHardSettleWatchdog();
    fetch(apiObservations + qs, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('records ' + r.status)); })
      .then(function (list) {
        if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) return;
        state.recordsRecoveryAttempts = 0;
        var selectedAggregateCellId = scope && scope.cellId && list && list.stats && list.stats.selectedCellId === scope.cellId
          ? scope.cellId
          : null;
        state.records = ((list && list.items) || []).map(function (record) {
          if (!record || !selectedAggregateCellId) return record;
          return Object.assign({}, record, { cellId: selectedAggregateCellId });
        }).filter(isRenderableMapRecord);
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
        forceSettleRecordsRequest(requestSeq, list && list.stats);
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') {
          forceSettleRecordsRequest(requestSeq, state.lastStats);
          return;
        }
        settleCurrentRecordsRequest(requestSeq);
        state.recordsRecoveryAttempts = 0;
        setResultsLoadState('error', state.records && state.records.length ? state.records.length : 0);
        setStatus('—');
        setStatusMeta('');
        clearDiscoveryPreviewMarkers();
      })
      .then(function () {
        if (!MapExplorerStateHelpers.shouldApplyAsyncResponse(requestSeq, state._recordsRequestSeq)) return;
        if (state._recordsAppliedSeq === requestSeq) return;
        forceSettleRecordsRequest(requestSeq, state.lastStats);
      });
  }

  function loadMyObservations() {
    if (!state.map || !apiMyObservations) return;
    fetch(apiMyObservations + '?limit=120', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('my observations ' + r.status)); })
      .then(function (payload) {
        state.myObservations = payload && payload.signedIn ? (payload.items || []).filter(isRenderableMapRecord) : [];
        state.myObservationClusters = payload && payload.signedIn ? (payload.clusters || []).filter(isRenderableMapCluster) : [];
        if (root) root.setAttribute('data-own-observations-fetch', payload && payload.signedIn ? 'signed-in' : 'signed-out');
        renderPersonalMemoryClusters();
        syncViewerOwnedRecordSource(state.map);
        try {
          renderOwnObservationMarkers();
        } catch (_) {
          setOwnObservationMarkerState('render-error', 0);
        }
        try {
          maybeFitOwnObservationsOnFirstOpen();
        } catch (_) {}
      })
      .catch(function () {
        state.myObservations = [];
        state.myObservationClusters = [];
        if (root) {
          root.setAttribute('data-own-observations-fetch', 'error');
          root.setAttribute('data-own-observation-record-count', '0');
        }
        hidePersonalMemoryClusters();
        hideOwnObservationTrail();
        clearOwnObservationMarkers();
        syncViewerOwnedRecordSource(state.map);
      });
  }

  function refreshMapData() {
    loadCells();
    loadRecords(null);
    loadMyObservations();
  }

  function clearSuppressedViewportSearch() {
    state.suppressViewportSearchUntil = 0;
    state.suppressNextViewportSearch = false;
  }

  function consumeSuppressedViewportSearch() {
    var suppressViewportSearch = state.suppressViewportSearchUntil
      && Date.now() <= state.suppressViewportSearchUntil;
    if (!suppressViewportSearch) {
      clearSuppressedViewportSearch();
      return false;
    }
    state.suppressNextViewportSearch = false;
    state.pendingViewportSearch = false;
    clearViewportRefreshTimer();
    var resizedBbox = currentBboxString();
    if (resizedBbox) state.lastSearchedBbox = resizedBbox;
    updateSearchAreaUi();
    refreshDiscoveryPreviewMarkers();
    renderOwnObservationMarkers();
    return true;
  }

  function refreshViewportSearchData() {
    if (!state.map) return;
    if (consumeSuppressedViewportSearch()) return;
    clearViewportRefreshTimer();
    var bbox = currentBboxString();
    if (bbox) state.lastSearchedBbox = bbox;
    state.pendingViewportSearch = false;
    updateSearchAreaUi();
    refreshMapData();
    if (state.tab === 'frontier') loadFrontier(state.map);
    deferMapTask(function () { loadEffortSummary(); }, 180);
  }

  function scheduleViewportRefresh() {
    if (!state.map || !state.pendingViewportSearch) return;
    clearViewportRefreshTimer();
    state.viewportRefreshTimer = setTimeout(function () {
      state.viewportRefreshTimer = null;
      if (!state.pendingViewportSearch) return;
      if (hasPendingMapResults()) {
        scheduleViewportRefresh();
        return;
      }
      refreshViewportSearchData();
    }, 700);
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

  function deferMapTask(fn, delay) {
    var run = function () {
      try { fn(); } catch (_) {}
    };
    var ms = typeof delay === 'number' ? delay : 0;
    if (window.requestIdleCallback) {
      window.setTimeout(function () {
        window.requestIdleCallback(run, { timeout: Math.max(500, ms + 500) });
      }, ms);
      return;
    }
    window.setTimeout(run, ms);
  }

  function scheduleInitialMapDataLoad(delay) {
    if (state.initialDataLoaded || state.initialDataLoadTimer) return;
    state.initialDataLoadTimer = window.setTimeout(function () {
      state.initialDataLoadTimer = null;
      runInitialMapDataLoad('timer');
    }, delay);
  }

  function runInitialMapDataLoad(reason) {
    if (!state.map || state.initialDataLoaded) return false;
    var bbox = '';
    try { bbox = currentBboxString(); } catch (_) { bbox = ''; }
    if (!bbox) {
      state.initialDataLoadAttempts += 1;
      if (state.initialDataLoadAttempts <= 8) {
        scheduleInitialMapDataLoad(Math.min(1600, 180 + state.initialDataLoadAttempts * 220));
      }
      return false;
    }
    state.initialDataLoaded = true;
    state.initialDataLoadAttempts = 0;
    refreshMapData();
    refreshDiscoveryPreviewMarkers();
    if (state.tab === 'markers' || state.tab === 'places' || state.tab === 'rain') loadGuideSpots();
    scheduleStartPanelRouteCandidates(reason === 'load' ? 120 : 260);
    maybeShowLayerHint(state.tab);
    deferMapTask(function () {
      if (state.tab === 'frontier') loadFrontier(state.map);
      loadEffortSummary();
      loadTraces();
    }, reason === 'load' ? 220 : 420);
    return true;
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

  function applyRestoredParams(params, options) {
    if (!params || !Object.keys(params).length) return;
    var restoreViewport = !options || options.restoreViewport !== false;
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
    if (restoreViewport && params.cell) state._restoredCellId = params.cell;
    if (restoreViewport && params.lng && params.lat && params.z) {
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
    document.querySelectorAll('.me-filter-tab-chip').forEach(function (btn) {
      var t = btn.getAttribute('data-filter-tab');
      btn.classList.toggle('is-active', t === state.tab);
      btn.setAttribute('aria-pressed', t === state.tab ? 'true' : 'false');
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

  // Restore explicit shared viewport from query/hash. Local storage may restore
  // filters, but not the old viewport; opening /map should bias toward here-now.
  (function () {
    var params = parseStateString(window.location.search);
    var restoreViewport = true;
    if (!Object.keys(params).length) {
      var hash = window.location.hash;
      params = hash ? parseStateString(hash) : {};
    }
    if (!Object.keys(params).length) {
      try { params = parseStateString(localStorage.getItem(STATE_STORAGE_KEY) || ''); } catch (_) {}
      restoreViewport = false;
    }
    applyRestoredParams(params, { restoreViewport: restoreViewport });
    state.rainEnabled = state.tab === 'rain';
    syncUiFromState();
    syncRainUi();
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
    if (state.rainEnabled) updateRainLayer();
  };

  function isValidMapLngLat(lng, lat) {
    return Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -85 && lat <= 85;
  }

  function rememberLastStartupLocation(lng, lat, meta) {
    lng = Number(lng);
    lat = Number(lat);
    if (!isValidMapLngLat(lng, lat)) return;
    try {
      localStorage.setItem(LAST_LOCATION_STORAGE_KEY, JSON.stringify({
        lng: Math.round(lng * 1000000) / 1000000,
        lat: Math.round(lat * 1000000) / 1000000,
        zoom: meta && Number.isFinite(Number(meta.zoom)) ? Number(meta.zoom) : STARTUP_LOCATION_ZOOM,
        accuracyM: meta && Number.isFinite(Number(meta.accuracyM)) ? Math.round(Number(meta.accuracyM)) : null,
        source: meta && meta.source ? String(meta.source).slice(0, 48) : 'geolocation',
        capturedAt: Date.now(),
      }));
    } catch (_) {}
  }

  function readLastStartupLocation() {
    try {
      var raw = localStorage.getItem(LAST_LOCATION_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var lng = Number(parsed && parsed.lng);
      var lat = Number(parsed && parsed.lat);
      var capturedAt = Number(parsed && parsed.capturedAt);
      if (!isValidMapLngLat(lng, lat)) return null;
      if (!Number.isFinite(capturedAt) || Date.now() - capturedAt > LAST_LOCATION_MAX_AGE_MS) return null;
      return {
        center: [lng, lat],
        zoom: Math.max(DEFAULT_MAP_ZOOM, Math.min(16.5, Number(parsed.zoom) || STARTUP_LOCATION_ZOOM)),
        source: 'last_location',
      };
    } catch (_) {
      return null;
    }
  }

  function initialStartupViewport() {
    if (state._restoredCenter && state._restoredCenter.length >= 2) {
      return {
        center: state._restoredCenter,
        zoom: state._restoredZoom != null ? state._restoredZoom : DEFAULT_MAP_ZOOM,
        source: 'explicit_viewport',
      };
    }
    var last = readLastStartupLocation();
    if (last) return last;
    return { center: DEFAULT_MAP_CENTER, zoom: DEFAULT_MAP_ZOOM, source: 'regional_default' };
  }

  function requestStartupCurrentLocation(options) {
    var force = options && options.force === true;
    var onlyIfGranted = options && options.onlyIfGranted === true;
    if ((!force && (state._restoredCenter || state._restoredCellId)) || !state.map || !navigator.geolocation) return;
    var applyPosition = function (pos) {
      state.startupLocationRequestActive = false;
      if (!state.map || state.startupLocationUserMoved) return;
      var coords = pos && pos.coords ? pos.coords : null;
      var lng = Number(coords && coords.longitude);
      var lat = Number(coords && coords.latitude);
      if (!isValidMapLngLat(lng, lat)) return;
      rememberLastStartupLocation(lng, lat, {
        zoom: STARTUP_LOCATION_ZOOM,
        accuracyM: Number(coords.accuracy),
        source: force ? 'start_panel_location' : 'startup_geolocation',
      });
      state.map.flyTo({
        center: [lng, lat],
        zoom: Math.max(Number(state.map.getZoom && state.map.getZoom() || 0), STARTUP_LOCATION_ZOOM),
        duration: 520,
        essential: false,
      });
      dropMeMarker(lng, lat);
    };
    var fail = function () {
      state.startupLocationRequestActive = false;
    };
    var run = function () {
      state.startupLocationRequestActive = true;
      navigator.geolocation.getCurrentPosition(applyPosition, fail, {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 10,
        timeout: 4500,
      });
    };
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions.query({ name: 'geolocation' }).then(function (status) {
        if (status && status.state === 'denied') {
          fail();
          return;
        }
        if (onlyIfGranted && (!status || status.state !== 'granted')) {
          fail();
          return;
        }
        run();
      }).catch(run);
      return;
    }
    if (onlyIfGranted) return;
    run();
  }

  function hydrate() {
    if (!window.maplibregl) { showMapLoadFailure(); return; }
    var startupViewport = initialStartupViewport();
    try {
      state.maplibreRuntime = window.maplibregl;
      state.map = new window.maplibregl.Map({
        container: root,
        style: BASEMAPS[state.basemap] || BASEMAPS.standard,
        center: startupViewport.center,
        zoom: startupViewport.zoom,
        attributionControl: true,
      });
    } catch (err) {
      try { console.error('[map] init failed', err); } catch (_) {}
      state._restoredCenter = null;
      state._restoredZoom = null;
      try {
        state.maplibreRuntime = window.maplibregl;
        state.map = new window.maplibregl.Map({
          container: root,
          style: BASEMAPS.standard,
          center: DEFAULT_MAP_CENTER,
          zoom: DEFAULT_MAP_ZOOM,
          attributionControl: true,
        });
      } catch (err2) {
        showMapLoadFailure();
        return;
      }
    }
    state.map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    state.map.on('click', dismissPurposeHint);
    state.map.on('click', dismissStartPanel);
    state.map.on('dragstart', dismissPurposeHint);
    state.map.on('zoomstart', dismissPurposeHint);
    state.map.on('dragstart', dismissStartPanel);
    state.map.on('zoomstart', dismissStartPanel);
    state.map.on('load', function () {
      // Restore enabled overlays from URL/localStorage state before loading data.
      overlayCatalog.forEach(function (def) {
        if (overlayState[def.id] && overlayState[def.id].enabled) addOverlay(state.map, def);
      });
      if (state.rainEnabled) loadRainTimes().then(updateRainLayer);
      ensureAreaPolygons(state.map);
      loadAreaPolygons();
      refreshStartPanelRoutes();
      scheduleStartPanelRouteCandidates(120);
      requestStartupCurrentLocation({ onlyIfGranted: true });
      runInitialMapDataLoad('load');
    });
    scheduleInitialMapDataLoad(180);
    state.map.on('moveend', function () {
      if (state.ignoreNextMoveEnd) {
        state.ignoreNextMoveEnd = false;
        saveMapState();
        return;
      }
      saveMapState();
      refreshStartPanelRoutes();
      scheduleStartPanelRouteCandidates(180);
      if (consumeSuppressedViewportSearch()) return;
      if (state.nearbyAreaLocateMovePending) {
        state.nearbyAreaLocateMovePending = false;
      } else if (state.nearbyAreaOrigin) {
        state.nearbyAreaOrigin = null;
        clearNearbyAreaMarkers();
      }
      var bbox = currentBboxString();
      state.pendingViewportSearch = !!bbox && bbox !== state.lastSearchedBbox;
      updateSearchAreaUi();
      scheduleViewportRefresh();
      refreshDiscoveryPreviewMarkers();
      renderOwnObservationMarkers();
      if (state.areaPolygonsDebounce) clearTimeout(state.areaPolygonsDebounce);
      state.areaPolygonsDebounce = setTimeout(function () { loadAreaPolygons(); }, 250);
      if (state.tab === 'markers' || state.tab === 'places' || state.tab === 'rain') loadGuideSpots();
      if (state.waterwayDebounce) clearTimeout(state.waterwayDebounce);
      state.waterwayDebounce = setTimeout(function () { loadWaterwayHints(); }, 350);
      if (layerHintEl && !layerHintEl.classList.contains('is-hidden')) maybeShowLayerHint(state.tab);
    });
    state.map.on('dragstart', clearSuppressedViewportSearch);
    state.map.on('zoomstart', clearSuppressedViewportSearch);
    state.map.on('dragstart', function () {
      if (state.startupLocationRequestActive) state.startupLocationUserMoved = true;
    });
    state.map.on('zoomstart', function () {
      if (state.startupLocationRequestActive) state.startupLocationUserMoved = true;
    });
    // Empty-point tap → Site Brief. Skip if the click hit an observation
    // layer (those have their own handlers via map.on('click', 'layer', ...)).
    state.map.on('click', function (e) {
      var layers = [];
      ['observation-cell-fill', 'observation-cell-outline', 'observation-cell-selected', 'viewer-owned-observation-halo', 'viewer-owned-observation-dot', 'obs-cell-heat', 'obs-cell-heat-selected'].forEach(function (id) {
        if (state.map.getLayer(id)) layers.push(id);
      });
      if (state.map.getLayer('frontier-fill')) layers.push('frontier-fill');
      areaPolygonHitLayers().forEach(function (id) { layers.push(id); });
      var hits = layers.length > 0 ? state.map.queryRenderedFeatures(e.point, { layers: layers }) : [];
      if (hits && hits.length > 0) return;
      if (isRainInteractionMode() && checkRainTap(e.lngLat)) return;
      openPlaceSheet(e.lngLat.lat, e.lngLat.lng);
    });
  }

  function showMapLoadFailure() {
    setStatus('—');
    if (!root || root.querySelector('[data-map-load-error="1"]')) return;
    var box = document.createElement('div');
    box.setAttribute('data-map-load-error', '1');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', COPY.mapLoadErrorTitle);
    box.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(135deg,#ecfeff,#eff6ff);color:#0f172a;font:500 14px/1.5 system-ui,sans-serif;text-align:center;z-index:4;';
    box.innerHTML = '<div><div style="font-size:15px;margin-bottom:6px;">' + escapeHtml(COPY.mapLoadErrorTitle) + '</div><div style="opacity:.75;margin-bottom:12px;">' + escapeHtml(COPY.mapLoadErrorBody) + '</div><button type="button" style="padding:8px 14px;border-radius:9999px;border:1px solid rgba(15,23,42,.18);background:#fff;cursor:pointer;font:600 13px/1 system-ui,sans-serif;">' + escapeHtml(COPY.mapLoadRetryLabel) + '</button><a href="' + escapeHtml(COMMUNITY_RECORDS_HREF) + '" data-map-public-records-link style="display:inline-flex;align-items:center;min-height:44px;margin-left:12px;text-underline-offset:3px;">' + escapeHtml(COPY.mapLoadRecordsLabel) + '</a></div>';
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
      var t = btn.getAttribute('data-tab');
      if (!t) return;
      dismissStartPanel();
      dismissPurposeHint();
      switchMapTab(t);
    });
  });
  document.querySelectorAll('.me-filter-tab-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.getAttribute('data-filter-tab');
      if (!t) return;
      dismissStartPanel();
      dismissPurposeHint();
      switchMapTab(t);
      closeFilterDrawer();
    });
  });
  if (filterDrawerEl) {
    filterDrawerEl.addEventListener('toggle', function () {
      var open = filterDrawerEl.hasAttribute('open');
      if (mapShellEl) mapShellEl.classList.toggle('me-filter-open', open);
      if (!open) return;
      closeBottomSheet();
      if (startPanelEl && !startPanelEl.hidden) setStartPanelCollapsed(true);
      hideLayerHint();
    });
  }
  if (layerHintJumpEl) {
    layerHintJumpEl.addEventListener('click', function () {
      jumpToVisibleLayer(layerHintEl ? (layerHintEl.getAttribute('data-tab') || state.tab) : state.tab);
    });
  }
  if (layerHintCloseEl) {
    layerHintCloseEl.addEventListener('click', hideLayerHint);
  }
  if (purposeHintCloseEl) {
    purposeHintCloseEl.addEventListener('click', function (event) {
      event.preventDefault();
      dismissPurposeHint();
    });
  }
  if (startPanelCloseEl) {
    startPanelCloseEl.addEventListener('click', function (event) {
      event.preventDefault();
      setStartPanelCollapsed(!startPanelEl || !startPanelEl.classList.contains('is-collapsed'));
      refreshPurposeHint();
    });
  }
  if (startPanelLocationEl) {
    startPanelLocationEl.addEventListener('click', function (event) {
      event.preventDefault();
      requestStartupCurrentLocation({ force: true });
    });
  }
  if (legendToggleEl) {
    legendToggleEl.addEventListener('click', function (event) {
      event.preventDefault();
      var collapsed = legendEl && legendEl.classList.contains('is-collapsed');
      if (!legendEl) return;
      legendEl.classList.toggle('is-collapsed', !collapsed ? true : false);
      legendToggleEl.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
    });
  }
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
      refreshStartPanelRoutes();
    });
  });
  if (searchAreaBtnEl) {
    searchAreaBtnEl.addEventListener('click', function () {
      dismissPurposeHint();
      refreshViewportSearchData();
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
      if (row.kind === 'heading') {
        return '<div class="me-search-group-heading">' + escapeHtml(row.title) + '</div>';
      }
      return '<button type="button" role="option" class="me-search-row" data-idx="' + idx + '">' +
        '<span class="me-search-badge me-search-badge-' + escapeHtml(row.kind) + '">' + escapeHtml(row.badge) + '</span>' +
        '<strong>' + escapeHtml(row.title) + '</strong>' +
        (row.subtitle ? '<span>' + escapeHtml(row.subtitle) + '</span>' : '') +
        '</button>';
    }).join('');
    searchResultsEl.classList.add('is-open');
    searchResultsEl.querySelectorAll('.me-search-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-idx'));
        var row = rows[i];
        if (!row || typeof row.onSelect !== 'function') return;
        row.onSelect();
      });
    });
  }

  function latestObservedDate(records) {
    var latest = '';
    (records || []).forEach(function (record) {
      var date = resultGroupDate(record);
      if (date && date > latest) latest = date;
    });
    return latest;
  }

  function searchHitLabel(count) {
    return SEARCH_LANG === 'ja' ? String(count) + '件'
      : SEARCH_LANG === 'es' ? String(count) + ' registros'
      : SEARCH_LANG === 'pt-BR' ? String(count) + ' registros'
      : String(count) + ' hits';
  }

  function placeTypeLabel(type) {
    var key = String(type || '').trim().toLowerCase();
    if (!key) return '';
    var ja = {
      park: '公園',
      garden: '庭園',
      forest: '森林',
      nature_reserve: '自然保護区',
      attraction: '名所',
      artwork: '作品',
      monument: '記念碑',
      museum: '博物館',
      theme_park: 'テーマパーク',
      shopping_mall: 'ショッピングモール',
      commercial_complex: '商業施設',
      zoo: '動物園',
      aquarium: '水族館',
      stadium: 'スタジアム',
      sports_facility: 'スポーツ施設',
      resort: 'リゾート',
      market: '市場',
      farm: '農園',
      temple_shrine: '寺社',
      cultural_facility: '文化施設',
      public_facility: '公共施設',
      event_venue: 'イベント会場',
      neighborhood: '地域',
      administrative_area: '行政区域',
      other_named_area: '名前のある場所',
      school: '学校',
      university: '大学',
      river: '川',
      water: '水辺',
      peak: '山',
      suburb: '地域',
      village: '地域',
      town: '地域',
      city: '市区町村',
      administrative: '行政区域',
    };
    if (SEARCH_LANG === 'ja') return ja[key] || '';
    return key.replace(/_/g, ' ');
  }

  function placeRowInCurrentBounds(row) {
    if (!state.map || !row) return false;
    var lat = Number(row.lat);
    var lng = Number(row.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !state.map.getBounds) return false;
    var bounds = state.map.getBounds();
    return !!(bounds && bounds.contains && bounds.contains([lng, lat]));
  }

  function placeSearchTypeKey(row) {
    return [row && row.type, row && row.category, row && row.class].filter(Boolean).join(' ').toLowerCase();
  }

  function isSensitivePlaceSearchRow(row) {
    return /\b(school|kindergarten|childcare|college|university|residential|house|apartments|dormitory|address|building)\b/.test(placeSearchTypeKey(row));
  }

  function safePlaceSearchOrigin(row, lat, lng) {
    var precision = isSensitivePlaceSearchRow(row) ? 1000 : 10000;
    return {
      lat: Math.round(lat * precision) / precision,
      lng: Math.round(lng * precision) / precision
    };
  }

  function groupSearchRows(localRows, placeRows) {
    var current = [];
    var other = [];
    (localRows || []).forEach(function (row) { current.push(row); });
    (placeRows || []).forEach(function (row) {
      if (row.inCurrentBounds) current.push(row);
      else other.push(row);
    });
    var out = [];
    if (current.length) out.push({ kind: 'heading', title: COPY.searchGroupCurrent });
    out = out.concat(current);
    if (other.length) out.push({ kind: 'heading', title: COPY.searchGroupOther });
    out = out.concat(other);
    return out.slice(0, 10);
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
      var key = normalizeSearchText(recordDisplayName(record, variants[0]));
      if (!speciesMap[key]) {
        speciesMap[key] = {
          kind: 'species',
          badge: COPY.searchResultSpecies,
          title: recordDisplayName(record, variants[0]),
          subtitle: record.localityLabel || '',
          occurrenceIds: [],
          records: [],
          cellIds: {},
          taxonGroup: record.taxonGroup || '',
        };
      }
      speciesMap[key].occurrenceIds.push(record.occurrenceId);
      speciesMap[key].records.push(record);
      if (record.cellId) speciesMap[key].cellIds[record.cellId] = true;
    });
    return Object.keys(speciesMap)
      .map(function (key) { return speciesMap[key]; })
      .sort(function (a, b) { return b.occurrenceIds.length - a.occurrenceIds.length; })
      .slice(0, 5)
      .map(function (row) {
        var latest = latestObservedDate(row.records);
        var parts = [];
        if (row.subtitle) parts.push(row.subtitle);
        parts.push(searchHitLabel(row.occurrenceIds.length));
        if (latest) parts.push(COPY.searchRecentPrefix + ' ' + latest);
        row.subtitle = row.subtitle
          ? parts.join(' · ')
          : parts.join(' · ');
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
      var typeLabel = placeTypeLabel(row.type || row.category || row.class || '');
      var inCurrentBounds = placeRowInCurrentBounds(row);
      var verificationLabel = row.canonical_place_id
        ? (/^(verified|source_verified|administrator_verified)$/.test(String(row.verification_status || ''))
          ? (SEARCH_LANG === 'ja' ? '確認済み' : 'verified')
          : (SEARCH_LANG === 'ja' ? '未確認' : 'unverified'))
        : '';
      return {
        kind: 'place',
        badge: COPY.searchResultPlace,
        title: name,
        subtitle: [typeLabel, row.locality_label || '', verificationLabel, inCurrentBounds ? COPY.searchGroupCurrent : COPY.searchGroupOther].filter(Boolean).join(' · '),
        inCurrentBounds: inCurrentBounds,
        onSelect: function () {
          if (!row || !state.map) return;
          var lat = Number(row.lat);
          var lng = Number(row.lon);
          if (!isFinite(lat) || !isFinite(lng)) return;
          var canonicalSearchFeature = canonicalPlaceSearchFeature(row, lat, lng);
          if (root) {
            root.setAttribute(
              'data-place-search-profile-ref',
              canonicalSearchFeature
                ? String(canonicalSearchFeature.properties.entity_key || 'resolved')
                : 'unresolved'
            );
          }
          state.tab = 'places';
          state.namedAreaDiscoveryUntil = Date.now() + 60 * 1000;
          state.pendingPlaceSearchRef = row.canonical_place_id && !canonicalSearchFeature ? {
            canonicalPlaceId: String(row.canonical_place_id),
            osmType: String(row.osm_type || ''),
            osmId: String(row.osm_id || '')
          } : null;
          state.nearbyAreaOrigin = safePlaceSearchOrigin(row, lat, lng);
          state.nearbyAreaLocateMovePending = true;
          syncUiFromState();
          applyTab(state.map, state.tab);
          var sensitivePlaceSearch = isSensitivePlaceSearchRow(row);
          var targetZoom = sensitivePlaceSearch ? 12 : 14;
          var currentCenter = typeof state.map.getCenter === 'function' ? state.map.getCenter() : null;
          var currentZoom = typeof state.map.getZoom === 'function' ? state.map.getZoom() : NaN;
          var staysInPlace = currentCenter
            ? distanceMeters({ lat: currentCenter.lat, lng: currentCenter.lng }, state.nearbyAreaOrigin) <= 25
              && Math.abs(currentZoom - targetZoom) <= 0.25
              && !(row.boundingbox && row.boundingbox.length === 4)
            : false;
          var areaDiscoveryRefreshed = false;
          var areaDiscoveryFallbackTimer = null;
          function refreshSearchAreaDiscovery() {
            if (areaDiscoveryRefreshed) return;
            areaDiscoveryRefreshed = true;
            if (areaDiscoveryFallbackTimer) clearTimeout(areaDiscoveryFallbackTimer);
            loadAreaPolygons();
            refreshNearbyAreaMarkers(state.nearbyAreaOrigin);
          }
          if (staysInPlace) {
            refreshSearchAreaDiscovery();
          } else {
            state.map.once('moveend', refreshSearchAreaDiscovery);
            areaDiscoveryFallbackTimer = setTimeout(refreshSearchAreaDiscovery, 2000);
          }
          if (row.boundingbox && row.boundingbox.length === 4) {
            var b = row.boundingbox.map(Number);
            if (b.every(isFinite)) {
              state.map.fitBounds([[b[2], b[0]], [b[3], b[1]]], { padding: 48, maxZoom: sensitivePlaceSearch ? 12 : 14, duration: 500 });
            } else {
              state.map.flyTo({ center: [lng, lat], zoom: targetZoom, duration: 500 });
            }
          } else {
            state.map.flyTo({ center: [lng, lat], zoom: targetZoom, duration: 500 });
          }
          if (canonicalSearchFeature) {
            openAreaFeatureSheet(canonicalSearchFeature, lat, lng);
          }
          searchResultsEl.classList.remove('is-open');
          if (searchInputEl) searchInputEl.value = row.display_name || '';
          saveMapState();
        },
      };
    });
  }

  function canonicalPlaceSearchFeature(row, lat, lng) {
    if (!row || !row.canonical_place_id) return null;
    var osmType = String(row.osm_type || '');
    var osmId = String(row.osm_id || '');
    if ((osmType !== 'way' && osmType !== 'relation') || !/^[0-9]+$/.test(osmId)) return null;
    var bbox = Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null;
    var validBbox = bbox && bbox.length === 4 && bbox.every(isFinite);
    if (!validBbox) return null;
    var geometry = {
      type: 'Polygon',
      coordinates: [[
        [bbox[2], bbox[0]],
        [bbox[3], bbox[0]],
        [bbox[3], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[0]],
      ]],
    };
    return {
      type: 'Feature',
      geometry: geometry,
      properties: {
        field_id: 'osm-live:' + osmType + ':' + osmId,
        entity_key: 'osm:' + osmType + ':' + osmId,
        osm_type: osmType,
        osm_id: Number(osmId),
        canonical_place_id: String(row.canonical_place_id),
        name: String(row.display_name || row.name || COPY.osmAreaFallbackName || ''),
        place_kind: String(row.type || ''),
        localityLabel: String(row.locality_label || ''),
        source: 'osm_named_area',
        source_label: COPY.searchResultPlace,
        source_confidence: 0.9,
        verification_level: String(row.verification_status || ''),
        center: [lng, lat],
        transient: true,
        boundary_projection: 'safe_bbox',
      },
    };
  }

  function canonicalPlaceRows(payload) {
    var results = payload && Array.isArray(payload.results) ? payload.results : [];
    return results.map(function (place) {
      var bbox = place && place.boundary && Array.isArray(place.boundary.bbox)
        ? place.boundary.bbox.map(Number)
        : null;
      var validBbox = bbox && bbox.length === 4 && bbox.every(isFinite);
      var sourceId = String(place && place.osmSourceId || '');
      var osmMatch = /^(node|way|relation)[:/]([0-9]+)$/.exec(sourceId);
      return {
        display_name: String(place.canonicalName || ''),
        type: String(place.placeKind || ''),
        lat: validBbox ? String((bbox[1] + bbox[3]) / 2) : '',
        lon: validBbox ? String((bbox[0] + bbox[2]) / 2) : '',
        boundingbox: validBbox ? [bbox[1], bbox[3], bbox[0], bbox[2]].map(String) : null,
        canonical_place_id: String(place.canonicalPlaceId || ''),
        locality_label: String(place.localityLabel || ''),
        verification_status: String(place.verificationStatus || ''),
        official_status: String(place.officialStatus || ''),
        osm_type: osmMatch ? osmMatch[1] : '',
        osm_id: osmMatch ? osmMatch[2] : '',
      };
    }).filter(function (row) {
      return row.display_name && isFinite(Number(row.lat)) && isFinite(Number(row.lon));
    });
  }

  function mergePlaceSearchCandidates(canonicalRows, nominatimRows) {
    var out = [];
    var seen = {};
    (canonicalRows || []).concat(nominatimRows || []).forEach(function (row) {
      var nameKey = normalizeSearchText(row && (row.display_name || row.name || ''))
        .replace(/[\s　・･'’"()（）_-]+/g, '');
      var lat = Number(row && row.lat);
      var lng = Number(row && row.lon);
      var spatialKey = isFinite(lat) && isFinite(lng)
        ? String(Math.round(lat * 1000)) + ':' + String(Math.round(lng * 1000))
        : '';
      var key = nameKey + '|' + spatialKey;
      if (!nameKey || seen[key]) return;
      seen[key] = true;
      out.push(row);
    });
    return out.slice(0, 8);
  }

  function runUnifiedSearch(query) {
    if (!searchResultsEl) return;
    var trimmed = String(query || '').trim();
    var seq = ++searchSeq;
    var searchStartedAt = typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
    var localRows = buildSpeciesSearchRows(trimmed);
    if (!trimmed || trimmed.length < 2) {
      closeSearchResults();
      return;
    }
    if (localRows.length) renderSearchRows(groupSearchRows(localRows, []));
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

    var registryPromise = apiPlaceSearch
      ? fetch(apiPlaceSearch + '?q=' + encodeURIComponent(trimmed) + '&limit=5', {
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' },
          signal: controller ? controller.signal : undefined,
        }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      : Promise.resolve(null);
    var nominatimPromise = fetch(NOMINATIM_URL + '?' + params.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined,
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function (err) {
      if (err && err.name === 'AbortError') throw err;
      return null;
    });

    Promise.all([registryPromise, nominatimPromise])
      .then(function (resolved) {
        if (seq !== searchSeq) return;
        var registryRows = canonicalPlaceRows(resolved[0]);
        var candidates = mergePlaceSearchCandidates(registryRows, Array.isArray(resolved[1]) ? resolved[1] : []);
        var placeRows = buildPlaceSearchRows(candidates);
        var merged = groupSearchRows(localRows, placeRows);
        var searchCompletedAt = typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
        sendMapKpi('place_search_complete', 'map:place_search:complete', {
          queryLength: trimmed.length,
          canonicalCount: registryRows.length,
          placeCount: placeRows.length,
          localCount: localRows.length,
          latencyMs: Math.max(0, Math.round(searchCompletedAt - searchStartedAt)),
          state: merged.length ? 'complete' : 'empty'
        });
        if (!merged.length) {
          renderSearchRows([]);
          return;
        }
        renderSearchRows(merged);
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
      dismissPurposeHint();
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
      dismissPurposeHint();
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

  // locate-me
  var locateFab = document.getElementById('me-locate-fab');
  if (locateFab) {
    locateFab.addEventListener('click', function () {
      dismissPurposeHint();
      if (!state.map || !navigator.geolocation) {
        setStatus(COPY.locateError);
        return;
      }
      locateFab.classList.add('is-loading');
      navigator.geolocation.getCurrentPosition(function (pos) {
        locateFab.classList.remove('is-loading');
        var lng = pos.coords.longitude;
        var lat = pos.coords.latitude;
        rememberLastStartupLocation(lng, lat, {
          zoom: 14.8,
          accuracyM: Number(pos.coords.accuracy),
          source: 'locate_button',
        });
        if (state.tab !== 'rain') state.tab = 'places';
        state.nearbyAreaOrigin = {
          lat: Math.round(lat * 10000) / 10000,
          lng: Math.round(lng * 10000) / 10000
        };
        state.nearbyAreaLocateMovePending = true;
        syncUiFromState();
        applyTab(state.map, state.tab);
        state.map.once('moveend', function () {
          loadAreaPolygons();
          refreshNearbyAreaMarkers(state.nearbyAreaOrigin);
        });
        state.map.flyTo({ center: [lng, lat], zoom: 14.8, duration: 650 });
        // Drop a quick "you are here" marker; cheap DOM element rather than a
        // source so it doesn't need a style reload.
        if (state._meMarker) state._meMarker.remove();
        var el = document.createElement('div');
        el.className = 'me-locate-marker';
        state._meMarker = new window.maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(state.map);
        if (state.rainEnabled) checkRainAt(lng, lat);
      }, function () {
        locateFab.classList.remove('is-loading');
        setStatus(COPY.locateError);
      }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    });
  }

  if (rainToggleEl) {
    rainToggleEl.addEventListener('click', function () {
      if (state.tab !== 'rain') switchMapTab('rain');
      else enableRainLayer();
      sendMapKpi('funnel_step', 'map:rain:refresh', {
        enabled: true,
        timeCount: Array.isArray(state.rainTimes) ? state.rainTimes.length : 0
      });
    });
  }
  if (rainCurrentEl) {
    rainCurrentEl.addEventListener('click', function () {
      if (!navigator.geolocation) {
        setRainStatus(COPY.locateError);
        return;
      }
      if (!state.rainEnabled && rainToggleEl) rainToggleEl.click();
      setRainStatus(COPY.rainCheckLoading);
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lng = pos.coords.longitude;
        var lat = pos.coords.latitude;
        rememberLastStartupLocation(lng, lat, {
          zoom: 12.8,
          accuracyM: Number(pos.coords.accuracy),
          source: 'rain_current',
        });
        checkRainAt(lng, lat);
        if (state.map) {
          state.map.flyTo({ center: [lng, lat], zoom: Math.max(Number(state.map.getZoom() || 0), 12.8), duration: 520 });
          dropMeMarker(lng, lat);
        }
      }, function () {
        if (state.map && typeof state.map.getCenter === 'function') {
          var center = state.map.getCenter();
          setRainStatus(COPY.rainLocationFallback);
          checkRainAt(Number(center.lng), Number(center.lat));
          return;
        }
        setRainStatus(COPY.locateError);
      }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    });
  }
  if (rainTargetEl) {
    rainTargetEl.addEventListener('click', function () {
      if (!state.map || typeof state.map.getCenter !== 'function') return;
      if (!state.rainEnabled && rainToggleEl) rainToggleEl.click();
      var center = state.map.getCenter();
      checkRainAt(Number(center.lng), Number(center.lat));
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
  ${MAP_PLACE_ATLAS_PROFILE_STYLES}
  .site-header {
    background: rgba(249,255,254,.9);
  }

  .site-shell.has-global-record-launcher {
    padding-bottom: 0;
  }

  .site-shell.is-map-surface .global-record-launcher {
    display: none;
  }
  .me-rain-mode .site-shell.is-map-surface .global-record-launcher {
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
    min-height: 44px;
    padding: 7px 8px;
    font-size: 13px;
  }

  .site-header .site-search {
    min-height: 44px;
    padding: 0 12px;
  }

  .site-header .lang-switch {
    padding: 3px;
  }

  .site-header .lang-switch-link {
    min-width: 44px;
    min-height: 44px;
    padding: 0 8px;
  }

  .site-header .btn {
    min-height: 44px;
    padding: 8px 14px;
  }

  .site-header .site-mobile-menu-toggle {
    min-height: 44px;
    width: 44px;
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
    .cf-header-menu,
    .site-header-actions-mobile,
    .site-mobile-menu {
      display: none !important;
    }
    .site-header .brand {
      flex: none;
      max-width: none;
    }
    .site-header .brand-logo-lockup {
      min-height: 44px;
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
      min-height: 44px;
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
    --me-enjoy-h: 44px;
    --me-side-w: 420px;
    --me-side-rail-w: 52px;
    --me-side-gap: 0px;
    --me-map-height: calc(100dvh - var(--me-header-h) - var(--me-topbar-h) - var(--me-enjoy-h));
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
  .me-map-kicker {
    flex: 0 0 auto;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(15,118,110,.08);
    color: #0f766e;
    font-size: 11px;
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: .03em;
  }
  .me-topbar-secondary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: nowrap;
  }
  .me-map-role-strip {
    min-height: var(--me-enjoy-h);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    background: rgba(240,253,244,.92);
    border-bottom: 1px solid rgba(16,185,129,.14);
    color: #334155;
    position: relative;
    z-index: 7;
  }
  .me-map-role-strip strong {
    color: #065f46;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 950;
    white-space: nowrap;
  }
  .me-map-role-strip span {
    min-width: 0;
    color: #475569;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-map-role-strip em {
    min-width: 0;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.82);
    color: #047857;
    border: 1px solid rgba(16,185,129,.18);
    font-size: 11px;
    line-height: 1.2;
    font-style: normal;
    font-weight: 950;
    white-space: nowrap;
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
  .me-tab-short { display: none; }
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
    min-height: 44px; min-width: 86px; padding: 0 12px;
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
  .me-start-panel {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 7;
    width: auto;
    max-width: calc(100% - 92px);
    display: block;
    padding: 5px;
    border-radius: 12px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 6px 18px rgba(15,23,42,.10);
    backdrop-filter: blur(14px);
    box-sizing: border-box;
  }
  .me-start-panel.is-collapsed {
    display: inline-grid;
    grid-template-columns: auto auto;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: rgba(255,255,255,.9);
  }
  .me-start-panel[hidden] {
    display: none;
  }
  .me-start-panel-head {
    position: absolute;
    top: -8px;
    right: -8px;
    z-index: 2;
  }
  .me-start-panel-head strong {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .me-start-panel-close {
    min-width: 24px;
    min-height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 0;
    border-radius: 999px;
    background: rgba(15,23,42,.06);
    color: #334155;
    font-size: 15px;
    line-height: 1;
    font-weight: 900;
    cursor: pointer;
  }
  .me-start-panel-brief {
    display: none;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    color: inherit;
    white-space: nowrap;
  }
  .me-start-panel-symbol {
    display: inline-grid;
    place-items: center;
    line-height: 1;
  }
  .me-start-panel.is-collapsed .me-start-panel-head {
    position: static;
  }
  .me-start-panel.is-collapsed .me-start-panel-close {
    width: 38px;
    min-width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(255,255,255,.92);
    color: #64748b;
    box-shadow: none;
  }
  .me-start-panel.is-collapsed .me-start-panel-brief {
    display: inline;
  }
  .me-start-panel.is-collapsed .me-start-panel-grid {
    grid-template-columns: 38px;
  }
  .me-start-panel.is-collapsed .me-start-panel-grid a {
    display: none;
  }
  .me-start-panel.is-collapsed .me-start-panel-routes {
    display: none;
  }
  .me-start-panel-location {
    min-width: 0;
    width: 38px;
    min-height: 38px;
    display: grid;
    grid-template-rows: 1fr;
    align-items: center;
    justify-items: center;
    padding: 0;
    border: 1px solid rgba(15,118,110,.18);
    border-radius: 10px;
    background: rgba(240,253,250,.94);
    color: #0f766e;
    font: inherit;
    font-size: 10.5px;
    line-height: 1.15;
    font-weight: 950;
    cursor: pointer;
  }
  .me-start-panel-location span,
  .me-start-panel-grid a span {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
  }
  .me-start-panel-location strong {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .me-start-panel-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4px;
  }
  .me-start-panel-grid a {
    min-width: 0;
    width: 38px;
    min-height: 38px;
    display: grid;
    grid-template-rows: 1fr;
    align-items: center;
    justify-items: center;
    padding: 0;
    border-radius: 10px;
    background: rgba(248,250,252,.92);
    border: 1px solid rgba(15,23,42,.07);
    color: inherit;
    text-decoration: none;
  }
  .me-start-panel-grid a strong {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .me-start-panel-routes {
    display: none;
    gap: 5px;
    margin-top: 5px;
    padding: 7px;
    border-radius: 10px;
    background: rgba(240,253,250,.92);
    border: 1px solid rgba(15,118,110,.12);
  }
  .me-start-panel-routes > strong {
    color: #0f172a;
    font-size: 11.5px;
    line-height: 1.2;
    font-weight: 950;
  }
  .me-start-panel-routes nav {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .me-start-panel-routes a {
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    border-radius: 999px;
    background: #fff;
    border: 1px solid rgba(15,118,110,.14);
    color: #0f766e;
    font-size: 11px;
    line-height: 1;
    font-weight: 900;
    text-decoration: none;
    white-space: nowrap;
  }
  .me-start-panel-routes a:hover {
    background: rgba(204,251,241,.76);
  }
  .me-start-panel-routes a[hidden] {
    display: none;
  }
  .me-rain-mode .me-start-panel,
  .me-sheet-open .me-start-panel {
    display: none;
  }

  .me-purpose-hint {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 5;
    display: grid;
    gap: 4px;
    width: min(310px, calc(100% - 116px));
    padding: 11px 38px 11px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(20,184,166,.20);
    box-shadow: 0 12px 28px rgba(15,23,42,.12);
    color: #0f172a;
    backdrop-filter: blur(12px);
  }
  .me-purpose-hint[hidden],
  .me-rain-mode .me-purpose-hint,
  .me-sheet-open .me-purpose-hint {
    display: none;
  }
  .me-purpose-hint strong {
    font-size: 13px;
    line-height: 1.25;
    font-weight: 950;
    color: #10251a;
  }
  .me-purpose-hint p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    font-weight: 760;
    color: #475569;
  }
  .me-purpose-hint-close {
    position: absolute;
    top: 7px;
    right: 7px;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(15,23,42,.08);
    border-radius: 999px;
    background: rgba(248,250,252,.88);
    color: #334155;
    font-size: 16px;
    line-height: 1;
    font-weight: 900;
    cursor: pointer;
  }
  .me-rain-card {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 5;
    display: grid;
    gap: 8px;
    width: min(332px, calc(100% - 116px));
    padding: 10px;
    border-radius: 8px;
    background: rgba(255,255,255,.93);
    border: 1px solid rgba(15,23,42,.10);
    box-shadow: 0 12px 28px rgba(15,23,42,.13);
    backdrop-filter: blur(12px);
    color: #0f172a;
    transition: opacity .18s ease, transform .18s ease;
  }
  .me-rain-card[hidden] {
    display: none;
  }
  .me-rain-card[data-enabled="0"] .me-rain-timeline,
  .me-rain-card[data-enabled="0"] .me-rain-actions {
    opacity: .55;
  }
  .me-rain-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .me-rain-head strong {
    min-width: 0;
    color: #0f172a;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 950;
  }
  .me-rain-head span {
    color: #64748b;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 850;
    white-space: nowrap;
  }
  .me-rain-toggle {
    min-height: 32px;
    border: 1px solid rgba(14,165,233,.30);
    border-radius: 8px;
    padding: 6px 11px;
    background: rgba(14,165,233,.10);
    color: #075985;
    font-size: 13px;
    font-weight: 950;
    cursor: pointer;
  }
  .me-rain-toggle[aria-pressed="true"] {
    background: #0369a1;
    border-color: #0369a1;
    color: #fff;
  }
  .me-rain-timeline {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 4px;
  }
  .me-rain-time {
    min-height: 28px;
    border: 1px solid rgba(148,163,184,.28);
    border-radius: 7px;
    background: rgba(248,250,252,.92);
    color: #475569;
    font-size: 11px;
    line-height: 1.1;
    font-weight: 900;
    cursor: pointer;
  }
  .me-rain-time.is-active {
    background: rgba(14,165,233,.13);
    border-color: rgba(14,165,233,.45);
    color: #075985;
  }
  .me-rain-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .me-rain-actions button {
    min-height: 32px;
    border: 1px solid rgba(15,23,42,.10);
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }
  .me-rain-status {
    margin: 0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.45;
    font-weight: 750;
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
  .me-personal-pulse {
    display: grid;
    gap: 8px;
    margin: 0 0 10px;
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.98) 58%, rgba(240,249,255,.92));
    border: 1px solid rgba(16,185,129,.18);
    box-shadow: 0 8px 22px rgba(15,23,42,.05);
  }
  .me-personal-pulse-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .me-personal-pulse-head span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    color: transparent;
    background: #10b981;
    box-shadow: 0 0 0 5px rgba(16,185,129,.12);
    flex: 0 0 9px;
  }
  .me-personal-pulse-head strong {
    color: #0f172a;
    font-size: 13px;
    line-height: 1.35;
    font-weight: 950;
  }
  .me-personal-pulse p {
    margin: 0;
    color: #475569;
    font-size: 11.5px;
    line-height: 1.55;
    font-weight: 760;
  }
  .me-map-privacy-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .me-map-privacy-strip span {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.18);
    color: #0f766e;
    font-size: 10.5px;
    line-height: 1.1;
    font-weight: 900;
  }
  .me-personal-memory {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(255,255,255,.74);
    border: 1px solid rgba(15,118,110,.14);
  }
  .me-personal-memory.is-hidden { display: none; }
  .me-personal-memory-head {
    display: grid;
    gap: 2px;
  }
  .me-personal-memory-head strong {
    color: #0f172a;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 950;
  }
  .me-personal-memory-head small {
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.45;
    font-weight: 760;
  }
  .me-personal-memory-list {
    display: grid;
    gap: 6px;
  }
  .me-personal-memory-item {
    width: 100%;
    min-width: 0;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 6px;
    border-radius: 8px;
    border: 1px solid rgba(15,23,42,.08);
    background: #fff;
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-personal-memory-item:hover { border-color: rgba(15,118,110,.26); }
  .me-personal-memory-item img,
  .me-personal-memory-item i {
    width: 42px;
    height: 34px;
    border-radius: 7px;
    object-fit: cover;
    background: rgba(16,185,129,.12);
  }
  .me-personal-memory-item i {
    display: grid;
    place-items: center;
    color: transparent;
  }
  .me-personal-memory-item span {
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .me-personal-memory-item strong,
  .me-personal-memory-item small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-personal-memory-item strong {
    color: #0f172a;
    font-size: 11.5px;
    line-height: 1.25;
    font-weight: 950;
  }
  .me-personal-memory-item small {
    color: #64748b;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 760;
  }
  .me-personal-memory-item b {
    color: #0f766e;
    font-size: 10.5px;
    line-height: 1.2;
    font-weight: 950;
  }
  .me-personal-pulse-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .me-personal-pulse-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #0f172a;
    color: #fff !important;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 900;
    text-decoration: none;
  }
  .me-personal-pulse-actions a:nth-child(2) {
    background: rgba(255,255,255,.92);
    color: #0f766e !important;
    border: 1px solid rgba(16,185,129,.18);
  }
  .me-discovery-preview {
    width: 50px;
    min-height: 58px;
    display: grid;
    position: relative;
    justify-items: center;
    align-content: start;
    gap: 3px;
    padding: 4px;
    border: 0;
    border-radius: 12px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 8px 18px rgba(15,23,42,.16);
    color: #0f172a;
    cursor: pointer;
    transform-origin: bottom center;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .me-discovery-preview:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(15,23,42,.20); }
  .me-discovery-preview.is-grid {
    outline: 2px dashed rgba(14,165,233,.38);
    outline-offset: 3px;
    box-shadow: 0 8px 18px rgba(14,165,233,.16), 0 0 0 1px rgba(14,165,233,.22), 0 0 0 7px rgba(14,165,233,.07);
  }
  .me-discovery-preview img,
  .me-discovery-preview i {
    width: 42px;
    height: 31px;
    border-radius: 8px;
    object-fit: cover;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #e0f2fe, #dcfce7);
    color: #0f766e;
    font-style: normal;
    font-size: 16px;
  }
  .me-discovery-preview span {
    max-width: 42px;
    min-height: 18px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: center;
    font-size: 8.5px;
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: 0;
  }
  .me-discovery-preview em {
    max-width: 42px;
    padding: 1px 4px;
    border-radius: 999px;
    background: rgba(14,165,233,.10);
    color: #0369a1;
    font-style: normal;
    font-size: 7.5px;
    line-height: 1.1;
    font-weight: 900;
    letter-spacing: 0;
  }
  .me-discovery-preview::after {
    content: "";
    width: 8px;
    height: 8px;
    margin-bottom: -8px;
    transform: rotate(45deg);
    background: rgba(255,255,255,.96);
    box-shadow: 4px 4px 8px rgba(15,23,42,.08);
  }
  .me-own-observation-marker {
    width: 66px;
    min-height: 74px;
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 5px;
    border-radius: 16px;
    background: rgba(16,185,129,.96);
    color: #052e1c;
    box-shadow: 0 14px 30px rgba(5,150,105,.28), 0 0 0 3px rgba(255,255,255,.9);
    text-decoration: none;
    transform-origin: bottom center;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .me-own-observation-marker:hover {
    transform: translateY(-2px);
    box-shadow: 0 18px 34px rgba(5,150,105,.34), 0 0 0 3px rgba(255,255,255,.96);
  }
  .me-own-observation-marker img {
    width: 56px;
    height: 48px;
    border-radius: 12px;
    object-fit: cover;
    display: block;
    background: #ecfdf5;
  }
  .me-own-observation-marker.is-stack {
    background: rgba(8,145,178,.96);
    color: #082f49;
    box-shadow: 0 16px 34px rgba(8,145,178,.28), -8px 8px 0 rgba(255,255,255,.86), -14px 14px 0 rgba(8,145,178,.22);
  }
  .me-own-observation-marker.is-stack img {
    box-shadow: 8px -5px 0 rgba(255,255,255,.58);
  }
  .me-own-observation-marker b {
    position: absolute;
    top: -8px;
    right: -8px;
    min-width: 24px;
    height: 24px;
    display: inline-grid;
    place-items: center;
    padding: 0 6px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font-size: 12px;
    line-height: 1;
    font-weight: 950;
    box-shadow: 0 0 0 3px rgba(255,255,255,.95);
  }
  .me-own-observation-marker span {
    max-width: 56px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-align: center;
    font-size: 10px;
    line-height: 1.15;
    font-weight: 950;
    letter-spacing: 0;
  }
  .me-own-observation-marker em {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .me-own-observation-marker.is-photo-missing {
    min-height: 42px;
    align-content: center;
  }
  .me-own-stack-sheet {
    gap: 12px;
    padding-bottom: 14px;
  }
  .me-own-stack-hint {
    margin: 0 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(236,253,245,.92);
    border: 1px solid rgba(16,185,129,.18);
    color: #0f3f2e;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 800;
  }
  .me-own-stack-list {
    display: grid;
    gap: 8px;
    padding: 0 12px 12px;
  }
  .me-own-stack-item {
    min-height: 72px;
    width: 100%;
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 8px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(15,23,42,.08);
    color: #0f172a;
    text-decoration: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
    box-shadow: 0 8px 18px rgba(15,23,42,.06);
  }
  .me-own-stack-item:hover {
    border-color: rgba(20,184,166,.28);
    background: #f8fffc;
  }
  .me-own-stack-item img {
    width: 58px;
    height: 56px;
    object-fit: cover;
    border-radius: 12px;
    background: #ecfdf5;
  }
  .me-own-stack-item.is-photo-missing {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .me-own-stack-item span {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .me-own-stack-item strong {
    color: #0f172a;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 950;
    overflow-wrap: anywhere;
  }
  .me-own-stack-item small {
    color: #64748b;
    font-size: 11px;
    line-height: 1.25;
    font-weight: 760;
    overflow-wrap: anywhere;
  }
  .me-own-stack-item b {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
    font-size: 11px;
    line-height: 1;
    font-weight: 950;
    white-space: nowrap;
  }
  .me-own-trail {
    position: absolute;
    left: 18px;
    bottom: 34px;
    z-index: 4;
    width: min(520px, calc(100% - 36px));
    padding: 10px;
    border-radius: 18px;
    border: 1px solid rgba(15,23,42,.08);
    background: rgba(255,255,255,.94);
    box-shadow: 0 18px 44px rgba(15,23,42,.14);
    backdrop-filter: blur(16px);
  }
  .me-own-trail.is-hidden { display: none; }
  .me-own-trail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .me-own-trail-head strong {
    color: #0f172a;
    font-size: 13px;
    font-weight: 950;
    letter-spacing: 0;
  }
  .me-own-trail-head small {
    margin-left: auto;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(209,250,229,.78);
    color: #047857;
    font-size: 10px;
    line-height: 1.15;
    font-weight: 950;
  }
  .me-own-trail-head span {
    color: #047857;
    font-size: 11px;
    font-weight: 900;
    white-space: nowrap;
  }
  .me-own-trail-list {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(132px, 1fr);
    gap: 8px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
  }
  .me-own-trail-item {
    min-width: 0;
    min-height: 62px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    padding: 7px;
    border-radius: 14px;
    border: 1px solid rgba(16,185,129,.16);
    background: rgba(236,253,245,.76);
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-own-trail-item:hover {
    background: rgba(209,250,229,.92);
    border-color: rgba(5,150,105,.28);
  }
  .me-own-trail-item img {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    object-fit: cover;
    display: block;
    background: #e0f2fe;
  }
  .me-own-trail-item span {
    min-width: 0;
    display: grid;
    gap: 3px;
  }
  .me-own-trail-item strong,
  .me-own-trail-item small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0;
  }
  .me-own-trail-item strong {
    font-size: 12px;
    line-height: 1.25;
    font-weight: 950;
  }
  .me-own-trail-item small {
    color: #64748b;
    font-size: 10px;
    line-height: 1.2;
    font-weight: 800;
  }
  .me-nearby-area-marker {
    max-width: 150px;
    min-width: 98px;
    display: grid;
    gap: 2px;
    padding: 7px 9px 8px;
    border: 1px solid rgba(15,23,42,.14);
    border-radius: 10px;
    background: rgba(255,255,255,.96);
    color: #0f172a;
    box-shadow: 0 12px 26px rgba(15,23,42,.16);
    cursor: pointer;
    text-align: left;
    transform-origin: bottom center;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .me-nearby-area-marker:hover { transform: translateY(-2px); box-shadow: 0 16px 32px rgba(15,23,42,.20); border-color: rgba(15,118,110,.28); }
  .me-nearby-area-marker span {
    justify-self: start;
    min-height: 18px;
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(20,184,166,.12);
    color: #0f766e;
    font-size: 10.5px;
    line-height: 1.1;
    font-weight: 950;
  }
  .me-nearby-area-marker strong {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 12px;
    line-height: 1.25;
    font-weight: 950;
    letter-spacing: 0;
  }
  .me-nearby-area-marker::after {
    content: "";
    justify-self: center;
    width: 9px;
    height: 9px;
    margin-bottom: -13px;
    transform: rotate(45deg);
    background: rgba(255,255,255,.96);
    border-right: 1px solid rgba(15,23,42,.10);
    border-bottom: 1px solid rgba(15,23,42,.10);
  }
  .me-nearby-area-marker.is-public { border-color: rgba(16,185,129,.28); }
  .me-nearby-area-marker.is-public span { background: rgba(16,185,129,.14); color: #047857; }
  .me-nearby-area-marker.is-restricted { border-color: rgba(245,158,11,.26); }
  .me-nearby-area-marker.is-restricted span { background: rgba(254,243,199,.86); color: #92400e; }
  .me-nearby-area-marker.is-school { border-style: dashed; border-color: #d97706; }
  .me-nearby-area-marker.is-school span { background: rgba(254,243,199,.9); color: #92400e; }
  .me-walk-map-marker {
    max-width: 120px;
    min-width: 74px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    border: 1px solid rgba(15,118,110,.22);
    border-radius: 999px;
    background: rgba(255,255,255,.96);
    color: #0f172a;
    box-shadow: 0 10px 22px rgba(15,118,110,.14);
    text-decoration: none;
    cursor: pointer;
    transform-origin: center;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .me-walk-map-marker:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 28px rgba(15,118,110,.18);
    border-color: rgba(15,118,110,.36);
  }
  .me-walk-map-marker span {
    min-height: 18px;
    display: inline-flex;
    align-items: center;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(20,184,166,.13);
    color: #0f766e;
    font-size: 10.5px;
    line-height: 1.1;
    font-weight: 950;
  }
  .me-walk-map-marker strong {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 11.5px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: 0;
  }
  @media (max-width: 700px) {
    .me-walk-map-marker {
      min-width: 44px;
      max-width: 132px;
      min-height: 34px;
      padding: 6px 7px;
    }
    .me-walk-map-marker strong {
      max-width: 70px;
      display: -webkit-box;
    }
  }
  .me-guide-spot-marker.is-pin .me-guide-spot-main {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border-radius: 999px;
    border: 1px solid rgba(20,184,166,.32);
    background: rgba(240,253,250,.96);
    color: #0f766e;
    box-shadow: 0 10px 22px rgba(15,118,110,.16);
    backdrop-filter: blur(10px);
  }
  .me-guide-dot {
    width: 22px;
    height: 22px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,.72);
    color: #0f766e;
  }
  .me-guide-dot svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .me-guide-cluster-count {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #2dd4bf;
    color: #063f3c;
    font-size: 10px;
    line-height: 1;
    font-weight: 950;
  }
  .me-guide-spot-marker {
    color: #0f172a;
    transform-origin: bottom center;
  }
  .me-guide-spot-main {
    display: grid;
    gap: 3px;
    max-width: 178px;
    padding: 8px 10px;
    border: 1px solid rgba(15,23,42,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.96);
    box-shadow: 0 12px 26px rgba(15,23,42,.14);
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .me-guide-spot-main strong {
    font-size: 11px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: 0;
  }
  .me-guide-spot-main > span:not(.me-guide-dot):not(.me-guide-cluster-count) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: #475569;
    font-size: 9.5px;
    line-height: 1.25;
    font-weight: 800;
  }
  .me-guide-spot-detail,
  .me-guide-spot-body {
    display: grid;
    gap: 12px;
  }
  .me-guide-spot-list {
    display: grid;
    gap: 8px;
  }
  .me-guide-spot-list-item {
    display: grid;
    gap: 4px;
    width: 100%;
    min-height: 54px;
    padding: 10px 12px;
    border: 1px solid rgba(15,23,42,.10);
    border-radius: 8px;
    background: #fff;
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-guide-spot-list-item strong {
    font-size: 13px;
    line-height: 1.35;
    font-weight: 950;
  }
  .me-guide-spot-list-item span {
    color: #475569;
    font-size: 11px;
    line-height: 1.45;
    font-weight: 760;
  }
  .me-guide-spot-body p {
    margin: 0;
    color: #334155;
    font-size: 13px;
    line-height: 1.75;
    font-weight: 700;
  }
  .me-guide-spot-points {
    margin: 0;
    padding-left: 18px;
    color: #475569;
    font-size: 12.5px;
    line-height: 1.65;
    font-weight: 700;
  }
  .me-area-guide-sources {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    padding-top: 4px;
    border-top: 1px dashed rgba(15,23,42,.12);
  }
  .me-area-guide-sources span {
    color: #64748b;
    font-size: 10px;
    font-weight: 950;
  }
  .me-area-guide-sources a {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 4px 7px;
    border-radius: 999px;
    background: rgba(15,23,42,.06);
    color: #0f172a;
    font-size: 10.5px;
    font-weight: 850;
    text-decoration: none;
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
  .me-search-group-heading {
    padding: 9px 14px 5px;
    color: #0f766e;
    background: rgba(240,253,250,.78);
    border-bottom: 1px solid rgba(15,23,42,.04);
    font-size: 10px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: .08em;
  }
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
  @keyframes me-results-loading { from { background-position: 100% 0; } to { background-position: -80% 0; } }
  .me-locate-marker {
    width: 18px; height: 18px; border-radius: 50%;
    background: #0ea5e9; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(14,165,233,.28);
  }
  .me-legend {
    /* MapLibre の OpenStreetMap attribution の上、確実に被らない位置に。
       attribution は実測で ~24-28px、上に 12px 余白を取って bottom:42px。 */
    position: absolute; right: 8px; bottom: 42px; z-index: 4;
    max-width: min(360px, calc(100% - 24px));
    box-sizing: border-box;
    padding: 5px 8px; border-radius: 8px;
    background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 4px 10px rgba(15,23,42,.08);
    display: flex; flex-direction: column; align-items: stretch; gap: 7px; font-size: 10px; font-weight: 700;
  }
  .me-legend-main { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0; }
  .me-legend-gradient { width: 96px; height: 6px; }
  .me-legend.is-hidden { display: none; }
  .me-legend-toggle {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border: 0;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    font: inherit;
    font-size: 11px;
    line-height: 1;
    font-weight: 950;
    cursor: pointer;
  }
  .me-legend-toggle::after {
    content: "＋";
    margin-left: 6px;
    font-size: 10px;
    line-height: 1;
  }
  .me-legend:not(.is-collapsed) .me-legend-toggle::after { content: "−"; }
  .me-legend-gradient { flex: 0 1 140px; min-width: 92px; height: 10px; border-radius: 999px; display: inline-block; }
  .me-legend-range { display: inline-flex; flex: 1 1 190px; min-width: 0; flex-wrap: wrap; gap: 6px 10px; color: #64748b; font-weight: 700; }
  .me-legend.is-collapsed {
    max-width: none;
    padding: 4px;
  }
  .me-legend.is-collapsed .me-legend-toggle {
    width: 38px;
    min-width: 38px;
    min-height: 38px;
    padding: 0;
    font-size: 0;
  }
  .me-legend.is-collapsed .me-legend-toggle::after {
    content: "?";
    margin-left: 0;
    font-size: 15px;
  }
  .me-legend.is-collapsed .me-legend-gradient,
  .me-legend.is-collapsed .me-legend-range,
  .me-legend.is-collapsed .me-legend-detail {
    display: none;
  }
  #me-legend-low,
  #me-legend-high { min-width: 0; overflow-wrap: anywhere; }
  .me-legend-detail {
    max-width: 100%;
  }
  .me-legend-detail.is-hidden { display: none; }
  .me-legend-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
    gap: 6px;
    margin: 0;
    padding: 0;
    max-width: 100%;
  }
  .me-legend-chip {
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 6px 8px;
    border-radius: 8px;
    border: 1px solid rgba(15,23,42,.10);
    background: rgba(255,255,255,.92);
    color: #0f172a;
  }
  .me-legend-chip dt {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    margin: 0;
  }
  .me-legend-chip i {
    width: 16px;
    height: 16px;
    border-radius: 5px;
    background: rgba(148,163,184,.16);
    border: 2px solid rgba(100,116,139,.38);
  }
  .me-legend-chip strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 10.5px;
    line-height: 1.2;
    font-weight: 900;
  }
  .me-legend-chip dd {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    color: #64748b;
    font-size: 9.5px;
    line-height: 1.25;
    font-weight: 700;
  }
  .me-legend-chip.is-confirmed i { background: rgba(16,185,129,.18); border-color: #059669; }
  .me-legend-chip.is-pending i { background: rgba(245,158,11,.16); border-color: #d97706; }
  .me-legend-chip.is-park i { background: linear-gradient(135deg, rgba(187,247,208,.9), rgba(74,222,128,.42)); border-color: #16a34a; }
  .me-legend-chip.is-school i { background: rgba(254,243,199,.9); border-color: #d97706; border-style: dashed; }
  .me-legend-chip.is-water i { height: 8px; border-radius: 999px; background: #7dd3fc; border-color: #0284c7; }
  .me-layer-hint {
    position: absolute;
    left: 12px;
    bottom: 56px;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(520px, calc(100% - 24px));
    box-sizing: border-box;
    padding: 9px 10px 9px 12px;
    border-radius: 12px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(15,118,110,.16);
    box-shadow: 0 10px 24px rgba(15,23,42,.14);
    color: #0f172a;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 820;
  }
  .me-layer-hint.is-hidden { display: none; }
  .me-layer-hint span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .me-layer-hint-jump,
  .me-layer-hint-close {
    flex: 0 0 auto;
    border: 0;
    cursor: pointer;
    font-weight: 900;
  }
  .me-layer-hint-jump {
    min-height: 32px;
    padding: 0 11px;
    border-radius: 999px;
    background: #0f766e;
    color: #fff;
    box-shadow: 0 8px 18px rgba(15,118,110,.18);
  }
  .me-layer-hint-close {
    width: 30px;
    height: 30px;
    border-radius: 999px;
    background: rgba(15,23,42,.06);
    color: #475569;
    font-size: 17px;
    line-height: 1;
  }
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
    transform: translate3d(0, 28px, 0); opacity: 0; pointer-events: none;
    transition: transform .38s cubic-bezier(.16,1,.3,1), opacity .22s ease, height .34s cubic-bezier(.16,1,.3,1), max-height .34s cubic-bezier(.16,1,.3,1);
    will-change: transform, opacity, height;
    max-height: 50%;
    overflow-y: auto;
  }
  .me-bottom-sheet.is-open { transform: translate3d(0, 0, 0); opacity: 1; pointer-events: auto; }
  .me-bottom-sheet.is-dragging { transition: none; }
  .me-bottom-grip { display: none; }
  .me-bottom-sheet--detail {
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    border-radius: 22px 22px 0 0;
    max-height: min(76%, 680px);
    transform: translate3d(0, 105%, 0);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .me-bottom-sheet--detail[data-snap="peek"] {
    height: min(34dvh, 300px);
    max-height: min(34dvh, 300px);
  }
  .me-bottom-sheet--detail[data-snap="full"] {
    height: min(76dvh, 680px);
    max-height: calc(100% - 10px);
  }
  .me-bottom-sheet--detail .me-bottom-grip,
  .me-bottom-sheet--area .me-bottom-grip {
    position: sticky;
    top: 0;
    z-index: 2;
    display: block;
    width: 96px;
    height: 44px;
    margin: 0 auto -24px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    cursor: grab;
    touch-action: none;
  }
  .me-bottom-sheet--detail .me-bottom-grip::before,
  .me-bottom-sheet--area .me-bottom-grip::before {
    content: "";
    display: block;
    width: 42px;
    height: 4px;
    margin: 18px auto 0;
    border-radius: 999px;
    background: rgba(100,116,139,.42);
  }
  .me-bottom-sheet--detail .me-bottom-grip:active,
  .me-bottom-sheet--area .me-bottom-grip:active { cursor: grabbing; }
  .me-bottom-sheet--detail.is-open { transform: translate3d(0, 0, 0); }
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
  .me-bottom-detail .me-detail-hero.me-detail-hero-compact {
    min-height: 92px;
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
  .me-bottom-sheet--detail[data-snap="peek"] .me-bottom-detail {
    gap: 8px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-recent,
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-walk,
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-stats,
  .me-bottom-sheet--detail[data-snap="peek"] .me-selected-ambient,
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-head,
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-heading,
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-section {
    display: none;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-visit div:nth-child(n+2),
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-loop-card:nth-child(n+2) {
    display: none;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding-bottom: 10px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-action {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    gap: 3px;
    padding: 4px 5px;
    border-radius: 999px;
    background: rgba(20,184,166,.10);
    border: 1px solid rgba(20,184,166,.16);
    font-size: 10px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-action-icon {
    width: auto;
    height: auto;
    border: 0;
    background: transparent;
    font-size: 13px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-action strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-visit div,
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-loop-card {
    padding: 8px 10px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief {
    margin-bottom: 0;
    padding: 8px 10px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-site-brief-loop-grid {
    margin-bottom: 0;
  }
  .me-bottom-close { position: absolute; right: 8px; top: 8px; width: 44px; height: 44px; padding: 0; border-radius: 999px; background: rgba(15,23,42,.06); border: 0; color: #475569; font-size: 18px; cursor: pointer; }
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
  .me-area-gallery-empty-lead {
    margin: 8px 0 0;
    color: #334155;
    font-size: 12.5px;
    line-height: 1.6;
    font-weight: 760;
    overflow-wrap: anywhere;
  }
  .me-area-gallery-empty-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 10px;
  }
  .me-area-gallery-empty-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 42px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(15,118,110,.18);
    background: #fff;
    color: #0f766e !important;
    text-align: center;
    text-decoration: none;
    font-size: 11.5px;
    line-height: 1.25;
    font-weight: 930;
    letter-spacing: 0;
    overflow-wrap: anywhere;
    white-space: normal;
    cursor: pointer;
  }
  .me-area-gallery-empty-action.is-primary {
    background: #0f766e;
    border-color: #0f766e;
    color: #fff !important;
  }
  .me-area-gallery-empty-action.is-safety {
    background: rgba(255,251,235,.92);
    border-color: rgba(245,158,11,.28);
    color: #92400e !important;
    cursor: default;
  }
  @media (max-width: 520px) {
    .me-area-gallery-empty-actions { grid-template-columns: 1fr; }
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
  .me-area-primary-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin: -2px 0 12px;
  }
  .me-area-primary-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 0;
    min-height: 44px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid rgba(15,118,110,.16);
    background: #fff;
    color: #0f766e !important;
    text-decoration: none;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: 0;
    text-align: center;
  }
  .me-area-primary-action span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border-radius: 999px;
    background: rgba(15,118,110,.12);
    font-weight: 950;
  }
  .me-area-primary-action-event {
    border-color: #0f9f7a;
    background: #0f9f7a;
    color: #fff !important;
    box-shadow: 0 8px 18px rgba(15,118,110,.2);
  }
  .me-area-primary-action-event span {
    background: rgba(255,255,255,.2);
  }
  .me-area-primary-action:hover {
    border-color: rgba(15,118,110,.34);
    background: #ecfdf5;
    color: #0f766e !important;
  }
  .me-area-primary-action-event:hover {
    background: #0f766e;
    color: #fff !important;
  }
  .me-activity-panel,
  .me-area-primary-actions.me-area-activity-panel {
    display: grid;
    grid-template-columns: 1fr;
    gap: 9px;
    padding: 12px;
    margin: 0 0 10px;
    border-radius: 16px;
    background: rgba(255,255,255,.96);
    border: 1px solid rgba(14,165,233,.18);
    box-shadow: 0 8px 22px rgba(15,23,42,.05);
  }
  .me-area-primary-actions.me-area-activity-panel {
    margin: -2px 0 12px;
  }
  .me-activity-head,
  .me-area-activity-head {
    display: grid;
    gap: 2px;
  }
  .me-activity-head span,
  .me-area-activity-head span {
    font-size: 10px;
    line-height: 1.25;
    color: #0f766e;
    font-weight: 950;
  }
  .me-activity-head strong,
  .me-area-activity-head strong {
    font-size: 13px;
    line-height: 1.35;
    color: #0f172a;
    font-weight: 950;
  }
  .me-activity-panel p,
  .me-area-activity-panel p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.5;
    color: #475569;
    font-weight: 720;
  }
  .me-activity-link,
  .me-area-activity-link {
    width: fit-content;
    max-width: 100%;
    min-height: 34px;
    padding: 8px 12px;
  }
  .me-area-activity-extra {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 7px;
  }
  .me-area-primary-actions-meta {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
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
  .me-area-season-gap.is-muted {
    color: #92400e;
    background: rgba(254,243,199,.62);
    border-color: rgba(217,119,6,.24);
  }
  .me-area-season-gap.is-muted strong { color: #92400e; }
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
  .me-detail-hero-compact {
    min-height: 104px;
    background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(240,249,255,.94));
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
  .me-detail-hero-compact .me-detail-hero-copy {
    position: static;
    min-height: 104px;
    align-content: center;
    padding: 18px 18px 16px;
    background: none;
    color: #0f172a;
  }
  .me-detail-hero-compact span {
    background: rgba(20,184,166,.12);
    color: #0f766e;
  }
  .me-detail-hero-compact strong {
    color: #0f172a;
    text-shadow: none;
  }
  .me-detail-hero-compact small {
    color: #64748b;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-hero-compact,
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-hero-compact .me-detail-hero-copy {
    min-height: 78px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-hero-compact .me-detail-hero-copy {
    padding: 12px 18px 9px;
  }
  .me-bottom-sheet--detail[data-snap="peek"] .me-detail-hero-compact strong {
    font-size: 19px;
  }
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
  .me-aggregate-safety {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(240,253,250,.9);
    border: 1px solid rgba(20,184,166,.18);
    color: #0f3f3a;
    font-size: 12px;
    font-weight: 760;
    line-height: 1.5;
  }
  .me-gbif-area-summary {
    padding: 12px;
    border-radius: 12px;
    background: rgba(248,250,252,.94);
    border: 1px solid rgba(15,118,110,.16);
  }
  .me-gbif-area-summary.is-loading {
    background: linear-gradient(90deg, rgba(248,250,252,.94), rgba(240,253,250,.96));
  }
  .me-gbif-area-note {
    margin: 0 0 10px;
    color: #475569;
    font-size: 11.5px;
    line-height: 1.55;
    font-weight: 760;
  }
  .me-gbif-area-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 10px;
  }
  .me-gbif-area-stats div {
    min-width: 0;
    padding: 9px 10px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid rgba(148,163,184,.14);
  }
  .me-gbif-area-stats span {
    display: block;
    color: #64748b;
    font-size: 10px;
    line-height: 1.25;
    font-weight: 850;
  }
  .me-gbif-area-stats strong {
    display: block;
    margin-top: 3px;
    color: #0f172a;
    font-size: 14px;
    line-height: 1.25;
    font-weight: 950;
  }
  .me-gbif-taxa-list {
    display: grid;
    gap: 7px;
  }
  .me-gbif-taxon {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    padding: 7px 8px;
    border-radius: 10px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(148,163,184,.12);
  }
  .me-gbif-taxon > span {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: rgba(20,184,166,.10);
  }
  .me-gbif-taxon strong {
    min-width: 0;
    color: #0f172a;
    font-size: 11.5px;
    line-height: 1.3;
    font-weight: 850;
    overflow-wrap: anywhere;
  }
  .me-gbif-taxon strong em {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 10px;
    font-style: italic;
    font-weight: 650;
  }
  .me-gbif-taxon small {
    color: #0f766e;
    font-size: 10px;
    font-weight: 950;
  }
  .me-gbif-area-source {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    margin-top: 10px;
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.35;
    font-weight: 760;
  }
  .me-gbif-area-source a {
    color: #0f766e;
    font-weight: 950;
    text-decoration: none;
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
  .me-detail-panel-area .me-area-guide-stop,
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
    .me-area-guide-actions { grid-template-columns: 1fr; }
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
    overflow: visible;
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
  .me-section[data-side="rail"] .me-side-body { display: none; }
  .me-side-rail-icons {
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 18px 0;
    color: #475569;
  }
  .me-side-rail-mark {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(20,184,166,.2), rgba(14,165,233,.16));
  }
  .me-side-rail-mark::before,
  .me-side-rail-mark::after {
    content: "";
    position: absolute;
    left: 6px;
    width: 10px;
    height: 3px;
    border-radius: 999px;
    background: rgba(15,118,110,.72);
  }
  .me-side-rail-mark::before { top: 7px; transform: rotate(-8deg); }
  .me-side-rail-mark::after { top: 13px; transform: rotate(8deg); }
  .me-side-rail-signal {
    display: inline-flex;
    align-items: end;
    gap: 3px;
    width: 24px;
    height: 22px;
    padding: 3px;
    border-radius: 999px;
    background: rgba(148,163,184,.16);
  }
  .me-side-rail-signal i {
    display: block;
    width: 4px;
    border-radius: 999px;
    background: rgba(100,116,139,.42);
  }
  .me-side-rail-signal i:nth-child(1) { height: 7px; }
  .me-side-rail-signal i:nth-child(2) { height: 11px; }
  .me-side-rail-signal i:nth-child(3) { height: 15px; }
  .me-side-rail-signal.is-active {
    background: rgba(20,184,166,.14);
    box-shadow: 0 0 0 1px rgba(20,184,166,.18);
  }
  .me-side-rail-signal.is-active i {
    background: linear-gradient(180deg, #2dd4bf, #0ea5e9);
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
    gap: 10px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
  }
  .me-result-group {
    display: grid;
    gap: 6px;
  }
  .me-result-group-head {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 4px 4px;
    background: rgba(255,255,255,.96);
    border-bottom: 1px solid rgba(15,23,42,.05);
  }
  .me-result-group-head strong {
    color: #0f172a;
    font-size: 12px;
    line-height: 1.2;
    font-weight: 950;
  }
  .me-result-group-head span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 10.5px;
    line-height: 1.25;
    font-weight: 780;
  }
  .me-result-row {
    display: grid;
    grid-template-columns: 64px minmax(0,1fr);
    gap: 10px;
    width: 100%;
    min-height: 78px;
    padding: 8px;
    border: 1px solid rgba(15,23,42,.06);
    border-radius: 10px;
    background: rgba(255,255,255,.96);
    text-align: left;
    cursor: pointer;
  }
  .me-result-row.is-active { border-color: rgba(14,165,233,.28); box-shadow: 0 12px 28px rgba(14,165,233,.12); }
  .me-result-thumb {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 8px;
    background: rgba(241,245,249,.9);
  }
  .me-result-thumb-placeholder { display: grid; place-items: center; font-size: 22px; color: #64748b; }
  .me-result-body { display: flex; flex-direction: column; justify-content: center; gap: 6px; min-width: 0; }
  .me-result-body strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13.5px;
    font-weight: 900;
    color: #0f172a;
    letter-spacing: -.01em;
  }
  .me-result-body span { font-size: 12px; color: #64748b; line-height: 1.4; }
  .me-result-badges { display: flex; flex-wrap: wrap; gap: 4px; }
  .me-result-badge { display: inline-flex; width: fit-content; padding: 2px 7px; border-radius: 999px; font-size: 10px; line-height: 1.2; font-weight: 900; letter-spacing: .04em; }
  .me-result-ai { background: rgba(14,165,233,.14); color: #075985; }
  .me-result-awaiting { background: rgba(234,179,8,.18); color: #713f12; }
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
  .me-results-empty { display: grid; gap: 10px; border-color: rgba(14,165,233,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.64); }
  .me-results-empty-kicker {
    width: fit-content;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(14,165,233,.1);
    color: #0369a1;
    font-size: 10px;
    line-height: 1.3;
    font-weight: 900;
  }
  .me-results-empty strong { color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 900; }
  .me-results-empty p, .me-results-empty small { margin: 0; color: #64748b; line-height: 1.55; }
  .me-results-empty small { font-size: 11px; }
  .me-results-loading {
    display: grid;
    gap: 8px;
    padding: 10px;
    border-radius: 14px;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(14,165,233,.12);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.7);
  }
  .me-results-loading-row {
    min-height: 74px;
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-radius: 10px;
    background: rgba(248,250,252,.88);
    border: 1px solid rgba(148,163,184,.14);
  }
  .me-results-loading-thumb,
  .me-results-loading-lines b {
    display: block;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(226,232,240,.96), rgba(203,213,225,.76), rgba(226,232,240,.96));
    background-size: 180% 100%;
    animation: me-results-loading 1.2s ease-in-out infinite;
  }
  .me-results-loading-thumb {
    width: 54px;
    height: 54px;
    border-radius: 10px;
  }
  .me-results-loading-lines {
    display: grid;
    gap: 9px;
    min-width: 0;
  }
  .me-results-loading-lines b {
    width: var(--skeleton-w, 70%);
    height: 12px;
  }
  .me-results-empty-actions { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .me-results-empty-action {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 38px; padding: 8px 10px; border-radius: 12px;
    border: 1px solid rgba(15,23,42,.1); background: #fff;
    color: #0f172a; text-decoration: none; cursor: pointer;
    font-size: 12px; line-height: 1.25; font-weight: 850; text-align: center;
  }
  .me-results-empty-action.is-primary {
    background: linear-gradient(135deg, rgba(16,185,129,.16), rgba(14,165,233,.14));
    border-color: rgba(16,185,129,.32);
    color: #065f46;
  }
  @media (min-width: 1180px) {
    .me-results-empty-actions { grid-template-columns: 1fr 1fr; }
    .me-results-empty-action:first-child { grid-column: 1 / -1; }
  }
  @media (max-width: 520px) {
    .me-results-loading { gap: 7px; padding: 9px; }
    .me-results-loading-row { min-height: 66px; grid-template-columns: 48px minmax(0, 1fr); }
    .me-results-loading-row:nth-child(n+3) { display: none; }
    .me-results-loading-thumb { width: 46px; height: 46px; }
  }
  .me-overlap-choice-popup .maplibregl-popup-content {
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(15,23,42,.08);
    box-shadow: 0 14px 34px rgba(15,23,42,.18);
  }
  .me-overlap-choice-popup .maplibregl-popup-close-button {
    width: 24px;
    height: 24px;
    color: #64748b;
    font-size: 18px;
  }
  .me-overlap-choice {
    display: grid;
    gap: 6px;
    min-width: 220px;
    padding-top: 10px;
  }
  .me-overlap-choice-title {
    padding: 0 24px 2px 4px;
    font-size: 12px;
    font-weight: 900;
    color: #0f172a;
  }
  .me-overlap-choice-btn {
    display: grid;
    gap: 2px;
    width: 100%;
    min-height: 48px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(15,23,42,.08);
    background: #fff;
    color: #0f172a;
    text-align: left;
    cursor: pointer;
  }
  .me-overlap-choice-btn:hover {
    border-color: rgba(14,165,233,.38);
    background: #f8fafc;
  }
  .me-overlap-choice-btn strong {
    font-size: 12.5px;
    font-weight: 950;
    line-height: 1.25;
  }
  .me-overlap-choice-btn span {
    max-width: 210px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #64748b;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 750;
  }
  .me-overlap-choice-cell {
    background: rgba(240,249,255,.9);
    border-color: rgba(14,165,233,.24);
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
  .me-side-toggle:focus-visible,
  .me-overlap-choice-btn:focus-visible,
  .me-area-primary-action:focus-visible,
  .me-year-range:focus-visible,
  .me-result-row:focus-visible,
  .me-filter-toggle:focus-visible,
  .me-search-area-btn:focus-visible {
    outline: 3px solid #ebb72f;
    outline-offset: 3px;
    box-shadow: 0 0 0 1px #0f172a;
  }

  @media (max-width: 1200px) {
    .me-section { --me-side-w: 360px; }
    .me-map-panel-selection { width: clamp(260px, 30vw, 320px); }
  }

  @media (max-width: 900px) {
    .site-shell.is-map-surface .global-record-launcher {
      display: grid;
      z-index: 72;
      left: 10px;
      right: 10px;
      bottom: max(8px, env(safe-area-inset-bottom));
    }
    .me-map .maplibregl-ctrl-bottom-right {
      bottom: calc(var(--me-mobile-action-space) + 4px);
    }
    .me-rain-mode .site-shell.is-map-surface .global-record-launcher {
      display: none;
    }

    .me-section {
      --me-side-w: 0px;
      --me-topbar-h: 94px;
      --me-enjoy-h: 38px;
      --me-mobile-action-space: calc(92px + max(0px, env(safe-area-inset-bottom)));
      --me-mobile-sheet-clearance: 14px;
    }
    .me-rain-mode .me-section {
      --me-topbar-h: 44px;
      --me-mobile-action-space: calc(102px + max(0px, env(safe-area-inset-bottom)));
    }
    .me-topbar {
      grid-template-columns: 1fr auto;
      grid-template-rows: 40px 38px;
      gap: 8px;
      padding: 5px 10px;
    }
    .me-rain-mode .me-topbar {
      grid-template-columns: 1fr;
      grid-template-rows: 34px;
      gap: 0;
      padding: 4px 8px 5px;
      background: rgba(248,255,254,.9);
      backdrop-filter: blur(10px);
    }
    .me-topbar-primary { display: contents; }
    .me-map-kicker { display: none; }
    .me-search-shell { grid-column: 1; grid-row: 1; }
    .me-rain-mode .me-search-shell,
    .me-rain-mode .me-topbar-secondary {
      display: none;
    }
    .me-topbar-secondary { grid-column: 2; grid-row: 1; }
    .me-map-role-strip {
      grid-template-columns: 1fr;
      align-content: center;
      gap: 0;
      padding: 5px 12px;
    }
    .me-map-role-strip strong {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
    }
    .me-map-role-strip span,
    .me-map-role-strip em {
      display: none;
    }
    .me-tabs {
      grid-column: 1 / -1;
      grid-row: 2;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
      min-width: 0;
      overflow: hidden;
      scrollbar-width: none;
    }
    .me-rain-mode .me-tabs {
      grid-column: 1;
      grid-row: 1;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-self: center;
      gap: 3px;
      padding: 2px;
      background: rgba(255,255,255,.86);
      border: 1px solid rgba(15,23,42,.06);
      box-shadow: 0 8px 22px rgba(15,23,42,.08);
    }
    .me-tabs::-webkit-scrollbar { display: none; }
    .me-tab[data-tab="rain"],
    .me-tab[data-tab="frontier"] {
      display: none;
    }
    .me-tab {
      min-width: 0;
      min-height: 34px;
      padding: 4px 3px;
      font-size: 10.5px;
      line-height: 1.15;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .me-tab-full { display: none; }
    .me-tab-short { display: inline; }
    .me-rain-mode .me-tab {
      flex: 0 0 auto;
      min-height: 29px;
      padding: 3px 6px;
      border-radius: 8px;
      font-size: 11.5px;
    }
    .me-filter-drawer { flex: 0 0 auto; }
    .me-filter-toggle {
      min-width: 96px;
      min-height: 44px;
      padding: 0 12px;
    }
    .me-filter-drawer[open] .me-filter-toggle {
      background: rgba(15,118,110,.12);
      border-color: rgba(15,118,110,.28);
      color: #0f766e;
    }
    .me-filter-display-group {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(15,23,42,.06);
    }
    .me-filter-panel {
      position: fixed;
      top: auto;
      right: 8px;
      left: 8px;
      bottom: calc(var(--me-mobile-action-space) + 8px);
      z-index: 80;
      width: auto;
      max-width: none;
      max-height: min(560px, calc(100dvh - var(--me-header-h) - var(--me-topbar-h) - var(--me-mobile-action-space) - 20px));
      border-radius: 22px 22px 16px 16px;
      box-shadow: 0 18px 42px rgba(15,23,42,.22);
      backdrop-filter: blur(12px);
    }
    .me-filter-open .me-rain-card,
    .me-filter-open .me-own-trail,
    .me-filter-open .me-layer-hint,
    .me-filter-open .me-locate-fab,
    .me-filter-open .me-legend {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .me-main { display: block; }
    .me-map-wrap { position: relative; width: 100%; margin-left: 0; }
    .me-map { min-height: var(--me-map-height); height: var(--me-map-height); }
    .me-start-panel {
      top: 10px;
      left: 10px;
      width: auto;
      max-width: calc(100% - 82px);
      padding: 5px;
    }
    .me-start-panel.is-collapsed {
      max-width: min(286px, calc(100% - 82px));
      grid-template-columns: auto;
      padding: 4px;
    }
    .me-start-panel.is-collapsed .me-start-panel-close {
      width: 34px;
      min-width: 34px;
      max-width: 34px;
      height: 34px;
      padding: 0;
    }
    .me-start-panel.is-collapsed .me-start-panel-brief {
      display: none;
    }
    .me-start-panel.is-collapsed .me-start-panel-grid {
      display: none;
    }
    .me-start-panel.is-collapsed .me-start-panel-location,
    .me-start-panel.is-collapsed .me-start-panel-grid a {
      width: 34px;
      min-height: 34px;
      border-radius: 9px;
    }
    .me-start-panel.is-collapsed .me-start-panel-location span,
    .me-start-panel.is-collapsed .me-start-panel-grid a span {
      width: 22px;
      height: 22px;
    }
    .me-start-panel-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 4px;
    }
    .me-start-panel-grid a {
      width: 38px;
      min-height: 38px;
      padding-inline: 0;
    }
    .me-purpose-hint {
      top: 10px;
      left: 10px;
      width: min(260px, calc(100% - 116px));
      padding: 10px 36px 10px 11px;
    }
    .me-purpose-hint strong { font-size: 12.5px; }
    .me-purpose-hint p { font-size: 11px; line-height: 1.4; }
    .me-rain-card {
      position: fixed;
      top: auto;
      left: 10px;
      right: 10px;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 38;
      width: auto;
      max-width: none;
      padding: 8px 8px 7px;
      gap: 5px;
      border-radius: 16px;
      box-shadow: 0 14px 30px rgba(15,23,42,.16);
      background: rgba(255,255,255,.92);
      transform: translate3d(0, 0, 0);
    }
    .me-rain-mode .me-rain-card {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "label timeline update"
        "source actions actions"
        "status status status";
      align-items: center;
      gap: 5px 7px;
      padding: 7px;
      border-radius: 18px;
    }
    .me-rain-card[data-sheet-open="1"] {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translate3d(0, 10px, 0);
    }
    .me-own-trail {
      position: fixed;
      left: 10px;
      right: 10px;
      bottom: calc(var(--me-mobile-action-space) + 10px);
      width: auto;
      padding: 8px;
      border-radius: 16px;
      z-index: 34;
    }
    .me-own-trail-list {
      grid-auto-columns: minmax(124px, 44vw);
    }
    .me-own-trail-item {
      min-height: 58px;
      grid-template-columns: 44px minmax(0, 1fr);
      padding: 6px;
    }
    .me-own-trail-item img {
      width: 44px;
      height: 44px;
    }
    .me-rain-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 6px;
    }
    .me-rain-mode .me-rain-head { display: contents; }
    .me-rain-mode .me-rain-head strong {
      grid-area: label;
      white-space: nowrap;
      font-size: 12px;
      line-height: 1.2;
    }
    .me-rain-head span {
      padding: 5px 7px;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
      font-size: 10px;
    }
    .me-rain-mode .me-rain-head span {
      grid-area: source;
      padding: 4px 7px;
      justify-self: start;
    }
    .me-rain-toggle {
      min-height: 28px;
      padding: 5px 9px;
      border-radius: 999px;
      font-size: 11px;
    }
    .me-rain-mode .me-rain-toggle {
      grid-area: update;
      min-height: 29px;
      padding: 4px 9px;
      justify-self: end;
    }
    .me-rain-timeline {
      display: flex;
      grid-template-columns: none;
      gap: 5px;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      padding: 0 18px 2px 1px;
      scroll-padding-inline: 8px 18px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      -webkit-mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent 100%);
      mask-image: linear-gradient(to right, #000 0, #000 calc(100% - 22px), transparent 100%);
    }
    .me-rain-mode .me-rain-timeline {
      grid-area: timeline;
      min-width: 0;
      padding-right: 16px;
    }
    .me-rain-timeline::-webkit-scrollbar { display: none; }
    .me-rain-time {
      flex: 0 0 auto;
      min-width: 58px;
      min-height: 30px;
      border-radius: 999px;
    }
    .me-rain-actions { gap: 7px; }
    .me-rain-mode .me-rain-actions {
      grid-area: actions;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      min-width: 0;
    }
    .me-rain-actions button {
      min-height: 34px;
      border-radius: 999px;
    }
    .me-rain-mode .me-rain-actions button {
      min-height: 30px;
      padding: 5px 9px;
      font-size: 12px;
    }
    .me-rain-status {
      max-height: 18px;
      overflow: hidden;
      font-size: 10px;
      line-height: 1.35;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .me-rain-mode .me-rain-status {
      grid-area: status;
      margin: 0;
      max-height: 16px;
    }
    .me-side { display: none; }
    .me-side-toggle { display: none; }
    .me-map-panel-selection { display: none; }
    .me-map-panel-insight {
      left: 12px;
      width: min(360px, calc(100% - 96px));
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
      bottom: calc(var(--me-mobile-action-space) + 8px);
      top: auto;
      max-width: calc(100% - 96px);
    }
    .me-locate-fab { bottom: calc(var(--me-mobile-action-space) + 8px); }
    .me-rain-mode.me-sheet-open .me-locate-fab {
      opacity: 0;
      pointer-events: none;
      transform: translate3d(0, 10px, 0);
    }
    .me-layer-hint {
      left: 10px;
      right: 10px;
      bottom: calc(var(--me-mobile-action-space) + 24px);
      max-width: none;
      flex-wrap: wrap;
      padding: 9px 10px;
    }
    .me-layer-hint span {
      flex: 1 1 100%;
    }
    .me-layer-hint-jump {
      flex: 1 1 auto;
      min-width: 0;
    }
    .me-bottom-sheet {
      display: block;
      position: fixed;
      border-radius: 22px 22px 0 0;
      left: 0;
      right: 0;
      bottom: calc(var(--me-mobile-action-space) + var(--me-mobile-sheet-clearance));
      z-index: 40;
      max-height: 62%;
      max-height: min(62dvh, calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance)));
    }
    .me-bottom-sheet--detail {
      max-height: 74%;
      max-height: min(74dvh, calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance)));
    }
    .me-bottom-sheet--detail[data-snap="peek"] {
      height: 34vh;
      max-height: 34vh;
      height: min(34dvh, 300px);
      max-height: min(34dvh, 300px);
    }
    .me-bottom-sheet--detail[data-snap="full"] {
      height: calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance));
      max-height: calc(100% - 8px);
      max-height: calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance));
    }
    .me-bottom-sheet--detail.is-dragging,
    .me-bottom-sheet--area.is-dragging {
      height: var(--me-sheet-drag-height);
      max-height: var(--me-sheet-drag-height);
      overflow-y: hidden;
      touch-action: none;
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
  .me-area-sheet-source-trust { font-size: 11px; font-weight: 800; color: #334155; align-self: center; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.06); white-space: nowrap; }
  .me-area-positive { display: grid; gap: 10px; margin: 0 0 12px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(255,255,255,.98) 58%, rgba(240,249,255,.9)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 10px 24px rgba(15,23,42,.055); }
  .me-area-positive-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .me-area-positive-head span { color: #047857; font-size: 10px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .me-area-positive-head strong { color: #10251a; font-size: 14px; line-height: 1.35; font-weight: 950; text-align: right; overflow-wrap: anywhere; }
  .me-area-positive-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .me-area-positive-card { min-width: 0; min-height: 98px; padding: 10px; border-radius: 10px; background: rgba(255,255,255,.86); border: 1px solid rgba(16,185,129,.13); overflow-wrap: anywhere; }
  .me-area-positive-card span { display: block; color: #047857; font-size: 10.5px; line-height: 1.25; font-weight: 950; }
  .me-area-positive-card em { display: inline-flex; margin-top: 6px; min-height: 22px; align-items: center; padding: 3px 7px; border-radius: 999px; background: rgba(20,184,166,.12); color: #0f766e; font-size: 10px; line-height: 1.2; font-style: normal; font-weight: 900; }
  .me-area-positive-card strong { display: block; margin-top: 7px; color: #10251a; font-size: 12px; line-height: 1.55; font-weight: 850; }
  .me-area-positive-records { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .me-area-positive-record { min-width: 0; display: grid; grid-template-rows: 70px auto auto; gap: 5px; padding: 7px; border-radius: 10px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.07); color: inherit; text-decoration: none; overflow: hidden; }
  .me-area-positive-record img, .me-area-positive-record > span { width: 100%; height: 70px; object-fit: cover; border-radius: 8px; background: linear-gradient(135deg, #ecfdf5, #f8fafc); display: grid; place-items: center; color: #047857; font-weight: 950; }
  .me-area-positive-record strong { color: #10251a; font-size: 11px; line-height: 1.3; font-weight: 900; overflow-wrap: anywhere; }
  .me-area-positive-record small { color: #64748b; font-size: 9.5px; line-height: 1.25; font-weight: 750; overflow-wrap: anywhere; }
  .me-area-positive-actions { display: flex; flex-wrap: wrap; gap: 7px; }
  .me-area-positive-actions a { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 7px 10px; border-radius: 999px; background: #10251a; color: #fff; font-size: 11px; line-height: 1.2; font-weight: 900; text-decoration: none; }
  .me-area-positive-actions a:nth-child(n+2) { background: rgba(255,255,255,.9); color: #0f766e; border: 1px solid rgba(16,185,129,.18); }
  .me-area-guide-stop { display: grid; gap: 10px; margin: 0 0 12px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(15,23,42,.96), rgba(12,74,110,.94)); border: 1px solid rgba(56,189,248,.28); box-shadow: 0 12px 28px rgba(15,23,42,.14); color: #f8fafc; }
  .me-area-guide-head { display: grid; gap: 3px; }
  .me-area-guide-head span { color: #7dd3fc; font-size: 10px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .me-area-guide-head strong { font-size: 15px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
  .me-area-guide-langs { display: flex; flex-wrap: wrap; gap: 6px; }
  .me-area-guide-langs button { min-height: 30px; border-radius: 999px; border: 1px solid rgba(255,255,255,.16); padding: 5px 9px; background: rgba(255,255,255,.08); color: rgba(224,242,254,.86); font-size: 11px; line-height: 1.1; font-weight: 900; cursor: pointer; }
  .me-area-guide-langs button.is-active { background: #f8fafc; border-color: #f8fafc; color: #0f172a; }
  .me-area-guide-lead { margin: 0; color: rgba(248,250,252,.86); font-size: 12px; line-height: 1.65; font-weight: 760; }
  .me-area-guide-points { display: grid; gap: 5px; margin: 0; padding-left: 18px; color: rgba(224,242,254,.94); font-size: 11.5px; line-height: 1.55; font-weight: 760; }
  .me-area-guide-status { display: grid; gap: 3px; padding: 9px 10px; border-radius: 10px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.10); }
  .me-area-guide-status span { font-size: 12px; line-height: 1.35; font-weight: 950; color: #f8fafc; }
  .me-area-guide-status small { font-size: 10.5px; line-height: 1.35; font-weight: 780; color: rgba(224,242,254,.82); }
  .me-area-guide-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .me-area-guide-actions button { min-height: 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,.14); padding: 9px 10px; font-size: 12px; line-height: 1.2; font-weight: 950; cursor: pointer; }
  .me-area-guide-locate { background: rgba(255,255,255,.12); color: #f8fafc; }
  .me-area-guide-play { background: #f8fafc; color: #0f172a; }
  .me-area-guide-play[disabled] { opacity: .46; cursor: not-allowed; }
  .me-area-guide-stop[data-guide-state="unlocked"] { border-color: rgba(134,239,172,.56); box-shadow: 0 12px 28px rgba(20,184,166,.20); }
  .me-area-guide-stop.is-speaking .me-area-guide-play { background: #bae6fd; color: #0c4a6e; }
  .me-area-guide-approval { justify-self: start; padding: 4px 8px; border-radius: 999px; background: rgba(125,211,252,.14); color: #bae6fd; font-size: 10px; line-height: 1.2; font-weight: 900; overflow-wrap: anywhere; }
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
  .me-area-next-step { display: grid; gap: 10px; margin: 0 0 12px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(240,253,250,.96), rgba(255,255,255,.98)); border: 1px solid rgba(15,118,110,.18); box-shadow: 0 10px 24px rgba(15,23,42,.06); }
  .me-area-next-step.is-restricted { background: linear-gradient(135deg, rgba(255,251,235,.98), rgba(255,255,255,.98)); border-color: rgba(217,119,6,.28); }
  .me-area-next-step-head { display: grid; gap: 3px; }
  .me-area-next-step-head span { color: #0f766e; font-size: 10px; line-height: 1.2; font-weight: 950; text-transform: uppercase; letter-spacing: .08em; }
  .me-area-next-step.is-restricted .me-area-next-step-head span { color: #b45309; }
  .me-area-next-step-head strong { color: #0f172a; font-size: 14px; line-height: 1.35; font-weight: 950; overflow-wrap: anywhere; }
  .me-area-next-step ul { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: #334155; font-size: 12px; line-height: 1.5; font-weight: 760; }
  .me-area-next-step li { padding-left: 1px; }
  .me-area-next-step-cta { justify-self: start; display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 8px 12px; border-radius: 10px; background: #0f766e; color: #fff !important; font-size: 12px; line-height: 1.2; font-weight: 950; text-decoration: none; box-shadow: 0 7px 16px rgba(15,118,110,.22); }
  .me-area-next-step-cta:hover { filter: brightness(1.05); }
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
  .me-area-safety strong,
  .me-area-action-note strong {
    display: inline-block;
    margin-bottom: 2px;
    color: #78350f;
  }

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
      bottom: calc(var(--me-mobile-action-space) + var(--me-mobile-sheet-clearance));
      max-height: 86%;
      max-height: calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance));
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: 22px 22px 0 0;
    }
    .me-bottom-sheet.me-bottom-sheet--area[data-snap="peek"] {
      height: 44vh;
      max-height: 44vh;
      height: min(44dvh, calc(100dvh - var(--me-header-h) - 112px), 380px);
      max-height: min(44dvh, calc(100dvh - var(--me-header-h) - 112px), 380px);
    }
    .me-bottom-sheet.me-bottom-sheet--area[data-snap="full"] {
      height: calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance));
      max-height: calc(100% - 8px);
      max-height: calc(100dvh - var(--me-header-h) - var(--me-mobile-action-space) - var(--me-mobile-sheet-clearance));
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
    .me-bottom-sheet.me-bottom-sheet--area .me-area-positive-grid,
    .me-bottom-sheet.me-bottom-sheet--area .me-area-positive-records {
      grid-template-columns: 1fr;
    }
  }
  .map-explorer :where(button,a){min-height:44px}
  .map-explorer :where(button){min-width:44px}
  .map-explorer input:not([type=checkbox]):not([type=radio]):not([type=range]){min-height:44px}
  .map-explorer .maplibregl-ctrl button{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
  .map-explorer :where(.me-area-source-opt,.me-trace-toggle-label,.me-basemap-opt){min-width:44px;min-height:44px}
  .map-explorer input[type=range]{min-height:44px}
  .map-explorer .me-start-panel.is-collapsed .me-start-panel-close{width:44px!important;min-width:44px!important;max-width:44px!important;height:44px!important;min-height:44px!important}
  .map-explorer .me-legend.is-collapsed .me-legend-toggle{width:44px;min-width:44px;min-height:44px}
  .map-explorer :where(.me-area-source-opt,.me-trace-toggle-label,.me-basemap-opt):has(input:focus-visible){outline:3px solid rgba(14,165,233,.42);outline-offset:2px}
`;
