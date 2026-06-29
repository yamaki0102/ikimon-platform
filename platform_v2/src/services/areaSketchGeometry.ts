import {
  asPolygonGeometry,
  haversineMeters,
  validateAreaPolygon,
  type AreaGeometryValidation,
  type LngLat,
  type PolygonGeometry,
} from "./observationEventAreaGeometry.js";

export type AreaSketchNormalizeOptions = {
  duplicateToleranceM?: number;
  maxPoints?: number;
  simplifyToleranceM?: number;
};

export type AreaSketchNormalizeResult = {
  ok: boolean;
  polygon: PolygonGeometry | null;
  validation: AreaGeometryValidation;
  originalPointCount: number;
  cleanedPointCount: number;
  removedPointCount: number;
  warnings: string[];
  errors: string[];
  isValidForAreaEstimate: boolean;
};

const DEFAULT_DUPLICATE_TOLERANCE_M = 0.75;
const DEFAULT_MAX_POINTS = 80;
const DEFAULT_SIMPLIFY_TOLERANCE_M = 1.5;

function isLngLat(value: unknown): value is LngLat {
  if (!Array.isArray(value) || value.length < 2) return false;
  const [lng, lat] = value;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

function extractOuterRing(input: unknown): LngLat[] {
  if (Array.isArray(input)) {
    return input.filter(isLngLat).map((p) => [p[0], p[1]]);
  }
  const polygon = asPolygonGeometry(input);
  return polygon?.coordinates[0]?.map((p) => [p[0], p[1]]) ?? [];
}

function samePoint(a: LngLat, b: LngLat): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function closeRing(points: LngLat[]): LngLat[] {
  if (points.length === 0) return [];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (samePoint(first, last)) return points;
  return [...points, [first[0], first[1]]];
}

function stripClosingPoint(points: LngLat[]): LngLat[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return samePoint(first, last) ? points.slice(0, -1) : points;
}

function removeNearDuplicatePoints(points: LngLat[], toleranceM: number): LngLat[] {
  const cleaned: LngLat[] = [];
  for (const point of stripClosingPoint(points)) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous) {
      cleaned.push(point);
      continue;
    }
    const distance = haversineMeters(previous[1], previous[0], point[1], point[0]);
    if (distance >= toleranceM) cleaned.push(point);
  }
  if (cleaned.length > 1) {
    const first = cleaned[0]!;
    const last = cleaned[cleaned.length - 1]!;
    const closingDistance = haversineMeters(first[1], first[0], last[1], last[0]);
    if (closingDistance < toleranceM) cleaned.pop();
  }
  return cleaned;
}

type ProjectedPoint = {
  lngLat: LngLat;
  x: number;
  y: number;
};

function projectPoints(points: LngLat[]): ProjectedPoint[] {
  const centerLat = points.reduce((sum, p) => sum + p[1], 0) / Math.max(1, points.length);
  const metersPerDegLat = 111_320;
  const metersPerDegLng = metersPerDegLat * Math.cos((centerLat * Math.PI) / 180);
  return points.map((lngLat) => ({
    lngLat,
    x: lngLat[0] * metersPerDegLng,
    y: lngLat[1] * metersPerDegLat,
  }));
}

