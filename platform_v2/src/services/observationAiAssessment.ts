import { getPool } from "../db.js";

export type AreaInferenceCandidate = {
  label: string;
  why: string;
  confidence: number | null;
};

export type AreaInference = {
  vegetationStructureCandidates: AreaInferenceCandidate[];
  successionStageCandidates: AreaInferenceCandidate[];
  humanInfluenceCandidates: AreaInferenceCandidate[];
  moistureRegimeCandidates: AreaInferenceCandidate[];
  managementHintCandidates: AreaInferenceCandidate[];
};

export type ShotSuggestion = {
  role: "full_body" | "close_up_organ" | "habitat_wide" | "substrate" | "scale_reference" | string;
  target: string;
  rationale: string;
  priority: "high" | "medium";
};

export type SizeClass = "tiny" | "small" | "typical" | "large" | "exceptional";

export type SizeAssessment = {
  typicalSizeCm: number | null;
  observedSizeEstimateCm: number | null;
  sizeClass: SizeClass | null;
  rankingHint: string;
  basis: string;
  hedge: string;
};

export type NoveltyHint = {
  isPotentiallyNovel: boolean;
  noveltyScore: number | null;
  reasoning: string;
  hedge: string;
};

export type MhlwInvasiveCategory = "iaspecified" | "priority" | "industrial" | "prevention" | "native";
export type InvasiveRecommendedAction =
  | "observe_only"
  | "observe_and_report"
  | "report_only"
  | "do_not_handle"
  | "controlled_removal";

export type InvasiveResponse = {
  isInvasive: boolean;
  mhlwCategory: MhlwInvasiveCategory | null;
  recommendedAction: InvasiveRecommendedAction | null;
  actionBasis: string;
  regionalCaveat: string;
  legalWarning: string;
  hedge: string;
};

export type AssessmentClaimRef = {
  claimId: string;
  claimType: string | null;
  scopeMatch: string | null;
};

export type AssessmentNavigableOs = {
  branch: string | null;
  observationPackageId: string | null;
  retrievedClaimIds: string[];
  claimRefsUsed: AssessmentClaimRef[];
};

export type AiAssessment = {
  assessmentId: string;
  confidenceBand: "high" | "medium" | "low" | "unknown";
  modelUsed: string;
  recommendedRank: string | null;
  recommendedTaxonName: string | null;
  bestSpecificTaxonName: string | null;
  narrative: string;
  simpleSummary: string;
  observerBoost: string;
  nextStepText: string;
  stopReason: string;
  funFact: string;
  funFactGrounded: boolean;
  diagnosticFeaturesSeen: string[];
  missingEvidence: string[];
  similarTaxa: Array<{ name: string; rank?: string }>;
  distinguishingTips: string[];
  confirmMore: string[];
  geographicContext: string;
  seasonalContext: string;
  areaInference: AreaInference;
  shotSuggestions: ShotSuggestion[];
  sizeAssessment: SizeAssessment | null;
  noveltyHint: NoveltyHint | null;
  invasiveResponse: InvasiveResponse | null;
  claimRefsUsed: AssessmentClaimRef[];
  navigableOs: AssessmentNavigableOs | null;
  generatedAt: string;
};

/**
 * 観察詳細ページの「絞り込みヒント」として使う最新 AI assessment を返す。
 * legacy から import された機械判定 / 将来の v2 ネイティブ生成、どちらも同じテーブルから引く。
 */
