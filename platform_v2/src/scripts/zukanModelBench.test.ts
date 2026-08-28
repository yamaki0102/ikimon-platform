import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_BENCH_CORE_POST_COUNT,
  ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA,
  ZUKAN_BENCH_MIN_GOLD_POSTS,
  ZUKAN_BENCH_SMOKE_POST_COUNT,
  CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL,
  CLOUDFLARE_QWEN_3_8_27B_MODEL,
  buildCloudflareAiChatPayload,
  buildCloudflareAiRequestHeaders,
  buildCloudflareAiRunPayload,
  buildCloudflareResponsesPayload,
  buildZukanBenchFinalOutputRecord,
  compareZukanBenchReports,
  detailHasHumanConsensus,
  extractOrderedPostPhotoUrls,
  buildCloudflareOfficialRestPayload,
  generateWithCloudflareAiRun,
  generateWithCloudflareOfficialRest,
  generateWithCloudflareAiRest,
  rightsVettedTargetsFromResearchPayload,
  loadZukanBenchPrompt,
  scoreZukanBenchResponse,
  selectDeterministicPostTargets,
  selectZukanBenchFixtures,
  type ZukanBenchFixture,
  type ZukanBenchModelReport,
} from "./zukanModelBench.js";

const baseFixture: ZukanBenchFixture = {
  fixtureId: "zukan-post-record-1",
  visitId: "record-1",
  occurrenceId: "occ:record-1:0",
  detailPath: "/observations/record-1",
  observedAt: "2026-08-01T00:00:00Z",
  images: [
    { index: 0, url: "https://zukan.earth/a.webp", sha256: "a".repeat(64), bytes: 1024, mimeType: "image/webp" },
    { index: 1, url: "https://zukan.earth/b.webp", sha256: "b".repeat(64), bytes: 2048, mimeType: "image/webp" },
  ],
  postInputSha256: "c".repeat(64),
  gold: { label: "クロスジギンヤンマ", aliases: ["Anax nigrofasciatus"], rank: "species", status: "human_consensus" },
};

function response(name: string, confidence = "medium", rank = "species", geography = "位置情報が未取得のため評価保留"): string {
  return JSON.stringify({
    recommended_taxon_name: name,
    recommended_rank: rank,
    confidence_band: confidence,
    taxonomic_candidates: [],
    geographic_context: geography,
  });
}

function target(visitId: string, occurrenceId: string) {
  return {
    path: `/observations/${visitId}`,
    visitId,
    occurrenceId,
    observedAt: "2026-08-01T00:00:00Z",
    displayName: "名前待ち",
    photoUrl: `/derived/${visitId}.webp`,
    source: "record-path" as const,
  };
}

test("core and smoke sizes stay intentionally small", () => {
  assert.equal(ZUKAN_BENCH_CORE_POST_COUNT, 24);
  assert.equal(ZUKAN_BENCH_SMOKE_POST_COUNT, 8);
  assert.equal(ZUKAN_BENCH_MIN_GOLD_POSTS, 8);
});

test("Gemini benchmark uses the native schema for scored fields while allowing full final output", () => {
  assert.deepEqual(ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA.required, [
    "confidence_band",
    "recommended_rank",
    "recommended_taxon_name",
  ]);
  assert.equal(ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA.additionalProperties, true);
  assert.deepEqual(ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA.properties.recommended_rank.enum, [
    "species",
    "genus",
    "family",
    "order",
    "lifeform",
  ]);
});

