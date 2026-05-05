/**
 * Area Polygons — bbox-prefiltered GeoJSON FeatureCollection of registered
 * `observation_fields` polygons. Drives the new "click an area" layer on /ja/map.
 *
 * No PostGIS: we filter rows whose stored bbox overlaps the viewport bbox via
 * the BTREE index added in migration 0079. For Phase 1 the polygon JSONB is
 * returned verbatim; large admin polygons (Phase 2) will go through
 * `geom_simplified`.
 *
 * 60s in-memory TTL per (precise bbox / source / zoom bucket) so panning
 * burst-clicks don't hit the DB on every moveend.
 */
import { getPool } from "../db.js";
import type { FieldSource } from "./observationFieldRegistry.js";

export type AreaPolygonSource =
  | FieldSource
  | "osm_park"
  | "admin_municipality"
  | "admin_prefecture"
  | "admin_country";

export interface AreaPolygonFeatureProps {
  field_id: string;
  name: string;
  source: AreaPolygonSource;
  source_label: string;
  admin_level: string | null;
  prefecture: string;
  city: string;
  area_ha: number | null;
  official_url: string;
  center: [number, number]; // [lng, lat]
  transient?: boolean;
  entity_key?: string;
  osm_type?: string;
  osm_id?: number;
}

export interface AreaPolygonFeature {
  type: "Feature";
  properties: AreaPolygonFeatureProps;
  geometry: Record<string, unknown> | null;
}

export interface AreaPolygonCollection {
  type: "FeatureCollection";
  features: AreaPolygonFeature[];
  truncated: boolean;
}

export interface AreaPolygonsQuery {
  bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  zoom?: number;
  sources?: AreaPolygonSource[];
  limit?: number;
}

const SOURCE_LABEL: Record<AreaPolygonSource, string> = {
  user_defined: "マイフィールド",
  nature_symbiosis_site: "自然共生サイト",
  tsunag: "TSUNAG",
  protected_area: "保護区",
  oecm: "OECM",
  osm_park: "公園 (OSM)",
  admin_municipality: "市町村",
  admin_prefecture: "都道府県",
  admin_country: "国",
};

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 1000;
const CACHE_TTL_MS = 60_000;
const LIVE_OSM_TIMEOUT_MS = 4_500;
const LIVE_OSM_MAX_SPAN_DEGREES = 0.18;
const LIVE_OSM_MIN_ZOOM = 13;
const LIVE_OSM_SOURCES = new Set<AreaPolygonSource>(["osm_park", "user_defined"]);
const LIVE_OSM_TILE_Z = 14;
const LIVE_OSM_TILE_SCHEMA = "osm-area-live-v1";
const LIVE_OSM_TILE_SOURCE = "overpass";
const LIVE_OSM_SUCCESS_TTL_DAYS = 7;

type OverpassElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
  center?: { lat?: number; lon?: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
};

