/**
 * 環境省「侵略的外来種リスト」由来の seed JSON を knowledge_claims テーブルに
 * risk_lane='invasive', use_in_feedback=true, human_review_status='ready' で
 * upsert する専用スクリプト。
 *
 * 観察 reassess パイプライン (observationFeedbackKnowledge.ts /
 * observationReassess.ts) は、外来種候補種に対してこのテーブルから claim を
 * 引き、subject 該当の claim が存在する場合のみ AI に外来種判定を許可する
 * （Phase 1 で実装した hard-gate）。
 *
 * Usage:
 *   npx tsx src/scripts/importInvasiveKnowledgeClaims.ts [--dry-run] [--seed=path/to/seed.json]
 *
 * Default seed file: platform_v2/db/seeds/invasive_species_seed.ja.json
 *
 * 各レコードは upsert (claim_hash で冪等)。再実行で重複は発生しない。
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";

type SeedRecord = {
  scientific_name: string;
  vernacular_name: string;
  rank: string;
  mhlw_category: "iaspecified" | "priority" | "industrial" | "prevention" | "native";
  recommended_action:
    | "observe_only"
    | "observe_and_report"
    | "report_only"
    | "do_not_handle"
    | "controlled_removal";
  action_basis: string;
  legal_warning?: string;
  regional_caveat?: string;
  source_url: string;
};

const RECOMMENDED_ACTION_LABEL: Record<SeedRecord["recommended_action"], string> = {
  observe_only: "観察のみ（記録に意義あり）",
  observe_and_report: "観察と通報（自治体・環境省）",
  report_only: "通報のみ。直接の捕獲・運搬はしない",
  do_not_handle: "触れない・移動させない",
  controlled_removal: "管理された駆除（許可が必要）",
};

const MHLW_CATEGORY_LABEL: Record<SeedRecord["mhlw_category"], string> = {
  iaspecified: "特定外来生物",
  priority: "重点対策外来種",
  industrial: "産業管理外来種",
  prevention: "生態系被害防止外来種",
  native: "在来種",
};

function buildClaimText(rec: SeedRecord): string {
  const lines: string[] = [];
  lines.push(`${rec.vernacular_name} (${rec.scientific_name}) は環境省「${MHLW_CATEGORY_LABEL[rec.mhlw_category]}」に該当する外来生物です。`);
  lines.push(`推奨対応: ${RECOMMENDED_ACTION_LABEL[rec.recommended_action]}。${rec.action_basis}`);
  if (rec.legal_warning && rec.legal_warning.trim().length > 0) {
    lines.push(`法的注意: ${rec.legal_warning}`);
  }
  if (rec.regional_caveat && rec.regional_caveat.trim().length > 0) {
    lines.push(`地域差: ${rec.regional_caveat}`);
  }
  lines.push(`根拠: 環境省 侵略的外来種リスト / 外来生物法。`);
  return lines.join(" ");
}

function buildCitationSpan(rec: SeedRecord): string {
  return `Ministry of the Environment Japan invasive species list (${rec.mhlw_category}) entry for ${rec.scientific_name} / ${rec.vernacular_name}.`;
}

function claimHash(rec: SeedRecord): string {
  return (
    "claim:invasive:" +
    createHash("sha1")
      .update(`mhlw|${rec.mhlw_category}|${rec.scientific_name.toLowerCase()}|${rec.vernacular_name}`)
      .digest("hex")
      .slice(0, 16)
  );
}

function defaultSeedPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../db/seeds/invasive_species_seed.ja.json");
}

async function loadCuratorCoveredScientificNames(): Promise<Set<string>> {
  // freshness-os の curator pipeline (Sprint 4) が invasive_status_versions に
  // 既に投入している scientific_name を取得し、本 seed と重複する種は skip する。
  // テーブルが無い環境 (migration 未適用) では空セットを返してフルセット投入を許容。
  try {
    const pool = getPool();
    const result = await pool.query<{ scientific_name: string }>(
      `SELECT DISTINCT scientific_name
         FROM invasive_status_versions
        WHERE valid_to IS NULL
          AND region_scope = 'JP'`,
    );
    return new Set(result.rows.map((r) => r.scientific_name.toLowerCase()));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/relation "invasive_status_versions" does not exist|undefined_table/i.test(msg)) {
      return new Set();
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force"); // curator 投入済みも上書きする escape hatch
  const seedArg = args.find((a) => a.startsWith("--seed="));
  const seedPath = seedArg ? seedArg.slice("--seed=".length) : defaultSeedPath();

  const text = await readFile(seedPath, "utf8");
  const records = JSON.parse(text) as SeedRecord[];
  if (!Array.isArray(records)) {
    throw new Error("seed JSON must be an array");
  }

  // curator が既に invasive_status_versions に入れている種は skip (fallback 化)。
  // dry-run では DB 接続は試みるが、失敗しても続行できるようにする。
  let curatorCovered = new Set<string>();
  try {
    curatorCovered = await loadCuratorCoveredScientificNames();
  } catch (e) {
    if (!dryRun) throw e;
  }

  let upserted = 0;
  let skipped = 0;
  let skippedAsCovered = 0;
  const summaryByCategory = new Map<string, number>();

  for (const rec of records) {
    if (!rec.scientific_name || !rec.vernacular_name || !rec.mhlw_category || !rec.recommended_action) {
      skipped += 1;
      continue;
    }
    if (!force && curatorCovered.has(rec.scientific_name.toLowerCase())) {
      skippedAsCovered += 1;
      continue;
    }
    const hash = claimHash(rec);
    const claimText = buildClaimText(rec);
    const citationSpan = buildCitationSpan(rec);

    summaryByCategory.set(rec.mhlw_category, (summaryByCategory.get(rec.mhlw_category) ?? 0) + 1);

    if (dryRun) {
      upserted += 1;
      continue;
    }

    const pool = getPool();
    await pool.query(
      `INSERT INTO knowledge_claims (
         claim_hash,
         claim_type,
         claim_text,
         taxon_name,
         scientific_name,
         taxon_rank,
         taxon_group,
         place_region,
         season_bucket,
         habitat,
         evidence_type,
         risk_lane,
         target_outputs,
         citation_span,
         source_title,
         source_doi,
         source_url,
         source_provider,
         source_text_policy,
         confidence,
         human_review_status,
         needs_human_review,
         use_in_feedback,
         source_payload,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19,
         $20, $21, $22, $23, $24::jsonb, NOW()
       )
       ON CONFLICT (claim_hash) DO UPDATE SET
         claim_type = EXCLUDED.claim_type,
         claim_text = EXCLUDED.claim_text,
         taxon_name = EXCLUDED.taxon_name,
         scientific_name = EXCLUDED.scientific_name,
         taxon_rank = EXCLUDED.taxon_rank,
         taxon_group = EXCLUDED.taxon_group,
         risk_lane = EXCLUDED.risk_lane,
         target_outputs = EXCLUDED.target_outputs,
         citation_span = EXCLUDED.citation_span,
         source_url = EXCLUDED.source_url,
         source_provider = EXCLUDED.source_provider,
         confidence = EXCLUDED.confidence,
         human_review_status = EXCLUDED.human_review_status,
         needs_human_review = EXCLUDED.needs_human_review,
         use_in_feedback = EXCLUDED.use_in_feedback,
         source_payload = EXCLUDED.source_payload,
         updated_at = NOW()`,
      [
        hash,
        "risk",
        claimText,
        rec.vernacular_name,
        rec.scientific_name,
        rec.rank || "species",
        "",
        "",
        "",
        "",
        "image",
        "invasive",
        JSON.stringify(["observation_feedback"]),
        citationSpan,
        "Ministry of the Environment, Japan — Invasive Alien Species List",
        "",
        rec.source_url,
        "MoE Japan",
        "metadata_only",
        0.95,
        "ready",
        false,
        true,
        JSON.stringify({
          importedFrom: "invasive_species_seed.ja.json",
          mhlwCategory: rec.mhlw_category,
          recommendedAction: rec.recommended_action,
          actionBasis: rec.action_basis,
          legalWarning: rec.legal_warning ?? "",
          regionalCaveat: rec.regional_caveat ?? "",
        }),
      ],
    );
    upserted += 1;
  }

  const summary = {
    dryRun,
    force,
    upserted,
    skipped,
    skippedAsCovered,
    curatorCoveredCount: curatorCovered.size,
    byCategory: Object.fromEntries(summaryByCategory),
    seedPath,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!dryRun) {
    await getPool().end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
