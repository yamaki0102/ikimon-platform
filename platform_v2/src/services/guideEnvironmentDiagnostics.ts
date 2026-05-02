import { getPool } from "../db.js";

export type GuideEnvironmentMeshDiagnosis = {
  date: string;
  guideRecordCount: number;
  withLatLngCount: number;
  withDetectedFeaturesCount: number;
  aggregatableCount: number;
  latencyStateCount: number;
  meshMatchedRecordCount: number;
  unmatchedAggregatableCount: number;
  meshCellCount: number;
  publicMeshCellCount: number;
  suppressedByPublicThresholdCount: number;
  likelyBlocker: "no_guide_records" | "missing_location_or_features" | "mesh_rebuild_needed" | "public_threshold_only" | "healthy";
};

export function guideEnvironmentDiagnosisSql(): string {
  return `
with day_records as (
  select gr.guide_record_id,
         gr.lat,
         gr.lng,
         gr.detected_features
    from guide_records gr
   where gr.created_at >= $1::date
     and gr.created_at < ($1::date + interval '1 day')
),
record_rollup as (
  select count(*)::int as guide_record_count,
         count(*) filter (where lat is not null and lng is not null)::int as with_lat_lng_count,
         count(*) filter (
           where jsonb_typeof(detected_features) = 'array'
             and jsonb_array_length(detected_features) > 0
         )::int as with_detected_features_count,
         count(*) filter (
           where lat is not null
             and lng is not null
             and jsonb_typeof(detected_features) = 'array'
             and jsonb_array_length(detected_features) > 0
         )::int as aggregatable_count
    from day_records
),
latency_rollup as (
  select count(gls.guide_record_id)::int as latency_state_count
    from day_records dr
    join guide_record_latency_states gls on gls.guide_record_id = dr.guide_record_id
),
mesh_match_rollup as (
  select count(distinct dr.guide_record_id)::int as mesh_matched_record_count
    from day_records dr
    join guide_environment_mesh_cells gemc
      on gemc.sample_record_ids ? (dr.guide_record_id::text)
),
mesh_day_rollup as (
  select count(*)::int as mesh_cell_count,
         count(*) filter (where guide_record_count >= 3 or contributor_count >= 2)::int as public_mesh_cell_count
    from guide_environment_mesh_cells
   where last_seen_at >= $1::date
     and last_seen_at < ($1::date + interval '1 day')
)
select $1::date::text as date,
       rr.guide_record_count,
       rr.with_lat_lng_count,
       rr.with_detected_features_count,
       rr.aggregatable_count,
       lr.latency_state_count,
       mmr.mesh_matched_record_count,
       greatest(rr.aggregatable_count - mmr.mesh_matched_record_count, 0)::int as unmatched_aggregatable_count,
       mdr.mesh_cell_count,
       mdr.public_mesh_cell_count,
       greatest(mdr.mesh_cell_count - mdr.public_mesh_cell_count, 0)::int as suppressed_by_public_threshold_count
  from record_rollup rr
 cross join latency_rollup lr
 cross join mesh_match_rollup mmr
 cross join mesh_day_rollup mdr`;
}

function likelyBlocker(row: Omit<GuideEnvironmentMeshDiagnosis, "likelyBlocker">): GuideEnvironmentMeshDiagnosis["likelyBlocker"] {
  if (row.guideRecordCount === 0) return "no_guide_records";
  if (row.aggregatableCount === 0) return "missing_location_or_features";
  if (row.meshMatchedRecordCount === 0 || row.unmatchedAggregatableCount > 0) return "mesh_rebuild_needed";
  if (row.publicMeshCellCount === 0 && row.meshCellCount > 0) return "public_threshold_only";
  return "healthy";
}

function toInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export async function diagnoseGuideEnvironmentMesh(date: string): Promise<GuideEnvironmentMeshDiagnosis> {
  const result = await getPool().query<Record<string, unknown>>(guideEnvironmentDiagnosisSql(), [date]);
  const row = result.rows[0] ?? {};
  const diagnosis: Omit<GuideEnvironmentMeshDiagnosis, "likelyBlocker"> = {
    date: String(row.date ?? date),
    guideRecordCount: toInt(row.guide_record_count),
    withLatLngCount: toInt(row.with_lat_lng_count),
    withDetectedFeaturesCount: toInt(row.with_detected_features_count),
    aggregatableCount: toInt(row.aggregatable_count),
    latencyStateCount: toInt(row.latency_state_count),
    meshMatchedRecordCount: toInt(row.mesh_matched_record_count),
    unmatchedAggregatableCount: toInt(row.unmatched_aggregatable_count),
    meshCellCount: toInt(row.mesh_cell_count),
    publicMeshCellCount: toInt(row.public_mesh_cell_count),
    suppressedByPublicThresholdCount: toInt(row.suppressed_by_public_threshold_count),
  };
  return { ...diagnosis, likelyBlocker: likelyBlocker(diagnosis) };
}

export const __test__ = { likelyBlocker };
