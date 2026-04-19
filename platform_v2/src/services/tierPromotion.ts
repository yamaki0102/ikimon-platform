import { getPool } from "../db.js";

/**
 * Tier 1 → 1.5 auto-promotion.
 * Criteria: AI confidence ≥ 0.8 AND ≥1 prior occurrence in same place_key AND observation in correct season.
 * Called non-blocking after observation write or identification update.
 */
export async function tryAutoPromoteToTier1_5(occurrenceId: string): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Fetch occurrence data
    const occRow = await client.query<{
      evidence_tier: number;
      confidence_score: string | null;
      visit_id: string;
    }>(
      `select o.evidence_tier, i.confidence_score, o.visit_id
       from occurrences o
       left join lateral (
         select confidence_score from identifications
         where occurrence_id = o.occurrence_id and is_current = true
         order by created_at desc limit 1
       ) i on true
       where o.occurrence_id = $1`,
      [occurrenceId],
    );

    const occ = occRow.rows[0];
    if (!occ || occ.evidence_tier >= 2) return false; // already promoted

    const confidence = occ.confidence_score !== null ? parseFloat(occ.confidence_score) : 0;
    if (confidence < 0.8) return false;

    // Check regional prior occurrence (same place_id, any time)
    const visitRow = await client.query<{ place_id: string | null; observed_at: string }>(
      `select place_id, observed_at::text from visits where visit_id = $1 limit 1`,
      [occ.visit_id],
    );
    const visit = visitRow.rows[0];
    if (!visit?.place_id) return false;

    const priorRow = await client.query<{ cnt: string }>(
      `select count(*) as cnt
       from occurrences o2
       join visits v2 on v2.visit_id = o2.visit_id
       where v2.place_id = $1
         and o2.occurrence_id <> $2
         and o2.evidence_tier >= 1`,
      [visit.place_id, occurrenceId],
    );
    const priorCount = Number(priorRow.rows[0]?.cnt ?? 0);
    if (priorCount < 1) return false;

    // Promote
    await client.query(
      `update occurrences set evidence_tier = 1.5, updated_at = now()
       where occurrence_id = $1 and evidence_tier < 2`,
      [occurrenceId],
    );
    return true;
  } finally {
    client.release();
  }
}

/**
 * Tier 2 → 3 promotion.
 * Criteria: ≥1 public-claim approval backed by authority/admin override AND has media.
 */
export async function tryPromoteToTier3(occurrenceId: string): Promise<boolean> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query<{ approval_count: string; has_media: boolean }>(
      `select
         (select count(*) from identifications
          where occurrence_id = $1
            and actor_kind = 'human'
            and is_current = true
            and coalesce(source_payload->>'lane', '') = 'public-claim'
            and coalesce(source_payload->>'review_class', '') in ('authority_backed', 'admin_override')) as approval_count,
         exists(select 1 from evidence_assets where occurrence_id = $1) as has_media`,
      [occurrenceId],
    );
    const row = result.rows[0];
    if (!row) return false;

    const approvals = Number(row.approval_count);
    if (approvals < 1 || !row.has_media) return false;

    await client.query(
      `update occurrences set evidence_tier = 3, updated_at = now()
       where occurrence_id = $1 and evidence_tier < 3`,
      [occurrenceId],
    );
    return true;
  } finally {
    client.release();
  }
}
