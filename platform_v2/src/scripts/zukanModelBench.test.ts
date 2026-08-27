import assert from "node:assert/strict";
import test from "node:test";
import {
  ZUKAN_BENCH_CORE_POST_COUNT,
  ZUKAN_BENCH_MIN_GOLD_POSTS,
  ZUKAN_BENCH_SMOKE_POST_COUNT,
  compareZukanBenchReports,
  detailHasHumanConsensus,
  extractOrderedPostPhotoUrls,
  buildCloudflareOfficialRestPayload,
  generateWithCloudflareOfficialRest,
  rightsVettedTargetsFromResearchPayload,
  scoreZukanBenchResponse,
  selectDeterministicPostTargets,
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
  assert.equal(payload.max_completion_tokens, 4096);
  assert.equal("max_tokens" in payload, false);
  assert.equal(payload.reasoning_effort, "low");
  assert.equal(payload.stream, false);
  assert.deepEqual(payload.response_format, { type: "json_object" });
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
  assert.equal(compareZukanBenchReports([report("baseline", tooFew), report("challenger", tooFew)]).decision, "INSUFFICIENT_GOLD");
});

test("an invalid baseline is never treated as approved", () => {
  const baseline = { ...report("baseline", 8), successCount: 23, successRatePct: 95.83 };
  const challenger = { ...report("challenger", 8), schemaValidRatePct: 95 };
  const comparison = compareZukanBenchReports([baseline, challenger]);
  assert.equal(comparison.decision, "BASELINE_INVALID");
  assert.equal(comparison.winnerModel, "");
});
