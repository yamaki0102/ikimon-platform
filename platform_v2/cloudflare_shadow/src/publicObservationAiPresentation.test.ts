import assert from "node:assert/strict";
import test from "node:test";
import { publicObservationAiCandidateInsights, publicObservationAiFeedback } from "./publicObservationAiPresentation";

test("public AI presentation keeps three evidence-backed candidates without confidence or provenance", () => {
  const insights = publicObservationAiCandidateInsights(JSON.stringify({
    models: { specialist: "internal-model" },
    topCandidates: [
      {
        name: "イソヒヨドリ",
        scientificName: "Monticola solitarius",
        confidence: 0.78,
        supportingFeatures: ["全身に鱗状の羽衣が見える"],
        missingFeatures: ["尾全体は確認できない"],
        contradictions: [],
        sourceLanes: ["specialist"],
        sourceAssetIds: ["private-asset"],
      },
      {
        name: "ヒヨドリ",
        scientificName: "Hypsipetes amaurotis",
        supportingFeatures: ["体形は中型の鳥に見える"],
        missingFeatures: [],
        contradictions: ["目立つ冠羽は確認できない"],
      },
      { name: "鳥類", supportingFeatures: ["粗い候補"] },
      { name: "ムクドリ", supportingFeatures: ["嘴と体形を比較する余地がある"] },
      { name: "スズメ", supportingFeatures: ["四件目は公開しない"] },
    ],
  }));

  assert.deepEqual(insights.map((item) => item.name), ["イソヒヨドリ", "ヒヨドリ", "ムクドリ"]);
  assert.equal(JSON.stringify(insights).includes("confidence"), false);
  assert.equal(JSON.stringify(insights).includes("sourceLanes"), false);
  assert.equal(JSON.stringify(insights).includes("private-asset"), false);
});

test("public AI presentation rejects malformed, generic, and exact-location-bearing text", () => {
  assert.deepEqual(publicObservationAiCandidateInsights("{broken"), []);
  assert.deepEqual(publicObservationAiCandidateInsights(JSON.stringify({
    topCandidates: [
      { name: "unknown", supportingFeatures: ["何かが写る"] },
      { name: "イソヒヨドリ", supportingFeatures: ["撮影地点 34.71234, 137.81234"] },
      { name: "ヒヨドリ", supportingFeatures: [], missingFeatures: [], contradictions: [] },
    ],
  })), []);
});

test("public AI presentation exposes bounded feedback and next-photo guidance", () => {
  const feedback = publicObservationAiFeedback(JSON.stringify({
    summary: {
      observer_feedback: "葉の形が見えるので、候補を比較できます。",
      subject_explanations: [{ next_photo: "葉の裏側と茎の付け根を近くから撮る。" }],
    },
  }));
  assert.deepEqual(feedback, {
    feedback: "葉の形が見えるので、候補を比較できます。",
    nextPhoto: "葉の裏側と茎の付け根を近くから撮る。",
  });
  assert.deepEqual(publicObservationAiFeedback(JSON.stringify({ summary: { observer_feedback: "座標 34.71234, 137.81234" } })), {
    feedback: null,
    nextPhoto: null,
  });
});
