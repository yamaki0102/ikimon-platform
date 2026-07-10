import { getPool } from "../db.js";
import { appendLiveEvent } from "./observationEventLive.js";
import { refreshMissionProgress } from "./observationRally.js";

const EARTH_RADIUS_M = 6_371_000;

export type RallyStationPoint = {
  lat: number;
  lng: number;
  radiusM: number;
};

export type ObservationRallyAutoMatchInput = {
  userId: string;
  visitId: string;
  occurrenceId: string | null;
  lat: number;
  lng: number;
  observedAt: string | null;
};

export type ObservationRallyAutoMatchResult = {
  matchedCandidates: number;
  createdSubmissions: number;
  refreshedMissions: number;
};

type RallyCandidateRow = {
  session_id: string;
  course_id: string;
  mission_id: string;
  station_id: string;
  station_lat: string | number;
  station_lng: string | number;
  radius_m: string | number;
  verification_policy: string;
  station_sort_order: number;
};

type InsertedSubmissionRow = {
  submission_id: string;
};

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function haversineDistanceMeters(
  from: Pick<RallyStationPoint, "lat" | "lng">,
  to: Pick<RallyStationPoint, "lat" | "lng">,
): number {
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLng * sinLng;
  const bounded = Math.min(1, Math.max(0, a));
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export function isObservationWithinRallyStation(
  observation: Pick<RallyStationPoint, "lat" | "lng">,
  station: RallyStationPoint,
): { matched: boolean; distanceM: number } {
  const distanceM = haversineDistanceMeters(observation, station);
  return {
    matched: Number.isFinite(distanceM) && distanceM <= station.radiusM,
    distanceM,
  };
}

function normalizeObservedAt(value: string | null): string {
  const parsed = value ? new Date(value) : new Date();
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function validCoordinate(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}

export async function autoMatchObservationToActiveRallies(
  input: ObservationRallyAutoMatchInput,
): Promise<ObservationRallyAutoMatchResult> {
  if (!input.userId.trim() || !input.visitId.trim()) {
    return { matchedCandidates: 0, createdSubmissions: 0, refreshedMissions: 0 };
  }
  if (!validCoordinate(input.lat, -90, 90) || !validCoordinate(input.lng, -180, 180)) {
    return { matchedCandidates: 0, createdSubmissions: 0, refreshedMissions: 0 };
  }

  const observedAt = normalizeObservedAt(input.observedAt);
  const pool = getPool();
  const candidatesResult = await pool.query<RallyCandidateRow>(
    `SELECT
       course.session_id::text AS session_id,
       course.course_id::text AS course_id,
       mission.mission_id::text AS mission_id,
       station.station_id::text AS station_id,
       station.lat::text AS station_lat,
       station.lng::text AS station_lng,
       station.radius_m::text AS radius_m,
       mission.verification_policy,
       station.sort_order AS station_sort_order
     FROM observation_rally_courses course
     JOIN observation_event_sessions event_session
       ON event_session.session_id = course.session_id
     JOIN observation_rally_missions mission
       ON mission.course_id = course.course_id
     JOIN observation_rally_stations station
       ON station.course_id = course.course_id
      AND (
        mission.station_id = station.station_id
        OR (mission.location_binding = 'any_registered_station' AND mission.station_id IS NULL)
      )
     WHERE course.status = 'live'
       AND mission.status = 'published'
       AND station.status = 'open'
       AND mission.location_binding IN ('station_required', 'any_registered_station')
       AND station.lat IS NOT NULL
       AND station.lng IS NOT NULL
       AND station.radius_m IS NOT NULL
       AND station.radius_m > 0
       AND station.lat BETWEEN
         $1::double precision - (station.radius_m / 110574.0)
         AND $1::double precision + (station.radius_m / 110574.0)
       AND station.lng BETWEEN
         $2::double precision - (
           station.radius_m / (111320.0 * GREATEST(ABS(COS(RADIANS($1::double precision))), 0.1))
         )
         AND $2::double precision + (
           station.radius_m / (111320.0 * GREATEST(ABS(COS(RADIANS($1::double precision))), 0.1))
         )
       AND event_session.started_at <= $3::timestamptz
       AND (event_session.ended_at IS NULL OR event_session.ended_at >= $3::timestamptz)
       AND (mission.starts_at IS NULL OR mission.starts_at <= $3::timestamptz)
       AND (mission.ends_at IS NULL OR mission.ends_at >= $3::timestamptz)
       AND (
         event_session.organizer_user_id = $4
         OR EXISTS (
           SELECT 1
           FROM observation_event_participants participant
           WHERE participant.session_id = course.session_id
             AND participant.user_id = $4
             AND participant.status IN ('registered', 'checked_in')
         )
       )
     ORDER BY mission.sort_order, station.sort_order, station.created_at`,
    [input.lat, input.lng, observedAt, input.userId],
  );

  let matchedCandidates = 0;
  let createdSubmissions = 0;
  const missionsToRefresh = new Map<string, string>();

  for (const candidate of candidatesResult.rows) {
    const station = {
      lat: Number(candidate.station_lat),
      lng: Number(candidate.station_lng),
      radiusM: Number(candidate.radius_m),
    };
    if (!validCoordinate(station.lat, -90, 90) || !validCoordinate(station.lng, -180, 180)) continue;
    if (!Number.isFinite(station.radiusM) || station.radiusM <= 0) continue;

    const match = isObservationWithinRallyStation(
      { lat: input.lat, lng: input.lng },
      station,
    );
    if (!match.matched) continue;
    matchedCandidates += 1;

    const reviewStatus = candidate.verification_policy === "auto" ? "auto_accepted" : "pending";
    const inserted = await pool.query<InsertedSubmissionRow>(
      `INSERT INTO observation_rally_submissions (
         submission_id,
         session_id,
         course_id,
         mission_id,
         station_id,
         user_id,
         source_type,
         source_ref,
         count_value,
         lat,
         lng,
         payload,
         review_status
       ) VALUES (
         gen_random_uuid(),
         $1::uuid,
         $2::uuid,
         $3::uuid,
         $4::uuid,
         $5,
         'observation_auto_match',
         $6,
         1,
         $7,
         $8,
         $9::jsonb,
         $10
       )
       ON CONFLICT DO NOTHING
       RETURNING submission_id::text AS submission_id`,
      [
        candidate.session_id,
        candidate.course_id,
        candidate.mission_id,
        candidate.station_id,
        input.userId,
        input.visitId,
        input.lat,
        input.lng,
        JSON.stringify({
          source: "observation_post_save_auto_match",
          visit_id: input.visitId,
          occurrence_id: input.occurrenceId,
          station_id: candidate.station_id,
          distance_m: Math.round(match.distanceM * 100) / 100,
          radius_m: station.radiusM,
          observed_at: observedAt,
          exact_location_used: true,
        }),
        reviewStatus,
      ],
    );

    missionsToRefresh.set(candidate.mission_id, candidate.session_id);
    const submissionId = inserted.rows[0]?.submission_id;
    if (!submissionId) continue;
    createdSubmissions += 1;

    await appendLiveEvent({
      sessionId: candidate.session_id,
      type: "rally_task_submitted",
      scope: "all",
      actorUserId: input.userId,
      payload: {
        submission_id: submissionId,
        mission_id: candidate.mission_id,
        station_id: candidate.station_id,
        visit_id: input.visitId,
        occurrence_id: input.occurrenceId,
        source_type: "observation_auto_match",
      },
    });
  }

  let refreshedMissions = 0;
  for (const [missionId, sessionId] of missionsToRefresh) {
    await refreshMissionProgress(sessionId, missionId, { emit: true });
    refreshedMissions += 1;
  }

  return { matchedCandidates, createdSubmissions, refreshedMissions };
}