function perpendicularDistanceM(point: ProjectedPoint, start: ProjectedPoint, end: ProjectedPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function simplifyOpenRing(points: LngLat[], toleranceM: number): LngLat[] {
  if (points.length <= 3) return points;
  const projected = projectPoints(points);
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const visit = (firstIndex: number, lastIndex: number): void => {
    let maxDistance = -1;
    let maxIndex = firstIndex;
    for (let i = firstIndex + 1; i < lastIndex; i += 1) {
      const distance = perpendicularDistanceM(projected[i]!, projected[firstIndex]!, projected[lastIndex]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance > toleranceM) {
      keep[maxIndex] = true;
      visit(firstIndex, maxIndex);
      visit(maxIndex, lastIndex);
    }
  };

  visit(0, points.length - 1);
  const simplified = points.filter((_, index) => keep[index]);
  return simplified.length >= 3 ? simplified : points.slice(0, 3);
}

function simplifyRing(points: LngLat[], toleranceM: number): LngLat[] {
  const open = stripClosingPoint(points);
  if (open.length <= 3) return closeRing(open);
  const rotated = [...open, open[0]!];
  const simplified = simplifyOpenRing(rotated, toleranceM).slice(0, -1);
  return closeRing(simplified.length >= 3 ? simplified : open);
}

function evenlyReduceRing(points: LngLat[], maxPoints: number): LngLat[] {
  const open = stripClosingPoint(points);
  const maxOpenPoints = Math.max(3, maxPoints - 1);
  if (open.length <= maxOpenPoints) return closeRing(open);
  const reduced: LngLat[] = [];
  const step = open.length / maxOpenPoints;
  for (let i = 0; i < maxOpenPoints; i += 1) {
    reduced.push(open[Math.floor(i * step)]!);
  }
  return closeRing(reduced);
}

function orientation(a: LngLat, b: LngLat, c: LngLat): number {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-12) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: LngLat, b: LngLat, c: LngLat): boolean {
  return (
    b[0] <= Math.max(a[0], c[0]) &&
    b[0] >= Math.min(a[0], c[0]) &&
    b[1] <= Math.max(a[1], c[1]) &&
    b[1] >= Math.min(a[1], c[1])
  );
}

function segmentsIntersect(a1: LngLat, a2: LngLat, b1: LngLat, b2: LngLat): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

export function hasPolygonSelfIntersection(polygon: PolygonGeometry): boolean {
  const ring = polygon.coordinates[0] ?? [];
  if (ring.length < 4) return false;
  const segmentCount = ring.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const a1 = ring[i]!;
    const a2 = ring[i + 1]!;
    for (let j = i + 1; j < segmentCount; j += 1) {
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === segmentCount - 1);
      if (adjacent) continue;
      const b1 = ring[j]!;
      const b2 = ring[j + 1]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function normalizeAreaSketchPolygon(
  input: unknown,
  options: AreaSketchNormalizeOptions = {},
): AreaSketchNormalizeResult {
  const maxPoints = Math.max(4, Math.floor(options.maxPoints ?? DEFAULT_MAX_POINTS));
  const duplicateToleranceM = Math.max(0, options.duplicateToleranceM ?? DEFAULT_DUPLICATE_TOLERANCE_M);
  const baseSimplifyToleranceM = Math.max(0, options.simplifyToleranceM ?? DEFAULT_SIMPLIFY_TOLERANCE_M);

  const raw = extractOuterRing(input);
  const originalPointCount = raw.length;
  const deduped = removeNearDuplicatePoints(raw, duplicateToleranceM);
  let ring = closeRing(deduped);
  if (ring.length > maxPoints) {
    let tolerance = baseSimplifyToleranceM;
    for (let attempt = 0; attempt < 10 && ring.length > maxPoints; attempt += 1) {
      ring = simplifyRing(ring, tolerance);
      tolerance *= 1.6;
    }
    if (ring.length > maxPoints) ring = evenlyReduceRing(ring, maxPoints);
  }

  const polygon = ring.length >= 4 ? { type: "Polygon" as const, coordinates: [ring] } : null;
  const validation = validateAreaPolygon(polygon);
  const warnings = [...validation.warnings];
  const errors = [...validation.errors];
  if (polygon && hasPolygonSelfIntersection(polygon)) errors.push("polygon_self_intersection");

  const cleanedPointCount = polygon?.coordinates[0]?.length ?? 0;
  return {
    ok: errors.length === 0,
    polygon,
    validation: { ...validation, ok: errors.length === 0, errors },
    originalPointCount,
    cleanedPointCount,
    removedPointCount: Math.max(0, originalPointCount - cleanedPointCount),
    warnings,
    errors,
    isValidForAreaEstimate: errors.length === 0 && validation.areaHa != null,
  };
}
