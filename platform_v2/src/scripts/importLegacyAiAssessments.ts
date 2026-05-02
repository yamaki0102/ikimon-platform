/**
 * Import legacy `ai_assessments` / `subjects` / `recommended_taxon` from
 * `<LEGACY_DATA_ROOT>/observations/*.json` into the v2 DB tables:
 *   - observation_ai_runs
 *   - observation_ai_assessments
 *   - observation_ai_subject_candidates
 *
 * 2026-04-23 INC response: 対応 151 obs が本番 / staging 両 DB に取り込まれた。
 * 残る observations で `ai_assessments` が空のもの (約 6380 件) は、
 * 新規に AI 再同定を走らせるか観察詳細ページで on-demand に assess する
 * 別 pipeline が必要。
 *
 * Usage:
 *   LEGACY_DATA_ROOT=/var/www/ikimon.life/repo/upload_package/data \
 *     npx tsx platform_v2/src/scripts/importLegacyAiAssessments.ts
 *
 * 現状の本実装は Python 版 (ops で VPS 上に置く) と等価。
 * TypeScript 移植は将来の PR で。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";

type LegacyObservation = {
  id?: string;
  ai_assessments?: Array<Record<string, unknown>>;
  created_at?: string;
};

type AiAssessment = {
  id?: string;
  model?: string;
  prompt_version?: string;
  pipeline_version?: string;
  taxonomy_version?: string;
  created_at?: string;
  recommended_taxon?: {
    scientific_name?: string;
    name?: string;
    rank?: string;
    vernacular_name?: string;
    name_ja?: string;
    common_name?: string;
  };
  confidence?: number;
  recommended_confidence?: number;
  narrative?: string;
  simple_summary?: string;
  next_step_text?: string;
  next_step?: string;
  stop_reason?: string;
  fun_fact?: string | { body?: string; search_keyword?: string };
  observer_boost?: string;
  similar_taxa?: unknown[];
  diagnostic_features_seen?: unknown[];
  diagnostic_features?: unknown[];
  missing_evidence?: unknown[];
  distinguishing_tips?: unknown[];
  confirm_more?: unknown[];
  geographic_context?: string;
  seasonal_context?: string;
};

/** legacy fun_fact は dict ({body, search_keyword}) で格納される場合があるので body だけ取り出す */
function extractFunFact(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "body" in value) {
    const body = (value as { body?: unknown }).body;
    return typeof body === "string" ? body : "";
  }
  return "";
}

const DATA_ROOT = (process.env.LEGACY_DATA_ROOT ?? "/var/www/ikimon.life/repo/upload_package/data") + "/observations";

function confidenceBand(score: number | null | undefined): string {
  if (score === null || score === undefined) return "";
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.3) return "low";
  return "very_low";
}

