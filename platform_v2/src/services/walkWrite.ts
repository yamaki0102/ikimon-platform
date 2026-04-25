import { getPool } from "../db.js";

export type WalkSessionInput = {
  externalId?: string | null;
  userId: string;
  startedAt: string;
  endedAt?: string | null;
  distanceM?: number | null;
  stepCount?: number | null;
  passiveDetectionCount?: number;
  topSpecies?: string[];
  biome?: string | null;
  source?: string;
  rawPayload?: Record<string, unknown>;
};

export type WalkSessionResult = {
  walkSessionId: string;
  created: boolean;
};

export async function upsertWalkSession(input: WalkSessionInput): Promise<WalkSessionResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ walk_session_id: string; created: boolean }>(
      `insert into walk_sessions
         (external_id, user_id, started_at, ended_at, distance_m, step_count,
          passive_detection_count, top_species, biome, source, raw_payload)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
       on conflict (external_id) do update set
         ended_at                  = coalesce(excluded.ended_at, walk_sessions.ended_at),
         distance_m                = coalesce(excluded.distance_m, walk_sessions.distance_m),
         step_count                = coalesce(excluded.step_count, walk_sessions.step_count),
         passive_detection_count   = excluded.passive_detection_count,
         top_species               = excluded.top_species,
         biome                     = coalesce(excluded.biome, walk_sessions.biome),
         raw_payload               = excluded.raw_payload
       returning walk_session_id, (xmax = 0) as created`,
      [
        input.externalId ?? null,
        input.userId,
        input.startedAt,
        input.endedAt ?? null,
        input.distanceM ?? null,
        input.stepCount ?? null,
        input.passiveDetectionCount ?? 0,
        JSON.stringify(input.topSpecies ?? []),
        input.biome ?? null,
        input.source ?? "fieldscan",
        JSON.stringify(input.rawPayload ?? {}),
      ],
    );
    const row = result.rows[0];
    return {
      walkSessionId: row?.walk_session_id ?? "",
      created: Boolean(row?.created),
    };
  } finally {
    client.release();
  }
}

export type TodayWalkSummary = {
  sessionCount: number;
  totalDistanceM: number;
  totalDetections: number;
  topSpecies: string[];
};

export async function getTodayWalkSummary(userId: string): Promise<TodayWalkSummary> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{
      session_count: string;
      total_distance_m: string | null;
      total_detections: string;
      all_species: string[] | null;
    }>(
      `select
         count(*)                                   as session_count,
         sum(distance_m)                            as total_distance_m,
         sum(passive_detection_count)               as total_detections,
         array_agg(top_species) filter (where top_species <> '{}') as all_species
       from walk_sessions
       where user_id = $1
         and started_at >= current_date
         and started_at < current_date + interval '1 day'`,
      [userId],
    );
    const row = result.rows[0];
    const flatSpecies = (row?.all_species ?? [])
      .flat()
      .filter((s): s is string => typeof s === "string")
      .slice(0, 5);
    return {
      sessionCount: Number(row?.session_count ?? 0),
      totalDistanceM: Number(row?.total_distance_m ?? 0),
      totalDetections: Number(row?.total_detections ?? 0),
      topSpecies: flatSpecies,
    };
  } finally {
    client.release();
  }
}
