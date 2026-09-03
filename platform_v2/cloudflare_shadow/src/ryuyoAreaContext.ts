import { pointInGeoJsonPolygon } from "../../src/services/pointInPolygon";

export const RYUYO_FIELD_ID = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
export const RYUYO_ENTITY_KEY = "osm:way:530835577";
export const RYUYO_NEARBY_MAX_DISTANCE_METERS = 300;

type LngLat = [number, number];
type Ring = LngLat[];
type PolygonGeometry = { type: "Polygon"; coordinates: Ring[] };
type MultiPolygonGeometry = { type: "MultiPolygon"; coordinates: Ring[][] };
export type RyuyoGeometry = PolygonGeometry | MultiPolygonGeometry;
export type RyuyoRecordContext = "core" | "nearby" | "outside";

function rings(geometry: RyuyoGeometry): Ring[] {
  return geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat();
}

function pointToSegmentMeters(lng: number, lat: number, start: LngLat, end: LngLat): number {
  const latScale = 110540;
  const lngScale = 111320 * Math.cos((lat * Math.PI) / 180);
  const ax = (start[0] - lng) * lngScale;
  const ay = (start[1] - lat) * latScale;
  const bx = (end[0] - lng) * lngScale;
  const by = (end[1] - lat) * latScale;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

export function distanceToRyuyoBoundaryMeters(lng: number, lat: number, geometry: RyuyoGeometry): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const ring of rings(geometry)) {
    for (let index = 0; index < ring.length; index += 1) {
      const start = ring[index];
      const end = ring[(index + 1) % ring.length];
      if (start && end) minimum = Math.min(minimum, pointToSegmentMeters(lng, lat, start, end));
    }
  }
  return minimum;
}

export function classifyRyuyoPoint(lng: number, lat: number, geometry: RyuyoGeometry): RyuyoRecordContext {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return "outside";
  if (pointInGeoJsonPolygon(lng, lat, geometry)) return "core";
  const distance = distanceToRyuyoBoundaryMeters(lng, lat, geometry);
  return distance > 0 && distance <= RYUYO_NEARBY_MAX_DISTANCE_METERS ? "nearby" : "outside";
}

export function expandBboxByMeters(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  meters = RYUYO_NEARBY_MAX_DISTANCE_METERS,
) {
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const latPad = meters / 110540;
  const lngPad = meters / (111320 * Math.max(0.05, Math.cos((centerLat * Math.PI) / 180)));
  return { minLat: bbox.minLat - latPad, maxLat: bbox.maxLat + latPad, minLng: bbox.minLng - lngPad, maxLng: bbox.maxLng + lngPad };
}
