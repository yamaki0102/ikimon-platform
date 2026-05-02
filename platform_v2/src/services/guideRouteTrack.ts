import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { meshKey100m } from "./observationEventEffort.js";
import { speedBandForMps, timeBandForIso } from "./guideTransectQuality.js";
import { buildPlaceName, normalizeTimestamp } from "./writeSupport.js";

export type GuideRoutePointInput = {
  sessionId: string;
  userId?: string | null;
  clientSceneId?: string | null;
  guideMode: "walk" | "vehicle";
  lat: number;
  lng: number;
  observedAt: string;
  accuracyM?: number | null;
  speedMps?: number | null;
  headingDegrees?: number | null;
  sessionDistanceM?: number | null;
  positionCapturedAt?: string | null;
};

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildGuideRouteHash(sessionId: string): string {
  return createHash("sha256").update(`guide-route:${sessionId}`).digest("hex").slice(0, 24);
}

async function pointAlreadyExists(client: PoolClient, visitId: string, clientSceneId: string | null | undefined): Promise<boolean> {
  if (!clientSceneId) return false;
  const result = await client.query<{ exists: boolean }>(
    `select exists(
       select 1
         from visit_track_points
        where visit_id = $1
          and raw_payload->>'client_scene_id' = $2
     ) as exists`,
    [visitId, clientSceneId],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function recordGuideRoutePoint(input: GuideRoutePointInput): Promise<{ visitId: string; inserted: boolean }> {
  if (input.guideMode !== "vehicle") return { visitId: `guide:${input.sessionId}`, inserted: false };
  if (!input.sessionId || input.sessionId.trim() === "") throw new Error("sessionId is required");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new Error("lat/lng are required");

  const visitId = `guide:${input.sessionId}`;
  const meshKey = meshKey100m(input.lat, input.lng) || "unknown";
  const placeId = `guide-route:${meshKey}`;
  const observedAt = normalizeTimestamp(input.positionCapturedAt ?? input.observedAt);
  const speedBand = speedBandForMps(input.speedMps);
  const timeBand = timeBandForIso(observedAt);
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `insert into places (
          place_id, legacy_place_key, canonical_name, source_kind,
          center_latitude, center_longitude, metadata, created_at, updated_at
       ) values (
          $1, $1, $2, 'v2_guide_route', $3, $4, $5::jsonb, $6, now()
       )
       on conflict (place_id) do update set
          center_latitude = excluded.center_latitude,
          center_longitude = excluded.center_longitude,
          metadata = excluded.metadata,
          updated_at = now()`,
      [
        placeId,
        buildPlaceName({ municipality: null, prefecture: null }),
        input.lat,
        input.lng,
        JSON.stringify({ source: "guide_vehicle_route", mesh_key: meshKey, privacy: "private_route_public_mesh" }),
        observedAt,
      ],
    );

    const existingVisit = await client.query<{ observed_at: string | null; point_count: string; max_distance_m: string | null }>(
      `select v.observed_at::text as observed_at,
              count(vtp.visit_track_point_id)::text as point_count,
              max((vtp.raw_payload->>'session_distance_m')::numeric)::text as max_distance_m
         from visits v
         left join visit_track_points vtp on vtp.visit_id = v.visit_id
        where v.visit_id = $1
        group by v.visit_id`,
      [visitId],
    );
    const firstObservedAt = existingVisit.rows[0]?.observed_at ?? observedAt;
    const firstMs = Date.parse(firstObservedAt);
    const currentMs = Date.parse(observedAt);
    const effortMinutes = Number.isFinite(firstMs) && Number.isFinite(currentMs)
      ? Math.max(0, Math.round(((currentMs - firstMs) / 60000) * 100) / 100)
      : null;
    const existingDistance = Number(existingVisit.rows[0]?.max_distance_m);
    const distanceMeters = Math.max(
      Number.isFinite(existingDistance) ? existingDistance : 0,
      finiteNumber(input.sessionDistanceM) ?? 0,
    ) || null;

    await client.query(
      `insert into visits (
          visit_id, place_id, user_id, observed_at, session_mode, visit_mode, movement_mode,
          route_hash, effort_minutes, distance_meters, point_latitude, point_longitude,
          source_kind, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4, 'guide', 'vehicle_transect', 'vehicle',
          $5, $6, $7, $8, $9, 'v2_guide_route', $10::jsonb, $4, $11
       )
       on conflict (visit_id) do update set
          place_id = excluded.place_id,
          user_id = coalesce(excluded.user_id, visits.user_id),
          movement_mode = excluded.movement_mode,
          route_hash = excluded.route_hash,
          effort_minutes = excluded.effort_minutes,
          distance_meters = excluded.distance_meters,
          point_latitude = excluded.point_latitude,
          point_longitude = excluded.point_longitude,
          source_payload = excluded.source_payload,
          updated_at = excluded.updated_at`,
      [
        visitId,
        placeId,
        input.userId ?? null,
        normalizeTimestamp(firstObservedAt),
        buildGuideRouteHash(input.sessionId),
        effortMinutes,
        distanceMeters,
        input.lat,
        input.lng,
        JSON.stringify({
          source: "guide_vehicle_route",
          session_id: input.sessionId,
          privacy: "private_route_public_mesh",
          latest_client_scene_id: input.clientSceneId ?? null,
          latest_accuracy_m: finiteNumber(input.accuracyM),
          latest_speed_mps: finiteNumber(input.speedMps),
          latest_heading_degrees: finiteNumber(input.headingDegrees),
          sampling_protocol: {
            protocol_id: "guide_vehicle_transect_v1",
            movement_mode: "vehicle",
            privacy: "private_route_public_mesh",
            public_surface: "guide_environment_mesh",
          },
          coverage_cube_axes: {
            modality: "guide_vehicle",
            speed_band: speedBand,
            time_band: timeBand,
            effort_metric: "distance_meters_and_minutes",
          },
        }),
        observedAt,
      ],
    );

    if (await pointAlreadyExists(client, visitId, input.clientSceneId)) {
      await client.query("commit");
      return { visitId, inserted: false };
    }

    const sequence = Number(existingVisit.rows[0]?.point_count ?? 0);
    await client.query(
      `insert into visit_track_points (
          visit_id, observed_at, sequence_no, point_latitude, point_longitude,
          accuracy_m, altitude_m, speed_mps, heading_degrees, raw_payload
       ) values (
          $1, $2, $3, $4, $5, $6, null, $7, $8, $9::jsonb
       )`,
      [
        visitId,
        observedAt,
        sequence,
        input.lat,
        input.lng,
        finiteNumber(input.accuracyM),
        finiteNumber(input.speedMps),
        finiteNumber(input.headingDegrees),
        JSON.stringify({
          source: "guide_vehicle_scene",
          client_scene_id: input.clientSceneId ?? null,
          session_distance_m: finiteNumber(input.sessionDistanceM),
          position_captured_at: input.positionCapturedAt ?? null,
          coverage_cube: {
            modality: "guide_vehicle",
            speed_band: speedBand,
            time_band: timeBand,
          },
          privacy: "private_route_public_mesh",
        }),
      ],
    );

    await client.query("commit");
    return { visitId, inserted: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
