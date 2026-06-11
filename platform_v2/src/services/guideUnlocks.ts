import type { QueryResultRow } from "pg";
import { getPool } from "../db.js";
import {
  MAP_GUIDE_PROGRAMS,
  MAP_GUIDE_SPOTS,
  type MapGuideProgram,
  type MapGuideSpot,
} from "./mapGuideSpots.js";
import {
  findActiveGuideProgramForSpot,
  listGuideProgramRefs,
  type RuntimeGuideProgram,
} from "./guidePrograms.js";

export type GuideUnlockCandidate = {
  spot: MapGuideSpot;
  program: MapGuideProgram | null;
  distanceM: number;
  distanceBand: "same_place" | "nearby" | "area";
  captureAccuracyM: number | null;
};

export type GuideUnlockSummary = {
  guideSpotId: string;
  guideTitle: string;
  guideSubtitle: string;
  programId: string | null;
  programTitle: string | null;
  programSlug: string | null;
  distanceBand: "same_place" | "nearby" | "area";
  unlockedAt: string;
  href: string;
};

export type GuideUnlockListItem = GuideUnlockSummary & {
  preview: string;
  script: string;
  storyPoints: string[];
  sourceLinks: MapGuideSpot["sourceLinks"];
  lastListenedAt: string | null;
};

type UnlockRow = QueryResultRow & {
  guide_spot_id: string;
  program_id: string | null;
  distance_band: "same_place" | "nearby" | "area";
  first_unlocked_at: string;
  last_unlocked_at: string;
  last_listened_at: string | null;
};

const EARTH_RADIUS_M = 6_371_000;

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseCaptureAccuracyM(sourcePayload: Record<string, unknown> | null | undefined): number | null {
  const payload = sourcePayload && typeof sourcePayload === "object" ? sourcePayload : {};
  const candidates = [
    payload.capture_accuracy_m,
    payload.location_accuracy_m,
    payload.locationAccuracyM,
    payload.accuracy_m,
    payload.accuracyM,
  ];
  for (const candidate of candidates) {
    const n = finiteNumber(candidate);
    if (n !== null && n >= 0 && n <= 10_000) return n;
  }
  const locationAudit = payload.location_audit && typeof payload.location_audit === "object"
    ? payload.location_audit as Record<string, unknown>
    : null;
  return finiteNumber(locationAudit?.capture_accuracy_m);
}

function primaryProgramForSpot(spot: MapGuideSpot): MapGuideProgram | null {
  const programId = spot.guideProgramIds?.[0];
  if (!programId) return null;
  return MAP_GUIDE_PROGRAMS.find((program) => program.id === programId) ?? null;
}

function spotIsUnlockable(spot: MapGuideSpot): boolean {
  if ((spot.visibilityStatus ?? "published") !== "published") return false;
  if ((spot.safetyStatus ?? "active") !== "active") return false;
  if (spot.landownerConsent === false) return false;
  if (spot.ownerType === "school") return false;
  return true;
}

function distanceBand(distanceM: number, spot: MapGuideSpot): "same_place" | "nearby" | "area" {
  const unlockRadius = Number.isFinite(spot.unlockedRadiusM) ? spot.unlockedRadiusM : 60;
  if (distanceM <= unlockRadius) return "same_place";
  if (distanceM <= Math.max(unlockRadius * 2, 120)) return "nearby";
  return "area";
}

export function findGuideUnlockCandidatesForPoint(input: {
  latitude: number;
  longitude: number;
  sourcePayload?: Record<string, unknown> | null;
  limit?: number;
}): GuideUnlockCandidate[] {
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) return [];
  const captureAccuracyM = parseCaptureAccuracyM(input.sourcePayload);
  return MAP_GUIDE_SPOTS
    .filter(spotIsUnlockable)
    .map((spot) => {
      const distanceM = distanceMeters(
        { lat: input.latitude, lng: input.longitude },
        { lat: spot.lat, lng: spot.lng },
      );
      const radius = Number.isFinite(spot.triggerRadiusM) ? spot.triggerRadiusM : 120;
      const accuracyBuffer = captureAccuracyM === null
        ? 0
        : Math.min(captureAccuracyM, Number.isFinite(spot.accuracyBufferCapM) ? spot.accuracyBufferCapM! : 80);
      return {
        spot,
        program: primaryProgramForSpot(spot),
        distanceM,
        distanceBand: distanceBand(distanceM, spot),
        captureAccuracyM,
        unlockable: distanceM <= radius + accuracyBuffer,
      };
    })
    .filter((item) => item.unlockable)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, Math.max(1, Math.min(5, input.limit ?? 3)))
    .map(({ unlockable: _unlockable, ...item }) => item);
}

function unlockHref(guideSpotId: string): string {
  return `/my-guides?guide=${encodeURIComponent(guideSpotId)}`;
}

function staticProgramForId(programId: string | null): MapGuideProgram | null {
  return programId ? MAP_GUIDE_PROGRAMS.find((item) => item.id === programId) ?? null : null;
}

