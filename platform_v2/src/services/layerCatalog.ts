/**
 * Overlay catalog — single source of truth for tiled raster overlays the
 * map explorer can stack on top of the active basemap. Keeping them here
 * means new overlays (forest change, NDVI, conservation mesh) get one
 * well-known shape and the client doesn't need to grow another switch
 * statement per tile provider.
 *
 * Design notes:
 * - Each overlay ships an id, localized labels, a tiles template, an
 *   attribution string, and an optional legend strip for the UI.
 * - The client fetches this catalog once (inlined into the SSR payload,
 *   not via API) and toggles layers client-side; tiles are fetched
 *   directly from the providers by MapLibre.
 * - Tile URL patterns are public, no-auth-needed endpoints. The `notes`
 *   field records any caveats (coverage area, exp status) the client can
 *   show as a tooltip.
 */

export type OverlayCategory = "terrain" | "landcover" | "conservation";

export type OverlayDefinition = {
  id: string;
  category: OverlayCategory;
  /** URL template with {z}/{x}/{y} placeholders. */
  tiles: string;
  tileSize?: number;
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
  /** 0-1, default 0.7. */
  defaultOpacity?: number;
  labels: Record<"ja" | "en" | "es" | "pt-BR", { label: string; note?: string }>;
  /** Optional CSS gradient for a legend strip. */
  legendGradient?: string;
  legendLow?: Record<"ja" | "en" | "es" | "pt-BR", string>;
  legendHigh?: Record<"ja" | "en" | "es" | "pt-BR", string>;
};

/**
 * Curated overlays. Focus on "free, CORS-friendly, relevant to Japan
 * biodiversity work" rather than dumping every tile service into the UI.
 */
