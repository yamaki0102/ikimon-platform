/**
 * Compute the bounding box of an arbitrary GeoJSON-shaped JSONB value.
 *
 * Walks coordinates regardless of whether the input is a Polygon, MultiPolygon,
 * Feature wrapping a geometry, or a FeatureCollection. Returns null when no
 * usable coordinate pair was found, so callers can skip rows whose `polygon`
 * column is absent or malformed (KSJ imports occasionally drop geometries).
 */
export type Bbox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function isFinitePair(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90
  );
}

function walk(node: unknown, acc: { minLat: number; maxLat: number; minLng: number; maxLng: number; seen: boolean }): void {
  if (!node) return;
  if (Array.isArray(node)) {
    if (node.length >= 2 && isFinitePair(node[0], node[1])) {
      const lng = node[0] as number;
      const lat = node[1] as number;
      if (!acc.seen || lng < acc.minLng) acc.minLng = lng;
      if (!acc.seen || lng > acc.maxLng) acc.maxLng = lng;
      if (!acc.seen || lat < acc.minLat) acc.minLat = lat;
      if (!acc.seen || lat > acc.maxLat) acc.maxLat = lat;
      acc.seen = true;
      return;
    }
    for (const child of node) walk(child, acc);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj.bbox) && obj.bbox.length >= 4) {
      const [minLng, minLat, maxLng, maxLat] = obj.bbox as number[];
      if ([minLng, minLat, maxLng, maxLat].every((v) => typeof v === "number" && Number.isFinite(v))) {
        if (!acc.seen || (minLng as number) < acc.minLng) acc.minLng = minLng as number;
        if (!acc.seen || (maxLng as number) > acc.maxLng) acc.maxLng = maxLng as number;
        if (!acc.seen || (minLat as number) < acc.minLat) acc.minLat = minLat as number;
        if (!acc.seen || (maxLat as number) > acc.maxLat) acc.maxLat = maxLat as number;
        acc.seen = true;
      }
    }
    if (obj.coordinates) walk(obj.coordinates, acc);
    if (obj.geometry) walk(obj.geometry, acc);
    if (obj.geometries && Array.isArray(obj.geometries)) walk(obj.geometries, acc);
    if (obj.features && Array.isArray(obj.features)) walk(obj.features, acc);
  }
}

export function computeBbox(polygon: unknown): Bbox | null {
  if (polygon == null) return null;
  const acc = {
    minLat: Number.POSITIVE_INFINITY,
    maxLat: Number.NEGATIVE_INFINITY,
    minLng: Number.POSITIVE_INFINITY,
    maxLng: Number.NEGATIVE_INFINITY,
    seen: false,
  };
  walk(polygon, acc);
  if (!acc.seen) return null;
  return {
    minLat: acc.minLat,
    maxLat: acc.maxLat,
    minLng: acc.minLng,
    maxLng: acc.maxLng,
  };
}
