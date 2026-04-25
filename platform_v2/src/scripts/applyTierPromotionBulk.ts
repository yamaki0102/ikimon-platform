/**
 * Phase γ: 既存 occurrences に対して tryAutoPromoteToTier1_5 を一括適用。
 *
 * 2026-04-24: role_tag backfill 後、組写真カバレッジが確保された obs を
 * Tier 1 → 1.5 に自動昇格させる (ENABLE_ROLE_COVERAGE_PROMOTION=true 時)。
 * 既に Tier >= 2 の obs は tryAuto 関数側で早期 return されるので safe。
 *
 * Usage:
 *   DATABASE_URL=... npx tsx platform_v2/src/scripts/applyTierPromotionBulk.ts
 */
import { getPool } from "../db.js";
import { tryAutoPromoteToTier1_5 } from "./../services/tierPromotion.js";

async function main(): Promise<void> {
  const pool = getPool();
  const rows = await pool.query<{ occurrence_id: string }>(
    `SELECT occurrence_id FROM occurrences WHERE coalesce(evidence_tier, 1) < 2 ORDER BY created_at DESC`,
  );
  const targets = rows.rows;
  console.log(`[collect] tier<2 occurrences: ${targets.length}`);
  let promoted = 0;
  let checked = 0;
  for (const row of targets) {
    checked += 1;
    try {
      const ok = await tryAutoPromoteToTier1_5(row.occurrence_id);
      if (ok) {
        promoted += 1;
        console.log(`[promoted] ${row.occurrence_id}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[fail] ${row.occurrence_id}: ${msg}`);
    }
  }
  console.log(`[done] checked=${checked}, promoted=${promoted}`);
  await pool.end();
}

void main();
