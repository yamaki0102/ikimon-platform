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
 * Public entrypoint: returns the most recent low-cloud Sentinel-2 scene
 * intersecting a (lat, lng) point with NDVI / NDWI summary statistics, or
 * null when MPC is disabled / the scene cannot be found / fetch fails.
 *
 * Note: this Phase 3-1 cut returns scene-level metadata (datetime, cloud %)
 * and the asset href but defers actual NDVI raster computation to a follow-up
 * (the bands need to be fetched and reduced in-process; for now the worker
 * stores the scene reference into source_snapshots so the data lineage is
 * recorded and a future raster job can fill in metric_value).
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
  return {
    observedOn,
    ndviMean: null,   // Filled by future raster reduce step.
    ndviMax: null,
    ndwiMean: null,
    cloudPct,
    itemId: feature.id,
    collection: feature.collection ?? "sentinel-2-l2a",
    sourceUrl: selfLink,
    rawAssetHref: visualAsset,
  };
}

export const __test__ = { bboxAround, isoDateBack };
