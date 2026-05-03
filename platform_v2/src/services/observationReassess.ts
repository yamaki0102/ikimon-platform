import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import type { PoolClient } from "pg";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { createObservationAiRun, ensureLegacyAiRunsForVisit, getLatestObservationAiRunForVisit } from "./observationAiRuns.js";
import { matchTaxon, matchTaxonBatch, type GbifMatch } from "./gbifBackboneMatch.js";
import { getStoredVisitDisplayState, upsertVisitDisplayState, deriveVisitDisplayState } from "./visitDisplayState.js";
import { getVisitSubjectSummaries } from "./visitSubjects.js";
import { logAiCost } from "./aiCostLogger.js";
import { assertAllowed as assertAiBudgetAllowed } from "./aiBudgetGate.js";
import { estimateAiCostUsd, pricingForModel } from "./aiModelPricing.js";
import { loadProfileDigestForPrompt } from "./profileDigestPromptLoader.js";
import {
  buildCacheKey,
  fetchUserOutputCache,
  recordCacheHit,
  saveUserOutputCache,
} from "./userOutputCache.js";
import { buildKnowledgeVersionSet } from "./versionedKnowledgeReader.js";
import {
  hasSubjectInvasiveFact,
  lookupInvasiveStatusFacts,
  pickSubjectInvasiveFact,
  type InvasiveLookupTerm,
  type InvasiveStatusFact,
} from "./invasiveLookupHelpers.js";
import { emitAlertsForOccurrence } from "./alertDispatcher.js";
import {
  buildObservationPackage,
  claimRefsForPackage,
  summarizeObservationPackageForPrompt,
} from "./observationPackage.js";
import {
  formatClaimRefsForPrompt,
  retrieveBranchKnowledgeClaims,
} from "./knowledgeClaimRetrieval.js";
import { normalizeManagementActionCandidatesFromRaw } from "./observationAiAssessment.js";
import { upsertAiInferredManagementActions } from "./managementActionConfirmation.js";
import { ensureVisitPlaceLink } from "./visitPlaceAutoLink.js";

export type ReassessResult = {
  aiRunId: string;
  assessmentId: string;
  occurrenceId: string;
  visitId: string;
  confidenceBand: string;
  recommendedTaxonName: string;
  narrative: string;
  candidateCount: number;
  regionCount: number;
  gbifMatchedPrimary: boolean;
  gbifMatchedCoexistingCount: number;
  modelUsed: string;
  selectionSource: string;
  featuredOccurrenceId: string | null;
};

export type ReassessImageInput = {
  mime: string;
  b64: string;
  assetId?: string | null;
  frameTimeMs?: number | null;
};

export type ReassessObservationOptions = {
  photos?: ReassessImageInput[];
  promptVersion?: string;
  sourceTag?: string;
  triggeredBy?: string | null;
};

type GeminiRegion = {
  asset_index?: number;
  rect?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  frame_time_ms?: number;
  confidence?: number;
  note?: string;
};

type GeminiAreaCandidate = {
  label?: string;
  why?: string;
  confidence?: number;
};

type GeminiAreaInference = {
  vegetation_structure_candidates?: GeminiAreaCandidate[];
  succession_stage_candidates?: GeminiAreaCandidate[];
  human_influence_candidates?: GeminiAreaCandidate[];
  moisture_regime_candidates?: GeminiAreaCandidate[];
  management_hint_candidates?: GeminiAreaCandidate[];
};

type GeminiShotSuggestion = {
  role?: string;
  target?: string;
  rationale?: string;
  priority?: string;
};

type GeminiManagementActionCandidate = {
  action_kind?: string;
  label?: string;
  why?: string;
  confidence?: number;
  source?: string;
  source_asset_id?: string;
  confirm_state?: string;
};

type GeminiJson = {
  confidence_band?: string;
  recommended_rank?: string;
  recommended_taxon_name?: string;
  recommended_scientific_name?: string;
  best_specific_taxon_name?: string;
  narrative?: string;
  simple_summary?: string;
  observer_boost?: string;
  next_step_text?: string;
  stop_reason?: string;
  fun_fact?: string;
  fun_fact_grounded?: boolean;
  diagnostic_features_seen?: string[];
  missing_evidence?: string[];
  similar_taxa?: Array<{ name?: string; rank?: string }>;
  distinguishing_tips?: string[];
  confirm_more?: string[];
  claim_refs_used?: string[];
  geographic_context?: string;
  seasonal_context?: string;
  area_inference?: GeminiAreaInference;
  management_action_candidates?: GeminiManagementActionCandidate[];
  shot_suggestions?: GeminiShotSuggestion[];
  recommended_media_regions?: GeminiRegion[];
  coexisting_taxa?: Array<{
    name?: string;
    scientific_name?: string;
    rank?: string;
    confidence?: number;
    note?: string;
    media_regions?: GeminiRegion[];
  }>;
};

const AREA_INFERENCE_KEYS = [
  "vegetation_structure_candidates",
  "succession_stage_candidates",
  "human_influence_candidates",
  "moisture_regime_candidates",
  "management_hint_candidates",
] as const;

type AreaInferenceKey = typeof AREA_INFERENCE_KEYS[number];

type NormalizedAreaCandidate = {
  label: string;
  why: string;
  confidence: number | null;
};

type NormalizedAreaInference = Record<AreaInferenceKey, NormalizedAreaCandidate[]>;

const SHOT_SUGGESTION_ROLES = new Set([
  "full_body",
  "close_up_organ",
  "habitat_wide",
  "substrate",
  "scale_reference",
]);

const SHOT_SUGGESTION_PRIORITIES = new Set(["high", "medium"]);

type NormalizedShotSuggestion = {
  role: string;
  target: string;
  rationale: string;
  priority: "high" | "medium";
};

function normalizeAreaCandidate(raw: unknown): NormalizedAreaCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as GeminiAreaCandidate;
  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  if (!label) return null;
  const why = typeof obj.why === "string" ? obj.why.trim() : "";
  const confidenceRaw = typeof obj.confidence === "number" && Number.isFinite(obj.confidence)
    ? Math.min(1, Math.max(0, obj.confidence))
    : null;
  return { label: label.slice(0, 60), why: why.slice(0, 120), confidence: confidenceRaw };
}

function normalizeAreaInference(raw: GeminiAreaInference | undefined): NormalizedAreaInference {
  const out: NormalizedAreaInference = {
    vegetation_structure_candidates: [],
    succession_stage_candidates: [],
    human_influence_candidates: [],
    moisture_regime_candidates: [],
    management_hint_candidates: [],
  };
  if (!raw || typeof raw !== "object") return out;
  for (const key of AREA_INFERENCE_KEYS) {
    const arr = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(arr)) continue;
    out[key] = arr
      .map(normalizeAreaCandidate)
      .filter((value): value is NormalizedAreaCandidate => value !== null)
      .slice(0, 4);
  }
  return out;
}