function toSummary(row: UnlockRow, spot: MapGuideSpot, runtimeProgram?: RuntimeGuideProgram | null): GuideUnlockSummary {
  const program = runtimeProgram ?? staticProgramForId(row.program_id) ?? primaryProgramForSpot(spot);
  return {
    guideSpotId: spot.id,
    guideTitle: spot.title,
    guideSubtitle: spot.subtitle,
    programId: program?.id ?? null,
    programTitle: program?.title ?? null,
    programSlug: program?.slug ?? null,
    distanceBand: row.distance_band,
    unlockedAt: row.last_unlocked_at,
    href: unlockHref(spot.id),
  };
}

export async function recordGuideUnlocksForObservation(input: {
  userId: string;
  visitId: string;
  occurrenceId: string;
  latitude: number;
  longitude: number;
  sourcePayload?: Record<string, unknown> | null;
}): Promise<GuideUnlockSummary[]> {
  const candidates = findGuideUnlockCandidatesForPoint(input);
  if (!candidates.length) return [];

  const pool = getPool();
  const rows: GuideUnlockSummary[] = [];
  for (const candidate of candidates) {
    const runtimeProgram = await findActiveGuideProgramForSpot(candidate.spot.id).catch(() => candidate.program);
    const result = await pool.query<UnlockRow>(
      `INSERT INTO guide_unlocks (
          user_id, guide_spot_id, program_id, source_visit_id, source_occurrence_id,
          unlock_method, visibility_status, location_basis, capture_accuracy_m,
          distance_band, source_payload, first_unlocked_at, last_unlocked_at, created_at, updated_at
       ) VALUES (
          $1, $2, $3, $4, $5,
          'nearby_record', 'private', 'visit_location', $6,
          $7, $8::jsonb, now(), now(), now(), now()
       )
       ON CONFLICT (user_id, guide_spot_id) DO UPDATE SET
          program_id = COALESCE(EXCLUDED.program_id, guide_unlocks.program_id),
          source_visit_id = EXCLUDED.source_visit_id,
          source_occurrence_id = EXCLUDED.source_occurrence_id,
          capture_accuracy_m = EXCLUDED.capture_accuracy_m,
          distance_band = EXCLUDED.distance_band,
          source_payload = guide_unlocks.source_payload || EXCLUDED.source_payload,
          last_unlocked_at = now(),
          updated_at = now()
       RETURNING guide_spot_id, program_id, distance_band, first_unlocked_at::text, last_unlocked_at::text, last_listened_at::text`,
      [
        input.userId,
        candidate.spot.id,
        runtimeProgram?.id ?? candidate.program?.id ?? null,
        input.visitId,
        input.occurrenceId,
        candidate.captureAccuracyM,
        candidate.distanceBand,
        JSON.stringify({
          source: "nearby_observation_record",
          distance_band: candidate.distanceBand,
          approximate_distance_m: Math.round(candidate.distanceM / 10) * 10,
          distance_display_policy: "coarse",
        }),
      ],
    );
    const row = result.rows[0];
    if (row) rows.push(toSummary(row, candidate.spot, runtimeProgram));
  }
  return rows;
}

export async function listMyGuideUnlocks(userId: string): Promise<GuideUnlockListItem[]> {
  const pool = getPool();
  const result = await pool.query<UnlockRow>(
    `SELECT guide_spot_id, program_id, distance_band, first_unlocked_at::text, last_unlocked_at::text, last_listened_at::text
       FROM guide_unlocks
      WHERE user_id = $1
      ORDER BY last_unlocked_at DESC
      LIMIT 100`,
    [userId],
  );
  const dbPrograms = await listGuideProgramRefs(result.rows.map((row) => row.program_id).filter((id): id is string => Boolean(id))).catch(() => new Map());
  return result.rows
    .map((row) => {
      const spot = MAP_GUIDE_SPOTS.find((item) => item.id === row.guide_spot_id);
      if (!spot) return null;
      const summary = toSummary(row, spot);
      const dbProgram = row.program_id ? dbPrograms.get(row.program_id) : null;
      return {
        ...summary,
        programTitle: dbProgram?.title ?? summary.programTitle,
        programSlug: dbProgram?.slug ?? summary.programSlug,
        preview: spot.preview,
        script: spot.script,
        storyPoints: spot.storyPoints,
        sourceLinks: spot.sourceLinks,
        lastListenedAt: row.last_listened_at,
      };
    })
    .filter((item): item is GuideUnlockListItem => Boolean(item));
}

export async function markGuideUnlockListened(input: { userId: string; guideSpotId: string }): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query<{ guide_spot_id: string }>(
    `UPDATE guide_unlocks
        SET last_listened_at = now(), updated_at = now()
      WHERE user_id = $1 AND guide_spot_id = $2
      RETURNING guide_spot_id`,
    [input.userId, input.guideSpotId],
  );
  return result.rows.length > 0;
}
