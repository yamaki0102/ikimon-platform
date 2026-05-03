/**
 * Tiny point-in-polygon (no PostGIS, no turf).
 *
 * Handles GeoJSON Polygon and MultiPolygon (incl. holes). Input geometries
 * may come straight out of the `observation_fields.polygon` JSONB column.
 *
 * Uses ray-casting on the (lng, lat) plane. For Japan-scale areas the
 * cartesian approximation is fine — the worst case is points sitting on
 * an edge, which gets a stable but arbitrary classification (callers
 * should treat boundary cases as "either accept or reject is OK").
 */

type Ring = number[][]; // [[lng, lat], ...]

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function inPolygon(lng: number, lat: number, polygon: Ring[]): boolean {
  if (polygon.length === 0) return false;
  // First ring = outer; subsequent rings = holes.
  if (!inRing(lng, lat, polygon[0]!)) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (inRing(lng, lat, polygon[i]!)) return false;
  }
  return true;
}

/**
 * Returns true when the (lng, lat) sits inside the GeoJSON Polygon /
 * MultiPolygon stored in `polygon`. Anything malformed → false.
 */
export function pointInGeoJsonPolygon(lng: number, lat: number, polygon: unknown): boolean {
  if (!polygon || typeof polygon !== "object") return false;
  const obj = polygon as Record<string, unknown>;
  const type = String(obj.type ?? "");
  const coords = obj.coordinates as unknown;
  if (!Array.isArray(coords)) {
    // Bare Feature wrapper?
    if (type === "Feature" && obj.geometry) return pointInGeoJsonPolygon(lng, lat, obj.geometry);
    return false;
  }
  if (type === "Polygon") {
    return inPolygon(lng, lat, coords as Ring[]);
  }
  if (type === "MultiPolygon") {
    for (const poly of coords as Ring[][]) {
      if (inPolygon(lng, lat, poly)) return true;
    }
    return false;
  }
  return false;
}

export const __test__ = { inRing, inPolygon };