test("benchmark prompt source defaults to the manifest prompt and supports an explicit override", async () => {
  const manifest = { promptPath: "src/prompts/observation_reassess.md" };
  const defaultPrompt = await loadZukanBenchPrompt(manifest);
  const minimalPrompt = await loadZukanBenchPrompt(manifest, "src/prompts/observation_reassess_bench_minimal.md");

  assert.equal(defaultPrompt.sourcePath, manifest.promptPath);
  assert.equal(minimalPrompt.sourcePath, "src/prompts/observation_reassess_bench_minimal.md");
  assert.notEqual(defaultPrompt.sha256, minimalPrompt.sha256);
  assert.match(minimalPrompt.text, /recommended_taxon_name/iu);
  assert.match(minimalPrompt.text, /名前だけ/u);
  assert.match(minimalPrompt.text, /画像から直接支持できる分類群だけ/u);
  assert.match(minimalPrompt.text, /種に固有の視覚的な決定形質/u);
  assert.match(minimalPrompt.text, /属の証拠も弱ければ科・目・生活形/u);
  assert.match(minimalPrompt.text, /候補であるだけなら採用しない/u);
  assert.match(minimalPrompt.text, /決定形質が明瞭で、画像内に矛盾がない/u);
});

test("post selection is deterministic and deduped by visit", () => {
  const a = target("record-a", "occ-a");
  const a2 = target("record-a", "occ-a2");
  const b = target("record-b", "occ-b");
  const c = target("record-c", "occ-c");
  const first = selectDeterministicPostTargets([a, b, a2, c], 3).map((item) => item.visitId);
  const second = selectDeterministicPostTargets([c, a2, b, a], 3).map((item) => item.visitId);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 3);
});

test("research API candidates require canonical export rights and human consensus", () => {
  const accepted = {
    eventID: "record-1",
    occurrenceID: "occ:record-1:0",
    eventDate: "2026-08-01T00:00:00Z",
    scientificName: "Anax nigrofasciatus",
    vernacularName: "クロスジギンヤンマ",
    taxonRank: "species",
    consensusStatus: "community_consensus",
    associatedMedia: "/photo.jpg",
    licenseStatus: { mediaLicense: "CC-BY-4.0", externalExportAllowed: true, withdrawalStatus: "active" },
  };
  const targets = rightsVettedTargetsFromResearchPayload({
    records: [accepted, { ...accepted, eventID: "record-2", licenseStatus: { ...accepted.licenseStatus, externalExportAllowed: false } }],
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.gold.status, "human_consensus");
  assert.equal(targets[0]?.mediaLicense, "CC-BY-4.0");
});

test("all photos in one post are extracted in post order", () => {
  const html = `
    <button class="obs-hero-thumb" data-obs-thumb-index="2" data-obs-thumb-full-src="/photo-c.jpg"></button>
    <button class="obs-hero-thumb" data-obs-thumb-index="0" data-obs-thumb-full-src="/photo-a.jpg"></button>
    <button class="obs-hero-thumb" data-obs-thumb-index="1" data-obs-thumb-full-src="/photo-b.jpg"></button>`;
  assert.deepEqual(extractOrderedPostPhotoUrls(html), ["/photo-a.jpg", "/photo-b.jpg", "/photo-c.jpg"]);
});

test("official REST payload keeps every post photo in one ordered user message", () => {
  const payload = buildCloudflareOfficialRestPayload([
    { type: "image_url", image_url: { url: "data:image/webp;base64,AAA" } },
    { type: "image_url", image_url: { url: "data:image/webp;base64,BBB" } },
    { type: "image_url", image_url: { url: "data:image/webp;base64,CCC" } },
    { type: "text", text: "cold-start prompt" },
  ]);
  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0]?.role, "user");
  assert.deepEqual(payload.messages[0]?.content.map((part) => part.type), ["image_url", "image_url", "image_url", "text"]);
  assert.equal(payload.max_completion_tokens, 8192);
  assert.equal("max_tokens" in payload, false);
  assert.equal(payload.reasoning_effort, "low");
  assert.equal(payload.stream, false);
  assert.deepEqual(payload.response_format, { type: "json_object" });
});

