import assert from "node:assert/strict";
import test from "node:test";
import {
  GEMINI_ANALYSIS_MODEL,
  GEMINI_PRIMARY_MODEL,
  GEMINI_SUMMARY_MODEL,
  applyGeminiObservationSummary,
  buildGeminiCensusRequest,
  buildGeminiEnvironmentRequest,
  buildGeminiPrimaryRequest,
  createGeminiBatch,
  findGeminiBatchByDisplayName,
  geminiBatchResponseText,
  mergeGeminiObservationEvidence,
  type GeminiCensusEvidence,
  type GeminiEnvironmentEvidence,
  type GeminiPrimaryEvidence,
} from "./geminiObservationBatch.js";

const images = [
  { assetId: "asset-1", mimeType: "image/webp", base64Data: "AAAA" },
  { assetId: "asset-2", mimeType: "image/webp", base64Data: "BBBB" },
];

test("production model stack uses the measured exact Flash-Lite IDs and every image", () => {
  assert.equal(GEMINI_PRIMARY_MODEL, "gemini-3.5-flash-lite");
  assert.equal(GEMINI_ANALYSIS_MODEL, "gemini-3.1-flash-lite");
  assert.equal(GEMINI_SUMMARY_MODEL, "gemini-3.1-flash-lite");
  for (const request of [
    buildGeminiPrimaryRequest("record-1", "2026-07-19", images),
    buildGeminiCensusRequest("record-1", images),
    buildGeminiEnvironmentRequest("record-1", images),
  ]) {
    const text = JSON.stringify(request);
    assert.match(text, /asset_index=0/);
    assert.match(text, /asset_index=1/);
    assert.equal((text.match(/inlineData/g) ?? []).length, 2);
    assert.equal(request.generationConfig.maxOutputTokens, 2048);
    assert.equal(request.generationConfig.responseMimeType, "application/json");
  }
});

const primary: GeminiPrimaryEvidence = {
  record_class: "mixed",
  information_state: "informative",
  scene_class: "multi_taxa",
  subjects: [{ id: "bird", role: "primary", scope: "individual", count: 1, name: "鳥類", scientific: "", rank: "class", confidence: 0.76, evidence: "枝上に嘴と羽毛が見える" }],
  regions: [{ subject_id: "bird", asset_index: 1, x: 0.2, y: 0.1, width: 0.3, height: 0.4 }],
  non_biological_labels: ["園路"],
  quality_flags: [],
  needs_review: true,
  review_reasons: ["種の識別特徴が不足"],
};

const census: GeminiCensusEvidence = {
  detection_state: "detected",
  scene: "multiple_taxa",
  groups: [
    { id: "bird", kind: "animal", role: "primary", scope: "individual", count: 1, label: "鳥類", evidence: "枝上の個体", confidence: 0.8 },
    { id: "tree", kind: "plant", role: "other", scope: "group", count: 0, label: "樹木", evidence: "葉と枝", confidence: 0.72 },
  ],
  regions: [{ group_id: "tree", asset_index: 0, x: 0, y: 0, width: 0.8, height: 1 }],
  relations: ["bird｜枝に止まる｜tree｜接触が見える"],
  needs_review: false,
  review_reasons: [],
};

const environment: GeminiEnvironmentEvidence = {
  assessment_state: "informative",
  fields: { place_type: "woodland", contact_surface: "plant", surrounding_cover: "trees_shrubs", environment_condition: "shaded", human_change: "none_visible" },
  cues: [{ slot: "vegetation_structure", label: "樹木と低木", evidence: "複数層の枝葉", asset_index: 0, confidence: 0.86 }],
  uncertain_cues: [],
};

test("deterministic merge keeps the primary and independent secondary biota with media indices", () => {
  const merged = mergeGeminiObservationEvidence(primary, census, environment, 2);
  assert.equal(merged.recordClass, "mixed");
  assert.equal(merged.detectionState, "detected");
  assert.equal(merged.candidate.vernacularName, "鳥類");
  assert.equal(merged.candidate.assetIndex, 1);
  assert.equal(merged.candidate.sourceModel, GEMINI_PRIMARY_MODEL);
  assert.equal(merged.candidate.coexistingSubjects.length, 1);
  assert.equal(merged.candidate.coexistingSubjects[0]?.vernacularName, "樹木");
  assert.equal(merged.candidate.coexistingSubjects[0]?.assetIndex, 0);
  assert.equal(merged.candidate.coexistingSubjects[0]?.sourceModel, GEMINI_ANALYSIS_MODEL);
  assert.equal(merged.environment.fields.place_type, "woodland");
});

test("not detected and not assessable remain separate states", () => {
  const emptyPrimary = { ...primary, record_class: "environment" as const, information_state: "informative" as const, subjects: [], regions: [] };
  const emptyCensus = { ...census, detection_state: "not_detected" as const, groups: [], regions: [] };
  assert.equal(mergeGeminiObservationEvidence(emptyPrimary, emptyCensus, environment, 2).detectionState, "not_detected");
  assert.equal(mergeGeminiObservationEvidence(
    { ...emptyPrimary, information_state: "not_assessable" },
    { ...emptyCensus, detection_state: "not_assessable" },
    { ...environment, assessment_state: "not_assessable" },
    2,
  ).detectionState, "not_assessable");
});

test("summary can only enrich already extracted subjects", () => {
  const merged = mergeGeminiObservationEvidence(primary, census, environment, 2);
  const enriched = applyGeminiObservationSummary(merged, {
    narrative: "枝上の鳥と周囲の樹木が写っています。",
    subject_explanations: [{ subject_id: "bird", title: "鳥類", explanation: "嘴と羽毛が見えます。", uncertainty: "種までは判断できません。", next_photo: "頭部と翼を横から撮影してください。" }],
    environment_summary: "樹木と低木が見えます。",
    interaction_summary: "",
    observer_feedback: "複数方向からの写真が役立ちます。",
  });
  assert.match(enriched.candidate.visualEvidence.join(" "), /嘴と羽毛/);
  assert.match(enriched.candidate.needsMoreEvidence.join(" "), /頭部と翼/);
  assert.equal(enriched.candidate.coexistingSubjects[0]?.vernacularName, "樹木");
});

test("batch REST client uses exact model paths, recovers by display name, and parses item text", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const mockFetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/batches?pageSize=")) return new Response(JSON.stringify({ operations: [{ name: "batches/existing", metadata: { displayName: "claim-primary", state: "BATCH_STATE_RUNNING" } }] }), { status: 200 });
    return new Response(JSON.stringify({ name: "batches/created", metadata: { displayName: "claim-primary", state: "BATCH_STATE_PENDING" } }), { status: 200 });
  }) as typeof fetch;
  const created = await createGeminiBatch("secret", GEMINI_PRIMARY_MODEL, "claim-primary", [{ request: buildGeminiPrimaryRequest("record-1", null, images), metadata: { key: "record-1" } }], mockFetch);
  assert.equal(created.name, "batches/created");
  assert.match(calls[0]!.url, /models\/gemini-3\.5-flash-lite:batchGenerateContent$/);
  assert.equal((calls[0]!.init.headers as Record<string, string>)["x-goog-api-key"], "secret");
  const recovered = await findGeminiBatchByDisplayName("secret", "claim-primary", mockFetch);
  assert.equal(recovered?.name, "batches/existing");
  assert.equal(geminiBatchResponseText({ response: { candidates: [{ content: { parts: [{ text: "{\"ok\":true}" }] } }] } }), '{"ok":true}');
});
