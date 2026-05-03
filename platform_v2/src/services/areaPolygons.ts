/**
 * Area Polygons — bbox-prefiltered GeoJSON FeatureCollection of registered
 * `observation_fields` polygons. Drives the new "click an area" layer on /ja/map.
 *
 * No PostGIS: we filter rows whose stored bbox overlaps the viewport bbox via
 * the BTREE index added in migration 0079. For Phase 1 the polygon JSONB is
 * returned verbatim; large admin polygons (Phase 2) will go through
 * `geom_simplified`.
 *
 * 60s in-memory TTL per (rounded bbox / source / zoom bucket) so panning
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

interface CacheEntry {
  expires: number;
  payload: AreaPolygonCollection;
}
const cache = new Map<string, CacheEntry>();

function cacheKey(query: AreaPolygonsQuery): string {
  const [w, s, e, n] = query.bbox.map((v) => Math.round(v * 10) / 10);
  const z = Math.floor(query.zoom ?? 0);
  const sources = (query.sources ?? []).slice().sort().join(",");
  return `${w},${s},${e},${n}|z${z}|${sources}`;
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
  }>(
    `SELECT field_id, name, source, admin_level, prefecture, city,
            area_ha::text AS area_ha, official_url,
            lat::text AS lat, lng::text AS lng,
            polygon
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND bbox_min_lat IS NOT NULL
        AND bbox_max_lat >= $1
        AND bbox_min_lat <= $2
        AND bbox_max_lng >= $3
        AND bbox_min_lng <= $4
        AND source = ANY($5)
      ORDER BY area_ha NULLS LAST
      LIMIT $6`,
    [minLat, maxLat, minLng, maxLng, sources, limit + 1],
  );

  const rows = result.rows.slice(0, limit);
  const features: AreaPolygonFeature[] = rows.map((row) => {
    const source = (row.source as AreaPolygonSource) ?? "user_defined";
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
        area_ha: row.area_ha == null ? null : Number(row.area_ha),
        official_url: row.official_url,
        center: [Number(row.lng), Number(row.lat)],
      },
      geometry: row.polygon,
    };
  });

  const payload: AreaPolygonCollection = {
    type: "FeatureCollection",
    features,
    truncated: result.rows.length > limit,
  };
  cache.set(key, { expires: now + CACHE_TTL_MS, payload });
  return payload;
}

export const __test__ = {
  cacheKey,
  defaultSourcesForZoom,
  SOURCE_LABEL,
};