test("Cloudflare AI REST adapters preserve ordered multimodal input and native schema", async () => {
  const originalFetch = globalThis.fetch;
  const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  const previousGatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID;
  const parts = [
    { type: "image_url" as const, image_url: { url: "data:image/webp;base64,AAA" } },
    { type: "image_url" as const, image_url: { url: "data:image/webp;base64,BBB" } },
    { type: "image_url" as const, image_url: { url: "data:image/webp;base64,CCC" } },
    { type: "text" as const, text: "cold-start prompt" },
  ];
  let requestCount = 0;
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  let requestHeaders = new Headers();
  globalThis.fetch = (async (input, init) => {
    requestCount += 1;
    requestUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "chatcmpl-test",
      model: CLOUDFLARE_QWEN_3_8_27B_MODEL,
      choices: [{ message: { content: JSON.stringify({ recommended_taxon_name: "unknown", recommended_rank: "lifeform", confidence_band: "low" }) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 31, completion_tokens: 17 },
    }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
  }) as typeof fetch;
  process.env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  process.env.CLOUDFLARE_AI_GATEWAY_ID = "zukan-existing-gateway";
  try {
    const payload = buildCloudflareAiChatPayload(CLOUDFLARE_QWEN_3_8_27B_MODEL, parts, 8192);
    const payloadMessages = (payload.messages as Array<{ content: Array<{ type: string }> }>);
    assert.equal(payloadMessages[0]?.content.map((part) => part.type).join(","), "image_url,image_url,image_url,text");
    assert.deepEqual(payload.response_format, { type: "json_schema", json_schema: ZUKAN_BENCH_MODEL_RESPONSE_JSON_SCHEMA });
    const result = await generateWithCloudflareAiRest({ model: CLOUDFLARE_QWEN_3_8_27B_MODEL, parts });
    assert.equal(requestCount, 1);
    assert.equal(requestUrl, "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/ai/v1/chat/completions");
    assert.equal(requestHeaders.get("cf-aig-gateway-id"), "zukan-existing-gateway");
    assert.equal(requestBody.model, CLOUDFLARE_QWEN_3_8_27B_MODEL);
    assert.equal(result.inputTokens, 31);
    assert.equal(result.outputTokens, 17);
    assert.equal(result.providerResultMeta.http_status, 200);
    assert.equal(result.providerResultMeta.content_type, "application/json");
    assert.equal(result.providerResultMeta.response_shape, "chat_completions");

    globalThis.fetch = (async () => new Response(JSON.stringify({
      object: "response",
      status: "completed",
      model: "gpt-5.6-luna",
      output: [{ type: "message", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ recommended_taxon_name: "unknown", recommended_rank: "lifeform", confidence_band: "low" }) }] }],
      usage: { input_tokens: 41, output_tokens: 19, total_tokens: 60 },
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const responsePayload = buildCloudflareResponsesPayload(CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL, parts, 8192);
    assert.deepEqual((responsePayload.input[0]?.content as Array<{ type: string }>).map((part) => part.type), ["input_image", "input_image", "input_image", "input_text"]);
    assert.equal(responsePayload.text.format.strict, false);
    const universalPayload = buildCloudflareAiRunPayload(CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL, parts, 8192);
    assert.equal(universalPayload.model, CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL);
    assert.deepEqual((universalPayload.input.input[0]?.content as Array<{ type: string }>).map((part) => part.type), ["input_image", "input_image", "input_image", "input_text"]);
    assert.equal(universalPayload.input.text.format.strict, false);
    const responseResult = await generateWithCloudflareAiRest({ model: CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL, parts });
    assert.equal(responseResult.inputTokens, 41);
    assert.equal(responseResult.outputTokens, 19);
    assert.equal(responseResult.responseField, "output[0].content[0].text");
    assert.equal(responseResult.providerResultMeta.response_shape, "responses");

    globalThis.fetch = (async (input, init) => {
      requestCount += 1;
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response(JSON.stringify({
        result: {
          object: "response",
          status: "completed",
          model: "gpt-5.6-luna",
          output: [{ type: "message", status: "completed", content: [{ type: "output_text", text: JSON.stringify({ recommended_taxon_name: "unknown", recommended_rank: "lifeform", confidence_band: "low" }) }] }],
          usage: { input_tokens: 41, output_tokens: 19, total_tokens: 60 },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const runResult = await generateWithCloudflareAiRun({ model: CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL, parts });
    assert.equal(requestCount, 2);
    assert.equal(requestUrl, "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/ai/run");
    assert.equal(requestHeaders.get("cf-aig-gateway-id"), "zukan-existing-gateway");
    assert.equal(requestBody.model, CLOUDFLARE_OPENAI_GPT_5_6_LUNA_MODEL);
    assert.deepEqual((requestBody.input as { input: Array<{ content: Array<{ type: string }> }> }).input[0]?.content.map((part) => part.type), ["input_image", "input_image", "input_image", "input_text"]);
    assert.equal(runResult.inputTokens, 41);
    assert.equal(runResult.outputTokens, 19);
    assert.equal(runResult.responseField, "output[0].content[0].text");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
    if (previousToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = previousToken;
    if (previousGatewayId === undefined) delete process.env.CLOUDFLARE_AI_GATEWAY_ID;
    else process.env.CLOUDFLARE_AI_GATEWAY_ID = previousGatewayId;
  }
});

test("Cloudflare benchmark requests require an explicit existing named gateway", () => {
  assert.deepEqual(
    buildCloudflareAiRequestHeaders({ CLOUDFLARE_AI_GATEWAY_ID: "zukan-existing-gateway" }, true),
    { "cf-aig-gateway-id": "zukan-existing-gateway" },
  );
  assert.throws(
    () => buildCloudflareAiRequestHeaders({}, true),
    /zukan_bench_cloudflare_existing_gateway_required/u,
  );
  assert.throws(
    () => buildCloudflareAiRequestHeaders({ CLOUDFLARE_AI_GATEWAY_ID: "default" }, true),
    /cloudflare_ai_gateway_default_disallowed/u,
  );
});

test("official REST model call performs exactly one native request and reads provider usage", async () => {
  const originalFetch = globalThis.fetch;
  const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  let requestCount = 0;
  let requestUrl = "";
  let requestBody = "";
  globalThis.fetch = (async (input, init) => {
    requestCount += 1;
    requestUrl = String(input);
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({
      success: true,
      result: {
        response: "{\"recommended_taxon_name\":\"unknown\"}",
        usage: { prompt_tokens: 11, completion_tokens: 7 },
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  process.env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  try {
    const result = await generateWithCloudflareOfficialRest({
      model: "@cf/zai-org/glm-5.3-flash",
      parts: [{ type: "image_url", image_url: { url: "data:image/webp;base64,AAA" } }, { type: "text", text: "prompt" }],
    });
    assert.equal(requestCount, 1);
    assert.equal(requestUrl, "https://api.cloudflare.com/client/v4/accounts/" + "0".repeat(32) + "/ai/run/@cf/zai-org/glm-5.3-flash");
    assert.deepEqual(JSON.parse(requestBody).messages[0].content.map((part: { type: string }) => part.type), ["image_url", "text"]);
    assert.equal(result.inputTokens, 11);
    assert.equal(result.outputTokens, 7);
    assert.equal(result.usageReported, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
    if (previousToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = previousToken;
  }
});

test("official REST parser accepts nested reasoning content and structured text content", async () => {
  const originalFetch = globalThis.fetch;
  const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    result: {
      choices: [{
        message: { content: { type: "text", text: "{}" }, reasoning_content: "internal reasoning" },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 13, completion_tokens: 9 },
    },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  process.env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  try {
    const result = await generateWithCloudflareOfficialRest({
      model: "@cf/zai-org/glm-5.3-flash",
      parts: [{ type: "text", text: "prompt" }],
    });
    assert.equal(result.inputTokens, 13);
    assert.equal(result.outputTokens, 9);
    assert.equal(result.usageReported, true);
    assert.equal(result.responseField, "result.choices[0].message.content");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
    if (previousToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = previousToken;
  }
});

test("official REST parser falls back to nested reasoning content when final content is empty", async () => {
  const originalFetch = globalThis.fetch;
  const previousAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const previousToken = process.env.CLOUDFLARE_API_TOKEN;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    result: {
      choices: [{ message: { content: "", reasoning_content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 5, completion_tokens: 3 },
    },
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  process.env.CLOUDFLARE_ACCOUNT_ID = "0".repeat(32);
  process.env.CLOUDFLARE_API_TOKEN = "test-token";
  try {
    const result = await generateWithCloudflareOfficialRest({
      model: "@cf/zai-org/glm-5.3-flash",
      parts: [{ type: "text", text: "prompt" }],
    });
    assert.equal(result.responseField, "result.choices[0].message.reasoning_content");
    assert.equal(result.usageReported, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousAccountId === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID;
    else process.env.CLOUDFLARE_ACCOUNT_ID = previousAccountId;
    if (previousToken === undefined) delete process.env.CLOUDFLARE_API_TOKEN;
    else process.env.CLOUDFLARE_API_TOKEN = previousToken;
  }
});

test("fixture selection can isolate the requested canary without changing manifest order", () => {
  const manifest = {
    fixtures: [
      { ...baseFixture, fixtureId: "a", visitId: "record-a" },
      { ...baseFixture, fixtureId: "b", visitId: "record-b" },
      { ...baseFixture, fixtureId: "c", visitId: "record-c" },
    ],
  } as Parameters<typeof selectZukanBenchFixtures>[0];
  assert.deepEqual(selectZukanBenchFixtures(manifest, { fixtureVisitIds: ["record-b"] }).map((fixture) => fixture.visitId), ["record-b"]);
  assert.deepEqual(selectZukanBenchFixtures(manifest).map((fixture) => fixture.visitId), ["record-a", "record-b", "record-c"]);
});

test("final output record keeps final content and parsed fields while omitting reasoning-only content", () => {
  const raw = response("Anax nigrofasciatus") .replace(/\}\s*$/u, ',"diagnostic_features_observed":["翅脈"],"extra_final_field":"kept"}');
  const record = buildZukanBenchFinalOutputRecord({
    fixture: baseFixture,
    rawText: raw,
    responseField: "result.choices[0].message.content",
    finishReason: "stop",
    latencyMs: 123,
    inputTokens: 10,
    outputTokens: 20,
    usageReported: true,
    model: "@cf/zai-org/glm-5.3-flash",
    provider: "cloudflare-workers-ai",
    config: {
      transport: "cloudflare-official-rest",
      temperature: 0,
      max_completion_tokens: 8192,
      reasoning_effort: "low",
      stream: false,
      modalities: "omitted",
      response_format: { type: "json_object" },
      output_schema: "zukan-model-bench-parser-v1",
      attempts_per_model: 1,
      fallback_count: 0,
    },
    datasetSha256: "d".repeat(64),
    promptSha256: "p".repeat(64),
  });
  assert.equal(record.raw_final_content, raw);
  assert.equal(record.parsed_json?.extra_final_field, "kept");
  assert.deepEqual(record.observed_features, { diagnostic_features_observed: ["翅脈"] });
  assert.equal(record.finish_reason, "stop");
  assert.deepEqual(record.token_usage, { input_tokens: 10, output_tokens: 20 });
  assert.equal(record.internal_reasoning_saved, false);

  const reasoningOnly = buildZukanBenchFinalOutputRecord({
    fixture: baseFixture,
    rawText: "{\"recommended_taxon_name\":\"hidden\"}",
    responseField: "result.choices[0].message.reasoning_content",
    usageReported: true,
    model: "@cf/zai-org/glm-5.3-flash",
    provider: "cloudflare-workers-ai",
    config: record.config,
    datasetSha256: "d".repeat(64),
    promptSha256: "p".repeat(64),
  });
  assert.equal(reasoningOnly.raw_final_content, null);
  assert.equal(reasoningOnly.parsed_json, null);
  assert.equal(reasoningOnly.internal_reasoning_saved, false);
});

test("observation-first gallery photos are extracted without related records", () => {
  const html = `
    <figure class="of-media-slide" id="record-media-1"><img src="/photo-a.webp" alt="写真 1"></figure>
    <figure class="of-media-slide" id="record-media-2"><img src="/photo-b.webp" alt="写真 2"></figure>
    <section class="of-related"><img src="/related.webp"></section>`;
  assert.deepEqual(extractOrderedPostPhotoUrls(html), ["/photo-a.webp", "/photo-b.webp"]);
});

test("single-photo post falls back to preview image", () => {
  const html = `<img src="/display.webp" data-obs-full-src="/original.jpg" data-obs-preview-img />`;
  assert.deepEqual(extractOrderedPostPhotoUrls(html), ["/original.jpg"]);
});

test("human consensus is not confused with unidentified state", () => {
  assert.equal(detailHasHumanConsensus("community_consensus"), true);
  assert.equal(detailHasHumanConsensus("同定ルールにより同定されています"), true);
  assert.equal(detailHasHumanConsensus("未同定 同定されていません"), false);
});

test("one post with multiple images receives one full taxon score", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("Anax nigrofasciatus"));
  assert.equal(score.imageCount, 2);
  assert.equal(score.schemaValid, true);
  assert.equal(score.taxonScore, 1);
  assert.deepEqual(score.criticalFailures, []);
});

test("public label without human consensus is not automatic gold", () => {
  const score = scoreZukanBenchResponse(
    { ...baseFixture, gold: { ...baseFixture.gold, status: "public_label" } },
    response("クロスジギンヤンマ", "high"),
  );
  assert.equal(score.taxonScore, null);
});

test("high-confidence wrong species is a post-level critical failure", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("Anax parthenope", "high"));
  assert.ok(score.criticalFailures.includes("high_confidence_wrong_species"));
});

test("specific location assertion is critical when location is hidden", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("クロスジギンヤンマ", "medium", "species", "浜松市で撮影された個体と考えられる"));
  assert.ok(score.criticalFailures.includes("location_hallucination"));
});

function report(model: string, goldPostCount: number): ZukanBenchModelReport {
  return {
    version: "zukan-post-model-bench-v2",
    promptVersion: "observation-reassess-post-cold-start-v2",
    promptSha256: "p".repeat(64),
    model,
    provider: "test",
    manifestPath: "manifest.external.json",
    datasetSha256: "d".repeat(64),
    startedAt: "2026-08-27T00:00:00Z",
    completedAt: "2026-08-27T00:01:00Z",
    postCount: 24,
    imageCount: 48,
    successCount: 24,
    modelRequestCount: 24,
    successRatePct: 100,
    schemaValidRatePct: 100,
    goldPostCount,
    taxonScorePct: 95,
    criticalFailurePostCount: 0,
    highConfidenceWrongPostCount: 0,
    overprecisionPostCount: 0,
    locationHallucinationPostCount: 0,
    p50LatencyMs: 100,
    p95LatencyMs: 200,
    totalInputTokens: 1,
    totalOutputTokens: 1,
    estimatedCostUsd: 0.1,
    pricing: null,
    fixtureScores: [],
  };
}

test("automatic switching is refused without enough human gold posts", () => {
  const tooFew = ZUKAN_BENCH_MIN_GOLD_POSTS - 1;
  const comparison = compareZukanBenchReports([report("baseline", tooFew), report("challenger", tooFew)]);
  assert.equal(comparison.decision, "INSUFFICIENT_GOLD");
  assert.equal(comparison.finalVerdict, "INSUFFICIENT_GOLD");
});

test("current Gemini and GLM pair exposes the governed final verdict", () => {
  const comparison = compareZukanBenchReports([
    report("gemini-3.5-flash-lite", 8),
    report("@cf/zai-org/glm-5.3-flash", 8),
  ]);
  assert.equal(comparison.finalVerdict, "KEEP_GEMINI");
});

test("an invalid baseline is never treated as approved", () => {
  const baseline = { ...report("baseline", 8), successCount: 23, successRatePct: 95.83 };
  const challenger = { ...report("challenger", 8), schemaValidRatePct: 95 };
  const comparison = compareZukanBenchReports([baseline, challenger]);
  assert.equal(comparison.decision, "BASELINE_INVALID");
  assert.equal(comparison.winnerModel, "");
});
