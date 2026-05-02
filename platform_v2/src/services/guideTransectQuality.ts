import { getPool } from "../db.js";
import { meshKey100m } from "./observationEventEffort.js";

export type GuideTransectPoint = {
  sessionId: string;
  lat: number;
  lng: number;
  observedAt: string;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
};

export type GuideTransectQuality = {
  sessionId: string;
  pointCount: number;
  distanceM: number;
  effortMinutes: number;
  avgAccuracyM: number | null;
  goodAccuracyRate: number;
  duplicateCellRate: number;
  distinctCellCount: number;
  speedBands: Record<string, number>;
  timeBands: Record<string, number>;
  coverageSlotCount: number;
  coverageSlots: string[];
  effortQualityScore: number;
};

type GuideTransectPointRow = {
  session_id: string;
  observed_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: string | number | null;
  speed_mps: string | number | null;
  heading_degrees: string | number | null;
  visit_distance_m: string | number | null;
  visit_effort_minutes: string | number | null;
};

function finiteNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function speedBandForMps(speedMps: number | null | undefined): string {
  if (speedMps == null || !Number.isFinite(speedMps)) return "unknown_speed";
  const kmh = speedMps * 3.6;
  if (kmh < 8) return "slow";
  if (kmh < 25) return "urban_slow";
  if (kmh < 55) return "vehicle_transect";
  return "fast_vehicle";
}

export function timeBandForIso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown_time";
  const hour = new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCHours();
  if (hour < 5) return "night";
  if (hour < 10) return "morning";
  if (hour < 16) return "daytime";
  if (hour < 19) return "evening";
  return "night";
}

export function coverageSlotForPoint(point: GuideTransectPoint): string | null {
  const meshKey = meshKey100m(point.lat, point.lng);
  if (!meshKey) return null;
  return [
    "guide_vehicle",
    meshKey,
    timeBandForIso(point.observedAt),
    speedBandForMps(point.speedMps),
  ].join(":");
}

export function summarizeGuideTransectQuality(
  sessionId: string,
  points: readonly GuideTransectPoint[],
  fallback?: { distanceM?: number | null; effortMinutes?: number | null },
): GuideTransectQuality {
  const clean = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  let distanceM = 0;
  for (let index = 1; index < clean.length; index += 1) {
    const prev = clean[index - 1];
    const current = clean[index];
    if (!prev || !current) continue;
    const delta = metersBetween(prev, current);
    if (delta >= 0 && delta <= 750) distanceM += delta;
  }
  const fallbackDistance = finiteNumber(fallback?.distanceM);
  if (fallbackDistance != null && fallbackDistance > distanceM) distanceM = fallbackDistance;

  const firstMs = Date.parse(clean[0]?.observedAt ?? "");
  const lastMs = Date.parse(clean[clean.length - 1]?.observedAt ?? "");
  const computedEffort = Number.isFinite(firstMs) && Number.isFinite(lastMs)
    ? Math.max(0, (lastMs - firstMs) / 60000)
    : 0;
  const fallbackEffort = finiteNumber(fallback?.effortMinutes);
  const effortMinutes = Math.max(computedEffort, fallbackEffort ?? 0);

  const accuracies = clean.map((point) => finiteNumber(point.accuracyM)).filter((value): value is number => value != null);
  const avgAccuracyM = accuracies.length
    ? Math.round((accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length) * 10) / 10
    : null;
  const goodAccuracyRate = clean.length
    ? clean.filter((point) => {
      const accuracy = finiteNumber(point.accuracyM);
      return accuracy != null && accuracy <= 75;
    }).length / clean.length
    : 0;
  const meshKeys = clean.map((point) => meshKey100m(point.lat, point.lng)).filter((value): value is string => Boolean(value));
  const distinctCellCount = new Set(meshKeys).size;
  const duplicateCellRate = clean.length ? Math.max(0, 1 - (distinctCellCount / clean.length)) : 0;
  const speedBands: Record<string, number> = {};
  const timeBands: Record<string, number> = {};
  const slotSet = new Set<string>();
  for (const point of clean) {
    const speedBand = speedBandForMps(point.speedMps);
    const timeBand = timeBandForIso(point.observedAt);
    speedBands[speedBand] = (speedBands[speedBand] ?? 0) + 1;
    timeBands[timeBand] = (timeBands[timeBand] ?? 0) + 1;
    const slot = coverageSlotForPoint(point);
    if (slot) slotSet.add(slot);
  }
  const effortQualityScore = Math.round(100 * (
    (Math.min(1, distanceM / 1000) * 0.25) +
    (Math.min(1, effortMinutes / 15) * 0.25) +
    (goodAccuracyRate * 0.25) +
    ((1 - duplicateCellRate) * 0.25)
  ));
  return {
    sessionId,
    pointCount: clean.length,
    distanceM: Math.round(distanceM),
    effortMinutes: Math.round(effortMinutes * 10) / 10,
    avgAccuracyM,
    goodAccuracyRate: Math.round(goodAccuracyRate * 1000) / 1000,
    duplicateCellRate: Math.round(duplicateCellRate * 1000) / 1000,
    distinctCellCount,
    speedBands,
    timeBands,
    coverageSlotCount: slotSet.size,
    coverageSlots: Array.from(slotSet).slice(0, 24),
    effortQualityScore,
  };
}

export async function loadGuideTransectQualityForSessions(
  userId: string,
  sessionIds: readonly string[],
): Promise<Map<string, GuideTransectQuality>> {
  const ids = Array.from(new Set(sessionIds.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  const out = new Map<string, GuideTransectQuality>();
  if (ids.length === 0) return out;
  const result = await getPool().query<GuideTransectPointRow>(
    `select replace(v.visit_id, 'guide:', '') as session_id,
            vtp.observed_at::text as observed_at,
            vtp.point_latitude as lat,
            vtp.point_longitude as lng,
            vtp.accuracy_m,
            vtp.speed_mps,
            vtp.heading_degrees,
            v.distance_meters as visit_distance_m,
            v.effort_minutes as visit_effort_minutes
       from visits v
       join visit_track_points vtp on vtp.visit_id = v.visit_id
      where v.visit_id = any($1::text[])
        and (v.user_id = $2 or v.user_id is null)
      order by v.visit_id, vtp.sequence_no asc`,
    [ids.map((id) => `guide:${id}`), userId],
  );
  const grouped = new Map<string, { points: GuideTransectPoint[]; distanceM: number | null; effortMinutes: number | null }>();
  for (const row of result.rows) {
    if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    const entry = grouped.get(row.session_id) ?? { points: [], distanceM: null, effortMinutes: null };
    entry.points.push({
      sessionId: row.session_id,
      lat: row.lat,
      lng: row.lng,
      observedAt: row.observed_at,
      accuracyM: finiteNumber(row.accuracy_m),
      speedMps: finiteNumber(row.speed_mps),
      headingDegrees: finiteNumber(row.heading_degrees),
    });
    const distance = finiteNumber(row.visit_distance_m);
    if (distance != null) entry.distanceM = Math.max(entry.distanceM ?? 0, distance);
    const effort = finiteNumber(row.visit_effort_minutes);
    if (effort != null) entry.effortMinutes = Math.max(entry.effortMinutes ?? 0, effort);
    grouped.set(row.session_id, entry);
  }
  for (const [sessionId, entry] of grouped) {
    out.set(sessionId, summarizeGuideTransectQuality(sessionId, entry.points, entry));
  }
  return out;
}
