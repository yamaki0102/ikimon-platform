/**
 * Sentinel-2 NDVI / NDWI statistics via Microsoft Planetary Computer (MPC) STAC.
 *
 * Why MPC and not ESA CDSE: MPC's STAC + statistics API is fully anonymous for
 * Sentinel-2 L2A and supports point-radius queries directly, so we don't need
 * to manage OAuth tokens for the nightly worker.
 *
 *   POST https://planetarycomputer.microsoft.com/api/data/v1/item/statistics
 *
 * The worker calls fetchVegetationIndicesForPoint(lat, lng, radiusM) once per
 * place per night, taking the most recent low-cloud Sentinel-2 scene that
 * intersects a small bbox around the centre point.
 *
 * If MPC_DISABLED=1 (or the env is misconfigured) the helper returns null so
 * the worker can still run as a no-op against staging without API keys.
 */

const DEFAULT_STAC_BASE = "https://planetarycomputer.microsoft.com/api/stac/v1";
const DEFAULT_DATA_BASE = "https://planetarycomputer.microsoft.com/api/data/v1";

export interface SentinelIndicesPoint {
  observedOn: string;       // YYYY-MM-DD of the source scene
  ndviMean: number | null;   // -1..+1, vegetation greenness
  ndviMax: number | null;
  ndwiMean: number | null;   // -1..+1, water / moisture
  cloudPct: number;          // 0..100, scene-level cloud cover
  itemId: string;            // STAC item id (sceneId for traceability)
  collection: string;        // sentinel-2-l2a
  sourceUrl: string;         // STAC item self link, recorded into source_snapshots
  rawAssetHref: string;      // visual or B04/B08 asset href, for forensics only
}

export interface SearchOptions {
  /** Look-back window in days (default 30). */
  daysBack?: number;
  /** Max cloud cover percent the scene is allowed to have (default 30). */
  maxCloud?: number;
  /** Override base URL (set MPC_STAC_API_URL or pass explicitly). */
  baseUrl?: string;
}

/** ~radiusM around the centre point, expressed as a STAC bbox. */
function bboxAround(lat: number, lng: number, radiusM: number): [number, number, number, number] {
  const r = Math.max(50, Math.min(20000, radiusM));
  const dLat = r / 111000;
  const dLng = r / (111000 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function isoDateBack(daysBack: number): string {
  const d = new Date(Date.now() - daysBack * 86_400_000);
  return d.toISOString().slice(0, 10);
}

interface StacFeature {
  id: string;
  collection?: string;
  properties?: {
    "datetime"?: string;
    "eo:cloud_cover"?: number;
    "s2:high_proba_clouds_percentage"?: number;
  };
  assets?: Record<string, { href: string; type?: string }>;
  links?: Array<{ rel: string; href: string }>;
}

interface StacSearchResponse {
  features: StacFeature[];
}

async function searchLowCloudScene(
  baseUrl: string,
  bbox: [number, number, number, number],
  daysBack: number,
  maxCloud: number,
): Promise<StacFeature | null> {
  const body = {
    "collections": ["sentinel-2-l2a"],
    "bbox": bbox,
    "datetime": `${isoDateBack(daysBack)}/..`,
    "query": { "eo:cloud_cover": { "lt": maxCloud } },
    "sortby": [{ "field": "properties.datetime", "direction": "desc" }],
    "limit": 1,
  };
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`MPC STAC search HTTP ${response.status}`);
  }
  const payload = (await response.json()) as StacSearchResponse;
  const first = payload?.features?.[0];
  return first ?? null;
}

/**
 * Compute NDVI / NDWI mean+max for a Sentinel-2 scene over a small bbox via
 * MPC's Statistics API. No raster bytes are fetched in-process — MPC's
 * server-side reduce returns the summary directly.
 *
 *   POST {dataBase}/item/{collection}/{item}/statistics
 *   Body: { expression, geojson: <Feature> }
 *
 * The expression must reference Sentinel-2 L2A asset names. We compute:
 *   NDVI = (B08 - B04) / (B08 + B04)
 *   NDWI = (B03 - B08) / (B03 + B08)
 */
