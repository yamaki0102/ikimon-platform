/**
 * Run AI reassess for occurrences that have photos but no observation_ai_assessments.
 *
 * 2026-04-24: 本番 purge 後、photo 有り × AI 未同定 の obs は ~4件。
 * `reassessObservation` を直接呼んで埋める（session auth をバイパス）。
 *
 * Usage:
 *   LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads \
 *     GEMINI_API_KEY=... \
 *     npx tsx platform_v2/src/scripts/runAiForMissing.ts
 */

import { getPool } from "../db.js";
import { reassessObservation } from "../services/observationReassess.js";

type Row = {
  occurrence_id: string;
  vernacular_name: string | null;
  n_photos: string;
};

async function main(): Promise<void> {
  const pool = getPool();
  const rows = await pool.query<Row>(
    `SELECT
       o.occurrence_id,
       o.vernacular_name,
       (SELECT count(*)::text FROM evidence_assets ea
         WHERE ea.occurrence_id = o.occurrence_id
           AND ea.asset_role = 'observation_photo') AS n_photos
     FROM occurrences o
     LEFT JOIN observation_ai_assessments a ON a.occurrence_id = o.occurrence_id
     WHERE a.assessment_id IS NULL
     ORDER BY o.created_at DESC`,
  );
  const targets = rows.rows.filter((r) => Number(r.n_photos) > 0);
  console.log(`[collect] missing AI with photos: ${targets.length} / total missing: ${rows.rows.length}`);
  let ok = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      console.log(`[run] ${t.occurrence_id} (${t.vernacular_name ?? "—"}, photos=${t.n_photos})`);
      const result = await reassessObservation(t.occurrence_id);
      console.log(`[ok]  ${t.occurrence_id} → ${result.recommendedTaxonName ?? "(no name)"}`);
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[fail] ${t.occurrence_id}: ${msg}`);
      failed += 1;
    }
  }
  console.log(`[done] ok=${ok}, failed=${failed}`);
  await pool.end();
}

void main();
