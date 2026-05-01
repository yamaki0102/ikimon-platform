import { getPool } from "../db.js";

export type GuideHypothesisEvalLabel = "helpful" | "wrong";

export type GuideHypothesisEvalItem = {
  task: "regional_hypothesis_next_sampling_feedback";
  label: GuideHypothesisEvalLabel;
  interactionId: string;
  hypothesisId: string;
  meshKey: string | null;
  claimType: string;
  hypothesisText: string;
  whatWeCanSay: string;
  nextSamplingProtocol: string;
  biasWarnings: string[];
  missingData: string[];
  guideContext: {
    guideRecordId: string | null;
    sceneSummary: string;
    environmentContext: string;
    detectedFeatureNames: string[];
  };
  feedbackPayload: Record<string, unknown>;
  improvementTarget: "keep_next_sampling_protocol" | "rewrite_next_sampling_protocol";
  doNotUseAsEcologicalEvidence: true;
};

type EvalRow = {
  interaction_id: string;
  interaction_type: GuideHypothesisEvalLabel;
  payload: Record<string, unknown> | null;
  hypothesis_id: string;
  mesh_key: string | null;
  claim_type: string;
  hypothesis_text: string;
  what_we_can_say: string;
  next_sampling_protocol: string;
  bias_warnings: unknown;
  missing_data: unknown;
  guide_record_id: string | null;
  scene_summary: string | null;
  environment_context: string | null;
  detected_features: unknown;
};

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function detectedFeatureNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => item && typeof item === "object" ? item as Record<string, unknown> : null)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => String(item.name ?? "").trim())
    .filter(Boolean)
    .slice(0, 24);
}

export function rowToGuideHypothesisEvalItem(row: EvalRow): GuideHypothesisEvalItem {
  return {
    task: "regional_hypothesis_next_sampling_feedback",
    label: row.interaction_type,
    interactionId: row.interaction_id,
    hypothesisId: row.hypothesis_id,
    meshKey: row.mesh_key,
    claimType: row.claim_type,
    hypothesisText: row.hypothesis_text,
    whatWeCanSay: row.what_we_can_say,
    nextSamplingProtocol: row.next_sampling_protocol,
    biasWarnings: normalizeStringArray(row.bias_warnings),
    missingData: normalizeStringArray(row.missing_data),
    guideContext: {
      guideRecordId: row.guide_record_id,
      sceneSummary: row.scene_summary ?? "",
      environmentContext: row.environment_context ?? "",
      detectedFeatureNames: detectedFeatureNames(row.detected_features),
    },
    feedbackPayload: row.payload ?? {},
    improvementTarget: row.interaction_type === "helpful" ? "keep_next_sampling_protocol" : "rewrite_next_sampling_protocol",
    doNotUseAsEcologicalEvidence: true,
  };
}

export async function loadGuideHypothesisEvalItems(limit = 500): Promise<GuideHypothesisEvalItem[]> {
  const cappedLimit = Math.max(1, Math.min(5000, Math.round(limit)));
  const result = await getPool().query<EvalRow>(
    `select gi.interaction_id::text,
            gi.interaction_type as interaction_type,
            gi.payload,
            rh.hypothesis_id::text,
            rh.mesh_key,
            rh.claim_type,
            rh.hypothesis_text,
            rh.what_we_can_say,
            rh.next_sampling_protocol,
            rh.bias_warnings,
            rh.missing_data,
            gr.guide_record_id::text as guide_record_id,
            gr.scene_summary,
            gls.environment_context,
            gr.detected_features
       from guide_interactions gi
       join regional_hypotheses rh on rh.hypothesis_id = gi.hypothesis_id
       left join guide_records gr on gr.guide_record_id = gi.guide_record_id
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
      where gi.interaction_type in ('helpful', 'wrong')
      order by gi.occurred_at desc
      limit $1`,
    [cappedLimit],
  );
  return result.rows.map(rowToGuideHypothesisEvalItem);
}

export function toJsonl(items: GuideHypothesisEvalItem[]): string {
  return items.map((item) => JSON.stringify(item)).join("\n");
}

export const __test__ = { detectedFeatureNames };
