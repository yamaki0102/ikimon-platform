export const MSIL_SOURCE_NOTICE =
  "このサービスは、海しるAPIを利用して取得した情報をもとに作成しているが、サービスの内容は海上保安庁によって保証されたものではない";

export type PublicEnvironmentLayerId =
  | "msil_esi"
  | "msil_depth_contour"
  | "msil_aquarium";

export type PublicEnvironmentLayerSource = "msil_api";

export type PublicEnvironmentLayerBbox = [number, number, number, number];

type FetchLike = typeof fetch;

interface MsilLayerDefinition {
  readonly id: PublicEnvironmentLayerId;
  readonly title: string;
  readonly category: "coastal_context" | "education";
  readonly apiPath: string;
  readonly apiVersion: "v2";
  readonly mapServerLayer: string;
  readonly attribution: string;
  readonly maxPages: number;
}

export interface PublicEnvironmentLayerPayload {
  readonly id: PublicEnvironmentLayerId;
  readonly title: string;
  readonly source: PublicEnvironmentLayerSource;
  readonly category: MsilLayerDefinition["category"];
  readonly attribution: string;
  readonly fetchedAt: string;
  readonly featureCount: number;
  readonly truncated: boolean;
  readonly featureCollection: {
    readonly type: "FeatureCollection";
    readonly features: unknown[];
  };
}

export interface PublicEnvironmentLayersResponse {
  readonly layers: PublicEnvironmentLayerPayload[];
  readonly notices: string[];
}

export class PublicEnvironmentLayerError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, statusCode: number, message = code) {
    super(message);
    this.name = "PublicEnvironmentLayerError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const DEFAULT_PUBLIC_ENVIRONMENT_LAYER_IDS: readonly PublicEnvironmentLayerId[] = [
  "msil_esi",
  "msil_aquarium",
];

const MSIL_LAYER_DEFINITIONS: readonly MsilLayerDefinition[] = [
  {
    id: "msil_esi",
    title: "海岸線種類（環境脆弱性指標 ESI）",
    category: "coastal_context",
    apiPath: "coastline-type-ESI",
    apiVersion: "v2",
    mapServerLayer: "1",
    attribution: "海上保安庁 海洋状況表示システム（海しる）API",
    maxPages: 2,
  },
  {
    id: "msil_depth_contour",
    title: "等深線",
    category: "coastal_context",
    apiPath: "depth-contour",
    apiVersion: "v2",
    mapServerLayer: "10",
    attribution: "海上保安庁 海洋状況表示システム（海しる）API",
    maxPages: 1,
  },
  {
    id: "msil_aquarium",
    title: "水族館",
    category: "education",
    apiPath: "aquarium",
    apiVersion: "v2",
    mapServerLayer: "1",
    attribution: "海上保安庁 海洋状況表示システム（海しる）API",
    maxPages: 2,
  },
];

const MSIL_LAYER_BY_ID = new Map(MSIL_LAYER_DEFINITIONS.map((definition) => [definition.id, definition]));
const DEFAULT_MSIL_BASE_URL = "https://api.msil.go.jp/";
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_BBOX_AREA_DEGREES = 6;
const MAX_FEATURES_PER_LAYER = 2000;

const responseCache = new Map<string, { expiresAt: number; payload: PublicEnvironmentLayerPayload }>();

export function clearPublicEnvironmentLayerCache(): void {
  responseCache.clear();
}

export function isPublicEnvironmentLayerId(value: string): value is PublicEnvironmentLayerId {
  return MSIL_LAYER_BY_ID.has(value as PublicEnvironmentLayerId);
}

export function isPublicEnvironmentLayerBboxSupported(bbox: PublicEnvironmentLayerBbox): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return false;
  const width = maxLng - minLng;
  const height = maxLat - minLat;
  if (width <= 0 || height <= 0) return false;
  return width * height <= MAX_BBOX_AREA_DEGREES;
}

export function parsePublicEnvironmentLayerIds(raw: unknown): {
  layerIds: PublicEnvironmentLayerId[];
  invalidLayerIds: string[];
} {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { layerIds: [...DEFAULT_PUBLIC_ENVIRONMENT_LAYER_IDS], invalidLayerIds: [] };
  }
  const seen = new Set<PublicEnvironmentLayerId>();
  const invalidLayerIds: string[] = [];
  for (const item of raw.split(",")) {
    const value = item.trim();
    if (!value) continue;
    if (!isPublicEnvironmentLayerId(value)) {
      invalidLayerIds.push(value);
      continue;
    }
    seen.add(value);
  }
  return { layerIds: [...seen], invalidLayerIds };
}

