import { computeBbox, type Bbox } from "./geoJsonBbox.js";

export type LngLat = [number, number];

export type PolygonGeometry = {
  type: "Polygon";
  coordinates: LngLat[][];
};

export type AreaGeometryValidation = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  bbox: Bbox | null;
  areaHa: number | null;
  center: { lat: number; lng: number } | null;
};

const EARTH_RADIUS_M = 6_371_000;
const MAX_POLYGON_POINTS = 80;
const MAX_AREA_HA = 500;
const MIN_AREA_HA = 0.005;

function toRad(v: number): number {
  return (v * Math.PI) / 180;
}

function toDeg(v: number): number {
  return (v * 180) / Math.PI;
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s1 + s2));
}

export function normalizeFieldName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[（）()［\]\[\]【】「」『』"'`]/g, "")
    .replace(/[・･\-ー‐–—_]/g, "");
}

function isLngLatPair(value: unknown): value is LngLat {
  if (!Array.isArray(value) || value.length < 2) return false;
  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 && lng <= 180 &&
    lat >= -90 && lat <= 90
  );
}

function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, [first[0], first[1]]];
}

export function asPolygonGeometry(value: unknown): PolygonGeometry | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const geometry = obj.type === "Feature" ? obj.geometry : obj;
  if (!geometry || typeof geometry !== "object") return null;
  const g = geometry as Record<string, unknown>;
  if (g.type !== "Polygon" || !Array.isArray(g.coordinates)) return null;
  const outerRaw = g.coordinates[0];
  if (!Array.isArray(outerRaw)) return null;
  const outer = outerRaw.filter(isLngLatPair).map((p) => [p[0], p[1]] as LngLat);
  if (outer.length < 3) return null;
  return { type: "Polygon", coordinates: [closeRing(outer)] };
}

function polygonAreaHa(polygon: PolygonGeometry): number | null {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return null;
  const centerLat = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  const cos = Math.cos(toRad(centerLat));
  let twiceArea = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const ax = toRad(a[0]) * EARTH_RADIUS_M * cos;
    const ay = toRad(a[1]) * EARTH_RADIUS_M;
    const bx = toRad(b[0]) * EARTH_RADIUS_M * cos;
    const by = toRad(b[1]) * EARTH_RADIUS_M;
    twiceArea += ax * by - bx * ay;
  }
  return Math.abs(twiceArea / 2) / 10_000;
}

export function centroidFromPolygon(polygon: PolygonGeometry): { lat: number; lng: number } | null {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return null;
  const usable = ring.slice(0, -1);
  const lng = usable.reduce((sum, p) => sum + p[0], 0) / usable.length;
  const lat = usable.reduce((sum, p) => sum + p[1], 0) / usable.length;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function validateAreaPolygon(input: unknown): AreaGeometryValidation {
  const polygon = asPolygonGeometry(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!polygon) {
    return { ok: false, errors: ["polygon_required"], warnings, bbox: null, areaHa: null, center: null };
  }
  const ring = polygon.coordinates[0] ?? [];
  const pointCount = ring.length;
  if (pointCount < 4) errors.push("polygon_too_few_points");
  if (pointCount > MAX_POLYGON_POINTS) errors.push("polygon_too_many_points");

  const bbox = computeBbox(polygon);
  const areaHa = polygonAreaHa(polygon);
  const center = centroidFromPolygon(polygon);
  if (!bbox || !center || areaHa == null) errors.push("polygon_invalid_geometry");
  if (areaHa != null && areaHa > MAX_AREA_HA) errors.push("polygon_too_large");
  if (areaHa != null && areaHa < MIN_AREA_HA) warnings.push("範囲がかなり小さいため、集合場所だけの指定に見えるかもしれません。");
  if (bbox) {
    const diagonal = haversineMeters(bbox.minLat, bbox.minLng, bbox.maxLat, bbox.maxLng);
    if (diagonal > 4_000) warnings.push("範囲が広めです。移動時間と集合場所を確認してください。");
  }
  return { ok: errors.length === 0, errors, warnings, bbox, areaHa, center };
}

export function circleToPolygon(lat: number, lng: number, radiusM: number, points = 32): PolygonGeometry {
  const safeRadius = Math.max(30, Math.min(3_000, radiusM));
  const safePoints = Math.max(12, Math.min(48, Math.floor(points)));
  const coords: LngLat[] = [];
  const latRad = toRad(lat);
  const lngRad = toRad(lng);
  const angular = safeRadius / EARTH_RADIUS_M;
  for (let i = 0; i < safePoints; i += 1) {
    const bearing = (2 * Math.PI * i) / safePoints;
    const outLat = Math.asin(
      Math.sin(latRad) * Math.cos(angular) +
      Math.cos(latRad) * Math.sin(angular) * Math.cos(bearing),
    );
    const outLng = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(latRad),
      Math.cos(angular) - Math.sin(latRad) * Math.sin(outLat),
    );
    coords.push([Number(toDeg(outLng).toFixed(7)), Number(toDeg(outLat).toFixed(7))]);
  }
  return { type: "Polygon", coordinates: [closeRing(coords)] };
}

export function bboxToPolygon(minLng: number, minLat: number, maxLng: number, maxLat: number): PolygonGeometry {
  return {
    type: "Polygon",
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  };
}

export function bboxOverlaps(a: Bbox, b: Bbox): boolean {
  return a.minLat <= b.maxLat && a.maxLat >= b.minLat && a.minLng <= b.maxLng && a.maxLng >= b.minLng;
}

export function entityKeyForUserField(input: {
  ownerUserId: string;
  name: string;
  geohash6: string;
}): string {
  return `user_defined:${input.ownerUserId}:${normalizeFieldName(input.name)}:${input.geohash6}`;
}

export const __test__ = {
  MAX_AREA_HA,
  MAX_POLYGON_POINTS,
  asPolygonGeometry,
  polygonAreaHa,
  closeRing,
};
