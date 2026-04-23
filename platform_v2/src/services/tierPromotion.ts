import { getPool } from "../db.js";

/**
 * Environment flag (default on) for Phase γ role-coverage promotion path.
 * Set ENABLE_ROLE_COVERAGE_PROMOTION=false to disable the alternative
 * Tier 1 → 1.5 route without a redeploy.
 */
function roleCoveragePromotionEnabled(): boolean {
  const raw = (process.env.ENABLE_ROLE_COVERAGE_PROMOTION ?? "").trim().toLowerCase();
  if (raw === "" || raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  return false;
}

/**
 * Tier 1 → 1.5 auto-promotion.
 *
 * Criteria (いずれかを満たせば昇格):
 *   (A) AI confidence ≥ 0.8 かつ 同 place の先例 ≥ 1 (既存経路)
 *   (B) AI confidence ≥ 0.7 かつ 同 place の先例 ≥ 1 かつ
 *       role_tag (full_body/close_up_organ/habitat_wide/substrate/
 *       scale_reference) が ≥ 3 種類揃っている (Phase γ 組写真経路)
 *
 * (B) 経路は ENABLE_ROLE_COVERAGE_PROMOTION=false で即 off 可能。
 * Tier 2+ は一切触らない (authority gate 維持)。
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

    // Check regional prior occurrence (same place_id, any time). 両経路で必要。
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

    // 経路 (A): 既存 — confidence ≥ 0.8
    let shouldPromote = confidence >= 0.8;

    // 経路 (B): Phase γ — confidence ≥ 0.7 + role coverage ≥ 3
    if (!shouldPromote && roleCoveragePromotionEnabled() && confidence >= 0.7) {
      const roleRow = await client.query<{ role_count: string }>(
        `select count(distinct role_tag) as role_count
           from evidence_assets
          where occurrence_id = $1
            and role_tag is not null
            and role_tag <> 'unknown'`,
        [occurrenceId],
      );
      const roleCount = Number(roleRow.rows[0]?.role_count ?? 0);
      if (roleCount >= 3) shouldPromote = true;
    }

    if (!shouldPromote) return false;

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