export async function getPublicEnvironmentLayers(input: {
  bbox: PublicEnvironmentLayerBbox;
  layerIds: readonly PublicEnvironmentLayerId[];
  subscriptionKey?: string;
  fetchImpl?: FetchLike;
  now?: Date;
  msilBaseUrl?: string;
}): Promise<PublicEnvironmentLayersResponse> {
  const subscriptionKey = input.subscriptionKey?.trim();
  if (!subscriptionKey) {
    throw new PublicEnvironmentLayerError("msil_subscription_key_not_configured", 503);
  }
  if (!isPublicEnvironmentLayerBboxSupported(input.bbox)) {
    throw new PublicEnvironmentLayerError("bbox_too_large_or_invalid", 400);
  }

  const now = input.now ?? new Date();
  const layers = await Promise.all(input.layerIds.map((layerId) => fetchMsilLayer({
    bbox: input.bbox,
    definition: requireLayerDefinition(layerId),
    fetchImpl: input.fetchImpl ?? fetch,
    msilBaseUrl: input.msilBaseUrl ?? DEFAULT_MSIL_BASE_URL,
    now,
    subscriptionKey,
  })));

  return {
    layers,
    notices: [MSIL_SOURCE_NOTICE],
  };
}

function requireLayerDefinition(layerId: PublicEnvironmentLayerId): MsilLayerDefinition {
  const definition = MSIL_LAYER_BY_ID.get(layerId);
  if (!definition) throw new PublicEnvironmentLayerError("unsupported_public_environment_layer", 400);
  return definition;
}

async function fetchMsilLayer(input: {
  bbox: PublicEnvironmentLayerBbox;
  definition: MsilLayerDefinition;
  fetchImpl: FetchLike;
  msilBaseUrl: string;
  now: Date;
  subscriptionKey: string;
}): Promise<PublicEnvironmentLayerPayload> {
  const cacheKey = [
    input.definition.id,
    normalizeBboxForCache(input.bbox),
  ].join("|");
  const cached = responseCache.get(cacheKey);
  const nowMs = input.now.getTime();
  if (cached && cached.expiresAt > nowMs) return cached.payload;

  const features: unknown[] = [];
  let truncated = false;
  for (let page = 0; page < input.definition.maxPages; page += 1) {
    const resultOffset = page * 1000;
    const collection = await requestMsilFeatureCollection({ ...input, resultOffset });
    const pageFeatures = Array.isArray(collection.features) ? collection.features : [];
    for (const feature of pageFeatures) {
      if (features.length >= MAX_FEATURES_PER_LAYER) {
        truncated = true;
        break;
      }
      features.push(feature);
      if (features.length >= MAX_FEATURES_PER_LAYER) {
        truncated = true;
        break;
      }
    }
    if (features.length >= MAX_FEATURES_PER_LAYER) break;
    if (collection.exceededTransferLimit !== true) break;
    if (page === input.definition.maxPages - 1) truncated = true;
  }

  const payload: PublicEnvironmentLayerPayload = {
    id: input.definition.id,
    title: input.definition.title,
    source: "msil_api",
    category: input.definition.category,
    attribution: input.definition.attribution,
    fetchedAt: input.now.toISOString(),
    featureCount: features.length,
    truncated,
    featureCollection: {
      type: "FeatureCollection",
      features,
    },
  };
  responseCache.set(cacheKey, { expiresAt: nowMs + CACHE_TTL_MS, payload });
  return payload;
}

async function requestMsilFeatureCollection(input: {
  bbox: PublicEnvironmentLayerBbox;
  definition: MsilLayerDefinition;
  fetchImpl: FetchLike;
  msilBaseUrl: string;
  resultOffset: number;
  subscriptionKey: string;
}): Promise<{ type: "FeatureCollection"; features: unknown[]; exceededTransferLimit?: boolean }> {
  const url = new URL(
    `${input.definition.apiPath}/${input.definition.apiVersion}/MapServer/${input.definition.mapServerLayer}/query`,
    ensureTrailingSlash(input.msilBaseUrl),
  );
  url.searchParams.set("f", "geojson");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", input.bbox.join(","));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("outFields", "*");
  url.searchParams.set("resultRecordCount", "1000");
  if (input.resultOffset > 0) {
    url.searchParams.set("resultOffset", String(input.resultOffset));
  }

  const response = await input.fetchImpl(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "Ocp-Apim-Subscription-Key": input.subscriptionKey,
      "User-Agent": "ikimon.life-public-environment-layers (https://ikimon.life)",
    },
  });
  if (!response.ok) {
    throw new PublicEnvironmentLayerError("msil_fetch_failed", 502, `msil_fetch_failed:${response.status}`);
  }
  const payload = await response.json() as unknown;
  if (!isFeatureCollection(payload)) {
    throw new PublicEnvironmentLayerError("msil_invalid_geojson", 502);
  }
  return payload;
}

function isFeatureCollection(value: unknown): value is { type: "FeatureCollection"; features: unknown[]; exceededTransferLimit?: boolean } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "FeatureCollection" && Array.isArray(record.features);
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeBboxForCache(bbox: PublicEnvironmentLayerBbox): string {
  return bbox.map((value) => value.toFixed(5)).join(",");
}
