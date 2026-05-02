/**
 * Import reviewed or review-pending observation feedback claims into knowledge_claims.
 *
 * This replaces the missing observation_feedback_* dev_tools lane with the v2
 * claim-store contract. By default, imported records stay pending and are not
 * used by Hot-path feedback. Passing --allow-ready preserves ready/use flags
 * from the seed for intentionally reviewed data.
 *
 * Usage:
 *   npx tsx src/scripts/importObservationFeedbackKnowledgeClaims.ts --dry-run
 *   npx tsx src/scripts/importObservationFeedbackKnowledgeClaims.ts --seed=path/to/claims.json
 *   npx tsx src/scripts/importObservationFeedbackKnowledgeClaims.ts --allow-ready
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";

const CLAIM_TYPES = new Set([
  "identification_trait",
  "missing_evidence",
  "retake_guidance",
  "seasonality",
  "habitat",
  "distribution",
  "risk",
  "monitoring_interpretation",
  "site_condition_note",
]);
const EVIDENCE_TYPES = new Set(["image", "audio", "note", "video", "mixed"]);
const RISK_LANES = new Set(["rare", "invasive", "normal", "unknown"]);
const REVIEW_STATUSES = new Set(["pending", "ready", "rejected", "needs_review"]);
const SOURCE_TEXT_POLICIES = new Set(["metadata_only", "open_abstract", "oa_license_verified", "licensed_excerpt"]);

export type ObservationFeedbackClaimSeed = {
  claim_hash?: string;
  claim_type: string;
  claim_text: string;
  taxon_name?: string;
  scientific_name?: string;
  taxon_rank?: string;
  taxon_group?: string;
  place_region?: string;
  season_bucket?: string;
  habitat?: string;
  evidence_type?: string;
  risk_lane?: string;
  target_outputs?: string[];
  citation_span: string;
  source_title?: string;
  source_doi?: string;
  source_url?: string;
  source_provider?: string;
  source_text_policy?: string;
  confidence?: number;
  human_review_status?: string;
  use_in_feedback?: boolean;
  source_payload?: Record<string, unknown>;
};

export type NormalizedFeedbackClaim = Required<Omit<ObservationFeedbackClaimSeed, "claim_hash" | "source_payload">> & {
  claim_hash: string;
  source_payload: Record<string, unknown>;
};

function compact(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function stableClaimHash(input: ObservationFeedbackClaimSeed): string {
  const raw = [
    input.source_provider ?? "",
    input.source_title ?? "",
    input.claim_type,
    input.claim_text,
    input.taxon_group ?? "",
    input.risk_lane ?? "",
  ].join("|");
  return `claim:feedback:${createHash("sha1").update(raw).digest("hex").slice(0, 20)}`;
}

export function normalizeFeedbackClaimSeed(
  input: ObservationFeedbackClaimSeed,
  options: { allowReady?: boolean } = {},
): NormalizedFeedbackClaim {
  const claim_type = compact(input.claim_type);
  const claim_text = compact(input.claim_text);
  const citation_span = compact(input.citation_span);
  const evidence_type = compact(input.evidence_type) || "mixed";
  const risk_lane = compact(input.risk_lane) || "normal";
  const human_review_status = compact(input.human_review_status) || "pending";
  const source_text_policy = compact(input.source_text_policy) || "metadata_only";
  const confidence = Number.isFinite(input.confidence) ? Math.min(1, Math.max(0, Number(input.confidence))) : 0.5;
  const target_outputs = Array.isArray(input.target_outputs) && input.target_outputs.length > 0
    ? input.target_outputs.map(compact).filter(Boolean)
    : ["observation_feedback"];

  if (!CLAIM_TYPES.has(claim_type)) throw new Error(`invalid_claim_type:${claim_type}`);
  if (!EVIDENCE_TYPES.has(evidence_type)) throw new Error(`invalid_evidence_type:${evidence_type}`);
  if (!RISK_LANES.has(risk_lane)) throw new Error(`invalid_risk_lane:${risk_lane}`);
  if (!REVIEW_STATUSES.has(human_review_status)) throw new Error(`invalid_review_status:${human_review_status}`);
  if (!SOURCE_TEXT_POLICIES.has(source_text_policy)) throw new Error(`invalid_source_text_policy:${source_text_policy}`);
  if (claim_text.length < 1 || claim_text.length > 260) throw new Error(`claim_text_length:${claim_text.length}`);
  if (citation_span.length > 320) throw new Error(`citation_span_length:${citation_span.length}`);

  const use_in_feedback = options.allowReady
    ? Boolean(input.use_in_feedback) && human_review_status === "ready"
    : false;
  const status = options.allowReady ? human_review_status : "pending";

  return {
    claim_hash: compact(input.claim_hash) || stableClaimHash(input),
    claim_type,
    claim_text,
    taxon_name: compact(input.taxon_name),
    scientific_name: compact(input.scientific_name),
    taxon_rank: compact(input.taxon_rank) || "general",
    taxon_group: compact(input.taxon_group) || "general",
    place_region: compact(input.place_region),
    season_bucket: compact(input.season_bucket),
    habitat: compact(input.habitat),
    evidence_type,
    risk_lane,
    target_outputs,
    citation_span,
    source_title: compact(input.source_title),
    source_doi: compact(input.source_doi),
    source_url: compact(input.source_url),
    source_provider: compact(input.source_provider) || "ikimon_biodiversity_os",
    source_text_policy,
    confidence,
    human_review_status: status,
    use_in_feedback,
    source_payload: input.source_payload && typeof input.source_payload === "object" && !Array.isArray(input.source_payload)
      ? input.source_payload
      : {},
  };
}

function defaultSeedPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../db/seeds/observation_feedback_claims.seed.json");
}

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    if (!key) continue;
    out[key] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

async function loadSeed(seedPath: string, allowReady: boolean): Promise<NormalizedFeedbackClaim[]> {
  const data = JSON.parse(await readFile(seedPath, "utf8")) as unknown;
  if (!Array.isArray(data)) throw new Error("feedback claim seed must be an array");
  return data.map((record) => normalizeFeedbackClaimSeed(record as ObservationFeedbackClaimSeed, { allowReady }));
}

async function upsertSource(claim: NormalizedFeedbackClaim): Promise<string | null> {
  const pool = getPool();
  if (claim.source_doi) {
    const existing = await pool.query<{ source_id: string }>(
      `SELECT source_id
         FROM knowledge_sources
        WHERE lower(doi) = lower($1)
        LIMIT 1`,
      [claim.source_doi],
    );
    if (existing.rows[0]?.source_id) return existing.rows[0].source_id;
  }
  if (claim.source_url) {
    const existing = await pool.query<{ source_id: string }>(
      `SELECT source_id
         FROM knowledge_sources
        WHERE url = $1
        LIMIT 1`,
      [claim.source_url],
    );
    if (existing.rows[0]?.source_id) return existing.rows[0].source_id;
  }

  const result = await pool.query<{ source_id: string }>(
    `INSERT INTO knowledge_sources (
       source_kind, source_provider, title, doi, url, publisher, license_label,
       access_policy, citation_text, source_payload, updated_at
     ) VALUES (
       'ikimon_policy', $1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, '',
       $6, $7, $8::jsonb, NOW()
     )
     RETURNING source_id`,
    [
      claim.source_provider,
      claim.source_title,
      claim.source_doi,
      claim.source_url,
      claim.source_provider,
      claim.source_text_policy,
      claim.citation_span,
      JSON.stringify({ importedFrom: "observation_feedback_claims.seed.json" }),
    ],
  );
  return result.rows[0]?.source_id ?? null;
}

async function upsertClaim(claim: NormalizedFeedbackClaim): Promise<void> {
  const pool = getPool();
  const sourceId = await upsertSource(claim);
  await pool.query(
    `INSERT INTO knowledge_claims (
       source_id, claim_hash, claim_type, claim_text,
       taxon_name, scientific_name, taxon_rank, taxon_group,
       place_region, season_bucket, habitat, evidence_type, risk_lane,
       target_outputs, citation_span, source_title, source_doi, source_url,
       source_provider, source_text_policy, confidence, human_review_status,
       needs_human_review, use_in_feedback, source_payload, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12, $13,
       $14::jsonb, $15, $16, $17, $18,
       $19, $20, $21, $22,
       $23, $24, $25::jsonb, NOW()
     )
     ON CONFLICT (claim_hash) DO UPDATE SET
       source_id = EXCLUDED.source_id,
       claim_type = EXCLUDED.claim_type,
       claim_text = EXCLUDED.claim_text,
       taxon_name = EXCLUDED.taxon_name,
       scientific_name = EXCLUDED.scientific_name,
       taxon_rank = EXCLUDED.taxon_rank,
       taxon_group = EXCLUDED.taxon_group,
       place_region = EXCLUDED.place_region,
       season_bucket = EXCLUDED.season_bucket,
       habitat = EXCLUDED.habitat,
       evidence_type = EXCLUDED.evidence_type,
       risk_lane = EXCLUDED.risk_lane,
       target_outputs = EXCLUDED.target_outputs,
       citation_span = EXCLUDED.citation_span,
       source_title = EXCLUDED.source_title,
       source_doi = EXCLUDED.source_doi,
       source_url = EXCLUDED.source_url,
       source_provider = EXCLUDED.source_provider,
       source_text_policy = EXCLUDED.source_text_policy,
       confidence = EXCLUDED.confidence,
       human_review_status = EXCLUDED.human_review_status,
       needs_human_review = EXCLUDED.needs_human_review,
       use_in_feedback = EXCLUDED.use_in_feedback,
       source_payload = EXCLUDED.source_payload,
       updated_at = NOW()`,
    [
      sourceId,
      claim.claim_hash,
      claim.claim_type,
      claim.claim_text,
      claim.taxon_name,
      claim.scientific_name,
      claim.taxon_rank,
      claim.taxon_group,
      claim.place_region,
      claim.season_bucket,
      claim.habitat,
      claim.evidence_type,
      claim.risk_lane,
      JSON.stringify(claim.target_outputs),
      claim.citation_span,
      claim.source_title,
      claim.source_doi,
      claim.source_url,
      claim.source_provider,
      claim.source_text_policy,
      claim.confidence,
      claim.human_review_status,
      claim.human_review_status !== "ready",
      claim.use_in_feedback,
      JSON.stringify({
        ...claim.source_payload,
        importedBy: "importObservationFeedbackKnowledgeClaims.ts",
        contract: "docs/spec/navigable_biodiversity_os_contract.md",
      }),
    ],
  );
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dryRun = Boolean(args["dry-run"]);
  const allowReady = Boolean(args["allow-ready"]);
  const seedPath = typeof args.seed === "string" ? path.resolve(args.seed) : defaultSeedPath();
  const claims = await loadSeed(seedPath, allowReady);

  if (!dryRun) {
    for (const claim of claims) {
      await upsertClaim(claim);
    }
    await getPool().end();
  }

  const summary = {
    dryRun,
    allowReady,
    seedPath,
    total: claims.length,
    ready: claims.filter((claim) => claim.human_review_status === "ready").length,
    useInFeedback: claims.filter((claim) => claim.use_in_feedback).length,
    byType: Object.fromEntries(
      [...new Set(claims.map((claim) => claim.claim_type))]
        .sort()
        .map((type) => [type, claims.filter((claim) => claim.claim_type === type).length]),
    ),
  };
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && ["importObservationFeedbackKnowledgeClaims.ts", "importObservationFeedbackKnowledgeClaims.js"].includes(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
