import assert from "node:assert/strict";
import test from "node:test";
import { isPublicObservationAiSubjectEligible, publicObservationAiCandidateInsights, publicObservationAiFeedback, publicObservationAiPersonPrimaryNames } from "./publicObservationAiPresentation";

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

test("public AI candidates omit human taxa without stripping plant names or human context", () => {
  const insights = publicObservationAiCandidateInsights(JSON.stringify({
    topCandidates: [
      { name: "人間", scientificName: "Homo sapiens", supportingFeatures: ["観客が写っています"] },
      { name: "人物", supportingFeatures: ["人が写っています"] },
      { name: "Human", scientificName: "  HOMO   SAPIENS  ", supportingFeatures: ["観客が写っています"] },
      { name: "ヒトリシズカ", scientificName: "Chloranthus japonicus", supportingFeatures: ["人の近くに花が写っています"] },
      { name: "ニンジン", scientificName: "Daucus carota", supportingFeatures: ["葉の切れ込みが見えます"] },
      { name: "スズメ", scientificName: "Passer montanus", supportingFeatures: ["頬の黒い斑点が見えます"] },
    ],
  }));
  assert.deepEqual(insights.map((item) => item.name), ["ヒトリシズカ", "ニンジン", "スズメ"]);
  assert.equal(insights[0]?.supportingFeatures[0], "人の近くに花が写っています");
});

test("public AI guidance suppresses person and legacy human-subject close-up requests", () => {
  const summary = {
    observer_feedback: "地域の行事が記録されています。",
    subject_explanations: [{ subject_id: "primary:person", title: "主対象", next_photo: "頭部および胴体の鮮明な拡大画像" }],
  };
  for (const context of [
    { recordClass: "person" },
    { topCandidates: [{ candidateKey: "primary:person", name: "人間", scientificName: "Homo sapiens" }] },
    { candidate: { candidateKey: "primary:person", vernacularName: "ヒト", scientificName: "Homo sapiens" } },
  ]) {
    assert.deepEqual(publicObservationAiFeedback(JSON.stringify({ ...context, summary })), {
      feedback: "地域の行事が記録されています。",
      nextPhoto: null,
    });
  }
  assert.equal(publicObservationAiFeedback(JSON.stringify({
    summary: { subject_explanations: [{ title: "人間", next_photo: "顔を近くから撮る" }] },
  })).nextPhoto, null);
});

test("explicit person classification excludes primary advice and insights without relying on its name", () => {
  const payload = JSON.stringify({
    recordClass: "person",
    candidate: { candidateKey: "primary:person", vernacularName: "男性" },
    topCandidates: [
      { candidateKey: "primary:person", name: "男性", supportingFeatures: ["観客が写っています"] },
      { name: "男性", supportingFeatures: ["主対象の別候補です"] },
    ],
    summary: {
      observer_feedback: "地域の行事が記録されています。",
      subject_explanations: [{ subject_id: "primary:person", title: "主対象", next_photo: "頭部および胴体の鮮明な拡大画像" }],
    },
  });
  assert.deepEqual(publicObservationAiFeedback(payload), {
    feedback: "地域の行事が記録されています。",
    nextPhoto: null,
  });
  assert.deepEqual(publicObservationAiCandidateInsights(payload), []);
});

test("shared AI eligibility binds person names to the primary subject and preserves coexisting organisms", () => {
  const payload = JSON.stringify({
    recordClass: "person",
    candidate: { candidateKey: "primary:person", vernacularName: "男性", coexistingSubjects: [
      { candidateKey: "census:bird", vernacularName: "スズメ", scientificName: "Passer montanus" },
      { candidateKey: "census:plant", vernacularName: "ヒトリシズカ", scientificName: "Chloranthus japonicus" },
    ] },
    topCandidates: [
      { candidateKey: "primary:person", name: "成人男性", supportingFeatures: ["主対象です"] },
      { candidateKey: "census:bird", name: "スズメ", scientificName: "Passer montanus", supportingFeatures: ["頬に黒い斑点があります"] },
      { candidateKey: "census:plant", name: "ヒトリシズカ", scientificName: "Chloranthus japonicus", supportingFeatures: ["白い花が見えます"] },
    ],
    private_source: "must stay internal",
  });
  const names = publicObservationAiPersonPrimaryNames(payload);
  assert.deepEqual(names, ["男性", "成人男性"]);
  for (const source of [payload, names]) {
    assert.equal(isPublicObservationAiSubjectEligible(" 男性 ", source), false);
    assert.equal(isPublicObservationAiSubjectEligible("成人男性", source), false);
    assert.equal(isPublicObservationAiSubjectEligible("スズメ", source, "Passer montanus"), true);
    assert.equal(isPublicObservationAiSubjectEligible("ヒトリシズカ", source, "Chloranthus japonicus"), true);
  }
  assert.deepEqual(publicObservationAiCandidateInsights(payload).map((candidate) => candidate.name), ["スズメ", "ヒトリシズカ"]);
  assert.deepEqual(publicObservationAiPersonPrimaryNames("{broken"), []);
  assert.deepEqual(publicObservationAiPersonPrimaryNames(JSON.stringify({ recordClass: "organism", candidate: { vernacularName: "スズメ" } })), []);
  assert.equal(isPublicObservationAiSubjectEligible("Homo sapiens", "{broken"), false);
});

test("mixed-subject guidance selects the mapped bird or plant instead of a person or unbound request", () => {
  for (const subject of [
    { candidateKey: "census:bird", vernacularName: "スズメ", scientificName: "Passer montanus", advice: "翼とくちばしを横から撮る。" },
    { candidateKey: "census:plant", vernacularName: "ヒトリシズカ", scientificName: "Chloranthus japonicus", advice: "葉の裏側と茎の付け根を撮る。" },
  ]) {
    const payload = {
      recordClass: "mixed",
      candidate: {
        candidateKey: "primary:person", vernacularName: "人間", scientificName: "Homo sapiens",
        coexistingSubjects: [subject],
      },
      summary: { subject_explanations: [
        { subject_id: "primary:person", title: "主対象", next_photo: "頭部および胴体の鮮明な拡大画像" },
        { subject_id: "missing", title: "別の対象", next_photo: "顔を近くから撮る。" },
        { subject_id: subject.candidateKey, title: "別の生きもの", next_photo: subject.advice },
      ] },
    };
    assert.equal(publicObservationAiFeedback(JSON.stringify(payload)).nextPhoto, subject.advice);
    // A person-first photo may still contain an explicitly mapped bird or plant.
    assert.equal(publicObservationAiFeedback(JSON.stringify({ ...payload, recordClass: "person" })).nextPhoto, subject.advice);
    assert.equal(publicObservationAiFeedback(JSON.stringify({
      ...payload,
      recordClass: "person",
      candidate: { ...payload.candidate, vernacularName: "男性", scientificName: null },
    })).nextPhoto, subject.advice);
  }
});
