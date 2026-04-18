import { getPool } from "../db.js";

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
    generated_at: string;
  }>(
    `SELECT assessment_id::text, confidence_band, model_used, recommended_rank,
            recommended_taxon_name, best_specific_taxon_name,
            narrative, simple_summary, observer_boost, next_step_text, stop_reason,
            fun_fact, fun_fact_grounded,
            diagnostic_features_seen, missing_evidence, similar_taxa,
            distinguishing_tips, confirm_more,
            geographic_context, seasonal_context,
            generated_at::text
       FROM observation_ai_assessments
      WHERE occurrence_id = $1
      ORDER BY generated_at DESC
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
    generatedAt: r.generated_at,
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