async function main(): Promise<void> {
  const pool = getPool();
  const files = (await fs.readdir(DATA_ROOT))
    .filter((f) => f.endsWith(".json") && !f.includes(".bak"))
    .map((f) => path.join(DATA_ROOT, f))
    .sort();
  console.log(`[collect] scanning ${files.length} json files`);

  const candidates: LegacyObservation[] = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(f, "utf8");
      const d = JSON.parse(raw);
      const recs: LegacyObservation[] = Array.isArray(d) ? d : (d.observations ?? []);
      for (const r of recs) {
        if (r.ai_assessments && r.ai_assessments.length > 0) {
          candidates.push(r);
        }
      }
    } catch (e) {
      console.warn(`[skip] ${f}:`, e instanceof Error ? e.message : String(e));
    }
  }
  console.log(`[collect] observations with ai_assessments: ${candidates.length}`);

  let runsInserted = 0;
  let assessmentsInserted = 0;
  let candidatesInserted = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of candidates) {
      const obsId = r.id;
      if (!obsId) continue;
      const occurrenceId = `occ:${obsId}:0`;
      const visitRow = await client.query<{ visit_id: string }>(
        "select visit_id from occurrences where occurrence_id = $1 limit 1",
        [occurrenceId],
      );
      if (visitRow.rows.length === 0) continue;
      const visitId = visitRow.rows[0]!.visit_id;

      for (const [idx, rawAi] of (r.ai_assessments ?? []).entries()) {
        const a = rawAi as AiAssessment;
        const aiRunId = randomUUID();
        const assessmentId = randomUUID();
        const model = a.model ?? "";
        const promptVer = a.prompt_version ?? "";
        const pipeVer = a.pipeline_version ?? "";
        const taxVer = a.taxonomy_version ?? "";
        const created = a.created_at ?? r.created_at ?? "2026-04-01";
        const recTax = a.recommended_taxon ?? {};
        const recName = recTax.scientific_name ?? recTax.name ?? null;
        const recRank = recTax.rank ?? null;
        const recVernacular = recTax.vernacular_name ?? recTax.name_ja ?? recTax.common_name ?? null;
        const confidence = a.confidence ?? a.recommended_confidence ?? null;
        const legacyAssessmentId = a.id ?? `legacy-ai-${obsId}-${idx}`;

        await client.query(
          `insert into observation_ai_runs (ai_run_id, visit_id, trigger_occurrence_id, pipeline_version,
             model_provider, model_name, model_version, prompt_version, taxonomy_version, input_asset_fingerprint,
             trigger_kind, run_status, source_payload, generated_at)
           values ($1, $2, $3, $4, $5, $6, '', $7, $8, '', 'legacy_import', 'succeeded', $9::jsonb, $10::timestamptz)
           on conflict do nothing`,
          [
            aiRunId, visitId, occurrenceId, pipeVer,
            model.toLowerCase().includes("gemini") ? "gemini" : "", model,
            promptVer, taxVer, JSON.stringify(a), created,
          ],
        );
        runsInserted += 1;

        await client.query(
          `insert into observation_ai_assessments (assessment_id, occurrence_id, visit_id,
             legacy_observation_id, legacy_assessment_id, confidence_band, model_used, prompt_version,
             recommended_rank, recommended_taxon_name, best_specific_taxon_name, narrative, simple_summary,
             observer_boost, next_step_text, stop_reason, fun_fact, fun_fact_grounded,
             diagnostic_features_seen, missing_evidence, similar_taxa, distinguishing_tips,
             confirm_more, geographic_context, seasonal_context, raw_json, generated_at, ai_run_id,
             pipeline_version, taxonomy_version, interpretation_status)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, $12, $13, $14, $15, $16, false,
             $17::jsonb, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22, $23, $24::jsonb,
             $25::timestamptz, $26, $27, $28, 'selected')
           on conflict do nothing`,
          [
            assessmentId, occurrenceId, visitId, obsId, legacyAssessmentId, confidenceBand(confidence),
            model, promptVer, recRank, recName,
            a.narrative ?? a["summary" as keyof AiAssessment] ?? "",
            a.simple_summary ?? a["short_summary" as keyof AiAssessment] ?? "",
            a.observer_boost ?? "",
            a.next_step_text ?? a.next_step ?? "",
            a.stop_reason ?? "", extractFunFact(a.fun_fact),
            JSON.stringify(a.diagnostic_features_seen ?? a.diagnostic_features ?? []),
            JSON.stringify(a.missing_evidence ?? []),
            JSON.stringify(a.similar_taxa ?? []),
            JSON.stringify(a.distinguishing_tips ?? []),
            JSON.stringify(a.confirm_more ?? []),
            a.geographic_context ?? "", a.seasonal_context ?? "",
            JSON.stringify(a), created,
            aiRunId, pipeVer, taxVer,
          ],
        );
        assessmentsInserted += 1;

        if (recName) {
          const candKey = `legacy:${obsId}:${idx}:primary`;
          await client.query(
            `insert into observation_ai_subject_candidates (ai_run_id, visit_id,
               suggested_occurrence_id, candidate_key, vernacular_name, scientific_name,
               taxon_rank, confidence_score, candidate_status, source_payload)
             values ($1, $2, $3, $4, $5, $6, $7, $8, 'proposed', $9::jsonb)
             on conflict do nothing`,
            [aiRunId, visitId, occurrenceId, candKey, recVernacular, recName, recRank, confidence, JSON.stringify(recTax)],
          );
          candidatesInserted += 1;
        }
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  console.log(`[done] runs=${runsInserted}, assessments=${assessmentsInserted}, candidates=${candidatesInserted}`);
  await pool.end();
}

void main();
