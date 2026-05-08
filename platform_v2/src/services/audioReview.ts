import type { PoolClient } from "pg";
import { getPool } from "../db.js";

export type ReviewStatus =
  | "ai_candidate"
  | "needs_review"
  | "representative_picked"
  | "confirmed"
  | "published"
  | "rejected";

export type ClusterReviewSummary = {
  clusterId: string;
  reviewStatus: ReviewStatus;
  priority: string;
  memberCount: number;
  representativeSegmentId: string | null;
  dominantTaxonGuess: string | null;
  taxonConfidence: number | null;
  confirmedTaxonId: string | null;
  confirmedLabel: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  propagatedCount: number;
  reviewedAt: string | null;
  gbifPublishEligible: boolean;
  createdAt: string;
};

export type ClusterMember = {
  segmentId: string;
  distanceToCentroid: number;
  propagatedLabelStatus: string;
  recordedAt: string | null;
  candidateTaxon: string | null;
  bestConfidence: number | null;
  siteId: string | null;
  plotId: string | null;
  deviceId: string | null;
  modelId: string | null;
  modelVersion: string | null;
  spectrogramRef: string | null;
  clipRef: string | null;
  sampleRateHz: number | null;
  frequencyRangeHz: { low: number | null; high: number | null } | null;
  inferenceWindowSec: number | null;
};

export type ListReviewQueueOptions = {
  status?: ReviewStatus | "any";
  priority?: "high" | "normal" | "archive" | "any";
  limit?: number;
  offset?: number;
};

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}

function clampOffset(offset: number | undefined): number {
  if (typeof offset !== "number" || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.trunc(offset));
}

export async function listReviewQueue(
  options: ListReviewQueueOptions = {},
): Promise<ClusterReviewSummary[]> {
  const limit = clampLimit(options.limit);
  const offset = clampOffset(options.offset);
  const status = options.status ?? "needs_review";
  const priority = options.priority ?? "any";

  const params: Array<string | number> = [];
  const filters: string[] = [];

  if (status !== "any") {
    params.push(status);
    filters.push(`q.review_status = $${params.length}`);
  }
  if (priority !== "any") {
    params.push(priority);
    filters.push(`q.priority = $${params.length}`);
  }

  params.push(limit);
  const limitParamIdx = params.length;
  params.push(offset);
  const offsetParamIdx = params.length;

  const sql = `
    select c.cluster_id::text       as cluster_id,
           q.review_status           as review_status,
           q.priority                as priority,
           c.member_count            as member_count,
           c.representative_segment_id::text as representative_segment_id,
           c.dominant_taxon_guess    as dominant_taxon_guess,
           c.taxon_confidence        as taxon_confidence,
           c.confirmed_taxon_id      as confirmed_taxon_id,
           c.confirmed_label         as confirmed_label,
           c.confirmed_by            as confirmed_by,
           c.confirmed_at::text      as confirmed_at,
           c.propagated_count        as propagated_count,
           q.reviewed_at::text       as reviewed_at,
           q.gbif_publish_eligible   as gbif_publish_eligible,
           c.created_at::text        as created_at
      from audio_review_queue q
      join sound_clusters c on c.cluster_id = q.cluster_id
     ${filters.length ? `where ${filters.join(" and ")}` : ""}
     order by q.priority asc, c.member_count desc, c.created_at desc
     limit $${limitParamIdx} offset $${offsetParamIdx}
  `;

  const result = await getPool().query<{
    cluster_id: string;
    review_status: ReviewStatus;
    priority: string;
    member_count: number;
    representative_segment_id: string | null;
    dominant_taxon_guess: string | null;
    taxon_confidence: number | null;
    confirmed_taxon_id: string | null;
    confirmed_label: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    propagated_count: number;
    reviewed_at: string | null;
    gbif_publish_eligible: boolean;
    created_at: string;
  }>(sql, params);

  return result.rows.map((row) => ({
    clusterId: row.cluster_id,
    reviewStatus: row.review_status,
    priority: row.priority,
    memberCount: Number(row.member_count),
    representativeSegmentId: row.representative_segment_id,
    dominantTaxonGuess: row.dominant_taxon_guess,
    taxonConfidence: row.taxon_confidence != null ? Number(row.taxon_confidence) : null,
    confirmedTaxonId: row.confirmed_taxon_id,
    confirmedLabel: row.confirmed_label,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    propagatedCount: Number(row.propagated_count),
    reviewedAt: row.reviewed_at,
    gbifPublishEligible: row.gbif_publish_eligible,
    createdAt: row.created_at,
  }));
}

