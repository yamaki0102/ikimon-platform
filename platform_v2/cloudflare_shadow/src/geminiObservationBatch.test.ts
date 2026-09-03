import assert from "node:assert/strict";
import test from "node:test";
import {
  GEMINI_ANALYSIS_MODEL,
  GEMINI_PRIMARY_MODEL,
  GEMINI_SPECIALIST_MODEL,
  GEMINI_SUMMARY_MODEL,
  applyGeminiObservationSummary,
  applyGeminiSpecialistEvidence,
  buildGeminiCensusRequest,
  buildGeminiCensusDirectRequest,
  buildGeminiEnvironmentRequest,
  buildGeminiPrimaryRequest,
  buildGeminiSpecialistRequest,
  createGeminiBatch,
  decideGeminiSpecialistEscalation,
  findGeminiBatchByDisplayName,
  generateGeminiContent,
  getGeminiBatch,
  geminiBatchDisplayName,
  geminiBatchResponseText,
  mergeGeminiObservationEvidence,
  parseGeminiCensusEvidence,
  parseGeminiEnvironmentEvidence,
  parseGeminiObservationSummary,
  parseGeminiPrimaryEvidence,
  parseGeminiPrimaryEvidenceDirect,
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
    assert.equal(request.generationConfig.temperature, 1);
    assert.equal(request.generationConfig.thinkingConfig.thinkingLevel, "minimal");
    assert.doesNotMatch(text, /"thinkingLevel":"MINIMAL"/);
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

test("interactive fusion can record the fixed Gemini 3.5 model for every active lane", () => {
  const merged = mergeGeminiObservationEvidence(primary, census, environment, 2, {
    primary: GEMINI_PRIMARY_MODEL,
    census: GEMINI_PRIMARY_MODEL,
  });
  assert.deepEqual([...new Set(merged.topCandidates.flatMap((candidate) => candidate.sourceModels))], [GEMINI_PRIMARY_MODEL]);
});

test("partial provider JSON keeps the reassessment merge safe when required arrays are omitted", () => {
  const parsedPrimary = parseGeminiPrimaryEvidence(JSON.stringify({
    record_class: "environment",
    information_state: "not_assessable",
    scene_class: "no_clear_subject",
  }));
  const parsedCensus = parseGeminiCensusEvidence(JSON.stringify({
    detection_state: "not_assessable",
    scene: "uncertain",
  }));
  assert.deepEqual(parsedPrimary.subjects, []);
  assert.deepEqual(parsedPrimary.regions, []);
  assert.deepEqual(parsedCensus.groups, []);
  assert.deepEqual(parsedCensus.regions, []);
  assert.equal(mergeGeminiObservationEvidence(parsedPrimary, parsedCensus, environment, 1).detectionState, "not_assessable");
  const parsedEnvironment = parseGeminiEnvironmentEvidence(JSON.stringify({ assessment_state: "not_assessable", fields: {} }));
  assert.deepEqual(parsedEnvironment.cues, []);
  assert.deepEqual(parsedEnvironment.uncertain_cues, []);
  const parsedSummary = parseGeminiObservationSummary(JSON.stringify({ narrative: "写真の要約" }));
  assert.deepEqual(parsedSummary.subject_explanations, []);
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

test("candidate fusion promotes a concrete census species over a generic primary class", () => {
  const concreteCensus: GeminiCensusEvidence = {
    ...census,
    groups: [
      {
        id: "bird",
        kind: "animal",
        role: "primary",
        scope: "individual",
        count: 1,
        label: "イソヒヨドリ",
        scientific: "Monticola solitarius",
        rank: "species",
        evidence: "全身に鱗状の羽衣が見え、冠羽は目立たない",
        supporting_features: ["全身の鱗状模様", "冠羽が目立たない", "細めの嘴"],
        missing_features: ["尾全体", "胸腹の正面"],
        contradictions: [],
        confidence: 0.78,
      },
      census.groups[1]!,
    ],
  };
  const genericPrimary: GeminiPrimaryEvidence = {
    ...primary,
    subjects: [{ ...primary.subjects[0]!, name: "鳥類", rank: "class", confidence: 0.65 }],
  };
  const merged = mergeGeminiObservationEvidence(genericPrimary, concreteCensus, environment, 3);
  assert.equal(merged.candidate.vernacularName, "イソヒヨドリ");
  assert.equal(merged.candidate.scientificName, "Monticola solitarius");
  assert.equal(merged.candidate.rank, "species");
  assert.equal(merged.candidate.sourceModel, GEMINI_ANALYSIS_MODEL);
  assert.equal(merged.topCandidates[0]?.name, "イソヒヨドリ");
  assert.equal(merged.topCandidates.some((candidate) => candidate.name === "鳥類"), true);
  assert.deepEqual(merged.topCandidates[0]?.sourceLanes, ["census"]);
  assert.equal(merged.genericCandidateOnly, false);
  assert.equal(merged.candidate.coexistingSubjects.length, 1);
  assert.equal(merged.candidate.coexistingSubjects[0]?.vernacularName, "樹木");

  const escalation = decideGeminiSpecialistEscalation(merged, genericPrimary, concreteCensus);
  assert.equal(escalation.required, true);
  assert.equal(escalation.specialistKind, "bird");
  assert.equal(escalation.reasons.includes("lane_candidate_conflict"), true);
});

test("bird specialist keeps top three alternatives for one subject without creating coexisting subjects", () => {
  const merged = mergeGeminiObservationEvidence(primary, census, environment, 3);
  const specialized = applyGeminiSpecialistEvidence(merged, {
    assessment_state: "informative",
    candidates: [
      {
        name: "イソヒヨドリ",
        scientific: "Monticola solitarius",
        rank: "species",
        confidence: 0.74,
        supporting_features: ["全身の鱗状模様", "冠羽が目立たない", "嘴が比較的細い"],
        missing_features: ["尾全体", "胸腹の正面"],
        contradictions: [],
      },
      {
        name: "ヒヨドリ",
        scientific: "Hypsipetes amaurotis",
        rank: "species",
        confidence: 0.43,
        supporting_features: ["体型と止まり方"],
        missing_features: ["耳斑", "明瞭な冠羽"],
        contradictions: ["冠羽が目立たない"],
      },
      {
        name: "ムクドリ",
        scientific: "Spodiopsar cineraceus",
        rank: "species",
        confidence: 0.31,
        supporting_features: ["建物上に止まる中型の鳥"],
        missing_features: ["顔の白色部", "嘴色"],
        contradictions: ["全身の鱗状模様"],
      },
    ],
    comparison_summary: "鱗状模様、冠羽、耳斑、嘴、尾を比較する。",
    needs_review: true,
  });
  assert.deepEqual(
    specialized.topCandidates.slice(0, 3).map((candidate) => candidate.name),
    ["イソヒヨドリ", "ヒヨドリ", "ムクドリ"],
  );
  assert.equal(specialized.candidate.vernacularName, "イソヒヨドリ");
  assert.equal(specialized.candidate.coexistingSubjects.length, 1);
  assert.equal(specialized.candidate.coexistingSubjects[0]?.vernacularName, "樹木");
  assert.match(specialized.reviewReasons.join(" "), /幼鳥|雌/);
});

test("specialist request is conditional, uses 3.5 Flash-Lite contract, and asks for bird diagnostic traits", () => {
  assert.equal(GEMINI_SPECIALIST_MODEL, "gemini-3.5-flash-lite");
  const request = buildGeminiSpecialistRequest(
    "record-1780552463658",
    "bird",
    images,
    mergeGeminiObservationEvidence(primary, census, environment, 2),
  );
  const text = JSON.stringify(request);
  assert.match(text, /嘴/);
  assert.match(text, /冠羽/);
  assert.match(text, /耳斑/);
  assert.match(text, /翼帯/);
  assert.match(text, /幼鳥/);
  assert.match(text, /雌/);
  assert.equal(request.generationConfig.maxOutputTokens, 2048);
  assert.equal(request.generationConfig.responseMimeType, "application/json");
  assert.equal(
    geminiBatchDisplayName("fixed-claim", "specialist"),
    geminiBatchDisplayName("fixed-claim", "specialist"),
  );
  assert.match(geminiBatchDisplayName("fixed-claim", "specialist"), /fixed-claim-specialist$/);
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

test("batch REST client reads completed inline responses from the canonical batch output", async () => {
  const mockFetch = (async (url: string | URL | Request) => {
    assert.equal(String(url), "https://generativelanguage.googleapis.com/v1beta/batches/completed");
    return new Response(JSON.stringify({
      name: "batches/completed",
      displayName: "claim-primary",
      state: "BATCH_STATE_SUCCEEDED",
      batchStats: { requestCount: "1", successfulRequestCount: "1" },
      output: {
        inlinedResponses: {
          inlinedResponses: [{
            metadata: { key: "record-1" },
            response: { candidates: [{ content: { parts: [{ text: "{\"record_class\":\"organism\"}" }] } }] },
          }],
        },
      },
    }), { status: 200 });
  }) as typeof fetch;
  const completed = await getGeminiBatch("secret", "batches/completed", mockFetch);
  assert.equal(completed.state, "BATCH_STATE_SUCCEEDED");
  assert.equal(completed.responses.length, 1);
  assert.equal(geminiBatchResponseText(completed.responses[0]), '{"record_class":"organism"}');
});

test("batch REST client reads inline responses from the canonical operation wrapper", async () => {
  const mockFetch = (async () => new Response(JSON.stringify({
    name: "batches/wrapped",
    metadata: { displayName: "claim-primary", state: "JOB_STATE_SUCCEEDED" },
    response: {
      inlinedResponses: {
        inlinedResponses: [{
          metadata: { key: "record-1" },
          response: { candidates: [{ content: { parts: [{ text: "{\"record_class\":\"organism\"}" }] } }] },
        }],
      },
    },
  }), { status: 200 })) as typeof fetch;
  const completed = await getGeminiBatch("secret", "batches/wrapped", mockFetch);
  assert.equal(completed.state, "JOB_STATE_SUCCEEDED");
  assert.equal(completed.responses.length, 1);
  assert.equal(geminiBatchResponseText(completed.responses[0]), '{"record_class":"organism"}');
});

test("direct generateContent reuses the primary request and extracts structured text", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const responseText = JSON.stringify({
    record_class: "organism",
    information_state: "informative",
    scene_class: "single_subject",
    subjects: [], regions: [], non_biological_labels: [], quality_flags: [], needs_review: true, review_reasons: ["species_uncertain"],
  });
  const mockFetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: responseText }] }, finishReason: "STOP" }] }), { status: 200 });
  }) as typeof fetch;
  const request = buildGeminiPrimaryRequest("record-direct", null, images);
  const result = await generateGeminiContent("secret", GEMINI_PRIMARY_MODEL, request, mockFetch);
  assert.equal(calls[0]!.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
  const sentRequest = JSON.parse(String(calls[0]!.init.body));
  assert.deepEqual(sentRequest.contents, request.contents);
  assert.equal(sentRequest.generationConfig.responseMimeType, "application/json");
  assert.equal(sentRequest.generationConfig.responseSchema, undefined);
  assert.deepEqual(sentRequest.generationConfig.responseJsonSchema, request.generationConfig.responseJsonSchema);
  assert.equal(sentRequest.generationConfig.temperature, 0);
  assert.equal(sentRequest.generationConfig.responseFormat, undefined);
  assert.deepEqual(sentRequest.generationConfig.thinkingConfig, { thinkingLevel: "minimal" });
  assert.equal(result.model, GEMINI_PRIMARY_MODEL);
  assert.equal(result.candidatesCount, 1);
  assert.equal(result.finishReason, "STOP");
  assert.deepEqual(parseGeminiPrimaryEvidenceDirect(result.text).review_reasons, ["species_uncertain"]);
});