interface CacheEntry {
  expires: number;
  payload: AreaPolygonCollection;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(query: AreaPolygonsQuery): string {
  // Small OSM park polygons are click targets. Coarse 0.1 degree rounding can
  // reuse a response from several kilometers away and make the actual park
  // disappear from the interactive area layer.
  const [w, s, e, n] = query.bbox.map((v) => Number(v).toFixed(5));
  const z = Math.floor(query.zoom ?? 0);
  const sources = (query.sources ?? []).slice().sort().join(",");
  const limit = query.limit ?? DEFAULT_LIMIT;
  return `${w},${s},${e},${n}|z${z}|limit${limit}|${sources}`;
}

function defaultSourcesForZoom(zoom: number | undefined): AreaPolygonSource[] {
  // Phase 1 ships with parks/protected/oecm/symbiosis/tsunag at zoom>=8.
  // admin_* / osm_park land in Phase 2 — they'll just return empty for now.
  const z = zoom ?? 0;
  if (z < 8) return ["admin_country", "admin_prefecture"];
  if (z < 10) return [
    "admin_country", "admin_prefecture",
    "protected_area", "oecm", "nature_symbiosis_site", "tsunag",
  ];
  return [
    "admin_municipality", "admin_prefecture",
    "protected_area", "oecm", "nature_symbiosis_site", "tsunag",
    "osm_park", "user_defined",
  ];
}

function shouldFetchLiveOsm(query: AreaPolygonsQuery, sources: AreaPolygonSource[]): boolean {
  const zoom = query.zoom ?? 0;
  if (zoom < LIVE_OSM_MIN_ZOOM) return false;
  if (!sources.some((source) => LIVE_OSM_SOURCES.has(source))) return false;
  const [minLng, minLat, maxLng, maxLat] = query.bbox;
  if (maxLng <= minLng || maxLat <= minLat) return false;
  return (maxLng - minLng) <= LIVE_OSM_MAX_SPAN_DEGREES && (maxLat - minLat) <= LIVE_OSM_MAX_SPAN_DEGREES;
}

function buildLiveOsmAreaQuery(bbox: [number, number, number, number]): string {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const bb = `${minLat},${minLng},${maxLat},${maxLng}`;
  return `
[out:json][timeout:8];
(
  way["leisure"~"^(park|garden|nature_reserve|playground)$"](${bb});
  relation["leisure"~"^(park|garden|nature_reserve|playground)$"](${bb});
  relation["boundary"="national_park"](${bb});
);
out tags geom;
`;
}

function ringFromGeometry(geometry: Array<{ lat: number; lon: number }> | undefined): number[][] | null {
  if (!Array.isArray(geometry) || geometry.length < 3) return null;
  const ring = geometry
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
    .map((point) => [point.lon, point.lat]);
  if (ring.length < 3) return null;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0]!, first[1]!]);
  return ring;
}

function liveElementToPolygon(element: OverpassElement): Record<string, unknown> | null {
  if (element.type === "way") {
    const ring = ringFromGeometry(element.geometry);
    return ring ? { type: "Polygon", coordinates: [ring] } : null;
  }
  if (element.type === "relation" && Array.isArray(element.members)) {
    const polygons: number[][][][] = [];
    for (const member of element.members) {
      if (member.type !== "way") continue;
      const ring = ringFromGeometry(member.geometry);
      if (ring) polygons.push([ring]);
    }
    if (polygons.length === 0) return null;
    if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0]! };
    return { type: "MultiPolygon", coordinates: polygons };
  }
  return null;
}

function liveElementName(element: OverpassElement): string {
  const tags = element.tags ?? {};
  return tags["name:ja"] ?? tags.name ?? tags.alt_name ?? "OSMの公園・緑地";
}

function liveElementCenter(element: OverpassElement, geometry: Record<string, unknown>): [number, number] | null {
  if (Number.isFinite(element.center?.lat) && Number.isFinite(element.center?.lon)) {
    return [Number(element.center!.lon), Number(element.center!.lat)];
  }
  if (element.bounds) {
    return [
      (element.bounds.minlon + element.bounds.maxlon) / 2,
      (element.bounds.minlat + element.bounds.maxlat) / 2,
    ];
  }
  const coords = (geometry as { coordinates?: unknown }).coordinates;
  const ring = Array.isArray(coords) && Array.isArray(coords[0]) ? coords[0] : null;
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  let count = 0;
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const pointLng = Number(point[0]);
    const pointLat = Number(point[1]);
    if (!Number.isFinite(pointLng) || !Number.isFinite(pointLat)) continue;
    lng += pointLng;
    lat += pointLat;
    count += 1;
  }
  return count > 0 ? [lng / count, lat / count] : null;
}

function liveElementToFeature(element: OverpassElement): AreaPolygonFeature | null {
  if (element.type !== "way" && element.type !== "relation") return null;
  const geometry = liveElementToPolygon(element);
  if (!geometry) return null;
  const center = liveElementCenter(element, geometry);
  if (!center) return null;
  const tags = element.tags ?? {};
  const entityKey = `osm:${element.type}:${element.id}`;
  return {
    type: "Feature",
    properties: {
      field_id: `osm-live:${element.type}:${element.id}`,
      name: liveElementName(element),
      source: "osm_park",
      source_label: "公園・緑地 (OSM live)",
      admin_level: "osm_park",
      prefecture: "",
      city: "",
      area_ha: null,
      official_url: tags.website ?? tags["contact:website"] ?? "",
      center,
      transient: true,
      entity_key: entityKey,
      osm_type: element.type,
      osm_id: element.id,
    },
    geometry,
  };
}