export const OVERLAYS: OverlayDefinition[] = [
  {
    id: "gsi_hillshade",
    category: "terrain",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/hillshademap/{z}/{x}/{y}.png",
    attribution: "国土地理院 陰影起伏図",
    maxzoom: 16,
    defaultOpacity: 0.6,
    labels: {
      ja: { label: "陰影起伏（地形）", note: "地形の凹凸を読む。谷筋や尾根を見つけて、次の散歩ルートの根拠にする。" },
      en: { label: "Hillshade (terrain)", note: "GSI shaded relief — read valleys and ridges." },
      es: { label: "Relieve sombreado", note: "Relieve sombreado del GSI — lee valles y crestas." },
      "pt-BR": { label: "Sombreamento (relevo)", note: "Relevo sombreado do GSI — leia vales e cumeeiras." },
    },
  },
  {
    id: "gsi_relief",
    category: "terrain",
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png",
    attribution: "国土地理院 色別標高図",
    maxzoom: 15,
    defaultOpacity: 0.55,
    labels: {
      ja: { label: "色別標高（植生ヒント）", note: "標高の色分け。標高帯でおおよその植生を推測できる。" },
      en: { label: "Elevation colors", note: "GSI elevation tint — a rough proxy for vegetation bands." },
      es: { label: "Color por altitud", note: "Tinte de altitud del GSI — aproximación a franjas de vegetación." },
      "pt-BR": { label: "Cor por altitude", note: "Tinte de altitude do GSI — banda aproximada de vegetação." },
    },
    legendGradient: "linear-gradient(90deg,#1e40af,#059669,#a16207,#b91c1c,#ffffff)",
    legendLow: { ja: "低地", en: "Low", es: "Baja", "pt-BR": "Baixa" },
    legendHigh: { ja: "高地", en: "High", es: "Alta", "pt-BR": "Alta" },
  },
  {
    id: "gsi_vegetation",
    category: "landcover",
    // Experimental GSI land-classification raster. Not every tile is
    // populated outside metro areas; the client can still toggle it.
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/vbm/{z}/{x}/{y}.png",
    attribution: "国土地理院 植生図（試験公開）",
    maxzoom: 15,
    defaultOpacity: 0.55,
    labels: {
      ja: { label: "植生ベース（試験）", note: "国交省・国土地理院の植生区分。公開範囲が狭いため、試験扱い。" },
      en: { label: "Vegetation base (beta)", note: "GSI vegetation classification — partial coverage." },
      es: { label: "Vegetación (beta)", note: "Clasificación de vegetación GSI — cobertura parcial." },
      "pt-BR": { label: "Vegetação (beta)", note: "Classificação de vegetação do GSI — cobertura parcial." },
    },
  },
  {
    id: "gsi_ort_old10",
    category: "landcover",
    // 1984-1986 historical aerial — useful for "then vs now" forest change.
    tiles: "https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png",
    attribution: "国土地理院 1984-1986年空中写真",
    maxzoom: 17,
    defaultOpacity: 0.85,
    labels: {
      ja: { label: "1984年の空撮（変化を見る）", note: "約40年前の空中写真。現在の衛星と切り替えて、森林や川筋の変化を重ねる。" },
      en: { label: "1984 aerial (change)", note: "40-year-old aerial imagery for before/after comparisons." },
      es: { label: "Aérea 1984 (cambio)", note: "Imagen aérea de hace 40 años — comparaciones antes/después." },
      "pt-BR": { label: "Aérea 1984 (mudança)", note: "Imagem aérea de 40 anos atrás — comparações antes/depois." },
    },
  },
  // --- Global overlays surfaced by codex research (Apr 2026) ------------
  // Each URL was cross-referenced against official docs (NASA GIBS API,
  // Esri ArcGIS Living Atlas tile docs) and chosen for CORS-friendliness
  // and relevance to biodiversity / landcover / conservation framing.
  {
    id: "esa_worldcover",
    category: "landcover",
    tiles:
      "https://tiles.arcgis.com/tiles/F7DSX1DSNSiWmOqh/arcgis/rest/services/landcover_tilepackage/MapServer/tile/{z}/{y}/{x}",
    attribution: "ESA WorldCover 10m via Esri Living Atlas",
    maxzoom: 12,
    defaultOpacity: 0.45,
    labels: {
      ja: { label: "世界土地被覆 10m（ESA）", note: "ESA が Sentinel-2 で分類した 10m 精度の土地被覆。森林・草地・農地・湿地・水域などを色分けで重ねる。" },
      en: { label: "World Cover 10m (ESA)", note: "ESA Sentinel-2 10m land-cover classes: forest, grassland, cropland, wetland, water, etc." },
      es: { label: "Cobertura mundial 10m (ESA)", note: "Clases de cobertura del suelo de ESA a 10 m: bosque, pastizal, cultivo, humedal, agua." },
      "pt-BR": { label: "Cobertura mundial 10m (ESA)", note: "Classes de cobertura do solo da ESA a 10 m: floresta, pastagem, agricultura, wetland, água." },
    },
  },
  {
    id: "world_ecosystems",
    category: "landcover",
    tiles:
      "https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Ecosystems/MapServer/tile/{z}/{y}/{x}",
    attribution: "USGS/Esri World Ecosystems",
    maxzoom: 10,
    defaultOpacity: 0.45,
    labels: {
      ja: { label: "世界生態系区分（USGS/Esri）", note: "気候・地形・植生の組み合わせで分類した生態系ユニット。同じ「平地温帯林」がどこに広がるかを俯瞰できる。" },
      en: { label: "World Ecosystems (USGS/Esri)", note: "Ecosystem units combining climate, landform, and vegetation — see where similar systems extend." },
      es: { label: "Ecosistemas del mundo", note: "Unidades ecosistémicas por clima, relieve y vegetación — visión global de sistemas similares." },
      "pt-BR": { label: "Ecossistemas do mundo", note: "Unidades ecossistêmicas combinando clima, relevo e vegetação." },
    },
  },
  {
    id: "conservation_priority",
    category: "conservation",
    tiles:
      "https://tiles.arcgis.com/tiles/IkktFdUAcY3WrH25/arcgis/rest/services/Percent_total_terrestrial_025/MapServer/tile/{z}/{y}/{x}",
    attribution: "Global Safety Net — terrestrial conservation priority",
    maxzoom: 9,
    defaultOpacity: 0.3,
    labels: {
      ja: { label: "地球保全優先度（30×30 の下敷き）", note: "「あと 25% を保全するとしたらどこか」を示す世界メッシュ。30×30 議論や自然共生サイト選定の下敷きに。" },
      en: { label: "Global conservation priority (25% target)", note: "Where to protect next — grid priorities underpinning 30×30 conversations." },
      es: { label: "Prioridad de conservación global", note: "Cuadrícula global de prioridades de protección (objetivo 25%)." },
      "pt-BR": { label: "Prioridade global de conservação", note: "Grade global de prioridades de proteção (meta 25%)." },
    },
  },
  {
    id: "nasa_impervious",
    category: "landcover",
    tiles:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_Global_Man-made_Impervious_Surface/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png",
    attribution: "NASA GIBS / Landsat Man-made Impervious Surface",
    maxzoom: 12,
    defaultOpacity: 0.5,
    labels: {
      ja: { label: "人工構造物（NASA GIBS）", note: "舗装・建築など人工の不浸透面。市民観察と重ねて「都市の裂け目に残る自然」を見つけやすくする。" },
      en: { label: "Impervious surface (NASA)", note: "Built/paved surfaces — overlay to find the nature surviving in urban seams." },
      es: { label: "Superficie impermeable (NASA)", note: "Superficies construidas/pavimentadas — naturaleza que sobrevive en costuras urbanas." },
      "pt-BR": { label: "Superfície impermeável (NASA)", note: "Superfícies construídas/pavimentadas — natureza que resiste nas costuras urbanas." },
    },
  },
  {
    id: "nasa_canopy",
    category: "landcover",
    tiles:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GEDI_ISS_L3_Canopy_Height_Mean_RH100_201904-202303/default/2019-04-18/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
    attribution: "NASA GEDI / Canopy Height (2019-2023)",
    maxzoom: 7,
    defaultOpacity: 0.45,
    labels: {
      ja: { label: "樹冠高（NASA GEDI）", note: "宇宙ステーション搭載 LiDAR で測った平均樹冠高。森の厚みを定量視化し、観察メッシュ・保全優先度と重ねる。" },
      en: { label: "Canopy height (NASA GEDI)", note: "Mean canopy height from ISS LiDAR — stack on top of observations to see forest thickness." },
      es: { label: "Altura del dosel (GEDI)", note: "Altura media del dosel medida con LiDAR desde la ISS." },
      "pt-BR": { label: "Altura do dossel (GEDI)", note: "Altura média do dossel medida por LiDAR na ISS." },
    },
  },
];

export type LocalizedOverlay = {
  id: string;
  category: OverlayCategory;
  tiles: string;
  tileSize: number;
  attribution: string;
  minzoom?: number;
  maxzoom?: number;
  defaultOpacity: number;
  label: string;
  note?: string;
  legendGradient?: string;
  legendLow?: string;
  legendHigh?: string;
};

export function overlaysForLang(lang: "ja" | "en" | "es" | "pt-BR"): LocalizedOverlay[] {
  return OVERLAYS.map((o) => ({
    id: o.id,
    category: o.category,
    tiles: o.tiles,
    tileSize: o.tileSize ?? 256,
    attribution: o.attribution,
    minzoom: o.minzoom,
    maxzoom: o.maxzoom,
    defaultOpacity: o.defaultOpacity ?? 0.65,
    label: o.labels[lang]?.label ?? o.id,
    note: o.labels[lang]?.note,
    legendGradient: o.legendGradient,
    legendLow: o.legendLow?.[lang],
    legendHigh: o.legendHigh?.[lang],
  }));
}