function normalizeShotSuggestions(raw: GeminiShotSuggestion[] | undefined): NormalizedShotSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: NormalizedShotSuggestion[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const role = typeof entry.role === "string" ? entry.role.trim() : "";
    const target = typeof entry.target === "string" ? entry.target.trim() : "";
    const rationale = typeof entry.rationale === "string" ? entry.rationale.trim() : "";
    const priorityRaw = typeof entry.priority === "string" ? entry.priority.trim().toLowerCase() : "";
    if (!SHOT_SUGGESTION_ROLES.has(role) || !target) continue;
    const priority: "high" | "medium" = SHOT_SUGGESTION_PRIORITIES.has(priorityRaw)
      ? (priorityRaw as "high" | "medium")
      : "medium";
    const dedupeKey = `${role}|${target.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      role,
      target: target.slice(0, 60),
      rationale: rationale.slice(0, 120),
      priority,
    });
    if (out.length >= 5) break;
  }
  return out;
}

type GbifMatchLite = { canonicalName?: string | null; genus?: string | null; family?: string | null } | GbifMatch | null;

function buildInvasiveLookupTerms(input: {
  primaryName: string;
  primaryGbif: GbifMatchLite;
  coexisting: Array<{ name: string; gbif: GbifMatchLite }>;
}): InvasiveLookupTerm[] {
  const terms: InvasiveLookupTerm[] = [];
  const seen = new Set<string>();
  const push = (name: string | null | undefined, rank: string, appliesTo: "subject" | "coexisting") => {
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = `${trimmed.toLowerCase()}|${rank}|${appliesTo}`;
    if (seen.has(key)) return;
    seen.add(key);
    terms.push({ name: trimmed, rank, appliesTo });
  };
  if (input.primaryName) push(input.primaryName, "species", "subject");
  if (input.primaryGbif) {
    const g = input.primaryGbif as { canonicalName?: string | null; genus?: string | null; family?: string | null };
    push(g.canonicalName ?? null, "species", "subject");
    push(g.genus ?? null, "genus", "subject");
    push(g.family ?? null, "family", "subject");
  }
  for (const c of input.coexisting) {
    push(c.name, "species", "coexisting");
    if (c.gbif) {
      const g = c.gbif as { canonicalName?: string | null; genus?: string | null; family?: string | null };
      push(g.canonicalName ?? null, "species", "coexisting");
      push(g.genus ?? null, "genus", "coexisting");
      push(g.family ?? null, "family", "coexisting");
    }
  }
  return terms;
}

/**
 * Three-lens hard-gates applied before the LLM output is persisted.
 * - invasive_response: invasive_status_versions に subject 該当が無い場合は is_invasive=false 化。
 *                     該当がある場合は mhlw_category / action_basis を実データで補正。
 * - novelty_hint:      novelty_score >= 0.5 でなければ削除。confidence_band='low' のときは強制削除
 * - size_assessment:   basis が空、もしくはスケール参照らしい記述が無いとき observed_size_estimate_cm を null 化
 */
function applyThreeLensGates(
  parsed: GeminiJson,
  context: {
    bandIsLow: boolean;
    subjectInvasiveCovered: boolean;
    subjectInvasiveFact: InvasiveStatusFact | null;
  },
): GeminiJson {
  const out: GeminiJson = { ...parsed } as GeminiJson;
  const inv = (parsed as Record<string, unknown>)["invasive_response"];
  if (inv && typeof inv === "object") {
    const obj = { ...(inv as Record<string, unknown>) };
    if (obj.is_invasive === true && !context.subjectInvasiveCovered) {
      obj.is_invasive = false;
      obj.mhlw_category = null;
      obj.recommended_action = null;
      obj.action_basis = "invasive_status_versions に該当データが見つからなかったため、AI判定を保留しました。";
      obj.legal_warning = "";
      obj.regional_caveat = "";
      obj.hedge = obj.hedge || "AI判定です。駆除前に自治体・環境省にご確認ください。";
    } else if (obj.is_invasive === true && context.subjectInvasiveFact) {
      // 公式版データで mhlw_category と action_basis を上書き (LLM の hallucination を実データで補正)
      const fact = context.subjectInvasiveFact;
      const factCategory = fact.mhlwCategory === "none" ? null : fact.mhlwCategory;
      // none なら is_invasive そのものを false 化
      if (factCategory === null) {
        obj.is_invasive = false;
        obj.mhlw_category = null;
        obj.recommended_action = null;
      } else {
        obj.mhlw_category = factCategory;
        // iaspecified は 'controlled_removal' を強制的に 'report_only' に格下げ
        if (factCategory === "iaspecified" && obj.recommended_action === "controlled_removal") {
          obj.recommended_action = "report_only";
        }
        // source_excerpt があれば action_basis を補強
        if (fact.sourceExcerpt && fact.sourceExcerpt.trim().length > 0) {
          const existing = typeof obj.action_basis === "string" ? obj.action_basis : "";
          obj.action_basis = existing
            ? `${existing} / 出典: ${fact.sourceExcerpt}`
            : `環境省 ${factCategory} (${fact.scientificName})。出典: ${fact.sourceExcerpt}`;
        }
      }
      obj.hedge = obj.hedge || "AI判定です。駆除前に自治体・環境省にご確認ください。";
    }
    (out as Record<string, unknown>)["invasive_response"] = obj;
  }
  const nov = (parsed as Record<string, unknown>)["novelty_hint"];
  if (nov && typeof nov === "object") {
    const obj = nov as Record<string, unknown>;
    const score = typeof obj.novelty_score === "number" ? obj.novelty_score : null;
    if (context.bandIsLow || obj.is_potentially_novel !== true || score === null || score < 0.5) {
      delete (out as Record<string, unknown>)["novelty_hint"];
    }
  }
  const size = (parsed as Record<string, unknown>)["size_assessment"];
  if (size && typeof size === "object") {
    const obj = { ...(size as Record<string, unknown>) };
    const basis = typeof obj.basis === "string" ? obj.basis : "";
    const hasScaleHint = /手|指|コイン|スケール|物差し|定規|cm|mm/i.test(basis);
    if (!basis || !hasScaleHint) {
      obj.observed_size_estimate_cm = null;
    }
    obj.hedge = obj.hedge || "AIによる目測のため誤差大。確定値ではありません。";
    (out as Record<string, unknown>)["size_assessment"] = obj;
  }
  return out;
}

/**
 * gated 3 レンズの値を occurrences テーブルの専用カラムに同期する。
 * - 値が無いフィールドは NULL / 空 JSONB のままにする（既存値を破壊しない方針なら別途差分 UPDATE が必要だが、
 *   reassess は最新評価で上書きする前提なので NULL でリセットされる）
 * - サイズ・新種・外来種それぞれ JSONB 全体は保持し、UI / API は専用カラム or JSONB のいずれからも引ける
 */
async function syncOccurrenceThreeLenses(
  client: PoolClient,
  occurrenceId: string,
  gatedParsed: GeminiJson,
): Promise<void> {
  const obj = gatedParsed as Record<string, unknown>;
  const sizeRaw = obj["size_assessment"];
  const noveltyRaw = obj["novelty_hint"];
  const invasiveRaw = obj["invasive_response"];

  const sizeObj = sizeRaw && typeof sizeRaw === "object" ? (sizeRaw as Record<string, unknown>) : null;
  const noveltyObj = noveltyRaw && typeof noveltyRaw === "object" ? (noveltyRaw as Record<string, unknown>) : null;
  const invasiveObj = invasiveRaw && typeof invasiveRaw === "object" ? (invasiveRaw as Record<string, unknown>) : null;

  const sizeClassRaw = sizeObj && typeof sizeObj.size_class === "string" ? sizeObj.size_class.trim() : "";
  const sizeClass = ["tiny", "small", "typical", "large", "exceptional"].includes(sizeClassRaw)
    ? sizeClassRaw
    : null;

  const observedSize = sizeObj && typeof sizeObj.observed_size_estimate_cm === "number" && Number.isFinite(sizeObj.observed_size_estimate_cm) && sizeObj.observed_size_estimate_cm > 0
    ? Number(sizeObj.observed_size_estimate_cm)
    : null;

  const noveltyScoreRaw = noveltyObj && typeof noveltyObj.novelty_score === "number" && Number.isFinite(noveltyObj.novelty_score)
    ? Math.min(1, Math.max(0, Number(noveltyObj.novelty_score)))
    : null;
  const isPotentiallyNovel = noveltyObj?.is_potentially_novel === true;
  const noveltyScore = isPotentiallyNovel ? noveltyScoreRaw : null;

  const invasiveCatRaw = invasiveObj && typeof invasiveObj.mhlw_category === "string" ? invasiveObj.mhlw_category.trim() : "";
  const invasiveStatus = invasiveObj?.is_invasive === true && ["iaspecified", "priority", "industrial", "prevention"].includes(invasiveCatRaw)
    ? invasiveCatRaw
    : invasiveObj?.is_invasive === false
      ? "native"
      : null;

  await client.query(
    `INSERT INTO occurrence_three_lenses (
         occurrence_id, size_class, size_value_cm, size_assessment_json,
         novelty_score, novelty_assessment_json,
         invasive_status, invasive_assessment_json,
         ai_lenses_assessed_at, updated_at
     ) VALUES (
         $1::text, $2, $3, $4::jsonb,
         $5, $6::jsonb,
         $7, $8::jsonb,
         NOW(), NOW()
     )
     ON CONFLICT (occurrence_id) DO UPDATE SET
         size_class = EXCLUDED.size_class,
         size_value_cm = EXCLUDED.size_value_cm,
         size_assessment_json = EXCLUDED.size_assessment_json,
         novelty_score = EXCLUDED.novelty_score,
         novelty_assessment_json = EXCLUDED.novelty_assessment_json,
         invasive_status = EXCLUDED.invasive_status,
         invasive_assessment_json = EXCLUDED.invasive_assessment_json,
         ai_lenses_assessed_at = NOW(),
         updated_at = NOW()`,
    [
      occurrenceId,
      sizeClass,
      observedSize,
      JSON.stringify(sizeObj ?? {}),
      noveltyScore,
      JSON.stringify(noveltyObj ?? {}),
      invasiveStatus,
      JSON.stringify(invasiveObj ?? {}),
    ],
  );
}

type LoadedPhotoInput = ReassessImageInput & {
  assetId: string | null;
};

type ResolvedObservationTarget = {
  visitId: string;
  selectedOccurrenceId: string;
  primaryOccurrenceId: string;
  selectedSubjectIndex: number;
  vernacularName: string | null;
  scientificName: string | null;
  taxonRank: string | null;
};

type NormalizedRegion = {
  assetIndex: number;
  frameTimeMs: number | null;
  confidence: number | null;
  note: string | null;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

const PIPELINE_VERSION = "observation-reassess/v2-durable";
const TAXONOMY_VERSION = "gbif-backbone/current";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, "../prompts/observation_reassess.md");
let CACHED_PROMPT: string | null = null;

function loadPrompt(): string {
  if (CACHED_PROMPT) return CACHED_PROMPT;
  CACHED_PROMPT = readFileSync(PROMPT_PATH, "utf-8");
  return CACHED_PROMPT;
}

function renderPrompt(vars: Record<string, string>): string {
  let out = loadPrompt();
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`\${${k}}`).join(v);
  }
  return out;
}

function guessSeason(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const m = (isNaN(d.getTime()) ? new Date() : d).getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function normalizeRank(r: string | undefined): "species" | "genus" | "family" | "order" | "lifeform" | "unknown" {
  const v = String(r ?? "").toLowerCase().trim();
  if (v === "species" || v === "genus" || v === "family" || v === "order" || v === "lifeform") return v;
  return "unknown";
}

function normalizeBand(b: string | undefined): "high" | "medium" | "low" | "unknown" {
  const v = String(b ?? "").toLowerCase().trim();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function normalizeRectCandidate(region: GeminiRegion): NormalizedRegion | null {
  const assetIndex = Number(region.asset_index);
  if (!Number.isInteger(assetIndex) || assetIndex < 0) {
    return null;
  }
  const rect = region.rect ?? {};
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    return null;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.001 || y + height > 1.001) {
    return null;
  }
  const frameTimeMs = region.frame_time_ms == null ? null : Number(region.frame_time_ms);
  const confidence = region.confidence == null ? null : Math.min(1, Math.max(0, Number(region.confidence)));
  return {
    assetIndex,
    frameTimeMs: Number.isFinite(frameTimeMs ?? NaN) ? Math.max(0, Math.round(frameTimeMs ?? 0)) : null,
    confidence: confidence != null && Number.isFinite(confidence) ? confidence : null,
    note: typeof region.note === "string" && region.note.trim() ? region.note.trim() : null,
    rect: { x, y, width, height },
  };
}

function buildCandidateKey(vernacularName: string, scientificName: string, rank: string | null): string {
  return [scientificName.trim().toLowerCase(), vernacularName.trim().toLowerCase(), String(rank ?? "").trim().toLowerCase()]
    .filter((part) => part.length > 0)
    .join("|");
}

function buildAssetFingerprint(sourceTag: string, photos: LoadedPhotoInput[]): string {
  const hash = createHash("sha256");
  hash.update(sourceTag);
  for (const photo of photos) {
    hash.update("|");
    hash.update(photo.assetId ?? "inline");
    hash.update(":");
    hash.update(String(photo.frameTimeMs ?? ""));
    hash.update(":");
    hash.update(String(photo.b64.length));
    hash.update(":");
    hash.update(photo.b64.slice(0, 64));
  }
  return hash.digest("hex");
}

async function loadPhotoBytes(client: PoolClient, visitId: string): Promise<LoadedPhotoInput[]> {
  const rows = await client.query<{
    asset_id: string;
    mime_type: string | null;
    storage_path: string | null;
    public_url: string | null;
  }>(
    `SELECT ea.asset_id::text,
            ab.mime_type,
            ab.storage_path,
            ab.public_url
       FROM evidence_assets ea
       JOIN asset_blobs ab ON ab.blob_id = ea.blob_id
      WHERE ea.visit_id = $1
        AND ea.asset_role = 'observation_photo'
      ORDER BY ea.created_at ASC
      LIMIT 3`,
    [visitId],
  );

  const { legacyPublicRoot } = loadConfig();
  const out: LoadedPhotoInput[] = [];
  for (const row of rows.rows) {
    const candidates: string[] = [];
    if (row.storage_path) {
      if (path.isAbsolute(row.storage_path)) candidates.push(row.storage_path);
      else candidates.push(path.join(legacyPublicRoot, row.storage_path));
    }
    if (row.public_url && !row.public_url.startsWith("http")) {
      candidates.push(path.join(legacyPublicRoot, row.public_url.replace(/^\/+/, "")));
    }
    for (const candidate of candidates) {
      try {
        const buf = await readFile(candidate);
        out.push({
          mime: row.mime_type || "image/jpeg",
          b64: buf.toString("base64"),
          assetId: row.asset_id,
          frameTimeMs: null,
        });
        break;
      } catch {
        // continue
      }
    }
  }
  return out;
}

async function resolveObservationTarget(client: PoolClient, observationId: string): Promise<ResolvedObservationTarget | null> {
  const result = await client.query<{
    visit_id: string;
    selected_occurrence_id: string | null;
    primary_occurrence_id: string;
    selected_subject_index: number | null;
    vernacular_name: string | null;
    scientific_name: string | null;
    taxon_rank: string | null;
  }>(
    `WITH matched_visit AS (
        SELECT visit_id
          FROM visits
         WHERE visit_id = $1
            OR legacy_observation_id = $1
        UNION
        SELECT visit_id
          FROM occurrences
         WHERE occurrence_id = $1
            OR legacy_observation_id = $1
        LIMIT 1
     )
     SELECT v.visit_id,
            selected.occurrence_id AS selected_occurrence_id,
            primary_occurrence.occurrence_id AS primary_occurrence_id,
            selected.subject_index AS selected_subject_index,
            coalesce(selected.vernacular_name, primary_occurrence.vernacular_name) AS vernacular_name,
            coalesce(selected.scientific_name, primary_occurrence.scientific_name) AS scientific_name,
            coalesce(selected.taxon_rank, primary_occurrence.taxon_rank) AS taxon_rank
       FROM matched_visit mv
       JOIN visits v ON v.visit_id = mv.visit_id
       JOIN occurrences primary_occurrence
         ON primary_occurrence.visit_id = v.visit_id
        AND primary_occurrence.subject_index = 0
       LEFT JOIN LATERAL (
         SELECT occurrence_id, subject_index, vernacular_name, scientific_name, taxon_rank
           FROM occurrences
          WHERE visit_id = v.visit_id
            AND (occurrence_id = $1 OR legacy_observation_id = $1)
          ORDER BY subject_index ASC
          LIMIT 1
       ) selected ON true
      LIMIT 1`,
    [observationId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    visitId: row.visit_id,
    selectedOccurrenceId: row.selected_occurrence_id ?? row.primary_occurrence_id,
    primaryOccurrenceId: row.primary_occurrence_id,
    selectedSubjectIndex: row.selected_subject_index ?? 0,
    vernacularName: row.vernacular_name,
    scientificName: row.scientific_name,
    taxonRank: row.taxon_rank,
  };
}

function getClient(): GoogleGenAI {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey: cfg.geminiApiKey });
}

type GeminiCostMeta = {
  userId?: string | null;
  visitId?: string | null;
  occurrenceId?: string | null;
};

async function runGemini(
  prompt: string,
  photos: ReassessImageInput[],
  meta: GeminiCostMeta = {},
): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  // Hot-layer budget gate: throws AiBudgetExceededError when monthly cap reached.
  await assertAiBudgetAllowed("hot");

  const ai = getClient();
  const parts: Array<Record<string, unknown>> = photos.map((photo) => ({
    inlineData: { mimeType: photo.mime, data: photo.b64 },
  }));
  parts.push({ text: prompt });

  const MODELS = ["gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"];
  let lastErr: unknown = null;
  for (const model of MODELS) {
    const startedAt = Date.now();
    try {
      const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts }] });
      const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

      const usage = (response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }).usageMetadata;
      const inputTokens = Number(usage?.promptTokenCount ?? 0);
      const outputTokens = Number(usage?.candidatesTokenCount ?? 0);
      pricingForModel(model);
      const costUsd = estimateAiCostUsd({ model, inputTokens, outputTokens });
      // Cost log failure should never break the user-facing flow.
      logAiCost({
        layer: "hot",
        endpoint: "observation_reassess",
        provider: "gemini",
        model,
        inputTokens,
        outputTokens,
        costUsd,
        userId: meta.userId ?? null,
        visitId: meta.visitId ?? null,
        occurrenceId: meta.occurrenceId ?? null,
        latencyMs: Date.now() - startedAt,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[ai_cost_log] insert failed", err);
      });

      let parsed: GeminiJson = {};
      try {
        const matched = rawText.match(/\{[\s\S]*\}/);
        if (matched) parsed = JSON.parse(matched[0]);
      } catch {
        parsed = {};
      }
      return { parsed, modelUsed: model, rawText };
    } catch (error) {
      lastErr = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!/503|UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota/i.test(msg)) throw error;
    }
  }
  throw lastErr ?? new Error("gemini_all_models_failed");
}

/**
 * 観察単位の AI 再判定。
 * canonical occurrence は直接更新せず、immutable な ai_run / assessment / candidate / region を追記する。
 * stable display state は human lock を維持しつつ、未確定 visit だけ最新 run を既定表示に使う。
 */
export async function reassessObservation(
  observationId: string,
  options: ReassessObservationOptions = {},
): Promise<ReassessResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const target = await resolveObservationTarget(client, observationId);
    if (!target) {
      throw new Error("occurrence_not_found");
    }

    const visit = await client.query<{
      observed_at: string;
      latitude: number | null;
      longitude: number | null;
      place_id: string | null;
      prefecture: string | null;
      municipality: string | null;
    }>(
      `SELECT to_char(v.observed_at, 'YYYY-MM-DD HH24:MI') AS observed_at,
              coalesce(v.point_latitude, p.center_latitude) AS latitude,
              coalesce(v.point_longitude, p.center_longitude) AS longitude,
              v.place_id,
              coalesce(v.observed_prefecture, p.prefecture) AS prefecture,
              coalesce(v.observed_municipality, p.municipality) AS municipality
         FROM visits v
         LEFT JOIN places p ON p.place_id = v.place_id
        WHERE v.visit_id = $1
        LIMIT 1`,
      [target.visitId],
    );
    const vctx = visit.rows[0] ?? {
      observed_at: "",
      latitude: null,
      longitude: null,
      place_id: null,
      prefecture: null,
      municipality: null,
    };
    if (!vctx.place_id) {
      const linked = await ensureVisitPlaceLink(client, target.visitId).catch(() => null);
      if (linked?.placeId) {
        vctx.place_id = linked.placeId;
      }
    }

    const overridePhotos = Array.isArray(options.photos)
      ? options.photos
          .filter((photo) =>
            typeof photo?.mime === "string" &&
            photo.mime.trim().startsWith("image/") &&
            typeof photo.b64 === "string" &&
            photo.b64.trim().length > 0,
          )
          .map((photo) => ({
            ...photo,
            assetId: photo.assetId ?? null,
          }))
      : [];
    const photos = overridePhotos.length > 0
      ? overridePhotos
      : await loadPhotoBytes(client, target.visitId);
    if (photos.length === 0) {
      throw new Error("no_photo_for_reassess");
    }

    const hasCoordinates = typeof vctx.latitude === "number" &&
      Number.isFinite(vctx.latitude) &&
      typeof vctx.longitude === "number" &&
      Number.isFinite(vctx.longitude);
    const localityLabel = [vctx.municipality, vctx.prefecture].filter((value) =>
      typeof value === "string" && value.trim().length > 0,
    ).join(" / ");
    const existingLabel = target.vernacularName || target.scientificName || "未同定";
    // Hot-path personalization: pull a 240-char digest summary if the user has one.
    // Failures are silenced because new users / DB hiccups must not block re-assess.
    const profileDigest = await loadProfileDigestForPrompt(options.triggeredBy ?? null).catch(
      () => ({ summary: "", digestVersion: 0 }),
    );

    const baseObservationPackage = await buildObservationPackage({
      visitId: target.visitId,
      targetOccurrenceId: target.primaryOccurrenceId,
    }, client).catch(() => null);
    const branchClaimRefs = baseObservationPackage
      ? await retrieveBranchKnowledgeClaims({
          branch: "feedback_contract",
          observationPackage: baseObservationPackage,
          limit: 8,
        }, client).catch(() => [])
      : [];
    const observationPackage = baseObservationPackage
      ? claimRefsForPackage(baseObservationPackage, branchClaimRefs)
      : null;
    const observationPackageSummary = summarizeObservationPackageForPrompt(observationPackage);
    const observationPackageCacheRef = observationPackage
      ? createHash("sha1").update(observationPackageSummary).digest("hex").slice(0, 16)
      : "none";

    // ---- user_output_cache lookup ----
    // Skip when the caller forced a refresh via overridePhotos or explicit
    // sourceTag != "photo". Otherwise build the cache key from the canonical
    // inputs and try to short-circuit the Gemini call entirely.
    const cachePromptVersion = options.promptVersion?.trim() || "observation_reassess.md/v3";
    const cacheUserId = options.triggeredBy ?? null;
    const cacheAssetIds = photos
      .map((p) => p.assetId ?? null)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice()
      .sort();
    const baseKnowledgeVersionSet = await buildKnowledgeVersionSet({
      scientificNames: [target.scientificName, target.vernacularName].filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      ),
      placeId: vctx.place_id ?? null,
    }).catch(() => ({ invasive: [], redlist: [], taxonomy: [], placeEnv: [] }));
    const knowledgeVersionSet = {
      ...baseKnowledgeVersionSet,
      claim: branchClaimRefs.map((claim) => claim.claimId).sort(),
      observation_package: observationPackageCacheRef,
    };
    const cacheEligible =
      cacheUserId !== null &&
      overridePhotos.length === 0 &&
      cacheAssetIds.length > 0;
    const cacheKey = cacheEligible
      ? buildCacheKey({
          promptVersion: cachePromptVersion,
          userId: cacheUserId,
          visitId: target.visitId,
          occurrenceId: target.primaryOccurrenceId,
          assetBlobIds: cacheAssetIds,
          digestVersion: profileDigest.digestVersion,
          knowledgeVersionSet: knowledgeVersionSet as unknown as Record<string, string | string[]>,
        })
      : null;

    if (cacheKey) {
      const cached = await fetchUserOutputCache(cacheKey).catch(() => null);
      if (cached && cached.outputPayload) {
        recordCacheHit(cacheKey).catch(() => undefined);
        logAiCost({
          layer: "hot",
          endpoint: "observation_reassess",
          provider: "gemini",
          model: "user_output_cache",
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          userId: cacheUserId,
          visitId: target.visitId,
          occurrenceId: target.primaryOccurrenceId,
          cacheKey,
          cacheHit: true,
        }).catch(() => undefined);
        return cached.outputPayload as ReassessResult;
      }
    }

    const prompt = renderPrompt({
      occurrenceId: target.primaryOccurrenceId,
      lat: hasCoordinates ? Number(vctx.latitude).toFixed(5) : "不明",
      lng: hasCoordinates ? Number(vctx.longitude).toFixed(5) : "不明",
      observedAt: vctx.observed_at || "不明",
      season: guessSeason(vctx.observed_at || null),
      existingLabel,
      siteBriefLabel: localityLabel || vctx.place_id || "位置未取得",
      profileDigestSummary: profileDigest.summary,
      observationPackageSummary,
      knowledgeClaimsContext: formatClaimRefsForPrompt(branchClaimRefs),
    });

    const { parsed, modelUsed, rawText } = await runGemini(prompt, photos, {
      userId: options.triggeredBy ?? null,
      visitId: target.visitId,
      occurrenceId: target.primaryOccurrenceId,
    });
    const promptVersion = options.promptVersion?.trim() || "observation_reassess.md/v3";
    const sourceTag = options.sourceTag?.trim() || "photo";

    const band = normalizeBand(parsed.confidence_band);
    const rank = normalizeRank(parsed.recommended_rank);
    const recommendedName = String(parsed.recommended_taxon_name ?? "").trim();
    const recommendedScientificName = String(parsed.recommended_scientific_name ?? "").trim();
    const bestSpecific = String(parsed.best_specific_taxon_name ?? "").trim();
    const narrative = String(parsed.narrative ?? "").trim();
    const simple = String(parsed.simple_summary ?? "").trim();
    const diagFeatures = Array.isArray(parsed.diagnostic_features_seen) ? parsed.diagnostic_features_seen.filter((value) => typeof value === "string") : [];
    const missing = Array.isArray(parsed.missing_evidence) ? parsed.missing_evidence.filter((value) => typeof value === "string") : [];
    const similar = Array.isArray(parsed.similar_taxa)
      ? parsed.similar_taxa
          .filter((value) => value && typeof value.name === "string" && value.name.trim().length > 0)
          .map((value) => ({ name: value.name, rank: value.rank ?? "species" }))
      : [];
    const distinguishing = Array.isArray(parsed.distinguishing_tips) ? parsed.distinguishing_tips.filter((value) => typeof value === "string") : [];
    const confirmMore = Array.isArray(parsed.confirm_more) ? parsed.confirm_more.filter((value) => typeof value === "string") : [];
    const claimRefsUsed = Array.isArray(parsed.claim_refs_used)
      ? parsed.claim_refs_used.filter((value) => typeof value === "string" && branchClaimRefs.some((claim) => claim.claimId === value))
      : [];
    const areaInference = normalizeAreaInference(parsed.area_inference);
    const managementActionCandidates = normalizeManagementActionCandidatesFromRaw(
      parsed.management_action_candidates,
      {
        vegetationStructureCandidates: areaInference.vegetation_structure_candidates,
        successionStageCandidates: areaInference.succession_stage_candidates,
        humanInfluenceCandidates: areaInference.human_influence_candidates,
        moistureRegimeCandidates: areaInference.moisture_regime_candidates,
        managementHintCandidates: areaInference.management_hint_candidates,
      },
    );
    const shotSuggestions = normalizeShotSuggestions(parsed.shot_suggestions);
    const coexisting = Array.isArray(parsed.coexisting_taxa)
      ? parsed.coexisting_taxa.filter((value) => {
          if (!value) return false;
          const name = typeof value.name === "string" ? value.name.trim() : "";
          const scientificName = typeof value.scientific_name === "string" ? value.scientific_name.trim() : "";
          return name.length > 0 || scientificName.length > 0;
        })
      : [];

    const primaryRankHint = rank === "unknown" ? null : rank;
    const primaryMatchName = recommendedScientificName || recommendedName;
    const preparedCandidates = coexisting.map((candidate) => {
      const vernacularName = String(candidate.name ?? "").trim();
      const scientificName = String(candidate.scientific_name ?? "").trim();
      const normalizedRank = normalizeRank(candidate.rank);
      const confidence =
        typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
          ? Math.min(1, Math.max(0, candidate.confidence))
          : 0.5;
      return {
        vernacularName,
        scientificName,
        matchName: scientificName || vernacularName,
        rankHint: normalizedRank === "unknown" ? null : normalizedRank,
        rank: normalizedRank,
        confidence,
        note: typeof candidate.note === "string" ? candidate.note.trim() : null,
        regions: Array.isArray(candidate.media_regions)
          ? candidate.media_regions.map(normalizeRectCandidate).filter((region): region is NormalizedRegion => Boolean(region))
          : [],
      };
    });

    const [primaryGbifMatch, coexistingGbifMatches] = await Promise.all([
      matchTaxon({ name: primaryMatchName, rank: primaryRankHint }),
      matchTaxonBatch(preparedCandidates.map((candidate) => ({ name: candidate.matchName, rank: candidate.rankHint }))),
    ]);
    const gbifMatchedPrimary = primaryGbifMatch.usageKey !== null;
    const gbifMatchedCoexistingCount = coexistingGbifMatches.reduce((count, match) => (match.usageKey !== null ? count + 1 : count), 0);
    const primaryRegions = Array.isArray(parsed.recommended_media_regions)
      ? parsed.recommended_media_regions.map(normalizeRectCandidate).filter((region): region is NormalizedRegion => Boolean(region))
      : [];

    const invasiveLookupTerms = buildInvasiveLookupTerms({
      primaryName: recommendedScientificName || recommendedName,
      primaryGbif: primaryGbifMatch,
      coexisting: preparedCandidates.map((c, i) => ({
        name: c.scientificName || c.vernacularName,
        gbif: coexistingGbifMatches[i] ?? null,
      })),
    });
    const invasiveFacts = await lookupInvasiveStatusFacts(client, invasiveLookupTerms).catch(
      () => [] as InvasiveStatusFact[],
    );
    const subjectInvasiveCovered = hasSubjectInvasiveFact(invasiveFacts);
    const subjectInvasiveFact = pickSubjectInvasiveFact(invasiveFacts);

    const gatedParsed = applyThreeLensGates(parsed, {
      bandIsLow: band === "low",
      subjectInvasiveCovered,
      subjectInvasiveFact,
    });

    await client.query("begin");
    await ensureLegacyAiRunsForVisit(client, target.visitId);
    const previousRun = await getLatestObservationAiRunForVisit(client, target.visitId);
    const aiRun = await createObservationAiRun(client, {
      visitId: target.visitId,
      triggerOccurrenceId: target.primaryOccurrenceId,
      pipelineVersion: PIPELINE_VERSION,
      modelProvider: "google",
      modelName: modelUsed,
      modelVersion: modelUsed,
      promptVersion,
      taxonomyVersion: TAXONOMY_VERSION,
      inputAssetFingerprint: buildAssetFingerprint(sourceTag, photos),
      triggerKind: sourceTag === "video_thumb" ? "video_thumb_reassess" : "manual_reassess",
      triggeredBy: options.triggeredBy ?? null,
      supersedesRunId: previousRun?.aiRunId ?? null,
      runStatus: "succeeded",
      sourcePayload: {
        sourceTag,
        selectedOccurrenceId: target.selectedOccurrenceId,
        photoCount: photos.length,
        knowledgeVersionSet,
        navigableOs: {
          branch: "feedback_contract",
          observationPackageId: observationPackage?.packageId ?? null,
          claimRefCount: branchClaimRefs.length,
          claimRefs: branchClaimRefs.map((claim) => ({
            claimId: claim.claimId,
            claimType: claim.claimType,
            scopeMatch: claim.scopeMatch,
          })),
        },
        invasiveLookup: {
          termCount: invasiveLookupTerms.length,
          factCount: invasiveFacts.length,
          subjectCovered: subjectInvasiveCovered,
          subjectVersionId: subjectInvasiveFact?.versionId ?? null,
        },
      },
    });

    const assessmentId = randomUUID();
    await client.query(
      `INSERT INTO observation_ai_assessments (
         assessment_id,
         ai_run_id,
         occurrence_id,
         visit_id,
         confidence_band,
         model_used,
         prompt_version,
         pipeline_version,
         taxonomy_version,
         interpretation_status,
         recommended_rank,
         recommended_taxon_name,
         best_specific_taxon_name,
         narrative,
         simple_summary,
         observer_boost,
         next_step_text,
         stop_reason,
         fun_fact,
         fun_fact_grounded,
         diagnostic_features_seen,
         missing_evidence,
         similar_taxa,
         distinguishing_tips,
         confirm_more,
         geographic_context,
         seasonal_context,
         area_inference,
         shot_suggestions,
         raw_json
       ) VALUES (
         $1::uuid,
         $2::uuid,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         'selected',
         $10,
         $11,
         $12,
         $13,
         $14,
         $15,
         $16,
         $17,
         $18,
         $19,
         $20::jsonb,
         $21::jsonb,
         $22::jsonb,
         $23::jsonb,
         $24::jsonb,
         $25,
         $26,
         $27::jsonb,
         $28::jsonb,
         $29::jsonb
       )`,
      [
        assessmentId,
        aiRun.aiRunId,
        target.primaryOccurrenceId,
        target.visitId,
        band,
        modelUsed,
        promptVersion,
        PIPELINE_VERSION,
        TAXONOMY_VERSION,
        rank === "unknown" ? null : rank,
        recommendedName || null,
        bestSpecific || null,
        narrative,
        simple,
        String(parsed.observer_boost ?? "").trim(),
        String(parsed.next_step_text ?? "").trim(),
        String(parsed.stop_reason ?? "").trim(),
        String(parsed.fun_fact ?? "").trim(),
        Boolean(parsed.fun_fact_grounded),
        JSON.stringify(diagFeatures),
        JSON.stringify(missing),
        JSON.stringify(similar),
        JSON.stringify(distinguishing),
        JSON.stringify(confirmMore),
        String(parsed.geographic_context ?? "").trim(),
        String(parsed.seasonal_context ?? "").trim(),
        JSON.stringify(areaInference),
        JSON.stringify(shotSuggestions),
        JSON.stringify({
          raw: rawText.slice(0, 12000),
          parsed: {
            ...gatedParsed,
            claim_refs_used: claimRefsUsed,
            management_action_candidates: managementActionCandidates.map((candidate) => ({
              action_kind: candidate.actionKind,
              label: candidate.label,
              why: candidate.why,
              confidence: candidate.confidence,
              source: candidate.source,
              source_asset_id: candidate.sourceAssetId,
              confirm_state: candidate.confirmState,
            })),
          },
          navigable_os: {
            branch: "feedback_contract",
            observation_package_id: observationPackage?.packageId ?? null,
            retrieved_claim_ids: branchClaimRefs.map((claim) => claim.claimId),
          },
        }),
      ],
    );

    // 0061: gated 3 レンズ値を occurrences の専用列に同期。
    // raw_json への保存とは別に、ランキング・集計用の冗長カラムを更新する。
    await syncOccurrenceThreeLenses(client, target.primaryOccurrenceId, gatedParsed);
    await upsertAiInferredManagementActions(client, {
      assessmentId,
      occurrenceId: target.primaryOccurrenceId,
      visitId: target.visitId,
      placeId: vctx.place_id,
      observedAt: vctx.observed_at || new Date().toISOString(),
      candidates: managementActionCandidates,
    });

    // Phase 3: 通知ディスパッチ。reassess の主処理を巻き込まないように catch で握りつぶす。
    const noveltyScoreFromGated = (() => {
      const obj = (gatedParsed as Record<string, unknown>)["novelty_hint"];
      if (!obj || typeof obj !== "object") return null;
      const v = (obj as Record<string, unknown>)["novelty_score"];
      return typeof v === "number" ? v : null;
    })();
    await emitAlertsForOccurrence(
      {
        occurrenceId: target.primaryOccurrenceId,
        visitId: target.visitId,
        invasiveStatus: subjectInvasiveCovered && subjectInvasiveFact
          ? subjectInvasiveFact.mhlwCategory
          : null,
        scientificName: recommendedScientificName || target.scientificName || null,
        vernacularName: recommendedName || target.vernacularName || null,
        genus: primaryGbifMatch.genus ?? null,
        family: primaryGbifMatch.family ?? null,
        orderName: primaryGbifMatch.orderName ?? null,
        className: primaryGbifMatch.className ?? null,
        prefecture: vctx.prefecture ?? null,
        municipality: vctx.municipality ?? null,
        observerUserId: options.triggeredBy ?? null,
        noveltyScore: noveltyScoreFromGated,
        isRare: false,
      },
      client,
    ).catch((err) => {
      // 通知ディスパッチの失敗は reassess を巻き込まない。ログだけ残す。
      console.error("[reassess] alert dispatch failed:", err instanceof Error ? err.message : err);
    });

    const subjects = await getVisitSubjectSummaries(target.visitId, client);
    const subjectByKey = new Map<string, { occurrenceId: string }>();
    for (const subject of subjects) {
      const subjectKey = buildCandidateKey(subject.vernacularName ?? "", subject.scientificName ?? "", subject.rank);
      if (subjectKey) {
        subjectByKey.set(subjectKey, { occurrenceId: subject.occurrenceId });
      }
    }

    let candidateCount = 0;
    let regionCount = 0;
    for (let index = 0; index < preparedCandidates.length; index += 1) {
      const candidate = preparedCandidates[index];
      if (!candidate) continue;
      const gbif = coexistingGbifMatches[index];
      const candidateKey = buildCandidateKey(candidate.vernacularName, candidate.scientificName, candidate.rankHint);
      const matchedSubject = candidateKey ? subjectByKey.get(candidateKey) ?? null : null;
      const candidateId = randomUUID();
      await client.query(
        `INSERT INTO observation_ai_subject_candidates (
           candidate_id,
           ai_run_id,
           visit_id,
           suggested_occurrence_id,
           candidate_key,
           vernacular_name,
           scientific_name,
           taxon_rank,
           confidence_score,
           candidate_status,
           note,
           source_payload,
           updated_at
         ) VALUES (
           $1::uuid,
           $2::uuid,
           $3,
           $4,
           $5,
           $6,
           $7,
           $8,
           $9,
           $10,
           $11,
           $12::jsonb,
           NOW()
         )`,
        [
          candidateId,
          aiRun.aiRunId,
          target.visitId,
          matchedSubject?.occurrenceId ?? null,
          candidateKey || `${candidate.vernacularName}:${index}`,
          candidate.vernacularName || null,
          candidate.scientificName || null,
          candidate.rankHint,
          candidate.confidence,
          matchedSubject ? "matched" : "proposed",
          candidate.note,
          JSON.stringify({
            sourceTag,
            gbif: {
              usageKey: gbif?.usageKey ?? null,
              matchType: gbif?.matchType ?? "NONE",
              confidence: gbif?.confidence ?? null,
            },
          }),
        ],
      );
      candidateCount += 1;

      for (const region of candidate.regions) {
        const photo = photos[region.assetIndex];
        if (!photo?.assetId) continue;
        await client.query(
          `INSERT INTO subject_media_regions (
             region_id,
             ai_run_id,
             occurrence_id,
             candidate_id,
             asset_id,
             normalized_rect,
             frame_time_ms,
             confidence_score,
             source_kind,
             source_model,
             source_payload
           ) VALUES (
             gen_random_uuid(),
             $1::uuid,
             $2,
             $3::uuid,
             $4::uuid,
             $5::jsonb,
             $6,
             $7,
             'ai',
             $8,
             $9::jsonb
           )`,
          [
            aiRun.aiRunId,
            matchedSubject?.occurrenceId ?? null,
            candidateId,
            photo.assetId,
            JSON.stringify(region.rect),
            region.frameTimeMs ?? photo.frameTimeMs ?? null,
            region.confidence,
            modelUsed,
            JSON.stringify({
              note: region.note,
              sourceTag,
              assetIndex: region.assetIndex,
            }),
          ],
        );
        regionCount += 1;
      }
    }

    for (const region of primaryRegions) {
      const photo = photos[region.assetIndex];
      if (!photo?.assetId) continue;
      await client.query(
        `INSERT INTO subject_media_regions (
           region_id,
           ai_run_id,
           occurrence_id,
           asset_id,
           normalized_rect,
           frame_time_ms,
           confidence_score,
           source_kind,
           source_model,
           source_payload
         ) VALUES (
           gen_random_uuid(),
           $1::uuid,
           $2,
           $3::uuid,
           $4::jsonb,
           $5,
           $6,
           'ai',
           $7,
           $8::jsonb
         )`,
        [
          aiRun.aiRunId,
          target.primaryOccurrenceId,
          photo.assetId,
          JSON.stringify(region.rect),
          region.frameTimeMs ?? photo.frameTimeMs ?? null,
          region.confidence,
          modelUsed,
          JSON.stringify({
            note: region.note,
            sourceTag,
            assetIndex: region.assetIndex,
          }),
        ],
      );
      regionCount += 1;
    }

    // Phase γ: evidence_assets.role_tag を region サイズから heuristic 推定。
    // 既に user/heuristic が付いているものは上書きしない (role_tag_source=ai のみ更新)。
    // area ≥ 0.55 → full_body / 0.05-0.55 → close_up_organ / region なし → habitat_wide
    const roleAreaByAsset = new Map<string, number>();
    for (const region of primaryRegions) {
      const photo = photos[region.assetIndex];
      if (!photo?.assetId || !region.rect) continue;
      const area = Math.max(0, Math.min(1, region.rect.width * region.rect.height));
      const prev = roleAreaByAsset.get(photo.assetId) ?? 0;
      if (area > prev) roleAreaByAsset.set(photo.assetId, area);
    }
    for (const photo of photos) {
      if (!photo?.assetId) continue;
      const maxArea = roleAreaByAsset.get(photo.assetId) ?? 0;
      const roleTag = maxArea >= 0.55 ? "full_body"
        : maxArea > 0 && maxArea < 0.55 ? "close_up_organ"
        : "habitat_wide";
      await client.query(
        `UPDATE evidence_assets
           SET role_tag = $1, role_tag_source = 'ai'
         WHERE asset_id = $2::uuid
           AND (role_tag IS NULL OR role_tag_source = 'ai')`,
        [roleTag, photo.assetId],
      );
    }

    const storedDisplayState = await getStoredVisitDisplayState(client, target.visitId).catch(() => null);
    const latestSubjects = await getVisitSubjectSummaries(target.visitId, client);
    let resolvedDisplayState = storedDisplayState;
    if (!storedDisplayState || !storedDisplayState.lockedByHuman) {
      resolvedDisplayState = deriveVisitDisplayState(target.visitId, latestSubjects, aiRun.aiRunId);
      await upsertVisitDisplayState(client, resolvedDisplayState);
    }

    await client.query("commit");

    const result: ReassessResult = {
      aiRunId: aiRun.aiRunId,
      assessmentId,
      occurrenceId: target.primaryOccurrenceId,
      visitId: target.visitId,
      confidenceBand: band,
      recommendedTaxonName: recommendedName,
      narrative,
      candidateCount,
      regionCount,
      gbifMatchedPrimary,
      gbifMatchedCoexistingCount,
      modelUsed,
      selectionSource: resolvedDisplayState?.selectionSource ?? "system_stable",
      featuredOccurrenceId: resolvedDisplayState?.featuredOccurrenceId ?? null,
    };

    // Persist to user_output_cache for the next identical request. Failures
    // are silenced — the user already got their assessment.
    if (cacheKey && cacheUserId) {
      saveUserOutputCache({
        cacheKey,
        userId: cacheUserId,
        outputKind: "observation_assessment",
        promptVersion: cachePromptVersion,
        visitId: target.visitId,
        occurrenceId: target.primaryOccurrenceId,
        knowledgeVersionSet: knowledgeVersionSet as unknown as Record<string, string | string[]>,
        outputPayload: result,
      }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("[user_output_cache] save failed", err);
      });
    }

    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