export async function getLatestAiAssessment(occurrenceId: string): Promise<AiAssessment | null> {
  const pool = getPool();
  const row = await pool.query<{
    assessment_id: string;
    confidence_band: string | null;
    model_used: string;
    recommended_rank: string | null;
    recommended_taxon_name: string | null;
    best_specific_taxon_name: string | null;
    narrative: string;
    simple_summary: string;
    observer_boost: string;
    next_step_text: string;
    stop_reason: string;
    fun_fact: string;
    fun_fact_grounded: boolean;
    diagnostic_features_seen: unknown;
    missing_evidence: unknown;
    similar_taxa: unknown;
    distinguishing_tips: unknown;
    confirm_more: unknown;
    geographic_context: string;
    seasonal_context: string;
    area_inference: unknown;
    shot_suggestions: unknown;
    raw_json: unknown;
    run_source_payload: unknown;
    generated_at: string;
  }>(
    `SELECT a.assessment_id::text, a.confidence_band, a.model_used, a.recommended_rank,
            a.recommended_taxon_name, a.best_specific_taxon_name,
            a.narrative, a.simple_summary, a.observer_boost, a.next_step_text, a.stop_reason,
            a.fun_fact, a.fun_fact_grounded,
            a.diagnostic_features_seen, a.missing_evidence, a.similar_taxa,
            a.distinguishing_tips, a.confirm_more,
            a.geographic_context, a.seasonal_context,
            a.area_inference, a.shot_suggestions,
            a.raw_json,
            run.source_payload AS run_source_payload,
            a.generated_at::text
       FROM observation_ai_assessments a
       LEFT JOIN observation_ai_runs run ON run.ai_run_id = a.ai_run_id
      WHERE a.occurrence_id = $1
      ORDER BY a.generated_at DESC
      LIMIT 1`,
    [occurrenceId],
  );
  const r = row.rows[0];
  if (!r) return null;

  const arr = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim().length > 0);
    return [];
  };
  const similarTaxaArr = Array.isArray(r.similar_taxa)
    ? (r.similar_taxa as Array<{ name?: string; rank?: string; scientific_name?: string }>)
        .map((t) => ({
          name: String(t.name || t.scientific_name || ""),
          rank: t.rank,
        }))
        .filter((t) => t.name)
    : [];

  const band = r.confidence_band === "high" || r.confidence_band === "medium" || r.confidence_band === "low"
    ? r.confidence_band
    : "unknown";

  const areaInference = normalizeAreaInferenceFromDb(r.area_inference);
  const shotSuggestions = normalizeShotSuggestionsFromDb(r.shot_suggestions);
  const parsedFromRaw = pickParsedFromRawJson(r.raw_json);
  const sizeAssessment = parsedFromRaw ? normalizeSizeAssessmentFromRaw(parsedFromRaw["size_assessment"]) : null;
  const noveltyHint = parsedFromRaw ? normalizeNoveltyHintFromRaw(parsedFromRaw["novelty_hint"]) : null;
  const invasiveResponse = parsedFromRaw ? normalizeInvasiveResponseFromRaw(parsedFromRaw["invasive_response"]) : null;
  const navigableOs = extractNavigableOsFromAssessmentPayload(r.raw_json, r.run_source_payload);

  return {
    assessmentId: r.assessment_id,
    confidenceBand: band,
    modelUsed: r.model_used,
    recommendedRank: r.recommended_rank,
    recommendedTaxonName: r.recommended_taxon_name,
    bestSpecificTaxonName: r.best_specific_taxon_name,
    narrative: r.narrative,
    simpleSummary: r.simple_summary,
    observerBoost: r.observer_boost,
    nextStepText: r.next_step_text,
    stopReason: r.stop_reason,
    funFact: r.fun_fact,
    funFactGrounded: r.fun_fact_grounded,
    diagnosticFeaturesSeen: arr(r.diagnostic_features_seen),
    missingEvidence: arr(r.missing_evidence),
    similarTaxa: similarTaxaArr,
    distinguishingTips: arr(r.distinguishing_tips),
    confirmMore: arr(r.confirm_more),
    geographicContext: r.geographic_context,
    seasonalContext: r.seasonal_context,
    areaInference,
    shotSuggestions,
    sizeAssessment,
    noveltyHint,
    invasiveResponse,
    claimRefsUsed: navigableOs?.claimRefsUsed ?? [],
    navigableOs,
    generatedAt: r.generated_at,
  };
}

const AREA_INFERENCE_DB_KEYS: Array<[keyof AreaInference, string]> = [
  ["vegetationStructureCandidates", "vegetation_structure_candidates"],
  ["successionStageCandidates", "succession_stage_candidates"],
  ["humanInfluenceCandidates", "human_influence_candidates"],
  ["moistureRegimeCandidates", "moisture_regime_candidates"],
  ["managementHintCandidates", "management_hint_candidates"],
];

function normalizeAreaInferenceFromDb(raw: unknown): AreaInference {
  const empty: AreaInference = {
    vegetationStructureCandidates: [],
    successionStageCandidates: [],
    humanInfluenceCandidates: [],
    moistureRegimeCandidates: [],
    managementHintCandidates: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  for (const [camelKey, snakeKey] of AREA_INFERENCE_DB_KEYS) {
    const arr = obj[snakeKey];
    if (!Array.isArray(arr)) continue;
    empty[camelKey] = arr
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const e = entry as { label?: unknown; why?: unknown; confidence?: unknown };
        const label = typeof e.label === "string" ? e.label.trim() : "";
        if (!label) return null;
        const why = typeof e.why === "string" ? e.why.trim() : "";
        const confidence = typeof e.confidence === "number" && Number.isFinite(e.confidence)
          ? Math.min(1, Math.max(0, e.confidence))
          : null;
        return { label, why, confidence } satisfies AreaInferenceCandidate;
      })
      .filter((value): value is AreaInferenceCandidate => value !== null);
  }
  return empty;
}

