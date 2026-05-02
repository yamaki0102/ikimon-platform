import { getPool } from "../db.js";
import { VALID_OBSERVATION_PHOTO_ASSET_SQL, VALID_OBSERVATION_VIDEO_ASSET_SQL } from "./observationQualityGate.js";

export type MissingObservationPhoto = {
  visitId: string;
  occurrenceId: string;
  userId: string | null;
  observedAt: string;
  displayName: string;
  expectedPhotoCount: number;
  validPhotoCount: number;
  validVideoCount: number;
  publicVisibility: string | null;
  qualityReviewStatus: string | null;
  qualityGateReasons: string[];
  source: string | null;
  recordMode: string | null;
};

export type MissingObservationPhotoReport = {
  total: number;
  records: MissingObservationPhoto[];
};

function normalizePositiveInteger(value: string | number | null | undefined): number {
  const numberValue = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.trunc(numberValue));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

export async function getMissingObservationPhotoReport(
  options: { userId?: string | null; visitId?: string | null; limit?: number } = {},
): Promise<MissingObservationPhotoReport> {
  const pool = getPool();
  const params: Array<string | number> = [];
  const whereClauses = [
    "v.source_kind = 'v2_observation'",
    "coalesce(v.visit_mode, 'manual') in ('manual', 'survey')",
    "expected.expected_photo_count > photo.valid_photo_count",
    "expected.expected_photo_count > 0",
  ];

  if (options.userId) {
    params.push(options.userId);
    whereClauses.push(`v.user_id = $${params.length}`);
  }
  if (options.visitId) {
    params.push(options.visitId);
    whereClauses.push(`v.visit_id = $${params.length}`);
  }

  const baseSql = `
    from visits v
    join lateral (
      select greatest(
        0,
        case
          when coalesce(v.source_payload->>'media_count', '') ~ '^[0-9]+$'
            then (v.source_payload->>'media_count')::int
          else 0
        end
      ) as expected_photo_count
    ) expected on true
    join lateral (
      select o.occurrence_id,
             coalesce(nullif(o.vernacular_name, ''), nullif(o.scientific_name, ''), '同定待ち') as display_name
        from occurrences o
       where o.visit_id = v.visit_id
       order by o.subject_index asc, o.created_at asc
       limit 1
    ) primary_occurrence on true
    left join lateral (
      select count(*)::int as valid_photo_count
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
       where ea.visit_id = v.visit_id
         and ${VALID_OBSERVATION_PHOTO_ASSET_SQL}
    ) photo on true
    left join lateral (
      select count(*)::int as valid_video_count
        from evidence_assets ea
        join asset_blobs ab on ab.blob_id = ea.blob_id
       where ea.visit_id = v.visit_id
         and ${VALID_OBSERVATION_VIDEO_ASSET_SQL}
    ) video on true
    where ${whereClauses.join(" and ")}
  `;

  const countResult = await pool.query<{ total: string }>(
    `select count(*)::text as total ${baseSql}`,
    params,
  );

  const listParams = [...params];
  const limit = typeof options.limit === "number" && options.limit > 0
    ? Math.min(500, Math.trunc(options.limit))
    : 100;
  listParams.push(limit);
  const recordsResult = await pool.query<{
    visit_id: string;
    occurrence_id: string;
    user_id: string | null;
    observed_at: string;
    display_name: string;
    expected_photo_count: number | string | null;
    valid_photo_count: number | string | null;
    valid_video_count: number | string | null;
    public_visibility: string | null;
    quality_review_status: string | null;
    quality_gate_reasons: unknown;
    source: string | null;
    record_mode: string | null;
  }>(
    `select
        v.visit_id,
        primary_occurrence.occurrence_id,
        v.user_id,
        v.observed_at::text,
        primary_occurrence.display_name,
        expected.expected_photo_count,
        coalesce(photo.valid_photo_count, 0) as valid_photo_count,
        coalesce(video.valid_video_count, 0) as valid_video_count,
        v.public_visibility,
        v.quality_review_status,
        v.quality_gate_reasons,
        v.source_payload->>'source' as source,
        v.source_payload->>'record_mode' as record_mode
       ${baseSql}
       order by v.observed_at desc, v.visit_id desc
       limit $${listParams.length}`,
    listParams,
  );

  return {
    total: normalizePositiveInteger(countResult.rows[0]?.total ?? 0),
    records: recordsResult.rows.map((row) => ({
      visitId: row.visit_id,
      occurrenceId: row.occurrence_id,
      userId: row.user_id,
      observedAt: row.observed_at,
      displayName: row.display_name,
      expectedPhotoCount: normalizePositiveInteger(row.expected_photo_count),
      validPhotoCount: normalizePositiveInteger(row.valid_photo_count),
      validVideoCount: normalizePositiveInteger(row.valid_video_count),
      publicVisibility: row.public_visibility,
      qualityReviewStatus: row.quality_review_status,
      qualityGateReasons: normalizeStringArray(row.quality_gate_reasons),
      source: row.source,
      recordMode: row.record_mode,
    })),
  };
}