export async function getClusterDetail(
  clusterId: string,
): Promise<{ summary: ClusterReviewSummary; members: ClusterMember[] } | null> {
  // listReviewQueue は queue 経由なので、queue 行が無い cluster も拾えるよう個別 SQL で取得。
  const pool = getPool();
  const summary = await pool.query<{
    cluster_id: string;
    review_status: ReviewStatus;
    priority: string;
    member_count: number;
    representative_segment_id: string | null;
    dominant_taxon_guess: string | null;
    taxon_confidence: number | null;
    confirmed_taxon_id: string | null;
    confirmed_label: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    propagated_count: number;
    reviewed_at: string | null;
    gbif_publish_eligible: boolean;
    created_at: string;
  }>(
    `select c.cluster_id::text       as cluster_id,
            coalesce(q.review_status, 'ai_candidate') as review_status,
            coalesce(q.priority, 'normal')           as priority,
            c.member_count            as member_count,
            c.representative_segment_id::text as representative_segment_id,
            c.dominant_taxon_guess    as dominant_taxon_guess,
            c.taxon_confidence        as taxon_confidence,
            c.confirmed_taxon_id      as confirmed_taxon_id,
            c.confirmed_label         as confirmed_label,
            c.confirmed_by            as confirmed_by,
            c.confirmed_at::text      as confirmed_at,
            c.propagated_count        as propagated_count,
            q.reviewed_at::text       as reviewed_at,
            coalesce(q.gbif_publish_eligible, false) as gbif_publish_eligible,
            c.created_at::text        as created_at
       from sound_clusters c
       left join audio_review_queue q on q.cluster_id = c.cluster_id
      where c.cluster_id = $1
      limit 1`,
    [clusterId],
  );
  const summaryRow = summary.rows[0];
  if (!summaryRow) return null;

  const members = await pool.query<{
    segment_id: string;
    distance_to_centroid: number;
    propagated_label_status: string;
    recorded_at: string | null;
    candidate_taxon: string | null;
    best_confidence: number | null;
    site_id: string | null;
    plot_id: string | null;
    device_id: string | null;
    model_id: string | null;
    model_version: string | null;
    spectrogram_ref: string | null;
    clip_ref: string | null;
    sample_rate_hz: number | null;
    frequency_low_hz: number | null;
    frequency_high_hz: number | null;
    inference_window_sec: number | null;
  }>(
    `select m.segment_id::text as segment_id,
            m.distance_to_centroid,
            m.propagated_label_status,
            s.recorded_at::text as recorded_at,
            s.meta->>'site_id' as site_id,
            s.meta->>'plot_id' as plot_id,
            s.meta->>'device_id' as device_id,
            top.raw_score->>'model_id' as model_id,
            top.raw_score->>'model_version' as model_version,
            ea.source_payload->>'spectrogram_ref' as spectrogram_ref,
            ea.source_payload->>'clip_ref' as clip_ref,
            nullif(coalesce(ea.source_payload->>'sample_rate_hz', s.meta->>'sample_rate_hz'), '')::int as sample_rate_hz,
            nullif(coalesce(ea.source_payload->'frequency_range_hz'->>'low', s.meta->'frequency_range_hz'->>'low'), '')::int as frequency_low_hz,
            nullif(coalesce(ea.source_payload->'frequency_range_hz'->>'high', s.meta->'frequency_range_hz'->>'high'), '')::int as frequency_high_hz,
            nullif(coalesce(ea.source_payload->>'inference_window_sec', s.meta->>'inference_window_sec'), '')::real as inference_window_sec,
            top.detected_taxon as candidate_taxon,
            top.confidence as best_confidence
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       left join lateral (
         select detected_taxon, confidence, raw_score
           from audio_detections
          where segment_id = m.segment_id
          order by confidence desc
          limit 1
       ) top on true
       left join evidence_assets ea on ea.asset_id = nullif(s.meta->>'evidence_asset_id', '')::uuid
      where m.cluster_id = $1
      order by m.distance_to_centroid asc
      limit 100`,
    [clusterId],
  );

  return {
    summary: {
      clusterId: summaryRow.cluster_id,
      reviewStatus: summaryRow.review_status,
      priority: summaryRow.priority,
      memberCount: Number(summaryRow.member_count),
      representativeSegmentId: summaryRow.representative_segment_id,
      dominantTaxonGuess: summaryRow.dominant_taxon_guess,
      taxonConfidence:
        summaryRow.taxon_confidence != null ? Number(summaryRow.taxon_confidence) : null,
      confirmedTaxonId: summaryRow.confirmed_taxon_id,
      confirmedLabel: summaryRow.confirmed_label,
      confirmedBy: summaryRow.confirmed_by,
      confirmedAt: summaryRow.confirmed_at,
      propagatedCount: Number(summaryRow.propagated_count),
      reviewedAt: summaryRow.reviewed_at,
      gbifPublishEligible: summaryRow.gbif_publish_eligible,
      createdAt: summaryRow.created_at,
    },
    members: members.rows.map((row) => ({
      segmentId: row.segment_id,
      distanceToCentroid: Number(row.distance_to_centroid),
      propagatedLabelStatus: row.propagated_label_status,
      recordedAt: row.recorded_at,
      candidateTaxon: row.candidate_taxon,
      bestConfidence: row.best_confidence != null ? Number(row.best_confidence) : null,
      siteId: row.site_id,
      plotId: row.plot_id,
      deviceId: row.device_id,
      modelId: row.model_id,
      modelVersion: row.model_version,
      spectrogramRef: row.spectrogram_ref,
      clipRef: row.clip_ref,
      sampleRateHz: row.sample_rate_hz != null ? Number(row.sample_rate_hz) : null,
      frequencyRangeHz: row.frequency_low_hz != null || row.frequency_high_hz != null
        ? {
            low: row.frequency_low_hz != null ? Number(row.frequency_low_hz) : null,
            high: row.frequency_high_hz != null ? Number(row.frequency_high_hz) : null,
          }
        : null,
      inferenceWindowSec: row.inference_window_sec != null ? Number(row.inference_window_sec) : null,
    })),
  };
}

