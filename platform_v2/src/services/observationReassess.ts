import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import type { PoolClient } from "pg";
import sharp from "sharp";
import { loadConfig } from "../config.js";
import { getPool } from "../db.js";
import { createObservationAiRun, ensureLegacyAiRunsForVisit, getLatestObservationAiRunForVisit } from "./observationAiRuns.js";
import { matchTaxon, matchTaxonBatch, type GbifMatch } from "./gbifBackboneMatch.js";
import { getStoredVisitDisplayState, upsertVisitDisplayState, deriveVisitDisplayState } from "./visitDisplayState.js";
import { getVisitSubjectSummaries } from "./visitSubjects.js";
import { logAiCost } from "./aiCostLogger.js";
import { assertAllowed as assertAiBudgetAllowed } from "./aiBudgetGate.js";
import { generateAiTextWithRoleChain, type AiRouterGenerateResult, type AiRouterPart } from "./aiModelRouter.js";
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
import {
  markPrimaryOccurrenceAsAiJudgement,
  materializeAiJudgementObservationRecord,
} from "./aiJudgementObservationRecords.js";
import { lookupLocalTaxonName } from "./taxonNameNormalizer.js";
import { normalizeBiologicalSubjectCandidate } from "./biologicalSubjectGate.js";
import { logGlossaryTermCandidatesFromAiOutput } from "./glossaryTerms.js";

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
  materializedCandidateRecordCount: number;
  matchedCandidateRecordCount: number;
  candidateOnlyCount: number;
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
  selectionScore?: number | null;
  selectionReason?: string | null;
  differenceScore?: number | null;
  qualityScore?: number | null;
};

export type ReassessAudioInput = {
  mime: string;
  b64: string;
  assetId?: string | null;
  source?: string | null;
  durationSec?: number | null;
};

export type ReassessObservationOptions = {
  photos?: ReassessImageInput[];
  audioInputs?: ReassessAudioInput[];
  promptVersion?: string;
  sourceTag?: string;
  triggeredBy?: string | null;
};

type GeminiRegion = {
  asset_index?: number;
  assetIndex?: number;
  image_index?: number;
  imageIndex?: number;
  rect?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    w?: number;
    h?: number;
    left?: number;
    top?: number;
    x_min?: number;
    y_min?: number;
    x_max?: number;
    y_max?: number;
  };
  normalized_rect?: GeminiRegion["rect"];
  bbox?: unknown;
  bounding_box?: unknown;
  frame_time_ms?: number;
  frameTimeMs?: number;
  confidence?: number;
  confidence_score?: number;
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

type GeminiTaxonomicCandidate = {
  taxon_name?: string;
  name?: string;
  scientific_name?: string;
  rank?: string;
  probability?: number;
  confidence?: number;
  diagnostic_features_observed?: string[];
  diagnostic_features_missing?: string[];
  visual_contradictions?: string[];
};

type GeminiConfusableGroup = {
  group_name?: string;
  name?: string;
  distinction_point?: string;
};

type GeminiJson = {
  confidence_band?: string;
  recommended_rank?: string;
  recommended_taxon_name?: string;
  recommended_scientific_name?: string;
  taxonomic_candidates?: GeminiTaxonomicCandidate[];
  rank_decision_reason?: string;
  diagnostic_features_observed?: string[];
  diagnostic_features_missing?: string[];
  confusable_groups?: GeminiConfusableGroup[];
  visual_contradictions?: string[];
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
  candidate_readings?: Array<{
    name?: string;
    scientific_name?: string;
    rank?: string;
    role?: string;
    visible_features?: string[];
    weak_points?: string[];
    shooting_tips?: string[];
    regional_read?: string;
    size_assessment?: {
      typical_size_cm?: number | null;
      observed_size_estimate_cm?: number | null;
      size_class?: string | null;
      ranking_hint?: string;
      basis?: string;
      hedge?: string;
    };
  }>;
  recommended_media_regions?: GeminiRegion[];
  coexisting_taxa?: Array<{
    name?: string;
    scientific_name?: string;
    rank?: string;
    confidence?: number;
    note?: string;
    media_regions?: GeminiRegion[];
  }>;
  audio_events?: Array<{
    label?: string;
    taxon_name?: string;
    scientific_name?: string;
    confidence?: number;
    time_range_sec?: [number, number];
    evidence_note?: string;
  }>;
  heard_taxa?: Array<{
    name?: string;
    scientific_name?: string;
    rank?: string;
    confidence?: number;
    evidence_note?: string;
  }>;
  audio_privacy_risk?: boolean;
};

type GeminiCoexistingTaxon = NonNullable<GeminiJson["coexisting_taxa"]>[number];
type GeminiCandidateReading = NonNullable<GeminiJson["candidate_readings"]>[number];

type MultiSubjectGuardResult = {
  promotedFromCandidateReadings: number;
  rescueTriggered: boolean;
  rescueCandidateCount: number;
  rescueModelUsed: string | null;
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

function normalizeShotSuggestionKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeShotSuggestionRationale(options: {
  role: string;
  target: string;
  rationale: string;
}): string {
  const role = normalizeShotSuggestionKey(options.role);
  const target = normalizeShotSuggestionKey(options.target);
  const rationale = normalizeShotSuggestionKey(options.rationale);
  const combined = `${role} ${target} ${rationale}`;
  const isBoilerplate = !rationale || /詳細|文脈記録|記録するため|判断材料|識別に必須|同定に必須/.test(options.rationale);

  if (!isBoilerplate && options.rationale.length >= 24) return options.rationale;
  if (role.includes("habitat") || role.includes("広角") || rationale.includes("文脈")) {
    return "周りの草、水辺、日当たりなどが残ると、その場所でどう現れていたかを季節や別地点の記録と比べやすくなります。";
  }
  if (role.includes("substrate") || combined.includes("土") || combined.includes("石") || combined.includes("樹皮")) {
    return "接している土、石、樹皮などが残ると、その生きものが使っていた場所の条件を後から確認できます。";
  }
  if (role.includes("scale") || combined.includes("大きさ")) {
    return "大きさの手がかりがあると、写真だけでは迷いやすいサイズ感を後から確認できます。";
  }
  if (role.includes("full_body") || combined.includes("全景") || combined.includes("全身")) {
    return "全体の形と周りとの位置関係が残ると、アップだけでは分からない姿や広がりを見直せます。";
  }
  if (role.includes("close_up") || rationale.includes("詳細")) {
    if (combined.includes("花") || combined.includes("花弁") || combined.includes("裂片") || combined.includes("萼")) {
      return "花の形や割れ方を後から見比べられて、似た花との違いや季節ごとの姿を説明しやすくなります。";
    }
    if (combined.includes("葉") || combined.includes("茎") || combined.includes("毛")) {
      return "葉や茎の付き方、毛の有無が残ると、同じ仲間の違いや成長段階を後から見直せます。";
    }
    if (combined.includes("翅") || combined.includes("触角") || combined.includes("脚") || combined.includes("昆虫")) {
      return "細部の形を後から拡大して見直せるので、その場では気づかなかった手がかりを拾いやすくなります。";
    }
    return "細部が残ると、後から見直したときに何が写っていて何が足りないかを判断しやすくなります。";
  }
  return "その場の見え方がもう少し残ると、あとで確認したときに場面や変化を思い出しやすくなります。";
}

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
      rationale: normalizeShotSuggestionRationale({ role, target, rationale }).slice(0, 140),
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
  const gateSizeAssessment = (raw: unknown): Record<string, unknown> | null => {
    if (!raw || typeof raw !== "object") return null;
    const obj = { ...(raw as Record<string, unknown>) };
    const basis = typeof obj.basis === "string" ? obj.basis : "";
    const hasScaleHint = /手|指|コイン|スケール|物差し|定規|cm|mm/i.test(basis);
    if (!basis || !hasScaleHint) {
      obj.observed_size_estimate_cm = null;
    }
    obj.hedge = obj.hedge || "AIによる目測のため誤差大。確定値ではありません。";
    return obj;
  };
  const size = (parsed as Record<string, unknown>)["size_assessment"];
  const gatedSize = gateSizeAssessment(size);
  if (gatedSize) {
    (out as Record<string, unknown>)["size_assessment"] = gatedSize;
  }
  if (Array.isArray(out.candidate_readings)) {
    out.candidate_readings = out.candidate_readings.map((reading) => {
      const gatedCandidateSize = gateSizeAssessment(reading.size_assessment);
      if (!gatedCandidateSize) return reading;
      return { ...reading, size_assessment: gatedCandidateSize };
    });
  }
  return out;
}

type TaxonomicRankGuardrailInput = {
  recommendedName: string;
  recommendedScientificName: string;
  rank: ReturnType<typeof normalizeRank>;
  confidenceBand: ReturnType<typeof normalizeBand>;
  parsed: GeminiJson;
};

type TaxonomicRankGuardrailResult = {
  recommendedName: string;
  recommendedScientificName: string;
  rank: ReturnType<typeof normalizeRank>;
  downgraded: boolean;
  reason: string | null;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function scientificGenus(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^([A-Z][a-z-]+)(?:\s|$)/);
  return match?.[1] ?? null;
}

function candidateProbability(candidate: GeminiTaxonomicCandidate): number | null {
  const raw = typeof candidate.probability === "number" ? candidate.probability : candidate.confidence;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.min(1, raw));
}