type LiveOsmFetchResult = {
  ok: boolean;
  features: AreaPolygonFeature[];
  error?: string;
};

function tileForLngLat(lng: number, lat: number, z = LIVE_OSM_TILE_Z): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (clampedLat * Math.PI) / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return {
    x: Math.max(0, Math.min(n - 1, x)),
    y: Math.max(0, Math.min(n - 1, y)),
  };
}

function tilesForBbox(bbox: [number, number, number, number], z = LIVE_OSM_TILE_Z): Array<{ z: number; x: number; y: number }> {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const nw = tileForLngLat(minLng, maxLat, z);
  const se = tileForLngLat(maxLng, minLat, z);
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  const maxTiles = 24;
  for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x += 1) {
    for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y += 1) {
      tiles.push({ z, x, y });
      if (tiles.length >= maxTiles) return tiles;
    }
  }
  return tiles;
}

function walkGeometryNumbers(value: unknown, visit: (lng: number, lat: number) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    visit(value[0], value[1]);
    return;
  }
  for (const item of value) walkGeometryNumbers(item, visit);
}

function featureTouchesBbox(feature: AreaPolygonFeature, bbox: [number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const center = feature.properties.center;
  if (Array.isArray(center) && center.length >= 2) {
    const [lng, lat] = center;
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) return true;
  }
  let fMinLng = Infinity, fMinLat = Infinity, fMaxLng = -Infinity, fMaxLat = -Infinity;
  walkGeometryNumbers((feature.geometry as { coordinates?: unknown } | null)?.coordinates, (lng, lat) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    fMinLng = Math.min(fMinLng, lng);
    fMinLat = Math.min(fMinLat, lat);
    fMaxLng = Math.max(fMaxLng, lng);
    fMaxLat = Math.max(fMaxLat, lat);
  });
  if (!Number.isFinite(fMinLng)) return false;
  return fMaxLat >= minLat && fMinLat <= maxLat && fMaxLng >= minLng && fMinLng <= maxLng;
}

function dedupeAreaFeatures(features: AreaPolygonFeature[], limit: number, bbox?: [number, number, number, number]): AreaPolygonFeature[] {
  const seen = new Set<string>();
  const out: AreaPolygonFeature[] = [];
  for (const feature of features) {
    if (bbox && !featureTouchesBbox(feature, bbox)) continue;
    const key = feature.properties.entity_key ?? feature.properties.field_id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(feature);
    if (out.length >= limit) break;
  }
  return out;
}

function featuresFromCollection(value: unknown): AreaPolygonFeature[] {
  if (!value || typeof value !== "object") return [];
  const features = (value as { features?: unknown }).features;
  return Array.isArray(features) ? (features.filter((f) => f && typeof f === "object") as AreaPolygonFeature[]) : [];
}