function normalizeShotSuggestionsFromDb(raw: unknown): ShotSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as { role?: unknown; target?: unknown; rationale?: unknown; priority?: unknown };
      const role = typeof e.role === "string" ? e.role.trim() : "";
      const target = typeof e.target === "string" ? e.target.trim() : "";
      if (!role || !target) return null;
      const rationale = typeof e.rationale === "string" ? e.rationale.trim() : "";
      const priority: ShotSuggestion["priority"] = e.priority === "high" ? "high" : "medium";
      return { role, target, rationale, priority } satisfies ShotSuggestion;
    })
    .filter((value): value is ShotSuggestion => value !== null);
}

const SIZE_CLASS_VALUES = new Set<SizeClass>(["tiny", "small", "typical", "large", "exceptional"]);
const MHLW_CATEGORY_VALUES = new Set<MhlwInvasiveCategory>([
  "iaspecified",
  "priority",
  "industrial",
  "prevention",
  "native",
]);
const INVASIVE_ACTION_VALUES = new Set<InvasiveRecommendedAction>([
  "observe_only",
  "observe_and_report",
  "report_only",
  "do_not_handle",
  "controlled_removal",
]);

/**
 * raw_json は現状 `{ raw, parsed }` 形式で保存されている（observationReassess.ts:733 参照）。
 * parsed が無い旧フォーマットや、JSON 直書き形式にもフォールバックする。
 */
export function pickParsedFromRawJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const parsed = obj["parsed"];
  if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  if ("size_assessment" in obj || "novelty_hint" in obj || "invasive_response" in obj) {
    return obj;
  }
  return null;
}

function objOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean))];
}

export function extractNavigableOsFromAssessmentPayload(
  rawJson: unknown,
  runSourcePayload: unknown,
): AssessmentNavigableOs | null {
  const raw = objOrNull(rawJson);
  const runPayload = objOrNull(runSourcePayload);
  const rawNav = objOrNull(raw?.["navigable_os"]);
  const runNav = objOrNull(runPayload?.["navigableOs"]);
  const parsed = pickParsedFromRawJson(rawJson);
  const claimIdsUsed = stringArray(parsed?.["claim_refs_used"]);
  const retrievedClaimIds = stringArray(rawNav?.["retrieved_claim_ids"]);
  const runClaimRefsRaw = Array.isArray(runNav?.["claimRefs"]) ? runNav?.["claimRefs"] as unknown[] : [];
  const runClaimRefById = new Map<string, AssessmentClaimRef>();
  for (const entry of runClaimRefsRaw) {
    const obj = objOrNull(entry);
    const claimId = typeof obj?.["claimId"] === "string" ? obj["claimId"].trim() : "";
    if (!claimId) continue;
    runClaimRefById.set(claimId, {
      claimId,
      claimType: typeof obj?.["claimType"] === "string" ? obj["claimType"] : null,
      scopeMatch: typeof obj?.["scopeMatch"] === "string" ? obj["scopeMatch"] : null,
    });
  }
  const claimRefsUsed = claimIdsUsed.map((claimId) =>
    runClaimRefById.get(claimId) ?? { claimId, claimType: null, scopeMatch: null }
  );
  const branch = typeof rawNav?.["branch"] === "string"
    ? rawNav["branch"]
    : typeof runNav?.["branch"] === "string"
      ? runNav["branch"]
      : null;
  const observationPackageId = typeof rawNav?.["observation_package_id"] === "string"
    ? rawNav["observation_package_id"]
    : typeof runNav?.["observationPackageId"] === "string"
      ? runNav["observationPackageId"]
      : null;
  if (!branch && !observationPackageId && retrievedClaimIds.length === 0 && claimRefsUsed.length === 0) {
    return null;
  }
  return {
    branch,
    observationPackageId,
    retrievedClaimIds,
    claimRefsUsed,
  };
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function numOrNull(v: unknown, min?: number, max?: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  let n = v;
  if (typeof min === "number" && n < min) return null;
  if (typeof max === "number" && n > max) return null;
  return n;
}

export function normalizeSizeAssessmentFromRaw(raw: unknown): SizeAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sizeClassRaw = trimStr(o["size_class"]);
  const sizeClass = SIZE_CLASS_VALUES.has(sizeClassRaw as SizeClass) ? (sizeClassRaw as SizeClass) : null;
  const result: SizeAssessment = {
    typicalSizeCm: numOrNull(o["typical_size_cm"], 0),
    observedSizeEstimateCm: numOrNull(o["observed_size_estimate_cm"], 0),
    sizeClass,
    rankingHint: trimStr(o["ranking_hint"]),
    basis: trimStr(o["basis"]),
    hedge: trimStr(o["hedge"]),
  };
  const hasContent =
    result.typicalSizeCm !== null ||
    result.observedSizeEstimateCm !== null ||
    result.sizeClass !== null ||
    result.rankingHint.length > 0;
  return hasContent ? result : null;
}