export async function pickRepresentative(
  clusterId: string,
  segmentId: string,
): Promise<void> {
  const pool = getPool();
  const exists = await pool.query<{ cnt: string }>(
    `select count(*)::text as cnt
       from sound_cluster_members
      where cluster_id = $1 and segment_id = $2`,
    [clusterId, segmentId],
  );
  if (Number(exists.rows[0]?.cnt ?? 0) === 0) {
    throw new Error("segment_not_in_cluster");
  }
  await pool.query(
    `update sound_clusters
        set representative_segment_id = $2,
            updated_at = now()
      where cluster_id = $1`,
    [clusterId, segmentId],
  );
  await pool.query(
    `update audio_review_queue
        set review_status = case
              when review_status in ('confirmed', 'published', 'rejected') then review_status
              else 'representative_picked'
            end,
            updated_at = now()
      where cluster_id = $1`,
    [clusterId],
  );
}

export type ConfirmClusterInput = {
  clusterId: string;
  taxonId: string | null;
  label: string;
  reviewerUserId: string;
  gbifPublishEligible?: boolean;
  notes?: string;
  scientificName?: string;
};

export async function confirmCluster(
  input: ConfirmClusterInput,
  client?: PoolClient,
): Promise<void> {
  if (!input.clusterId) throw new Error("clusterId_required");
  if (!input.label) throw new Error("label_required");
  if (!input.reviewerUserId) throw new Error("reviewerUserId_required");

  if (!client) {
    const pooled = await getPool().connect();
    try {
      await pooled.query("begin");
      await confirmCluster(input, pooled);
      await pooled.query("commit");
    } catch (error) {
      await pooled.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      pooled.release();
    }
    return;
  }

  const runner = client;
  await runner.query(
    `update sound_clusters
        set confirmed_taxon_id = $2,
            confirmed_label = $3,
            confirmed_by = $4,
            confirmed_at = now(),
            review_status = 'confirmed',
            notes = coalesce($5, notes),
            updated_at = now()
      where cluster_id = $1`,
    [
      input.clusterId,
      input.taxonId,
      input.label,
      input.reviewerUserId,
      input.notes ?? null,
    ],
  );
  await runner.query(
    `insert into audio_review_queue (cluster_id, priority, review_status, reviewed_by, reviewed_at, gbif_publish_eligible)
       values ($1, 'normal', 'confirmed', $2, now(), $3)
       on conflict (cluster_id) do update set
          review_status = 'confirmed',
          reviewed_by = $2,
          reviewed_at = now(),
          gbif_publish_eligible = $3,
          updated_at = now()`,
    [input.clusterId, input.reviewerUserId, input.gbifPublishEligible ?? false],
  );
  await applyConfirmedClusterToCanonical(input, runner);
}

