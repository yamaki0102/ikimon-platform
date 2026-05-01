import assert from "node:assert/strict";
import test from "node:test";
import { rowToGuideHypothesisEvalItem, toJsonl } from "./guideHypothesisEvalSet.js";

test("guide hypothesis eval item turns helpful feedback into keep target", () => {
  const item = rowToGuideHypothesisEvalItem({
    interaction_id: "i-1",
    interaction_type: "helpful",
    payload: { reason: "clear next step" },
    hypothesis_id: "h-1",
    mesh_key: "m-1",
    claim_type: "habitat",
    hypothesis_text: "水辺候補",
    what_we_can_say: "仮説段階",
    next_sampling_protocol: "雨後に再訪する",
    bias_warnings: ["effort_bias_not_corrected"],
    missing_data: ["explicit_non_detection"],
    guide_record_id: "g-1",
    scene_summary: "水路沿いの草地",
    environment_context: "水辺",
    detected_features: [{ name: "水路沿い" }, { name: "湿性草地" }],
  });

  assert.equal(item.task, "regional_hypothesis_next_sampling_feedback");
  assert.equal(item.improvementTarget, "keep_next_sampling_protocol");
  assert.equal(item.doNotUseAsEcologicalEvidence, true);
  assert.deepEqual(item.guideContext.detectedFeatureNames, ["水路沿い", "湿性草地"]);
});

test("guide hypothesis eval item turns wrong feedback into rewrite target and exports JSONL", () => {
  const item = rowToGuideHypothesisEvalItem({
    interaction_id: "i-2",
    interaction_type: "wrong",
    payload: {},
    hypothesis_id: "h-2",
    mesh_key: null,
    claim_type: "sampling_gap",
    hypothesis_text: "不足",
    what_we_can_say: "",
    next_sampling_protocol: "再訪",
    bias_warnings: [],
    missing_data: [],
    guide_record_id: null,
    scene_summary: null,
    environment_context: null,
    detected_features: null,
  });

  assert.equal(item.improvementTarget, "rewrite_next_sampling_protocol");
  const jsonl = toJsonl([item]);
  assert.equal(jsonl.split("\n").length, 1);
  assert.match(jsonl, /"doNotUseAsEcologicalEvidence":true/);
});

test("guide hypothesis eval item preserves representative merge_ok feedback", () => {
  const item = rowToGuideHypothesisEvalItem({
    interaction_id: "i-3",
    interaction_type: "helpful",
    payload: { representativeFeedback: "merge_ok", bundleId: "b-1" },
    hypothesis_id: "h-3",
    mesh_key: "m-3",
    claim_type: "sampling_gap",
    hypothesis_text: "次回は水路を見る",
    what_we_can_say: "仮説段階",
    next_sampling_protocol: "夕方に水路沿いを撮る",
    bias_warnings: [],
    missing_data: [],
    guide_record_id: "g-3",
    scene_summary: "水路沿い",
    environment_context: "湿った管理地",
    detected_features: [],
  });

  assert.equal(item.label, "merge_ok");
  assert.equal(item.improvementTarget, "keep_next_sampling_protocol");
  assert.equal(item.feedbackPayload.bundleId, "b-1");
});