export function normalizeNoveltyHintFromRaw(raw: unknown): NoveltyHint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const score = numOrNull(o["novelty_score"], 0, 1);
  const isPotentiallyNovel = o["is_potentially_novel"] === true;
  if (!isPotentiallyNovel || score === null || score < 0.5) return null;
  return {
    isPotentiallyNovel: true,
    noveltyScore: score,
    reasoning: trimStr(o["reasoning"]),
    hedge: trimStr(o["hedge"]) || "新種判定はAIにはできません。可能性の示唆に留まります。",
  };
}

export function normalizeInvasiveResponseFromRaw(raw: unknown): InvasiveResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o["is_invasive"] !== true) return null;
  const cat = trimStr(o["mhlw_category"]);
  const action = trimStr(o["recommended_action"]);
  return {
    isInvasive: true,
    mhlwCategory: MHLW_CATEGORY_VALUES.has(cat as MhlwInvasiveCategory) ? (cat as MhlwInvasiveCategory) : null,
    recommendedAction: INVASIVE_ACTION_VALUES.has(action as InvasiveRecommendedAction)
      ? (action as InvasiveRecommendedAction)
      : null,
    actionBasis: trimStr(o["action_basis"]),
    regionalCaveat: trimStr(o["regional_caveat"]),
    legalWarning: trimStr(o["legal_warning"]),
    hedge: trimStr(o["hedge"]) || "AI判定です。駆除前に自治体・環境省にご確認ください。",
  };
}

/** UI ラベル（「いっしょに絞るためのメモ」等）用のヘルパ。 */
export function confidenceLabel(band: AiAssessment["confidenceBand"], lang: "ja" = "ja"): string {
  switch (band) {
    case "high": return lang === "ja" ? "かなり近そう" : "Quite confident";
    case "medium": return lang === "ja" ? "いまはここまで" : "Probably";
    case "low": return lang === "ja" ? "慎重に" : "Cautious";
    default: return lang === "ja" ? "様子見" : "Tentative";
  }
}

export function mhlwCategoryLabel(cat: MhlwInvasiveCategory | null, lang: "ja" = "ja"): string {
  if (!cat) return "";
  if (lang !== "ja") {
    switch (cat) {
      case "iaspecified": return "Invasive Alien Species (designated)";
      case "priority": return "Priority Control Alien Species";
      case "industrial": return "Industrially Managed Alien Species";
      case "prevention": return "Ecosystem-impact Prevention Alien Species";
      case "native": return "Native";
    }
  }
  switch (cat) {
    case "iaspecified": return "特定外来生物";
    case "priority": return "重点対策外来種";
    case "industrial": return "産業管理外来種";
    case "prevention": return "生態系被害防止外来種";
    case "native": return "在来種";
  }
}

export function invasiveActionLabel(action: InvasiveRecommendedAction | null, lang: "ja" = "ja"): string {
  if (!action) return "";
  if (lang !== "ja") {
    switch (action) {
      case "observe_only": return "Observe only";
      case "observe_and_report": return "Observe & report";
      case "report_only": return "Report only (do not handle)";
      case "do_not_handle": return "Do not handle";
      case "controlled_removal": return "Controlled removal (with permit)";
    }
  }
  switch (action) {
    case "observe_only": return "観察のみ";
    case "observe_and_report": return "観察と通報";
    case "report_only": return "通報のみ（直接の捕獲・運搬はしない）";
    case "do_not_handle": return "触れない・移動しない";
    case "controlled_removal": return "管理された駆除（許可が必要）";
  }
}

export function sizeClassLabel(cls: SizeClass | null, lang: "ja" = "ja"): string {
  if (!cls) return "";
  if (lang !== "ja") {
    switch (cls) {
      case "tiny": return "Tiny";
      case "small": return "Small";
      case "typical": return "Typical";
      case "large": return "Large";
      case "exceptional": return "Possibly record-breaking";
    }
  }
  switch (cls) {
    case "tiny": return "とても小さい";
    case "small": return "小さめ";
    case "typical": return "標準的";
    case "large": return "大きい";
    case "exceptional": return "観測史上クラスかも？（参考）";
  }
}
