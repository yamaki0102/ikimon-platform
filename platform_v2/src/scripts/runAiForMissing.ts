/**
 * Run AI reassess for occurrences that have photos but incomplete
 * observation_ai_assessments (missing, empty recommended name, or empty
 * area_inference).
 *
 * 2026-04-24 (Phase α): prompt 拡張で area_inference / shot_suggestions が
 * 追加された。旧プロンプトで生成された assessment は area_inference={} の
 * まま。これらを一括で再生成するために条件を拡張:
 *   - assessment 行が存在しない、OR
 *   - recommended_taxon_name が空、OR
 *   - area_inference が '{}' (旧 prompt / 失敗)
 * CLI flag:
 *   --refresh-area  : area_inference 空の既存 assessment も対象にする
 *                     (default off: 安全寄り。付けないと新規／空名前のみ)
 *   --limit=N       : 最大 N 件で止める (default: all)
 *
 * Usage:
 *   LEGACY_UPLOADS_ROOT=/var/www/ikimon.life/repo/upload_package/public_html/uploads \
 *     GEMINI_API_KEY=... \
 *     npx tsx platform_v2/src/scripts/runAiForMissing.ts [--refresh-area] [--limit=20]
 */

import { getPool } from "../db.js";
import { reassessObservation } from "../services/observationReassess.js";

type Row = {
  occurrence_id: string;
  vernacular_name: string | null;
  n_photos: string;
};

function parseArgs(argv: string[]): { refreshArea: boolean; limit: number | null } {
  let refreshArea = false;
  let limit: number | null = null;
  for (const arg of argv.slice(2)) {
    if (arg === "--refresh-area") refreshArea = true;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = n;
    }
  }
  return { refreshArea, limit };
}

async function main(): Promise<void> {
  const { refreshArea, limit } = parseArgs(process.argv);
  const pool = getPool();
  const baseWhereMissing = `NOT EXISTS (
       SELECT 1 FROM observation_ai_assessments a
        WHERE a.occurrence_id = o.occurrence_id
          AND coalesce(nullif(a.recommended_taxon_name, ''), '') <> ''
     )`;
  const refreshClause = refreshArea
    ? `OR EXISTS (
         SELECT 1 FROM observation_ai_assessments a2
          WHERE a2.occurrence_id = o.occurrence_id
            AND coalesce(a2.area_inference, '{}'::jsonb) = '{}'::jsonb
       )`
    : "";
  const rows = await pool.query<Row>(
    `SELECT
       o.occurrence_id,
       o.vernacular_name,
       (SELECT count(*)::text FROM evidence_assets ea
         WHERE ea.occurrence_id = o.occurrence_id
           AND ea.asset_role = 'observation_photo') AS n_photos
     FROM occurrences o
     WHERE ${baseWhereMissing} ${refreshClause}
     ORDER BY o.created_at DESC`,
  );
  let targets = rows.rows.filter((r) => Number(r.n_photos) > 0);
  if (limit !== null) targets = targets.slice(0, limit);
  console.log(`[collect] targets with photos: ${targets.length} / total raw: ${rows.rows.length} (refreshArea=${refreshArea}${limit !== null ? `, limit=${limit}` : ""})`);
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