async function readLiveOsmTileCache(
  bbox: [number, number, number, number],
  limit: number,
): Promise<{ freshComplete: boolean; freshFeatures: AreaPolygonFeature[]; staleFeatures: AreaPolygonFeature[]; tiles: Array<{ z: number; x: number; y: number }> }> {
  const tiles = tilesForBbox(bbox);
  if (tiles.length === 0) return { freshComplete: false, freshFeatures: [], staleFeatures: [], tiles };
  try {
    const pool = getPool();
    const xs = tiles.map((tile) => tile.x);
    const ys = tiles.map((tile) => tile.y);
    const result = await pool.query<{
      tile_x: number;
      tile_y: number;
      feature_collection: unknown;
      is_fresh: boolean;
    }>(
      `WITH wanted AS (
         SELECT * FROM unnest($2::int[], $3::int[]) AS t(tile_x, tile_y)
       )
       SELECT c.tile_x, c.tile_y, c.feature_collection,
              (c.status = 'success' AND c.expires_at > now()) AS is_fresh
         FROM wanted w
         JOIN osm_area_tile_cache c
           ON c.tile_z = $1
          AND c.tile_x = w.tile_x
          AND c.tile_y = w.tile_y
          AND c.source = $4
          AND c.schema_version = $5
          AND c.status = 'success'`,
      [LIVE_OSM_TILE_Z, xs, ys, LIVE_OSM_TILE_SOURCE, LIVE_OSM_TILE_SCHEMA],
    );
    const freshTileKeys = new Set<string>();
    const freshFeatures: AreaPolygonFeature[] = [];
    const staleFeatures: AreaPolygonFeature[] = [];
    for (const row of result.rows) {
      const key = `${row.tile_x}:${row.tile_y}`;
      const rowFeatures = featuresFromCollection(row.feature_collection);
      staleFeatures.push(...rowFeatures);
      if (row.is_fresh) {
        freshTileKeys.add(key);
        freshFeatures.push(...rowFeatures);
      }
    }
    return {
      freshComplete: freshTileKeys.size === tiles.length,
      freshFeatures: dedupeAreaFeatures(freshFeatures, limit, bbox),
      staleFeatures: dedupeAreaFeatures(staleFeatures, limit, bbox),
      tiles,
    };
  } catch {
    return { freshComplete: false, freshFeatures: [], staleFeatures: [], tiles };
  }
}

