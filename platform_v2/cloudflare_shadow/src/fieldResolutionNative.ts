import { pointInGeoJsonPolygon } from "../../src/services/pointInPolygon";

type D1Value = string | number | null;

export interface FieldResolutionNativeStatement {
  bind(...values: D1Value[]): FieldResolutionNativeStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface FieldResolutionNativeDatabase {
  prepare(sql: string): FieldResolutionNativeStatement;
}

type AreaPolygonRow = {
  field_id: string;
  bbox_min_lat: number;
  bbox_max_lat: number;
  bbox_min_lng: number;
  bbox_max_lng: number;
  geometry_json: string;
};

function parseGeometry(value: string): unknown | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Resolve a D1 observation point against the canonical imported area polygon readmodel. */
export async function resolveFieldsForPointNative(
  lat: number,
  lng: number,
  db: FieldResolutionNativeDatabase,
  maxCandidates = 200,
): Promise<string[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const limit = Math.max(1, Math.min(500, Math.trunc(maxCandidates)));
  const rows = (await db.prepare(
    `SELECT field_id, bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng, geometry_json
       FROM production_import_area_polygon_readmodel
      WHERE bbox_min_lat <= ? AND bbox_max_lat >= ?
        AND bbox_min_lng <= ? AND bbox_max_lng >= ?
      ORDER BY field_id
      LIMIT ?`,
  ).bind(lat, lat, lng, lng, limit).all<AreaPolygonRow>()).results;
  return rows
    .filter((row) => Number.isFinite(Number(row.bbox_min_lat))
      && Number.isFinite(Number(row.bbox_max_lat))
      && Number.isFinite(Number(row.bbox_min_lng))
      && Number.isFinite(Number(row.bbox_max_lng))
      && lat >= Number(row.bbox_min_lat)
      && lat <= Number(row.bbox_max_lat)
      && lng >= Number(row.bbox_min_lng)
      && lng <= Number(row.bbox_max_lng))
    .filter((row) => pointInGeoJsonPolygon(lng, lat, parseGeometry(row.geometry_json)))
    .map((row) => row.field_id);
}