async function fetchExpressionStatistics(
  dataBase: string,
  collection: string,
  itemId: string,
  expression: string,
  bbox: [number, number, number, number],
): Promise<{ mean: number | null; max: number | null }> {
  const [w, s, e, n] = bbox;
  const polygon = {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
    properties: {},
  };
  // MPC titiler-pgstac shape: collection / item / expression are query params,
  // not path params. asset_as_band=true lets the expression reference assets
  // by name (B04, B08, B03) instead of asset+band index.
  const params = new URLSearchParams({
    collection,
    item: itemId,
    expression,
    asset_as_band: "true",
  });
  const url = `${dataBase.replace(/\/$/, "")}/item/statistics?${params.toString()}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(polygon),
  });
  if (!response.ok) {
    return { mean: null, max: null };
  }
  // Response shape (titiler): { type:"Feature", properties: { statistics: { "<expr>": { mean, max, ... } } } }
  const payload = await response.json().catch(() => null) as
    | { properties?: { statistics?: Record<string, { mean?: number; max?: number }> } }
    | null;
  const stats = payload?.properties?.statistics ?? null;
  if (!stats) return { mean: null, max: null };
  const firstBand = Object.values(stats)[0];
  if (!firstBand) return { mean: null, max: null };
  return {
    mean: typeof firstBand.mean === "number" && Number.isFinite(firstBand.mean) ? firstBand.mean : null,
    max: typeof firstBand.max === "number" && Number.isFinite(firstBand.max) ? firstBand.max : null,
  };
}

/**
 * Public entrypoint: returns the most recent low-cloud Sentinel-2 scene
 * intersecting a (lat, lng) point with NDVI / NDWI summary statistics, or
 * null when MPC is disabled / the scene cannot be found / fetch fails.
 *
 * Phase 3-1b: ndviMean / ndviMax / ndwiMean are filled by MPC's server-side
 * Statistics API (no in-process raster fetch). Failures fall back to null so
 * the writer still records the scene lineage even if statistics are missing.
 */
export async function fetchSentinelSceneForPoint(
  lat: number,
  lng: number,
  radiusM: number,
  options: SearchOptions = {},
): Promise<SentinelIndicesPoint | null> {
  if (process.env.MPC_DISABLED === "1") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const baseUrl = options.baseUrl ?? process.env.MPC_STAC_API_URL ?? DEFAULT_STAC_BASE;
  const bbox = bboxAround(lat, lng, radiusM);
  const daysBack = options.daysBack ?? 30;
  const maxCloud = options.maxCloud ?? 30;
  const feature = await searchLowCloudScene(baseUrl, bbox, daysBack, maxCloud).catch((err) => {
    console.warn("[sentinelStatistics] search failed", err?.message ?? err);
    return null;
  });
  if (!feature) return null;
  const observedOn = String(feature.properties?.["datetime"] ?? "").slice(0, 10);
  const cloudPct = Number(feature.properties?.["eo:cloud_cover"] ?? 0);
  const selfLink = feature.links?.find((l) => l.rel === "self")?.href ?? "";
  const visualAsset = feature.assets?.["visual"]?.href
    ?? feature.assets?.["B04"]?.href
    ?? "";
  const collection = feature.collection ?? "sentinel-2-l2a";
  const dataBase = process.env.MPC_DATA_API_URL ?? DEFAULT_DATA_BASE;
  // Fetch NDVI + NDWI in parallel; either can fail independently.
  const [ndvi, ndwi] = await Promise.all([
    fetchExpressionStatistics(dataBase, collection, feature.id, "(B08-B04)/(B08+B04)", bbox)
      .catch(() => ({ mean: null, max: null })),
    fetchExpressionStatistics(dataBase, collection, feature.id, "(B03-B08)/(B03+B08)", bbox)
      .catch(() => ({ mean: null, max: null })),
  ]);
  return {
    observedOn,
    ndviMean: ndvi.mean,
    ndviMax: ndvi.max,
    ndwiMean: ndwi.mean,
    cloudPct,
    itemId: feature.id,
    collection,
    sourceUrl: selfLink,
    rawAssetHref: visualAsset,
  };
}

export const __test__ = { bboxAround, isoDateBack };