async function writeLiveOsmTileCache(
  tiles: Array<{ z: number; x: number; y: number }>,
  features: AreaPolygonFeature[],
): Promise<void> {
  if (tiles.length === 0) return;
  try {
    const pool = getPool();
    const payload = JSON.stringify({ type: "FeatureCollection", features });
    const expiresAt = new Date(Date.now() + LIVE_OSM_SUCCESS_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    for (const tile of tiles) {
      await pool.query(
        `INSERT INTO osm_area_tile_cache (
           tile_z, tile_x, tile_y, source, schema_version, status,
           feature_collection, error_count, last_error, fetched_at, expires_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'success',
           $6::jsonb, 0, '', now(), $7, now()
         )
         ON CONFLICT (tile_z, tile_x, tile_y, source, schema_version)
         DO UPDATE SET
           status = 'success',
           feature_collection = EXCLUDED.feature_collection,
           error_count = 0,
           last_error = '',
           fetched_at = now(),
           expires_at = EXCLUDED.expires_at,
           updated_at = now()`,
        [tile.z, tile.x, tile.y, LIVE_OSM_TILE_SOURCE, LIVE_OSM_TILE_SCHEMA, payload, expiresAt],
      );
    }
  } catch {
    // Migration may not be applied yet; live fallback still works.
  }
}

async function fetchLiveOsmAreaPolygons(query: AreaPolygonsQuery, remainingLimit: number): Promise<LiveOsmFetchResult> {
  if (remainingLimit <= 0) return { ok: true, features: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_OSM_TIMEOUT_MS);
  try {
    const response = await fetch(process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "ikimon.life-area-polygons (https://ikimon.life)",
      },
      body: `data=${encodeURIComponent(buildLiveOsmAreaQuery(query.bbox))}`,
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, features: [], error: `overpass_${response.status}` };
    const json = (await response.json()) as { elements?: OverpassElement[] };
    const features: AreaPolygonFeature[] = [];
    const seen = new Set<string>();
    for (const element of json.elements ?? []) {
      const feature = liveElementToFeature(element);
      if (!feature) continue;
      const key = feature.properties.entity_key ?? feature.properties.field_id;
      if (seen.has(key)) continue;
      seen.add(key);
      features.push(feature);
      if (features.length >= remainingLimit) break;
    }
    return { ok: true, features };
  } catch (error) {
    const message = error instanceof Error ? error.message : "overpass_failed";
    return { ok: false, features: [], error: message };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listAreaPolygonsForBbox(query: AreaPolygonsQuery): Promise<AreaPolygonCollection> {
  const key = cacheKey(query);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.payload;

  const [minLng, minLat, maxLng, maxLat] = query.bbox;
  const sources = query.sources && query.sources.length > 0
    ? query.sources
    : defaultSourcesForZoom(query.zoom);
  const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));

  const pool = getPool();
  const result = await pool.query<{
    field_id: string;
    entity_key: string | null;
    name: string;
    source: string;
    admin_level: string | null;
    prefecture: string;
    city: string;
    area_ha: string | null;
    official_url: string;
    lat: string;
    lng: string;
    polygon: Record<string, unknown> | null;
    polygon_simplified: Record<string, unknown> | null;
  }>(
    `SELECT field_id, entity_key, name, COALESCE(admin_level, source) AS source, admin_level, prefecture, city,
            area_ha::text AS area_ha, official_url,
            lat::text AS lat, lng::text AS lng,
            polygon,
            geom_simplified AS polygon_simplified
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND bbox_min_lat IS NOT NULL
        AND bbox_max_lat >= $1
        AND bbox_min_lat <= $2
        AND bbox_max_lng >= $3
        AND bbox_min_lng <= $4
        AND COALESCE(admin_level, source) = ANY($5)
        -- 現行版のみ (廃止された旧公園・旧合併前市町村などは除外)。
        -- 過去版を引きたい場合は別 endpoint で as_of 指定する想定。
        AND valid_to IS NULL
      ORDER BY area_ha NULLS LAST
      LIMIT $6`,
    [minLat, maxLat, minLng, maxLng, sources, limit + 1],
  );

  const rows = result.rows.slice(0, limit);
  const features: AreaPolygonFeature[] = rows.map((row) => {
    const source = (row.source as AreaPolygonSource) ?? "user_defined";
    const areaHa = row.area_ha == null ? null : Number(row.area_ha);
    // 行政界 (面積 1000 ha 超) は GeoJSON が重いので、間引いた版があれば優先。
    const useSimplified = areaHa != null && areaHa > 1000 && row.polygon_simplified;
    return {
      type: "Feature",
      properties: {
        field_id: row.field_id,
        name: row.name,
        source,
        source_label: SOURCE_LABEL[source] ?? source,
        admin_level: row.admin_level,
        prefecture: row.prefecture,
        city: row.city,
        area_ha: areaHa,
        official_url: row.official_url,
        center: [Number(row.lng), Number(row.lat)],
        entity_key: row.entity_key ?? undefined,
      },
      geometry: useSimplified ? row.polygon_simplified : row.polygon,
    };
  });

  const hasRegisteredOsmPark = features.some((feature) => feature.properties.source === "osm_park");
  if (!hasRegisteredOsmPark && shouldFetchLiveOsm(query, sources) && features.length < limit) {
    const cached = await readLiveOsmTileCache(query.bbox, limit - features.length);
    const cachedFeatures = cached.freshComplete ? cached.freshFeatures : [];
    if (cached.freshComplete) {
      features.push(...cachedFeatures);
    } else {
      const live = await fetchLiveOsmAreaPolygons(query, limit - features.length);
      if (live.ok) {
        await writeLiveOsmTileCache(cached.tiles, live.features);
        features.push(...live.features);
      } else {
        features.push(...cached.staleFeatures);
      }
    }
  }

  const payload: AreaPolygonCollection = {
    type: "FeatureCollection",
    features: dedupeAreaFeatures(features, limit),
    truncated: result.rows.length > limit || features.length >= limit,
  };
  cache.set(key, { expires: now + CACHE_TTL_MS, payload });
  return payload;
}

/** Drop the in-memory cache. Used by importer endpoints so that fresh OSM /
 *  N03 polygons surface immediately instead of waiting on the 60s TTL. */
export function flushAreaPolygonCache(): number {
  const before = cache.size;
  cache.clear();
  return before;
}

export const __test__ = {
  cacheKey,
  defaultSourcesForZoom,
  buildLiveOsmAreaQuery,
  liveElementToFeature,
  tileForLngLat,
  tilesForBbox,
  featureTouchesBbox,
  SOURCE_LABEL,
};