export async function rejectCluster(
  clusterId: string,
  reviewerUserId: string,
  reason: string,
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(
    `update sound_clusters
        set review_status = 'rejected',
            confirmed_by = $2,
            confirmed_at = now(),
            notes = coalesce(notes, '') || case when notes is null or notes = '' then $3 else E'\n' || $3 end,
            updated_at = now()
      where cluster_id = $1`,
    [clusterId, reviewerUserId, reason],
    );
    await client.query(
    `insert into audio_review_queue (cluster_id, priority, review_status, reviewed_by, reviewed_at, rejection_reason)
       values ($1, 'archive', 'rejected', $2, now(), $3)
       on conflict (cluster_id) do update set
          review_status = 'rejected',
          reviewed_by = $2,
          reviewed_at = now(),
          rejection_reason = $3,
          updated_at = now()`,
    [clusterId, reviewerUserId, reason],
    );
    await applyRejectedClusterToCanonical({ clusterId, reviewerUserId, reason }, client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function flagForReview(clusterId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `insert into audio_review_queue (cluster_id, priority, review_status)
       values ($1, 'high', 'needs_review')
       on conflict (cluster_id) do update set
          review_status = case
            when audio_review_queue.review_status in ('confirmed', 'published', 'rejected')
              then audio_review_queue.review_status
            else 'needs_review'
          end,
          priority = 'high',
          updated_at = now()`,
    [clusterId],
  );
}

async function applyConfirmedClusterToCanonical(input: ConfirmClusterInput, client: PoolClient): Promise<void> {
  await client.query(
    `update occurrences o
        set vernacular_name = coalesce(o.vernacular_name, $2),
            scientific_name = coalesce(o.scientific_name, nullif($3, '')),
            evidence_tier = case when coalesce(o.evidence_tier, 0) < 2 then 2 else o.evidence_tier end,
            data_quality = 'reviewer_verified',
            ai_assessment_status = 'reviewer_verified',
            evidence_tags = coalesce(o.evidence_tags, '[]'::jsonb) || '["audio-reviewer-verified"]'::jsonb,
            source_payload = coalesce(o.source_payload, '{}'::jsonb) || $4::jsonb,
            updated_at = now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
      where m.cluster_id = $1
        and s.visit_id = o.visit_id
        and o.basis_of_record = 'MachineObservation'`,
    [
      input.clusterId,
      input.label,
      input.scientificName ?? null,
      JSON.stringify({
        audio_review: {
          cluster_id: input.clusterId,
          reviewer_user_id: input.reviewerUserId,
          status: "reviewer_verified",
          confirmed_label: input.label,
          confirmed_taxon_id: input.taxonId,
          reviewed_at: new Date().toISOString(),
        },
      }),
    ],
  );

  await client.query(
    `insert into identifications (
        occurrence_id, actor_user_id, actor_kind, proposed_name, identification_method,
        confidence_score, is_current, notes, source_payload, created_at
     )
     select distinct o.occurrence_id,
            case when exists (select 1 from users u where u.user_id = $2) then $2 else null end,
            'human', $3,
            'audio_reviewer_verification', null, true,
            'reviewer検証済み。AI候補から人間レビューで確定。',
            $4::jsonb, now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       join occurrences o on o.visit_id = s.visit_id
      where m.cluster_id = $1
        and o.basis_of_record = 'MachineObservation'`,
    [
      input.clusterId,
      input.reviewerUserId,
      input.label,
      JSON.stringify({
        cluster_id: input.clusterId,
        confirmed_taxon_id: input.taxonId,
        review_status: "confirmed",
        source: "audio_review_queue",
      }),
    ],
  );

  await client.query(
    `update observation_quality_reviews oqr
        set review_status = 'verified',
            reason_code = 'reviewer_verified_audio_detection',
            reason_detail = $2,
            quality_signals = coalesce(oqr.quality_signals, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       join occurrences o on o.visit_id = s.visit_id
      where m.cluster_id = $1
        and oqr.occurrence_id = o.occurrence_id
        and oqr.review_kind = 'passive_audio_ai_detection'`,
    [
      input.clusterId,
      "reviewer_verified_audio_detection",
      JSON.stringify({
        cluster_id: input.clusterId,
        reviewer_user_id: input.reviewerUserId,
        confirmed_label: input.label,
        gbif_publish_eligible: input.gbifPublishEligible ?? false,
      }),
    ],
  );

  await client.query(
    `insert into observation_package_events (
        package_event_id, visit_id, occurrence_id, event_stage, event_kind,
        actor_kind, actor_user_id, decision_authority, human_review_required,
        event_payload, created_at
     )
     select distinct
            'pkg_event:' || o.visit_id || ':audio_reviewer_verified:' || $1,
            o.visit_id, o.occurrence_id, 'reviewed_data', 'audio_reviewer_verified',
            'human', nullif($2, 'system_write_key'), 'trusted_reviewer', false,
            $3::jsonb, now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       join occurrences o on o.visit_id = s.visit_id
      where m.cluster_id = $1
        and o.basis_of_record = 'MachineObservation'
     on conflict (package_event_id) do nothing`,
    [
      input.clusterId,
      input.reviewerUserId,
      JSON.stringify({
        cluster_id: input.clusterId,
        confirmed_label: input.label,
        confirmed_taxon_id: input.taxonId,
        gbif_publish_eligible: input.gbifPublishEligible ?? false,
        claim_limit: "reviewed_record_not_certification",
      }),
    ],
  );
}

async function applyRejectedClusterToCanonical(
  input: { clusterId: string; reviewerUserId: string; reason: string },
  client: PoolClient,
): Promise<void> {
  await client.query(
    `update occurrences o
        set data_quality = 'rejected',
            ai_assessment_status = 'reviewer_rejected',
            evidence_tags = coalesce(o.evidence_tags, '[]'::jsonb) || '["audio-reviewer-rejected"]'::jsonb,
            source_payload = coalesce(o.source_payload, '{}'::jsonb) || $2::jsonb,
            updated_at = now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
      where m.cluster_id = $1
        and s.visit_id = o.visit_id
        and o.basis_of_record = 'MachineObservation'`,
    [
      input.clusterId,
      JSON.stringify({
        audio_review: {
          cluster_id: input.clusterId,
          reviewer_user_id: input.reviewerUserId,
          status: "reviewer_rejected",
          rejection_reason: input.reason,
          reviewed_at: new Date().toISOString(),
        },
      }),
    ],
  );

  await client.query(
    `update observation_quality_reviews oqr
        set review_status = 'rejected',
            reason_code = 'reviewer_rejected_audio_detection',
            reason_detail = $2,
            quality_signals = coalesce(oqr.quality_signals, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       join occurrences o on o.visit_id = s.visit_id
      where m.cluster_id = $1
        and oqr.occurrence_id = o.occurrence_id
        and oqr.review_kind = 'passive_audio_ai_detection'`,
    [
      input.clusterId,
      input.reason,
      JSON.stringify({
        cluster_id: input.clusterId,
        reviewer_user_id: input.reviewerUserId,
        rejection_reason: input.reason,
      }),
    ],
  );

  await client.query(
    `insert into observation_package_events (
        package_event_id, visit_id, occurrence_id, event_stage, event_kind,
        actor_kind, actor_user_id, decision_authority, human_review_required,
        event_payload, created_at
     )
     select distinct
            'pkg_event:' || o.visit_id || ':audio_reviewer_rejected:' || $1,
            o.visit_id, o.occurrence_id, 'reviewed_data', 'audio_reviewer_rejected',
            'human', nullif($2, 'system_write_key'), 'trusted_reviewer', false,
            $3::jsonb, now()
       from sound_cluster_members m
       join audio_segments s on s.segment_id = m.segment_id
       join occurrences o on o.visit_id = s.visit_id
      where m.cluster_id = $1
        and o.basis_of_record = 'MachineObservation'
     on conflict (package_event_id) do nothing`,
    [
      input.clusterId,
      input.reviewerUserId,
      JSON.stringify({
        cluster_id: input.clusterId,
        rejection_reason: input.reason,
        claim_limit: "rejected_ai_candidate_not_a_record",
      }),
    ],
  );
}
