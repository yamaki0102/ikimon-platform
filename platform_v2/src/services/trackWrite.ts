import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { writeLegacyTrack } from "../legacy/compatibilityWriter.js";
import {
  buildPlaceId,
  buildPlaceName,
  normalizeTimestamp,
  recordCompatibilityFailure,
} from "./writeSupport.js";

export type TrackPointInput = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  altitudeMeters?: number | null;
  timestamp: string;
};

export type TrackUpsertInput = {
  sessionId: string;
  userId: string;
  fieldId?: string | null;
  startedAt: string;
  updatedAt?: string | null;
  distanceMeters?: number | null;
  stepCount?: number | null;
  points: TrackPointInput[];
  municipality?: string | null;
  prefecture?: string | null;
  sourcePayload?: Record<string, unknown>;
};

export type TrackWriteResult = {
  visitId: string;
  placeId: string;
  pointCount: number;
  compatibility: {
    attempted: boolean;
    succeeded: boolean;
    error?: string;
  };
};

function assertTrackInput(input: TrackUpsertInput): void {
  if (!input.sessionId || input.sessionId.trim() === "") {
    throw new Error("sessionId is required");
  }

  if (!input.userId || input.userId.trim() === "") {
    throw new Error("userId is required");
  }

  if (!Array.isArray(input.points) || input.points.length === 0) {
    throw new Error("points are required");
  }
}

export async function upsertTrack(input: TrackUpsertInput): Promise<TrackWriteResult> {
  assertTrackInput(input);

  const visitId = `track:${input.sessionId}`;
  const firstPoint = input.points[0];
  if (!firstPoint || !Number.isFinite(firstPoint.latitude) || !Number.isFinite(firstPoint.longitude)) {
    throw new Error("first point is invalid");
  }

  const placeId = buildPlaceId({
    latitude: firstPoint.latitude,
    longitude: firstPoint.longitude,
    municipality: input.municipality,
    prefecture: input.prefecture,
  });

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const userExists = await client.query<{ exists: boolean }>(
      "select exists(select 1 from users where user_id = $1) as exists",
      [input.userId],
    );
    if (!userExists.rows[0]?.exists) {
      throw new Error(`Unknown userId: ${input.userId}`);
    }

    await client.query(
      `insert into places (
          place_id, legacy_place_key, canonical_name, source_kind, prefecture, municipality,
          center_latitude, center_longitude, metadata, created_at, updated_at
       ) values (
          $1, $2, $3, 'v2_track_session', $4, $5, $6, $7, $8::jsonb, $9, now()
       )
       on conflict (place_id) do update set
          canonical_name = excluded.canonical_name,
          prefecture = excluded.prefecture,
          municipality = excluded.municipality,
          center_latitude = excluded.center_latitude,
          center_longitude = excluded.center_longitude,
          metadata = excluded.metadata,
          updated_at = now()`,
      [
        placeId,
        placeId,
        buildPlaceName({
          municipality: input.municipality,
          prefecture: input.prefecture,
        }),
        input.prefecture ?? null,
        input.municipality ?? null,
        firstPoint.latitude,
        firstPoint.longitude,
        JSON.stringify({
          source: "v2_track_api",
          field_id: input.fieldId ?? null,
        }),
        normalizeTimestamp(input.startedAt),
      ],
    );

    const sourcePayload = {
      session_id: input.sessionId,
      field_id: input.fieldId ?? null,
      user_id: input.userId,
      ...(input.sourcePayload ?? {}),
    };

    await client.query(
      `insert into visits (
          visit_id, place_id, user_id, observed_at, session_mode, visit_mode, effort_minutes,
          distance_meters, step_count, point_latitude, point_longitude, source_kind, source_payload, created_at, updated_at
       ) values (
          $1, $2, $3, $4, 'fieldscan', 'track', null, $5, $6, $7, $8, 'v2_track_session', $9::jsonb, $10, $11
       )
       on conflict (visit_id) do update set
          place_id = excluded.place_id,
          user_id = excluded.user_id,
          observed_at = excluded.observed_at,
          distance_meters = excluded.distance_meters,
          step_count = excluded.step_count,
          point_latitude = excluded.point_latitude,
          point_longitude = excluded.point_longitude,
          source_payload = excluded.source_payload,
          updated_at = excluded.updated_at`,
      [
        visitId,
        placeId,
        input.userId,
        normalizeTimestamp(input.startedAt),
        input.distanceMeters ?? null,
        input.stepCount ?? null,
        firstPoint.latitude,
        firstPoint.longitude,
        JSON.stringify(sourcePayload),
        normalizeTimestamp(input.startedAt),
        normalizeTimestamp(input.updatedAt ?? input.startedAt),
      ],
    );

    await client.query("delete from visit_track_points where visit_id = $1", [visitId]);
    for (let index = 0; index < input.points.length; index += 1) {
      const point = input.points[index];
      if (!point) {
        continue;
      }
      await client.query(
        `insert into visit_track_points (
            visit_id, observed_at, sequence_no, point_latitude, point_longitude, accuracy_m, altitude_m, speed_mps, heading_degrees, raw_payload
         ) values (
            $1, $2, $3, $4, $5, $6, $7, null, null, $8::jsonb
         )`,
        [
          visitId,
          normalizeTimestamp(point.timestamp),
          index,
          point.latitude,
          point.longitude,
          point.accuracyMeters ?? null,
          point.altitudeMeters ?? null,
          JSON.stringify({
            source: "v2_track_api",
          }),
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const config = loadConfig();
  const compatibility = {
    attempted: config.compatibilityWriteEnabled,
    succeeded: false,
    error: undefined as string | undefined,
  };

  if (config.compatibilityWriteEnabled) {
    try {
      await writeLegacyTrack(visitId, {
        legacyDataRoot: config.legacyDataRoot,
        publicRoot: config.legacyPublicRoot,
      });
      compatibility.succeeded = true;
    } catch (error) {
      compatibility.error = error instanceof Error ? error.message : "compatibility_write_failed";
      const failureClient = await pool.connect();
      try {
        await recordCompatibilityFailure(failureClient, "track", visitId, config.legacyDataRoot, {
          error: compatibility.error,
        });
      } finally {
        failureClient.release();
      }
    }
  }

  return {
    visitId,
    placeId,
    pointCount: input.points.length,
    compatibility,
  };
}
