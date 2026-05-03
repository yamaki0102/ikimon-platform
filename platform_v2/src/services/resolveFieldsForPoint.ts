/**
 * Resolve which `observation_fields` (current versions) contain a given point.
 *
 * Uses the bbox BTREE index from migration 0079 to prefilter, then runs the
 * tiny in-process point-in-polygon for the (small) candidate set. Returns
 * `field_id`s — the caller (visit write path) writes them into
 * `visits.resolved_field_ids[]` so area-snapshot aggregations can use a
 * straight `field_id = ANY(...)` instead of bbox+JSONB at read time.
 *
 * Performance budget for Japan-scale data:
 *   - bbox prefilter on (lat,lng) typically returns 10–100 candidates
 *   - each candidate runs ray-casting on ≤ ~1000 vertices
 *   - well under 50ms per write on warm cache.
 */
import { getPool } from "../db.js";
import { pointInGeoJsonPolygon } from "./pointInPolygon.js";

export interface ResolveOptions {
  /** Cap candidate scan to keep worst-case bounded. */
  maxCandidates?: number;
}

export async function resolveFieldsForPoint(
  lat: number,
  lng: number,
  options: ResolveOptions = {},
): Promise<string[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const limit = Math.max(50, Math.min(2000, options.maxCandidates ?? 500));
  const pool = getPool();
  const result = await pool.query<{ field_id: string; polygon: Record<string, unknown> | null }>(
    `SELECT field_id, polygon
       FROM observation_fields
      WHERE polygon IS NOT NULL
        AND valid_to IS NULL
        AND bbox_min_lat IS NOT NULL
        AND bbox_min_lat <= $1
        AND bbox_max_lat >= $1
        AND bbox_min_lng <= $2
        AND bbox_max_lng >= $2
      LIMIT $3`,
    [lat, lng, limit],
  );
  const matches: string[] = [];
  for (const row of result.rows) {
    if (pointInGeoJsonPolygon(lng, lat, row.polygon)) matches.push(row.field_id);
  }
  return matches;
}