test("direct census adapter keeps semantic fields while using a compact schema subset", () => {
  const request = buildGeminiCensusDirectRequest("record-direct-census", images);
  const schema = JSON.stringify(request.generationConfig.responseJsonSchema);
  assert.match(schema, /supporting_features/);
  assert.match(schema, /detection_state/);
  assert.doesNotMatch(schema, /maxItems/);
  assert.doesNotMatch(schema, /minimum/);
});

test("direct structured failures do not become semantic not-assessable", async () => {
  const empty = (async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })) as typeof fetch;
  await assert.rejects(() => generateGeminiContent("secret", GEMINI_PRIMARY_MODEL, buildGeminiPrimaryRequest("record-direct", null, images), empty), /gemini_generate_content_candidates_missing/);
  assert.throws(() => parseGeminiPrimaryEvidenceDirect(JSON.stringify({ record_class: "organism" })), /gemini_direct_schema_mismatch:primary:missing_/);
  const semantic = parseGeminiPrimaryEvidenceDirect(JSON.stringify({
    record_class: "unknown", information_state: "not_assessable", scene_class: "no_clear_subject",
    subjects: [], regions: [], non_biological_labels: [], quality_flags: [], needs_review: true, review_reasons: ["blurred"],
  }));
  assert.equal(semantic.information_state, "not_assessable");
});

test("direct provider errors retain only bounded field diagnostics", async () => {
  const failure = (async () => new Response(JSON.stringify({
    error: {
      message: "Request contains an invalid argument.",
      details: [{ fieldViolations: [{ field: "generation_config.response_format.text.mime_type", description: "invalid enum" }] }],
    },
  }), { status: 400 })) as typeof fetch;
  await assert.rejects(
    () => generateGeminiContent("secret", GEMINI_PRIMARY_MODEL, buildGeminiPrimaryRequest("record-direct", null, images), failure),
    /gemini_generate_content_api_failed:400:Request contains an invalid argument\.:generation_config\.response_format\.text\.mime_type:invalid enum/,
  );
});