function normalizedTaxonomicCandidates(raw: unknown): Array<{
  name: string;
  scientificName: string;
  rank: ReturnType<typeof normalizeRank>;
  probability: number | null;
}> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((candidate) => {
      const item = candidate as GeminiTaxonomicCandidate;
      const name = normalizeCandidateName(item.taxon_name ?? item.name);
      const scientificName = normalizeCandidateName(item.scientific_name);
      const rank = normalizeRank(item.rank);
      if (!name && !scientificName) return null;
      return { name, scientificName, rank, probability: candidateProbability(item) };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
    .slice(0, 5);
}

export function applyTaxonomicRankGuardrail(input: TaxonomicRankGuardrailInput): TaxonomicRankGuardrailResult {
  if (input.rank !== "species") {
    return {
      recommendedName: input.recommendedName,
      recommendedScientificName: input.recommendedScientificName,
      rank: input.rank,
      downgraded: false,
      reason: null,
    };
  }

  const candidates = normalizedTaxonomicCandidates(input.parsed.taxonomic_candidates);
  const missing = [
    ...stringArray(input.parsed.diagnostic_features_missing),
    ...stringArray(input.parsed.diagnostic_features_seen).filter((feature) => /見えない|不明|不足|確認できない/u.test(feature)),
  ];
  const contradictions = stringArray(input.parsed.visual_contradictions);
  const hasConfusableGroups = Array.isArray(input.parsed.confusable_groups) && input.parsed.confusable_groups.length > 0;
  const top = candidates[0] ?? null;
  const runnerUp = candidates[1] ?? null;
  const topProbability = top?.probability ?? null;
  const runnerProbability = runnerUp?.probability ?? null;
  const closeRace = topProbability != null && runnerProbability != null && topProbability - runnerProbability <= 0.2;
  const weakSpecies = input.confidenceBand === "low" || missing.length > 0 || contradictions.length > 0 || (hasConfusableGroups && closeRace);

  if (!weakSpecies) {
    return {
      recommendedName: input.recommendedName,
      recommendedScientificName: input.recommendedScientificName,
      rank: input.rank,
      downgraded: false,
      reason: null,
    };
  }

  const primaryGenus = scientificGenus(top?.scientificName || input.recommendedScientificName);
  const runnerGenus = scientificGenus(runnerUp?.scientificName || "");
  if (primaryGenus && (!runnerUp || primaryGenus === runnerGenus)) {
    return {
      recommendedName: `${primaryGenus}属の一種`,
      recommendedScientificName: primaryGenus,
      rank: "genus",
      downgraded: true,
      reason: [
        "species_guardrail",
        closeRace ? "close_candidates" : "",
        missing.length > 0 ? "diagnostic_missing" : "",
        contradictions.length > 0 ? "visual_contradiction" : "",
      ].filter(Boolean).join(":"),
    };
  }

  return {
    recommendedName: "チョウ目の一種",
    recommendedScientificName: "Lepidoptera",
    rank: "order",
    downgraded: true,
    reason: [
      "species_guardrail",
      "cross_group_uncertainty",
      missing.length > 0 ? "diagnostic_missing" : "",
      contradictions.length > 0 ? "visual_contradiction" : "",
    ].filter(Boolean).join(":"),
  };
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

type LoadedAudioInput = ReassessAudioInput & {
  assetId: string | null;
};

type ResolvedObservationTarget = {
  visitId: string;
  visitLegacyObservationId: string | null;
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

type PhotoAssetRef = {
  assetId: string;
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

function normalizeRank(r: string | undefined): "species" | "genus" | "family" | "order" | "class" | "lifeform" | "unknown" {
  const v = String(r ?? "").toLowerCase().trim();
  if (v === "species" || v === "genus" || v === "family" || v === "order" || v === "class" || v === "lifeform") return v;
  return "unknown";
}

function normalizeBand(b: string | undefined): "high" | "medium" | "low" | "unknown" {
  const v = String(b ?? "").toLowerCase().trim();
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function confidenceFromBand(band: "high" | "medium" | "low" | "unknown"): number {
  if (band === "high") return 0.85;
  if (band === "medium") return 0.6;
  if (band === "low") return 0.35;
  return 0.25;
}

function firstFiniteNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeCoordinateValue(value: number, scale: number): number {
  const normalized = scale === 100 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function normalizeRectValue(value: unknown): NormalizedRegion["rect"] | null {
  const source = Array.isArray(value)
    ? { x: value[0], y: value[1], width: value[2], height: value[3] }
    : value && typeof value === "object"
      ? value as Record<string, unknown>
      : null;
  if (!source) return null;
  const rect = source as Record<string, unknown>;

  const x = firstFiniteNumber([rect.x, rect.left, rect.x_min, rect.xMin]);
  const y = firstFiniteNumber([rect.y, rect.top, rect.y_min, rect.yMin]);
  let width = firstFiniteNumber([rect.width, rect.w]);
  let height = firstFiniteNumber([rect.height, rect.h]);
  const xMax = firstFiniteNumber([rect.x_max, rect.xMax, rect.right]);
  const yMax = firstFiniteNumber([rect.y_max, rect.yMax, rect.bottom]);
  if (x == null || y == null) return null;
  if (width == null && xMax != null) width = xMax - x;
  if (height == null && yMax != null) height = yMax - y;
  if (width == null || height == null) return null;

  const rawValues = [x, y, width, height, xMax, yMax].filter((item): item is number => item != null);
  const scale = rawValues.some((item) => Math.abs(item) > 1.001) ? 100 : 1;
  const nx = normalizeCoordinateValue(x, scale);
  const ny = normalizeCoordinateValue(y, scale);
  const nw = normalizeCoordinateValue(width, scale);
  const nh = normalizeCoordinateValue(height, scale);
  if (nw <= 0 || nh <= 0 || nx + nw > 1.001 || ny + nh > 1.001) return null;
  return {
    x: nx,
    y: ny,
    width: Math.min(nw, 1 - nx),
    height: Math.min(nh, 1 - ny),
  };
}

function normalizeRectCandidate(region: GeminiRegion, assetCount?: number): NormalizedRegion | null {
  let assetIndex = firstFiniteNumber([region.asset_index, region.assetIndex, region.image_index, region.imageIndex]);
  if (assetIndex == null && assetCount === 1) assetIndex = 0;
  if (assetIndex == null || !Number.isInteger(assetIndex) || assetIndex < 0) {
    return null;
  }
  if (assetCount != null && assetIndex >= assetCount) {
    return null;
  }
  const normalizedAssetIndex: number = assetIndex;
  const rect = normalizeRectValue(region.rect ?? region.normalized_rect ?? region.bbox ?? region.bounding_box);
  if (!rect) {
    return null;
  }
  const frameTimeMs = region.frame_time_ms == null ? region.frameTimeMs == null ? null : Number(region.frameTimeMs) : Number(region.frame_time_ms);
  const rawConfidence = region.confidence == null ? region.confidence_score : region.confidence;
  const confidence = rawConfidence == null ? null : Math.min(1, Math.max(0, Number(rawConfidence)));
  return {
    assetIndex: normalizedAssetIndex,
    frameTimeMs: Number.isFinite(frameTimeMs ?? NaN) ? Math.max(0, Math.round(frameTimeMs ?? 0)) : null,
    confidence: confidence != null && Number.isFinite(confidence) ? confidence : null,
    note: typeof region.note === "string" && region.note.trim() ? region.note.trim() : null,
    rect,
  };
}

function buildCandidateKey(vernacularName: string, scientificName: string, rank: string | null): string {
  return [scientificName.trim().toLowerCase(), vernacularName.trim().toLowerCase(), String(rank ?? "").trim().toLowerCase()]
    .filter((part) => part.length > 0)
    .join("|");
}

function looksLikeCanonicalScientificName(value: string): boolean {
  return /^[A-Z][a-z]+(?: [a-z][a-z.-]+){0,3}$/.test(value.trim());
}

function canonicalScientificNameFromGbif(candidate: { scientificName: string }, gbif: GbifMatch | null | undefined): string | null {
  if (candidate.scientificName) return null;
  if (!gbif?.usageKey) return null;
  const canonicalName = normalizeCandidateName(gbif.canonicalName);
  if (!canonicalName || !looksLikeCanonicalScientificName(canonicalName)) return null;
  const matchType = String(gbif.matchType ?? "").toUpperCase();
  const confidence = typeof gbif.confidence === "number" && Number.isFinite(gbif.confidence) ? gbif.confidence : 0;
  if (matchType !== "EXACT" && confidence < 95) return null;
  return canonicalName;
}

function normalizeCandidateName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUnhelpfulGenericCandidateName(value: unknown): boolean {
  const text = normalizeCandidateName(value);
  if (!text) return true;
  return /未同定|同定待ち|名前待ち|AI\s*候補|他の植栽|複数の低木|構成種[:：]?|植栽低木$/iu.test(text);
}

function isAlternativeIdentificationRole(value: unknown): boolean {
  const text = normalizeCandidateName(value);
  if (!text) return false;
  return /比較候補|別候補|代替候補|類似候補|同定候補|分類候補|混同|似ている|同じ対象|同一対象|same subject|alternative/i.test(text);
}

function isSeparateVisualSubjectRole(value: unknown): boolean {
  const text = normalizeCandidateName(value);
  if (!text) return false;
  return /副対象|別対象|別個体|一緒に写|同場面|背景|植生|草本|木本|地表|足元|周囲|花に来た虫|訪花|昆虫|ハチ|ハエ|甲虫|チョウ|クモ|幼虫|食痕|虫こぶ|寄生|摂食|写り込|グランドカバー/u.test(text);
}

function looksLikeAlternativeIdentificationCandidate(candidate: GeminiCoexistingTaxon): boolean {
  const roleText = [candidate.note, candidate.name].map(normalizeCandidateName).filter(Boolean).join(" / ");
  if (!isAlternativeIdentificationRole(roleText)) return false;
  return !Array.isArray(candidate.media_regions) || candidate.media_regions.length === 0;
}

function coexistingCandidateKey(candidate: GeminiCoexistingTaxon): string {
  const rank = normalizeRank(candidate.rank);
  return buildCandidateKey(
    normalizeCandidateName(candidate.name),
    normalizeCandidateName(candidate.scientific_name),
    rank === "unknown" ? null : rank,
  );
}

function isSameAsPrimaryCandidate(candidate: {
  name?: unknown;
  scientific_name?: unknown;
  rank?: unknown;
}, primary: { vernacularName: string; scientificName: string }): boolean {
  const name = normalizeCandidateName(candidate.name).toLowerCase();
  const scientificName = normalizeCandidateName(candidate.scientific_name).toLowerCase();
  const primaryNames = [primary.vernacularName, primary.scientificName]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (primaryNames.length === 0) return false;
  return Boolean((name && primaryNames.includes(name)) || (scientificName && primaryNames.includes(scientificName)));
}

function candidateReadingToCoexistingTaxon(reading: GeminiCandidateReading): GeminiCoexistingTaxon | null {
  const name = normalizeCandidateName(reading.name);
  const role = normalizeCandidateName(reading.role);
  if (!isSeparateVisualSubjectRole(role) || isAlternativeIdentificationRole(role)) return null;
  const local = lookupLocalTaxonName(name);
  const gated = normalizeBiologicalSubjectCandidate({
    vernacularName: name,
    scientificName: normalizeCandidateName(reading.scientific_name) || local?.scientificName || "",
  });
  if (!gated) return null;
  const scientificName = gated.scientificName || "";
  const vernacularName = gated.vernacularName || "";
  if (!scientificName && isUnhelpfulGenericCandidateName(vernacularName)) return null;
  const rank = normalizeRank(reading.rank);
  const visible = Array.isArray(reading.visible_features)
    ? reading.visible_features.filter((value) => typeof value === "string" && value.trim()).slice(0, 3)
    : [];
  const weak = Array.isArray(reading.weak_points)
    ? reading.weak_points.filter((value) => typeof value === "string" && value.trim()).slice(0, 2)
    : [];
  return {
    name: vernacularName,
    scientific_name: scientificName,
    rank: rank === "unknown" || (rank === "lifeform" && local) ? local?.rank ?? "lifeform" : rank,
    confidence: 0.45,
    note: [role, ...visible, ...weak].filter(Boolean).join(" / ").slice(0, 240),
    media_regions: [],
  };
}

function enrichCoexistingTaxonName(candidate: GeminiCoexistingTaxon): GeminiCoexistingTaxon {
  const name = normalizeCandidateName(candidate.name);
  const scientificName = normalizeCandidateName(candidate.scientific_name);
  if (scientificName) return candidate;
  const local = lookupLocalTaxonName(name);
  if (!local) return candidate;
  const rank = normalizeRank(candidate.rank);
  return {
    ...candidate,
    name: name || local.vernacularName,
    scientific_name: local.scientificName,
    rank: rank === "unknown" || rank === "lifeform" ? local.rank : rank,
  };
}

function enrichCandidateReadingName(reading: GeminiCandidateReading): GeminiCandidateReading {
  const name = normalizeCandidateName(reading.name);
  const scientificName = normalizeCandidateName(reading.scientific_name);
  if (scientificName) return reading;
  const local = lookupLocalTaxonName(name);
  if (!local) return reading;
  const rank = normalizeRank(reading.rank);
  return {
    ...reading,
    name: name || local.vernacularName,
    scientific_name: local.scientificName,
    rank: rank === "unknown" || rank === "lifeform" ? local.rank : rank,
  };
}

function mergeCoexistingCandidates(
  base: GeminiCoexistingTaxon[],
  additions: GeminiCoexistingTaxon[],
  primary: { vernacularName: string; scientificName: string },
): { candidates: GeminiCoexistingTaxon[]; added: number } {
  const candidates: GeminiCoexistingTaxon[] = [];
  const seen = new Set<string>();
  const push = (candidate: GeminiCoexistingTaxon): boolean => {
    const enriched = enrichCoexistingTaxonName(candidate);
    const gated = normalizeBiologicalSubjectCandidate({
      vernacularName: normalizeCandidateName(enriched.name),
      scientificName: normalizeCandidateName(enriched.scientific_name),
    });
    if (!gated) return false;
    const name = gated.vernacularName || "";
    const scientificName = gated.scientificName || "";
    if (!name && !scientificName) return false;
    if (!scientificName && isUnhelpfulGenericCandidateName(name)) return false;
    if (looksLikeAlternativeIdentificationCandidate(enriched)) return false;
    const normalizedCandidate = {
      ...enriched,
      name,
      scientific_name: scientificName,
    };
    if (isSameAsPrimaryCandidate(normalizedCandidate, primary)) return false;
    const key = coexistingCandidateKey(normalizedCandidate) || `${scientificName.toLowerCase()}|${name.toLowerCase()}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    candidates.push(normalizedCandidate);
    return true;
  };
  for (const candidate of base) push(candidate);
  let added = 0;
  for (const candidate of additions) {
    if (push(candidate)) added += 1;
  }
  return { candidates, added };
}

export function promoteCandidateReadingsToCoexistingTaxa(
  input: {
    coexistingTaxa?: GeminiJson["coexisting_taxa"];
    candidateReadings?: GeminiJson["candidate_readings"];
    primaryVernacularName?: string;
    primaryScientificName?: string;
  },
): { candidates: GeminiCoexistingTaxon[]; promoted: number } {
  const base = Array.isArray(input.coexistingTaxa)
    ? input.coexistingTaxa.filter((value) => Boolean(value))
    : [];
  const additions = Array.isArray(input.candidateReadings)
    ? input.candidateReadings
        .map(candidateReadingToCoexistingTaxon)
        .filter((value): value is GeminiCoexistingTaxon => Boolean(value))
    : [];
  const merged = mergeCoexistingCandidates(base, additions, {
    vernacularName: input.primaryVernacularName ?? "",
    scientificName: input.primaryScientificName ?? "",
  });
  return { candidates: merged.candidates, promoted: merged.added };
}

export const __test__ = {
  normalizeRectCandidate,
  buildVisualInputParts,
};

function buildAssetFingerprint(sourceTag: string, photos: LoadedPhotoInput[], audioInputs: LoadedAudioInput[] = []): string {
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
  for (const audio of audioInputs) {
    hash.update("|audio:");
    hash.update(audio.assetId ?? "inline");
    hash.update(":");
    hash.update(audio.mime);
    hash.update(":");
    hash.update(String(audio.durationSec ?? ""));
    hash.update(":");
    hash.update(String(audio.b64.length));
    hash.update(":");
    hash.update(audio.b64.slice(0, 64));
  }
  return hash.digest("hex");
}

function buildVisualInputParts(photos: ReassessImageInput[]): AiRouterPart[] {
  return photos.flatMap((photo, index) => {
    const asset = photo.assetId ? ` asset_id=${photo.assetId}` : "";
    const frame = typeof photo.frameTimeMs === "number" && Number.isFinite(photo.frameTimeMs)
      ? ` frame_time_ms=${Math.round(photo.frameTimeMs)}`
      : "";
    const selection = typeof photo.selectionScore === "number" && Number.isFinite(photo.selectionScore)
      ? ` selection_score=${photo.selectionScore.toFixed(2)}`
      : "";
    const reason = photo.selectionReason ? ` selection_reason=${photo.selectionReason}` : "";
    return [
      { text: `入力画像 asset_index=${index}${asset}${frame}${selection}${reason}` },
      { inlineData: { mimeType: photo.mime, data: photo.b64 } },
    ];
  });
}

function formatInputMediaSummaryForPrompt(sourceTag: string, photos: LoadedPhotoInput[]): string {
  if (photos.length === 0) return "";
  const imageLines = photos.map((photo, index) => {
    const frame = typeof photo.frameTimeMs === "number" && Number.isFinite(photo.frameTimeMs)
      ? ` video_frame ${(Number(photo.frameTimeMs) / 1000).toFixed(1).replace(/\.0$/, "")}s`
      : "photo";
    const asset = photo.assetId ? ` asset_id=${photo.assetId}` : "";
    const score = typeof photo.selectionScore === "number" ? ` score=${photo.selectionScore.toFixed(2)}` : "";
    const reason = photo.selectionReason ? ` reason=${photo.selectionReason}` : "";
    return `- asset_index ${index}: ${frame}${asset}${score}${reason}`;
  });
  const videoFrames = photos
    .map((photo, index) => ({
      index,
      frameTimeMs: photo.frameTimeMs,
      selectionScore: photo.selectionScore,
      selectionReason: photo.selectionReason,
      differenceScore: photo.differenceScore,
      qualityScore: photo.qualityScore,
    }))
    .filter((item) => item.frameTimeMs != null && Number.isFinite(Number(item.frameTimeMs)));
  const base = `\n\n入力画像メタデータ:\n${imageLines.join("\n")}\n領域を返す場合は、必ずこの 0 始まりの asset_index と対応させてください。複数写真では1枚目だけで決めず、各画像の主対象・周囲文脈・別対象候補を比較してください。`;
  if (!sourceTag.startsWith("video") || videoFrames.length === 0) return base;
  const lines = videoFrames.map((item) => {
    const seconds = (Number(item.frameTimeMs) / 1000).toFixed(1).replace(/\.0$/, "");
    const score = typeof item.selectionScore === "number" ? ` score=${item.selectionScore.toFixed(2)}` : "";
    const reason = item.selectionReason ? ` reason=${item.selectionReason}` : "";
    return `- asset_index ${item.index}: video_frame ${seconds}s${score}${reason}`;
  });
  return `${base}\n動画由来の複数フレーム:\n${lines.join("\n")}\nフレームはAIなしの差分・明るさ・輪郭スコアで可変選抜されています。時間差で見える対象・動き・周辺環境を総合し、領域を返す場合は該当する asset_index と frame_time_ms を使ってください。`;
}

function formatAudioEvidenceSummaryForPrompt(audioInputs: LoadedAudioInput[]): string {
  if (audioInputs.length === 0) return "";
  const lines = audioInputs.map((audio, index) => {
    const duration = typeof audio.durationSec === "number" && Number.isFinite(audio.durationSec)
      ? ` duration=${audio.durationSec.toFixed(1).replace(/\.0$/, "")}s`
      : "";
    const source = audio.source ? ` source=${audio.source}` : "";
    return `- audio_index ${index}: ${audio.mime}${duration}${source}`;
  });
  return `\n\n入力音声メタデータ:\n${lines.join("\n")}\n音声は「聞こえる証拠」として扱い、画像に写る副対象とは混ぜないでください。聞こえた可能性のある分類群は heard_taxa / audio_events に分け、人の声や個人情報が含まれそうなら audio_privacy_risk を true にしてください。`;
}

function triggerKindForSourceTag(sourceTag: string): string {
  if (sourceTag === "video_thumb" || sourceTag === "video_frames" || sourceTag === "video_adaptive_frames") {
    return "video_ready_reassess";
  }
  return "manual_reassess";
}

function readObservationAiImageMaxEdge(): number | null {
  const raw = process.env.AI_OBSERVATION_IMAGE_MAX_EDGE?.trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(4096, Math.max(320, parsed));
}

async function preparePhotoBytesForGemini(input: { buffer: Buffer; mime: string | null }): Promise<{ buffer: Buffer; mime: string }> {
  const mime = input.mime || "image/jpeg";
  const maxEdge = readObservationAiImageMaxEdge();
  if (!maxEdge || !mime.startsWith("image/")) {
    return { buffer: input.buffer, mime };
  }
  try {
    const resized = await sharp(input.buffer, { failOn: "none" })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
    return { buffer: resized, mime: "image/jpeg" };
  } catch {
    return { buffer: input.buffer, mime };
  }
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
      LIMIT 6`,
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
        const prepared = await preparePhotoBytesForGemini({ buffer: buf, mime: row.mime_type });
        out.push({
          mime: prepared.mime,
          b64: prepared.buffer.toString("base64"),
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

async function loadPhotoAssetRefs(client: PoolClient, visitId: string): Promise<PhotoAssetRef[]> {
  const rows = await client.query<{ asset_id: string }>(
    `SELECT ea.asset_id::text
       FROM evidence_assets ea
      WHERE ea.visit_id = $1
        AND ea.asset_role = 'observation_photo'
      ORDER BY ea.created_at ASC
      LIMIT 24`,
    [visitId],
  );
  return rows.rows.map((row) => ({ assetId: row.asset_id }));
}

async function resolveObservationTarget(client: PoolClient, observationId: string): Promise<ResolvedObservationTarget | null> {
  const result = await client.query<{
    visit_id: string;
    visit_legacy_observation_id: string | null;
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
            v.legacy_observation_id AS visit_legacy_observation_id,
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
    visitLegacyObservationId: row.visit_legacy_observation_id,
    selectedOccurrenceId: row.selected_occurrence_id ?? row.primary_occurrence_id,
    primaryOccurrenceId: row.primary_occurrence_id,
    selectedSubjectIndex: row.selected_subject_index ?? 0,
    vernacularName: row.vernacular_name,
    scientificName: row.scientific_name,
    taxonRank: row.taxon_rank,
  };
}

type GeminiCostMeta = {
  userId?: string | null;
  visitId?: string | null;
  occurrenceId?: string | null;
  sourceTag?: string | null;
};

const NON_BIOLOGICAL_SUBJECT_PATTERN = /石碑|公園|道路|舗装|看板|建物|土壌|裸地|礫|水面|ベンチ|フェンス|人工物|車両|車止め|噴水|モニュメント|コンクリート|アスファルト/u;

function isObservationVisualLiteFirstEnabled(): boolean {
  const raw = process.env.AI_OBSERVATION_VISUAL_LITE_FIRST?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function hasAreaInferenceSignal(parsed: GeminiJson): boolean {
  const area = parsed.area_inference;
  if (!area) return false;
  return [
    area.vegetation_structure_candidates,
    area.succession_stage_candidates,
    area.human_influence_candidates,
    area.moisture_regime_candidates,
    area.management_hint_candidates,
  ].some((items) => Array.isArray(items) && items.length > 0);
}

function coexistingTaxaContainNonBiologicalSubject(parsed: GeminiJson): boolean {
  if (!Array.isArray(parsed.coexisting_taxa)) return false;
  return parsed.coexisting_taxa.some((candidate) => {
    const text = [
      candidate?.name,
      candidate?.scientific_name,
      candidate?.rank,
      candidate?.note,
    ].filter(Boolean).join(" ");
    return NON_BIOLOGICAL_SUBJECT_PATTERN.test(text);
  });
}

function visualExtractEscalationReasons(parsed: GeminiJson): string[] {
  const reasons: string[] = [];
  const primaryName = String(parsed.recommended_taxon_name ?? "").trim();
  const primaryScientificName = String(parsed.recommended_scientific_name ?? "").trim();
  if (!primaryName && !primaryScientificName) reasons.push("missing_primary_taxon");
  if (coexistingTaxaContainNonBiologicalSubject(parsed)) reasons.push("non_biological_in_coexisting_taxa");
  if (!hasAreaInferenceSignal(parsed)) reasons.push("environment_context_sparse");
  return reasons;
}

function parseGeminiJson(rawText: string): GeminiJson {
  let parsed: GeminiJson = {};
  try {
    const matched = rawText.match(/\{[\s\S]*\}/);
    if (matched) parsed = JSON.parse(matched[0]);
  } catch {
    parsed = {};
  }
  return parsed;
}

function parseSubjectRescueCandidates(rawText: string): GeminiCoexistingTaxon[] {
  const parsed = parseGeminiJson(rawText || "{}");
  return Array.isArray(parsed.coexisting_taxa)
    ? parsed.coexisting_taxa.filter((value) => {
        if (!value) return false;
        const name = normalizeCandidateName(value.name);
        const scientificName = normalizeCandidateName(value.scientific_name);
        if (!scientificName && isUnhelpfulGenericCandidateName(name)) return false;
        return Boolean(name || scientificName);
      })
    : [];
}

function buildVisualSubjectRescuePrompt(primary: { vernacularName: string; scientificName: string }): string {
  return `あなたは生物観察写真の副対象抽出だけを行います。通常の同定レポート、主対象の再同定、説明文は返さないでください。

主対象として既に扱うもの:
- 和名/表示名: ${primary.vernacularName || "不明"}
- 学名: ${primary.scientificName || "不明"}

タスク:
写真内で主対象とは別に写る生物だけを拾ってください。植物、つる、低木、草本、昆虫、菌類、明確な生活形を最大6件。足元の草、低い草丈、植栽、花、樹木など実体のある植生は背景扱いで捨てないでください。

精度ルール:
種・属・科名は、葉形、花、果実、翅、体形などの根拠が写真で十分に見える場合だけ使う。三出複葉や細長い葉など形だけで科が断定できない場合は rank を lifeform、scientific_name を空文字にし、name は「三出複葉の草本」「細長い葉の草本」のように見える形で書く。背景植生や一部だけ見える対象の confidence は原則 0.3-0.7 に抑える。

除外:
主対象の別名・代替候補、裸地、礫、舗装、石碑、看板、建物、影、ピンボケだけの形は coexisting_taxa に入れない。

出力はJSONのみ。このトップレベルキー以外を返さないでください:
{
  "coexisting_taxa": [
    {
      "name": "細長い葉の草本",
      "scientific_name": "",
      "rank": "lifeform",
      "confidence": 0.5,
      "note": "主対象の周囲に細長い葉の草本が写る",
      "media_regions": [
        {"asset_index": 0, "rect": {"x": 0.1, "y": 0.1, "width": 0.3, "height": 0.3}, "confidence": 0.5, "note": "おおよその位置"}
      ]
    }
  ]
}`;
}

async function runVisualExtractGemini(
  parts: AiRouterPart[],
  meta: GeminiCostMeta,
  options: {
    liteFirst: boolean;
    escalationReasons?: string[];
  },
): Promise<AiRouterGenerateResult> {
  return generateAiTextWithRoleChain({
    chainName: options.liteFirst ? "observationVisualSummary" : "observationVisualExtract",
    parts,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: "minimal" },
    temperature: 0.1,
    maxOutputTokens: options.liteFirst ? 2048 : 4096,
    retriesPerModel: 3,
    retryDelayMs: 1200,
    cost: {
      layer: "hot",
      endpoint: "observation_visual_extract",
      userId: meta.userId ?? null,
      visitId: meta.visitId ?? null,
      occurrenceId: meta.occurrenceId ?? null,
      metadata: {
        sourceTag: meta.sourceTag ?? "photo",
        visualLiteFirst: options.liteFirst,
        visualLiteFirstEscalationReasons: options.escalationReasons ?? [],
      },
    },
  });
}

async function runVisualExtractWithOptionalLiteFirst(
  parts: AiRouterPart[],
  meta: GeminiCostMeta,
): Promise<AiRouterGenerateResult> {
  if (!isObservationVisualLiteFirstEnabled()) {
    return runVisualExtractGemini(parts, meta, { liteFirst: false });
  }

  const lite = await runVisualExtractGemini(parts, meta, { liteFirst: true });
  const reasons = visualExtractEscalationReasons(parseGeminiJson(lite.text || "{}"));
  const alreadyEscalatedByChain = lite.model.includes("3.5");
  if (reasons.length === 0 || alreadyEscalatedByChain) {
    return lite;
  }

  return runVisualExtractGemini(parts, meta, {
    liteFirst: false,
    escalationReasons: reasons,
  });
}

async function runSingleGeminiReassess(
  prompt: string,
  photos: ReassessImageInput[],
  audioInputs: ReassessAudioInput[] = [],
  meta: GeminiCostMeta = {},
): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  const parts: AiRouterPart[] = buildVisualInputParts(photos);
  for (const audio of audioInputs) {
    parts.push({ inlineData: { mimeType: audio.mime, data: audio.b64 } });
  }
  parts.push({ text: prompt });

  const response = await generateAiTextWithRoleChain({
    chainName: "observationReassess",
    parts,
    retriesPerModel: 1,
    cost: {
      layer: "hot",
      endpoint: "observation_reassess",
      userId: meta.userId ?? null,
      visitId: meta.visitId ?? null,
      occurrenceId: meta.occurrenceId ?? null,
    },
  });
  const rawText = response.text || "{}";
  return { parsed: parseGeminiJson(rawText), modelUsed: response.model, rawText };
}

async function runVisualTwoStageGemini(
  prompt: string,
  photos: ReassessImageInput[],
  audioInputs: ReassessAudioInput[] = [],
  meta: GeminiCostMeta = {},
): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  const parts: AiRouterPart[] = buildVisualInputParts(photos);
  for (const audio of audioInputs) {
    parts.push({ inlineData: { mimeType: audio.mime, data: audio.b64 } });
  }
  parts.push({
    text: `${prompt}

ここでは保存文の完成ではなく、画像・動画フレーム・音声から読み取れる「分類インベントリ」と「根拠」だけをJSONで返してください。
- primary は主対象として最も妥当な分類を1つ。断定しない場合も recommended_taxon_name / recommended_rank は最も有用な上位分類まで出す。
- recommended_media_regions は主対象が見える矩形。各矩形は asset_index と rect(x,y,width,height 0-1) を必ず含める。動画フレームなら frame_time_ms も使う。
- taxonomic_candidates / rank_decision_reason / diagnostic_features_observed / diagnostic_features_missing / confusable_groups / visual_contradictions を必ず使い、種確定に必要な形質が欠ける場合は species ではなく genus/family/order で止める。
- 白黒模様で黄色い腹部を持つ蛾は、キハラゴマダラヒトリ等のヒトリガ類だけでなく、Abraxas などシャクガ科も比較する。
- candidate_readings は同じ主対象の代替同定候補。副対象をここに混ぜない。
- coexisting_taxa は主対象とは別に写る対象だけ。各対象に media_regions をできるだけ付ける。
- 裸地・礫・舗装・石碑・看板・建物など非生物は coexisting_taxa に入れず、area_inference / management_action_candidates / note に分離する。
- area_inference は写真から読める植生構造・人為影響・水分環境・管理痕跡を短く残す。読み取れないキーは空配列でよいが、環境文脈を捨てない。
- area_inference は必ず次の5キーを持つJSONオブジェクトで返す: vegetation_structure_candidates / succession_stage_candidates / human_influence_candidates / moisture_regime_candidates / management_hint_candidates。各候補は label / confidence / why を持つ。
- audio_events / heard_taxa は音声だけで得た証拠。画像に写る副対象 coexisting_taxa に混ぜない。
- 音声入力がある場合は、何が聞こえたかを audio_events / heard_taxa に必ず入れる。聞き取れない場合も空配列を返す。鳥声・人声・環境音を区別し、人声や個人情報が疑われる場合は audio_privacy_risk を true にする。
- observer_boost は、この記録ですでに良いところを1文で返す。励まし過剰にせず、写っている証拠・周囲文脈・比較しやすさのどれが良いかを具体的に書く。next_step_text は最小限でよい。
- 各説明は短くする。diagnostic_features_seen / missing_evidence は各5件まで、candidate_readings / coexisting_taxa は各6件まで。
- トップレベルキー名は既存スキーマに合わせ、recommended_taxon_name / recommended_scientific_name / recommended_rank / confidence_band / recommended_media_regions を必ず使う。別名の primary や taxon は使わない。
JSONのみ出力。`,
  });
  const extract = await runVisualExtractWithOptionalLiteFirst(parts, meta);
  const audioExtract = audioInputs.length > 0
    ? await runAudioEvidenceGemini(audioInputs, meta).catch(() => null)
    : null;
  const summaryPrompt = `${prompt}

以下は3.5 Flashが抽出した分類・視覚・音声証拠JSONです。この情報だけを使って、最終的な観察ページ保存用JSONを同じスキーマで作ってください。
AI単独で確定同定せず、根拠・保留点・次に撮るべき写真を明確に分けてください。
上流AIが species と言っていても、taxonomic_candidates が拮抗している、diagnostic_features_missing がある、visual_contradictions がある、または confusable_groups が残る場合は recommended_rank を genus/family/order に下げてください。
上流AIの taxonomic_candidates / rank_decision_reason / diagnostic_features_observed / diagnostic_features_missing / confusable_groups / visual_contradictions は省略せず、最終JSONにも残してください。
主対象の recommended_media_regions と、副対象の media_regions は可能な限りそのまま維持してください。
同じ主対象の代替候補は candidate_readings、別個体や背景植生は coexisting_taxa、音声だけで聞こえた対象は heard_taxa / audio_events に分離してください。
分類名は証拠JSONにないものを新しく増やさないでください。地域文脈は補助に留め、画像・音声証拠を優先してください。
裸地・礫・舗装・石碑・看板・建物など非生物は coexisting_taxa に入れず、area_inference / management_action_candidates / narrative の環境文脈へ分離してください。
証拠JSONの area_inference / management_action_candidates に環境・場・人為管理の情報がある場合、最終JSONにも短く保持してください。
トップレベルキー recommended_taxon_name / recommended_scientific_name / recommended_rank / confidence_band / recommended_media_regions は必ず含めてください。
recommended_media_regions と coexisting_taxa[].media_regions は、証拠JSONにある asset_index / frame_time_ms / rect を維持してください。
証拠JSONに audio_events / heard_taxa がある場合、最終JSONにも必ず残してください。音声入力がある場合、missing_evidence に「音声データ不足」と書かないでください。
保存用JSONは短くしてください。narrative は日本語160字以内、simple_summary は80字以内、diagnostic_features_seen / missing_evidence / distinguishing_tips / confirm_more は各5件以内、candidate_readings / coexisting_taxa は各6件以内。根拠領域以外の長文説明は増やさないでください。
observer_boost は日本語70字以内で必ず1文。すでに残せている観察上の良さだけを書く。未不足・否定・説教・「素晴らしい」などの大げさな賞賛は禁止。

証拠JSON:
${extract.text.slice(0, 18000)}
${audioExtract?.rawText ? `\n\n音声専用証拠JSON:\n${audioExtract.rawText.slice(0, 6000)}` : ""}

JSONのみ出力。`;
  const summary = await generateAiTextWithRoleChain({
    chainName: "observationVisualSummary",
    text: summaryPrompt,
    responseMimeType: "application/json",
    temperature: 0.15,
    maxOutputTokens: 4096,
    retriesPerModel: 3,
    retryDelayMs: 1200,
    cost: {
      layer: "hot",
      endpoint: "observation_visual_summary",
      userId: meta.userId ?? null,
      visitId: meta.visitId ?? null,
      occurrenceId: meta.occurrenceId ?? null,
      metadata: {
        sourceTag: meta.sourceTag ?? "photo",
        visualExtractModel: `${extract.provider}:${extract.model}`,
        audioExtractModel: audioExtract ? audioExtract.modelUsed : null,
      },
    },
  });
  const rawText = summary.text || "{}";
  return {
    parsed: parseGeminiJson(rawText),
    modelUsed: `${extract.model}+${summary.model}`,
    rawText: JSON.stringify({
      visual_extract: extract.text.slice(0, 12000),
      audio_extract: audioExtract?.rawText.slice(0, 6000) ?? null,
      visual_summary: rawText.slice(0, 12000),
    }),
  };
}

async function runAudioEvidenceGemini(
  audioInputs: ReassessAudioInput[],
  meta: GeminiCostMeta = {},
): Promise<{ modelUsed: string; rawText: string }> {
  const parts: AiRouterPart[] = audioInputs.map((audio) => ({
    inlineData: { mimeType: audio.mime, data: audio.b64 },
  }));
  parts.push({
    text: `音声だけから、将来の再解析に残す証拠を短いJSONで返してください。
- 鳥声・虫の声・カエル声・哺乳類・人声・機械音・水音・風などを分ける。
- taxon_name / scientific_name は確信がある場合だけ。上位分類や「鳥類の鳴き声」でもよい。
- audio_events は聞こえたイベントを時系列で最大6件。
- heard_taxa は分類群候補を最大5件。音だけなので confidence は控えめに。
- 人の声や個人情報が疑われる場合は audio_privacy_risk を true。
JSONのみ:
{
  "audio_events": [{"label": "鳥のさえずり", "taxon_name": "", "scientific_name": "", "confidence": 0.5, "time_range_sec": [0, 3], "evidence_note": "短い説明"}],
  "heard_taxa": [{"name": "鳥類", "scientific_name": "Aves", "rank": "class", "confidence": 0.5, "evidence_note": "短い説明"}],
  "audio_privacy_risk": false
}`,
  });
  const response = await generateAiTextWithRoleChain({
    chainName: "observationVisualExtract",
    parts,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingLevel: "minimal" },
    temperature: 0.1,
    maxOutputTokens: 2048,
    retriesPerModel: 3,
    retryDelayMs: 1200,
    cost: {
      layer: "hot",
      endpoint: "observation_audio_extract",
      userId: meta.userId ?? null,
      visitId: meta.visitId ?? null,
      occurrenceId: meta.occurrenceId ?? null,
      metadata: { sourceTag: meta.sourceTag ?? "audio" },
    },
  });
  return { modelUsed: response.model, rawText: response.text || "{}" };
}

async function runVisualSubjectRescue(
  _prompt: string,
  photos: ReassessImageInput[],
  primary: { vernacularName: string; scientificName: string },
  meta: GeminiCostMeta = {},
): Promise<{ candidates: GeminiCoexistingTaxon[]; modelUsed: string }> {
  if (photos.length === 0) return { candidates: [], modelUsed: "" };
  const parts: AiRouterPart[] = buildVisualInputParts(photos);
  parts.push({ text: buildVisualSubjectRescuePrompt(primary) });
  const runRescue = (options: { liteFirst: boolean; escalationReasons?: string[] }): Promise<AiRouterGenerateResult | null> =>
    generateAiTextWithRoleChain({
      chainName: options.liteFirst ? "observationVisualSummary" : "observationVisualExtract",
      parts,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "minimal" },
      temperature: 0.1,
      maxOutputTokens: options.liteFirst ? 1536 : 2048,
      retriesPerModel: options.liteFirst ? 2 : 1,
      cost: {
        layer: "hot",
        endpoint: "observation_subject_rescue",
        userId: meta.userId ?? null,
        visitId: meta.visitId ?? null,
        occurrenceId: meta.occurrenceId ?? null,
        metadata: {
          sourceTag: meta.sourceTag ?? "photo",
          subjectRescueLiteFirst: options.liteFirst,
          subjectRescueEscalationReasons: options.escalationReasons ?? [],
        },
      },
    }).catch(() => null);

  if (isObservationVisualLiteFirstEnabled()) {
    const lite = await runRescue({ liteFirst: true });
    if (!lite) return { candidates: [], modelUsed: "" };
    const candidates = parseSubjectRescueCandidates(lite.text || "{}");
    if (candidates.length > 0 || lite.model.includes("3.5")) {
      return { candidates, modelUsed: lite.model };
    }

    const rescue = await runRescue({
      liteFirst: false,
      escalationReasons: ["no_coexisting_taxa_from_lite"],
    });
    if (!rescue) return { candidates, modelUsed: lite.model };
    return {
      candidates: parseSubjectRescueCandidates(rescue.text || "{}"),
      modelUsed: rescue.model,
    };
  }

  const response = await runRescue({ liteFirst: false });
  if (!response) return { candidates: [], modelUsed: "" };
  return { candidates: parseSubjectRescueCandidates(response.text || "{}"), modelUsed: response.model };
}

async function runGemini(
  prompt: string,
  photos: ReassessImageInput[],
  audioInputs: ReassessAudioInput[] = [],
  meta: GeminiCostMeta = {},
): Promise<{ parsed: GeminiJson; modelUsed: string; rawText: string }> {
  // Hot-layer budget gate: throws AiBudgetExceededError when monthly cap reached.
  await assertAiBudgetAllowed("hot");
  if (photos.length > 0 || audioInputs.length > 0) {
    return runVisualTwoStageGemini(prompt, photos, audioInputs, meta);
  }
  return runSingleGeminiReassess(prompt, photos, audioInputs, meta);
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
    const photoAssetRefs = await loadPhotoAssetRefs(client, target.visitId);
    const audioInputs: LoadedAudioInput[] = Array.isArray(options.audioInputs)
      ? options.audioInputs
          .filter((audio) =>
            typeof audio?.mime === "string" &&
            (audio.mime.trim().startsWith("audio/") || audio.mime.trim().startsWith("video/")) &&
            typeof audio.b64 === "string" &&
            audio.b64.trim().length > 0,
          )
          .map((audio) => ({
            ...audio,
            assetId: audio.assetId ?? null,
            source: audio.source ?? null,
            durationSec: typeof audio.durationSec === "number" && Number.isFinite(audio.durationSec)
              ? audio.durationSec
              : null,
          }))
      : [];
    if (photos.length === 0 && audioInputs.length === 0) {
      throw new Error("no_media_for_reassess");
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
    const cachePromptVersion = options.promptVersion?.trim() || "observation_reassess.md/v5.7";
    const sourceTag = options.sourceTag?.trim() || "photo";
    const cacheUserId = options.triggeredBy ?? null;
    const cacheAssetIds = photos
      .map((p) => p.assetId ?? null)
      .concat(audioInputs.map((audio) => audio.assetId ?? null))
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
      audioInputs.length === 0 &&
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
    }) + formatInputMediaSummaryForPrompt(sourceTag, photos) + formatAudioEvidenceSummaryForPrompt(audioInputs);

    const { parsed, modelUsed, rawText } = await runGemini(prompt, photos, audioInputs, {
      userId: options.triggeredBy ?? null,
      visitId: target.visitId,
      occurrenceId: target.primaryOccurrenceId,
      sourceTag,
    });
    const promptVersion = options.promptVersion?.trim() || "observation_reassess.md/v5.7";

    const band = normalizeBand(parsed.confidence_band);
    let rank = normalizeRank(parsed.recommended_rank);
    let recommendedName = String(parsed.recommended_taxon_name ?? "").trim();
    let recommendedScientificName = String(parsed.recommended_scientific_name ?? "").trim();
    const primaryLocalName = recommendedScientificName ? null : lookupLocalTaxonName(recommendedName || target.vernacularName || "");
    if (primaryLocalName) {
      recommendedName = recommendedName || primaryLocalName.vernacularName;
      recommendedScientificName = primaryLocalName.scientificName;
      if (rank === "unknown" || rank === "lifeform") {
        rank = primaryLocalName.rank;
      }
      parsed.recommended_taxon_name = recommendedName;
      parsed.recommended_scientific_name = recommendedScientificName;
      parsed.recommended_rank = rank;
    }
    const primaryGate = normalizeBiologicalSubjectCandidate({
      vernacularName: recommendedName,
      scientificName: recommendedScientificName,
    });
    if (primaryGate) {
      recommendedName = primaryGate.vernacularName || primaryGate.scientificName || "";
      recommendedScientificName = primaryGate.scientificName || "";
      parsed.recommended_taxon_name = recommendedName;
      parsed.recommended_scientific_name = recommendedScientificName || undefined;
    } else {
      recommendedName = "";
      recommendedScientificName = "";
      rank = "unknown";
      parsed.recommended_taxon_name = undefined;
      parsed.recommended_scientific_name = undefined;
      parsed.recommended_rank = "unknown";
    }
    const rankGuard = applyTaxonomicRankGuardrail({
      recommendedName,
      recommendedScientificName,
      rank,
      confidenceBand: band,
      parsed,
    });
    if (rankGuard.downgraded) {
      recommendedName = rankGuard.recommendedName;
      recommendedScientificName = rankGuard.recommendedScientificName;
      rank = rankGuard.rank;
      parsed.recommended_taxon_name = recommendedName;
      parsed.recommended_scientific_name = recommendedScientificName;
      parsed.recommended_rank = rank;
      parsed.rank_decision_reason = [
        String(parsed.rank_decision_reason ?? "").trim(),
        `保存前ガード: ${rankGuard.reason}`,
      ].filter(Boolean).join(" / ");
    }
    const bestSpecificGate = normalizeBiologicalSubjectCandidate({
      vernacularName: String(parsed.best_specific_taxon_name ?? "").trim(),
      scientificName: null,
    });
    const bestSpecific = bestSpecificGate?.vernacularName ?? bestSpecificGate?.scientificName ?? "";
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
    if (Array.isArray(parsed.candidate_readings)) {
      parsed.candidate_readings = parsed.candidate_readings.map(enrichCandidateReadingName);
    }
    const candidateReadings = Array.isArray(parsed.candidate_readings) ? parsed.candidate_readings : [];
    const glossaryCandidateTextBlocks = [
      narrative,
      simple,
      String(parsed.observer_boost ?? "").trim(),
      String(parsed.next_step_text ?? "").trim(),
      String(parsed.stop_reason ?? "").trim(),
      String(parsed.fun_fact ?? "").trim(),
      String(parsed.geographic_context ?? "").trim(),
      String(parsed.seasonal_context ?? "").trim(),
      ...diagFeatures,
      ...missing,
      ...distinguishing,
      ...confirmMore,
      ...AREA_INFERENCE_KEYS.flatMap((key) => (areaInference[key] ?? []).flatMap((candidate) => [candidate.label, candidate.why])),
      ...managementActionCandidates.flatMap((candidate) => [candidate.label, candidate.why]),
      ...shotSuggestions.flatMap((suggestion) => [suggestion.target, suggestion.rationale]),
      ...candidateReadings.flatMap((reading) => [
        ...(Array.isArray(reading.visible_features) ? reading.visible_features : []),
        ...(Array.isArray(reading.weak_points) ? reading.weak_points : []),
        ...(Array.isArray(reading.shooting_tips) ? reading.shooting_tips : []),
        String(reading.regional_read ?? "").trim(),
        String(reading.size_assessment?.ranking_hint ?? "").trim(),
        String(reading.size_assessment?.basis ?? "").trim(),
        String(reading.size_assessment?.hedge ?? "").trim(),
      ]),
    ].filter((value) => typeof value === "string" && value.trim().length > 0);
    const candidateReadingByKey = new Map<string, GeminiCandidateReading>();
    const registerCandidateReading = (reading: GeminiCandidateReading): void => {
      const rank = normalizeRank(reading.rank);
      const rankHint = rank === "unknown" ? null : rank;
      const keys = [
        buildCandidateKey(normalizeCandidateName(reading.name), normalizeCandidateName(reading.scientific_name), rankHint),
        normalizeCandidateName(reading.name).toLowerCase(),
        normalizeCandidateName(reading.scientific_name).toLowerCase(),
      ].filter(Boolean);
      for (const key of keys) {
        if (!candidateReadingByKey.has(key)) candidateReadingByKey.set(key, reading);
      }
    };
    candidateReadings.forEach(registerCandidateReading);
    const findCandidateReadingFor = (input: { vernacularName: string; scientificName: string; rankHint: string | null }): GeminiCandidateReading | null => {
      const keys = [
        buildCandidateKey(input.vernacularName, input.scientificName, input.rankHint),
        input.vernacularName.trim().toLowerCase(),
        input.scientificName.trim().toLowerCase(),
      ].filter(Boolean);
      for (const key of keys) {
        const reading = candidateReadingByKey.get(key);
        if (reading) return reading;
      }
      return null;
    };
    const rawCoexisting = Array.isArray(parsed.coexisting_taxa)
      ? parsed.coexisting_taxa.filter((value) => {
          if (!value) return false;
          const name = typeof value.name === "string" ? value.name.trim() : "";
          const scientificName = typeof value.scientific_name === "string" ? value.scientific_name.trim() : "";
          return name.length > 0 || scientificName.length > 0;
        }).map(enrichCoexistingTaxonName)
      : [];
    const primaryNamesForGuard = {
      vernacularName: recommendedName || target.vernacularName || "",
      scientificName: recommendedScientificName || target.scientificName || "",
    };
    const readingCandidates = Array.isArray(parsed.candidate_readings)
      ? parsed.candidate_readings
          .map(candidateReadingToCoexistingTaxon)
          .filter((value): value is GeminiCoexistingTaxon => Boolean(value))
      : [];
    const readingMerge = mergeCoexistingCandidates(rawCoexisting, readingCandidates, primaryNamesForGuard);
    let coexisting = readingMerge.candidates;
    const multiSubjectGuard: MultiSubjectGuardResult = {
      promotedFromCandidateReadings: readingMerge.added,
      rescueTriggered: false,
      rescueCandidateCount: 0,
      rescueModelUsed: null,
    };
    if (coexisting.length === 0 && photos.length > 0) {
      const rescue = await runVisualSubjectRescue(prompt, photos, primaryNamesForGuard, {
        userId: options.triggeredBy ?? null,
        visitId: target.visitId,
        occurrenceId: target.primaryOccurrenceId,
        sourceTag,
      });
      const rescuedMerge = mergeCoexistingCandidates(coexisting, rescue.candidates, primaryNamesForGuard);
      coexisting = rescuedMerge.candidates;
      multiSubjectGuard.rescueTriggered = true;
      multiSubjectGuard.rescueCandidateCount = rescuedMerge.added;
      multiSubjectGuard.rescueModelUsed = rescue.modelUsed || null;
    }
    coexisting = coexisting.map(enrichCoexistingTaxonName);
    parsed.coexisting_taxa = coexisting;

    const primaryRankHint = rank === "unknown" ? null : rank;
    const primaryMatchName = recommendedScientificName || recommendedName;
    const primaryCandidateReading = findCandidateReadingFor({
      vernacularName: recommendedName,
      scientificName: recommendedScientificName,
      rankHint: primaryRankHint,
    });
    let preparedCandidates = coexisting.map((candidate) => {
      const vernacularName = String(candidate.name ?? "").trim();
      const scientificName = String(candidate.scientific_name ?? "").trim();
      const scientificNameSource: "model" | "gbif_backbone" | null = scientificName ? "model" : null;
      const normalizedRank = normalizeRank(candidate.rank);
      const confidence =
        typeof candidate.confidence === "number" && Number.isFinite(candidate.confidence)
          ? Math.min(1, Math.max(0, candidate.confidence))
          : 0.5;
      return {
        vernacularName,
        scientificName,
        scientificNameSource: scientificNameSource as "model" | "gbif_backbone" | null,
        matchName: scientificName || vernacularName,
        rankHint: normalizedRank === "unknown" ? null : normalizedRank,
        rank: normalizedRank,
        confidence,
        note: typeof candidate.note === "string" ? candidate.note.trim() : null,
        regions: Array.isArray(candidate.media_regions)
          ? candidate.media_regions.map((region) => normalizeRectCandidate(region, photos.length)).filter((region): region is NormalizedRegion => Boolean(region))
          : [],
        candidateReading: findCandidateReadingFor({
          vernacularName,
          scientificName,
          rankHint: normalizedRank === "unknown" ? null : normalizedRank,
        }),
      };
    });

    const [primaryGbifMatch, coexistingGbifMatches] = await Promise.all([
      matchTaxon({ name: primaryMatchName, rank: primaryRankHint }),
      matchTaxonBatch(preparedCandidates.map((candidate) => ({ name: candidate.matchName, rank: candidate.rankHint }))),
    ]);
    preparedCandidates = preparedCandidates.map((candidate, index) => {
      const gbif = coexistingGbifMatches[index];
      const canonicalName = canonicalScientificNameFromGbif(candidate, gbif);
      if (!canonicalName) return candidate;
      const gbifRank = normalizeRank(gbif?.rank ?? undefined);
      return {
        ...candidate,
        scientificName: canonicalName,
        scientificNameSource: "gbif_backbone" as const,
        matchName: canonicalName,
        rank: candidate.rank === "unknown" && gbifRank !== "unknown" ? gbifRank : candidate.rank,
        rankHint: candidate.rankHint ?? (gbifRank === "unknown" ? null : gbifRank),
      };
    });
    const gbifMatchedPrimary = primaryGbifMatch.usageKey !== null;
    const gbifMatchedCoexistingCount = coexistingGbifMatches.reduce((count, match) => (match.usageKey !== null ? count + 1 : count), 0);
    const primaryRegions = Array.isArray(parsed.recommended_media_regions)
      ? parsed.recommended_media_regions.map((region) => normalizeRectCandidate(region, photos.length)).filter((region): region is NormalizedRegion => Boolean(region))
      : [];
    const photoAssetIdAt = (index: number): string | null => photos[index]?.assetId ?? photoAssetRefs[index]?.assetId ?? null;

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
      inputAssetFingerprint: buildAssetFingerprint(sourceTag, photos, audioInputs),
      triggerKind: triggerKindForSourceTag(sourceTag),
      triggeredBy: options.triggeredBy ?? null,
      supersedesRunId: previousRun?.aiRunId ?? null,
      runStatus: "succeeded",
      sourcePayload: {
        sourceTag,
        selectedOccurrenceId: target.selectedOccurrenceId,
        photoCount: photos.length,
        audioCount: audioInputs.length,
        visualEvidence: photos
          .filter((photo) => photo.frameTimeMs != null || photo.selectionScore != null || photo.selectionReason)
          .map((photo, index) => ({
            assetIndex: index,
            assetId: photo.assetId ?? null,
            frameTimeMs: photo.frameTimeMs ?? null,
            selectionScore: photo.selectionScore ?? null,
            selectionReason: photo.selectionReason ?? null,
            differenceScore: photo.differenceScore ?? null,
            qualityScore: photo.qualityScore ?? null,
          })),
        audioEvidence: audioInputs.map((audio, index) => ({
          audioIndex: index,
          assetId: audio.assetId ?? null,
          mime: audio.mime,
          source: audio.source ?? null,
          durationSec: audio.durationSec ?? null,
          byteLengthApprox: Math.round((audio.b64.length * 3) / 4),
        })),
        photoAssetRefCount: photoAssetRefs.length,
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
        multiSubjectGuard: {
          promotedFromCandidateReadings: multiSubjectGuard.promotedFromCandidateReadings,
          rescueTriggered: multiSubjectGuard.rescueTriggered,
          rescueCandidateCount: multiSubjectGuard.rescueCandidateCount,
          rescueModelUsed: multiSubjectGuard.rescueModelUsed,
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
            taxonomic_rank_guard: {
              downgraded: rankGuard.downgraded,
              reason: rankGuard.reason,
              final_rank: rank === "unknown" ? null : rank,
              final_name: recommendedName || null,
              final_scientific_name: recommendedScientificName || null,
            },
            multi_subject_guard: {
              promoted_from_candidate_readings: multiSubjectGuard.promotedFromCandidateReadings,
              rescue_triggered: multiSubjectGuard.rescueTriggered,
              rescue_candidate_count: multiSubjectGuard.rescueCandidateCount,
              rescue_model_used: multiSubjectGuard.rescueModelUsed,
            },
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
    await markPrimaryOccurrenceAsAiJudgement(client, {
      occurrenceId: target.primaryOccurrenceId,
      aiRunId: aiRun.aiRunId,
      confidence: confidenceFromBand(band),
      sourceTag,
    });

    for (let index = 0; index < photos.length; index += 1) {
      const photo = photos[index];
      if (!photo) continue;
      const assetId = photoAssetIdAt(index);
      await client.query(
        `INSERT INTO visual_evidence_extracts (
           ai_run_id, assessment_id, visit_id, occurrence_id, asset_id, asset_index,
           media_kind, frame_time_ms, selection_score, selection_reason, difference_score,
           quality_score, source_tag, source_model, extract_payload
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5::uuid, $6,
           $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
         )`,
        [
          aiRun.aiRunId,
          assessmentId,
          target.visitId,
          target.primaryOccurrenceId,
          assetId,
          index,
          photo.frameTimeMs != null || sourceTag.startsWith("video") ? "video_frame" : "image",
          photo.frameTimeMs ?? null,
          photo.selectionScore ?? null,
          photo.selectionReason ?? null,
          photo.differenceScore ?? null,
          photo.qualityScore ?? null,
          sourceTag,
          modelUsed,
          JSON.stringify({
            promptVersion,
            assetFingerprintSource: sourceTag,
          }),
        ],
      );
    }

    await client.query(
      `INSERT INTO visual_subject_candidates (
         ai_run_id, assessment_id, visit_id, occurrence_id, subject_role,
         display_name, scientific_name, taxon_rank, confidence_score, evidence_note, source_payload
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, 'primary',
         $5, $6, $7, $8, $9, $10::jsonb
       )`,
      [
        aiRun.aiRunId,
        assessmentId,
        target.visitId,
        target.primaryOccurrenceId,
        recommendedName || target.vernacularName || target.scientificName || null,
        recommendedScientificName || target.scientificName || null,
        rank === "unknown" ? null : rank,
        band === "high" ? 0.85 : band === "medium" ? 0.6 : 0.35,
        narrative || simple || null,
        JSON.stringify({
          sourceTag,
          candidateReading: primaryCandidateReading ?? null,
          gbifMatched: gbifMatchedPrimary,
          taxonomicRankGuard: {
            downgraded: rankGuard.downgraded,
            reason: rankGuard.reason,
          },
        }),
      ],
    );

    for (const key of AREA_INFERENCE_KEYS) {
      for (const candidate of areaInference[key]) {
        await client.query(
          `INSERT INTO visual_observation_signals (
             ai_run_id, assessment_id, visit_id, signal_kind, label, evidence_text, confidence_score, source_payload
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)`,
          [
            aiRun.aiRunId,
            assessmentId,
            target.visitId,
            key,
            candidate.label,
            candidate.why,
            candidate.confidence,
            JSON.stringify({ sourceTag }),
          ],
        );
      }
    }

    for (const suggestion of shotSuggestions) {
      await client.query(
        `INSERT INTO visual_next_capture_suggestions (
           ai_run_id, assessment_id, visit_id, role, target, rationale, priority, source_payload
         ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          aiRun.aiRunId,
          assessmentId,
          target.visitId,
          suggestion.role,
          suggestion.target,
          suggestion.rationale,
          suggestion.priority,
          JSON.stringify({ sourceTag }),
        ],
      );
    }

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
    let materializedCandidateRecordCount = 0;
    let matchedCandidateRecordCount = 0;
    let candidateOnlyCount = 0;
    for (let index = 0; index < preparedCandidates.length; index += 1) {
      const candidate = preparedCandidates[index];
      if (!candidate) continue;
      const gbif = coexistingGbifMatches[index];
      const candidateKey = buildCandidateKey(candidate.vernacularName, candidate.scientificName, candidate.rankHint);
      const matchedSubject = candidateKey ? subjectByKey.get(candidateKey) ?? null : null;
      const candidateId = randomUUID();
      const stableCandidateKey = candidateKey || `${candidate.vernacularName}:${index}`;
      const aiJudgementRecord = await materializeAiJudgementObservationRecord(client, {
        visitId: target.visitId,
        visitLegacyObservationId: target.visitLegacyObservationId,
        aiRunId: aiRun.aiRunId,
        candidateId,
        candidateKey: stableCandidateKey,
        vernacularName: candidate.vernacularName,
        scientificName: candidate.scientificName,
        taxonRank: candidate.rankHint,
        confidence: candidate.confidence,
        note: candidate.note,
        sourceTag,
        gbif: {
          usageKey: gbif?.usageKey ?? null,
          matchType: gbif?.matchType ?? "NONE",
          confidence: gbif?.confidence ?? null,
        },
        matchedOccurrenceId: matchedSubject?.occurrenceId ?? null,
      });
      const candidateOccurrenceId = aiJudgementRecord.occurrenceId;
      if (candidateOccurrenceId) {
        if (aiJudgementRecord.materialized) {
          materializedCandidateRecordCount += 1;
        } else if (aiJudgementRecord.matchedExisting) {
          matchedCandidateRecordCount += 1;
        }
      } else {
        candidateOnlyCount += 1;
      }
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
          candidateOccurrenceId,
          stableCandidateKey,
          candidate.vernacularName || null,
          candidate.scientificName || null,
          candidate.rankHint,
          candidate.confidence,
          candidateOccurrenceId ? "matched" : "proposed",
          candidate.note,
          JSON.stringify({
            sourceTag,
            candidateReading: candidate.candidateReading ?? null,
            scientificNameSource: candidate.scientificNameSource,
            aiJudgement: {
              materialized: aiJudgementRecord.materialized,
              matchedExisting: aiJudgementRecord.matchedExisting,
            },
            gbif: {
              usageKey: gbif?.usageKey ?? null,
              matchType: gbif?.matchType ?? "NONE",
              confidence: gbif?.confidence ?? null,
            },
          }),
        ],
      );
      candidateCount += 1;
      await client.query(
        `INSERT INTO visual_subject_candidates (
           ai_run_id, assessment_id, visit_id, occurrence_id, candidate_id, subject_role,
           display_name, scientific_name, taxon_rank, confidence_score, evidence_note, source_payload
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5::uuid, 'coexisting',
           $6, $7, $8, $9, $10, $11::jsonb
         )`,
        [
          aiRun.aiRunId,
          assessmentId,
          target.visitId,
          candidateOccurrenceId,
          candidateId,
          candidate.vernacularName || candidate.scientificName || null,
          candidate.scientificName || null,
          candidate.rankHint,
          candidate.confidence,
          candidate.note,
          JSON.stringify({
            sourceTag,
            candidateReading: candidate.candidateReading ?? null,
            scientificNameSource: candidate.scientificNameSource,
            gbif: {
              usageKey: gbif?.usageKey ?? null,
              matchType: gbif?.matchType ?? "NONE",
            },
          }),
        ],
      );

      for (const region of candidate.regions) {
        const assetId = photoAssetIdAt(region.assetIndex);
        if (!assetId) continue;
        const photoFrameTimeMs = photos[region.assetIndex]?.frameTimeMs ?? null;
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
            candidateOccurrenceId,
            candidateId,
            assetId,
            JSON.stringify(region.rect),
            region.frameTimeMs ?? photoFrameTimeMs,
            region.confidence,
            modelUsed,
            JSON.stringify({
              note: region.note,
              sourceTag,
              assetIndex: region.assetIndex,
            }),
          ],
        );
        await client.query(
          `INSERT INTO visual_asset_regions (
             ai_run_id, assessment_id, visit_id, occurrence_id, candidate_id, asset_id,
             asset_index, frame_time_ms, normalized_rect, confidence_score, note, source_model, source_payload
           ) VALUES (
             $1::uuid, $2::uuid, $3, $4, $5::uuid, $6::uuid,
             $7, $8, $9::jsonb, $10, $11, $12, $13::jsonb
           )`,
          [
            aiRun.aiRunId,
            assessmentId,
            target.visitId,
            candidateOccurrenceId,
            candidateId,
            assetId,
            region.assetIndex,
            region.frameTimeMs ?? photoFrameTimeMs,
            JSON.stringify(region.rect),
            region.confidence,
            region.note,
            modelUsed,
            JSON.stringify({ sourceTag }),
          ],
        );
        regionCount += 1;
      }
    }

    for (const region of primaryRegions) {
      const assetId = photoAssetIdAt(region.assetIndex);
      if (!assetId) continue;
      const photoFrameTimeMs = photos[region.assetIndex]?.frameTimeMs ?? null;
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
          assetId,
          JSON.stringify(region.rect),
          region.frameTimeMs ?? photoFrameTimeMs,
          region.confidence,
          modelUsed,
          JSON.stringify({
            note: region.note,
            sourceTag,
            assetIndex: region.assetIndex,
          }),
        ],
      );
      await client.query(
        `INSERT INTO visual_asset_regions (
           ai_run_id, assessment_id, visit_id, occurrence_id, asset_id,
           asset_index, frame_time_ms, normalized_rect, confidence_score, note, source_model, source_payload
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5::uuid,
           $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb
         )`,
        [
          aiRun.aiRunId,
          assessmentId,
          target.visitId,
          target.primaryOccurrenceId,
          assetId,
          region.assetIndex,
          region.frameTimeMs ?? photoFrameTimeMs,
          JSON.stringify(region.rect),
          region.confidence,
          region.note,
          modelUsed,
          JSON.stringify({ sourceTag }),
        ],
      );
      regionCount += 1;
    }

    // Phase γ: evidence_assets.role_tag を region サイズから heuristic 推定。
    // 既に user/heuristic が付いているものは上書きしない (role_tag_source=ai のみ更新)。
    // area ≥ 0.55 → full_body / 0.05-0.55 → close_up_organ / region なし → habitat_wide
    const roleAreaByAsset = new Map<string, number>();
    for (const region of primaryRegions) {
      const assetId = photoAssetIdAt(region.assetIndex);
      if (!assetId || !region.rect) continue;
      const area = Math.max(0, Math.min(1, region.rect.width * region.rect.height));
      const prev = roleAreaByAsset.get(assetId) ?? 0;
      if (area > prev) roleAreaByAsset.set(assetId, area);
    }
    for (let index = 0; index < photos.length; index += 1) {
      const assetId = photoAssetIdAt(index);
      if (!assetId) continue;
      const maxArea = roleAreaByAsset.get(assetId) ?? 0;
      const roleTag = maxArea >= 0.55 ? "full_body"
        : maxArea > 0 && maxArea < 0.55 ? "close_up_organ"
          : "habitat_wide";
      await client.query(
        `UPDATE evidence_assets
           SET role_tag = $1, role_tag_source = 'ai'
         WHERE asset_id = $2::uuid
           AND (role_tag IS NULL OR role_tag_source = 'ai')`,
        [roleTag, assetId],
      );
    }

    await client.query(
      `UPDATE observation_ai_runs
          SET source_payload = source_payload || $2::jsonb
        WHERE ai_run_id = $1::uuid`,
      [
        aiRun.aiRunId,
        JSON.stringify({
          aiSubjectRecordMaterialization: {
            totalCandidateCount: candidateCount,
            materializedCandidateRecordCount,
            matchedCandidateRecordCount,
            candidateOnlyCount,
            occurrenceBackedCandidateCount: materializedCandidateRecordCount + matchedCandidateRecordCount,
            proposalUiFallbackRiskCount: candidateOnlyCount,
          },
          visualRegionMaterialization: {
            primaryRegionInputCount: primaryRegions.length,
            candidateRegionInputCount: preparedCandidates.reduce((count, candidate) => count + candidate.regions.length, 0),
            storedRegionCount: regionCount,
            photoCount: photos.length,
            photoAssetRefCount: photoAssetRefs.length,
          },
        }),
      ],
    );

    const storedDisplayState = await getStoredVisitDisplayState(client, target.visitId).catch(() => null);
    const latestSubjects = await getVisitSubjectSummaries(target.visitId, client);
    let resolvedDisplayState = storedDisplayState;
    if (!storedDisplayState || !storedDisplayState.lockedByHuman) {
      resolvedDisplayState = deriveVisitDisplayState(target.visitId, latestSubjects, aiRun.aiRunId);
      await upsertVisitDisplayState(client, resolvedDisplayState);
    }

    await client.query("commit");

    await logGlossaryTermCandidatesFromAiOutput({
      textBlocks: glossaryCandidateTextBlocks,
      lang: "ja",
      scopeTags: ["observation"],
      sourceKind: "observation_reassess",
      sourceId: assessmentId,
      visitId: target.visitId,
      occurrenceId: target.primaryOccurrenceId,
      aiRunId: aiRun.aiRunId,
      assessmentId,
    }).catch(() => ({ candidateCount: 0, labels: [] }));

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
      materializedCandidateRecordCount,
      matchedCandidateRecordCount,
      candidateOnlyCount,
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
