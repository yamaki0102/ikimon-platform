import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuideHypothesisPromptImprovements,
  buildWrongFeedbackQueueCandidates,
} from "./guideHypothesisPromptImprovements.js";
import type { GuideHypothesisEvalItem } from "./guideHypothesisEvalSet.js";

function item(overrides: Partial<GuideHypothesisEvalItem>): GuideHypothesisEvalItem {
  return {
    task: "regional_hypothesis_next_sampling_feedback",
    label: "helpful",
    interactionId: "i-1",
    hypothesisId: "h-1",
    meshKey: "m-1",
    claimType: "habitat",
    hypothesisText: "水辺候補",
    whatWeCanSay: "仮説段階",
    nextSamplingProtocol: "雨後に10分再訪し、見つからない分類群もabsentで残す。",
    biasWarnings: ["effort_bias_not_corrected"],
    missingData: ["complete_checklist", "explicit_non_detection"],
    guideContext: {
      guideRecordId: "g-1",
      sceneSummary: "水路沿い",
      environmentContext: "湿性草地",
      detectedFeatureNames: ["水路", "湿性草地"],
    },
    feedbackPayload: {},
    improvementTarget: "keep_next_sampling_protocol",
    doNotUseAsEcologicalEvidence: true,
    ...overrides,
  };
}

test("prompt improvements keep helpful patterns separate from ecological evidence", () => {
  const improvements = buildGuideHypothesisPromptImprovements([
    item({ interactionId: "i-1", label: "helpful" }),
    item({ interactionId: "i-2", label: "helpful", claimType: "habitat" }),
  ]);

  assert.equal(improvements.length, 1);
  assert.equal(improvements[0]?.improvementType, "keep_pattern");
  assert.equal(improvements[0]?.label, "helpful");
  assert.match(improvements[0]?.promptPatch ?? "", /Do not convert helpful feedback into ecological evidence/);
  assert.equal(improvements[0]?.evidence.doNotUseAsEcologicalEvidence, true);
});

test("prompt improvements turn wrong feedback into rewrite and global guardrail", () => {
  const improvements = buildGuideHypothesisPromptImprovements([
    item({
      interactionId: "i-3",
      label: "wrong",
      claimType: "sampling_gap",
      improvementTarget: "rewrite_next_sampling_protocol",
      biasWarnings: ["absence_cannot_be_inferred_without_scope"],
    }),
  ]);

  assert.ok(improvements.some((improvement) => improvement.improvementType === "rewrite_pattern"));
  assert.ok(improvements.some((improvement) => improvement.improvementType === "guardrail"));
  assert.ok(improvements.every((improvement) => String(improvement.evidence.doNotUseAsEcologicalEvidence) === "true"));
  assert.match(improvements.map((improvement) => improvement.promptPatch).join("\n"), /Never treat guide_interactions helpful\/wrong as ecological evidence/);
});

test("wrong feedback queue opens only after a claim type crosses threshold", () => {
  const belowThreshold = buildWrongFeedbackQueueCandidates([
    item({ interactionId: "w-1", label: "wrong", claimType: "seasonality", hypothesisId: "h-1" }),
    item({ interactionId: "w-2", label: "wrong", claimType: "seasonality", hypothesisId: "h-2" }),
  ]);

  assert.equal(belowThreshold.length, 0);

  const candidates = buildWrongFeedbackQueueCandidates([
    item({ interactionId: "w-1", label: "wrong", claimType: "seasonality", hypothesisId: "h-1" }),
    item({ interactionId: "w-2", label: "wrong", claimType: "seasonality", hypothesisId: "h-2" }),
    item({ interactionId: "w-3", label: "wrong", claimType: "seasonality", hypothesisId: "h-3" }),
    item({ interactionId: "w-4", label: "wrong", claimType: "habitat", hypothesisId: "h-4" }),
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.claimType, "seasonality");
  assert.equal(candidates[0]?.wrongCount, 3);
  assert.equal(candidates[0]?.thresholdCount, 3);
  assert.deepEqual(candidates[0]?.evidence.exampleHypothesisIds, ["h-1", "h-2", "h-3"]);
  assert.equal(candidates[0]?.evidence.doNotUseAsEcologicalEvidence, true);
});
