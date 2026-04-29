/**
 * guide_records に残った「スズキ看板」系の非生物 species 誤判定を補正する。
 *
 * 使い方:
 *   npm run backfill:guide-non-biological-species -- --dry-run --limit=100
 *   npm run backfill:guide-non-biological-species -- --limit=500
 */

import { getPool } from "../db.js";
import { sanitizeGuideSceneResult, type DetectedFeature, type PrimarySubject } from "../services/guideSession.js";

type CandidateRow = {
  guide_record_id: string;
  scene_summary: string | null;
  detected_species: string[] | null;
  detected_features: DetectedFeature[] | null;
  primary_subject: PrimarySubject | null;
  environment_context: string | null;
  seasonal_note: string | null;
  coexisting_taxa: string[] | null;
  confidence_context: Record<string, unknown> | null;
};

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function positiveInt(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function changed(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

async function loadCandidates(limit: number): Promise<CandidateRow[]> {
  const result = await getPool().query<CandidateRow>(
    `select gr.guide_record_id::text as guide_record_id,
            gr.scene_summary,
            gr.detected_species,
            gr.detected_features,
            gls.primary_subject,
            gls.environment_context,
            gls.seasonal_note,
            gls.coexisting_taxa,
            gls.confidence_context
       from guide_records gr
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
      where array_to_string(gr.detected_species, ' ') ~* '(スズキ|suzuki|ホンダ|honda|トヨタ|toyota|日産|nissan|マツダ|mazda|ダイハツ|daihatsu|スバル|subaru|三菱|mitsubishi|ヤマハ|yamaha)'
         or gr.detected_features::text ~* '(看板|標識|ロゴ|店舗|販売店|車|自動車|suzuki|honda|toyota|nissan|mazda|daihatsu|subaru|mitsubishi|yamaha)'
         or coalesce(gr.scene_summary, '') ~* '(看板|標識|ロゴ|店舗|販売店|車|自動車|スズキ|suzuki|ホンダ|honda|トヨタ|toyota)'
      order by gr.created_at desc
      limit $1`,
    [limit],
  );
  return result.rows;
}

async function updateRow(row: CandidateRow, dryRun: boolean): Promise<{ changed: boolean; beforeSpecies: string[]; afterSpecies: string[] }> {
  const sanitized = sanitizeGuideSceneResult({
    summary: row.scene_summary ?? "",
    detectedSpecies: row.detected_species ?? [],
    detectedFeatures: row.detected_features ?? [],
    primarySubject: row.primary_subject ?? undefined,
    environmentContext: row.environment_context ?? undefined,
    seasonalNote: row.seasonal_note ?? undefined,
    coexistingTaxa: row.coexisting_taxa ?? [],
  }, "vehicle");
  const beforeSpecies = row.detected_species ?? [];
  const afterSpecies = sanitized.detectedSpecies;
  const hasChange =
    changed(beforeSpecies, afterSpecies) ||
    changed(row.detected_features ?? [], sanitized.detectedFeatures) ||
    changed(row.primary_subject ?? {}, sanitized.primarySubject ?? {});
  if (!hasChange || dryRun) {
    return { changed: hasChange, beforeSpecies, afterSpecies };
  }
  const confidenceContext = {
    ...(row.confidence_context ?? {}),
    nonBiologicalSpeciesBackfill: {
      version: "v1",
      ranAt: new Date().toISOString(),
      beforeSpecies,
      afterSpecies,
    },
  };
  await getPool().query(
    `update guide_records
        set detected_species = $2,
            detected_features = $3::jsonb
      where guide_record_id = $1`,
    [row.guide_record_id, afterSpecies, JSON.stringify(sanitized.detectedFeatures)],
  );
  await getPool().query(
    `update guide_record_latency_states
        set primary_subject = $2::jsonb,
            coexisting_taxa = $3,
            confidence_context = $4::jsonb
      where guide_record_id = $1`,
    [
      row.guide_record_id,
      JSON.stringify(sanitized.primarySubject ?? {}),
      sanitized.coexistingTaxa ?? [],
      JSON.stringify(confidenceContext),
    ],
  );
  return { changed: true, beforeSpecies, afterSpecies };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dryRun = Boolean(args["dry-run"]);
  const limit = positiveInt(args.limit, 200);
  const rows = await loadCandidates(limit);
  let changedCount = 0;
  const samples: Array<{ guideRecordId: string; beforeSpecies: string[]; afterSpecies: string[] }> = [];
  for (const row of rows) {
    const result = await updateRow(row, dryRun);
    if (result.changed) {
      changedCount += 1;
      if (samples.length < 12) {
        samples.push({ guideRecordId: row.guide_record_id, beforeSpecies: result.beforeSpecies, afterSpecies: result.afterSpecies });
      }
    }
  }
  console.log(JSON.stringify({ dryRun, scanned: rows.length, changed: changedCount, samples }, null, 2));
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
