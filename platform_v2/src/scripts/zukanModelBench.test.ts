import assert from "node:assert/strict";
import test from "node:test";
import {
  compareZukanBenchReports,
  detailHasHumanConsensus,
  scoreZukanBenchResponse,
  type ZukanBenchFixture,
  type ZukanBenchModelReport,
} from "./zukanModelBench.js";

const baseFixture: ZukanBenchFixture = {
  fixtureId: "zukan-public-001",
  visitId: "record-1",
  occurrenceId: "occ:record-1:0",
  detailPath: "/observations/1",
  observedAt: "2026-08-01T00:00:00Z",
  imageUrl: "https://zukan.earth/example.webp",
  imageSha256: "a".repeat(64),
  imageBytes: 1024,
  imageMimeType: "image/webp",
  gold: { label: "クロスジギンヤンマ", aliases: ["Anax nigrofasciatus"], rank: "species", status: "human_consensus" },
};

function response(name: string, confidence = "medium", geography = "位置情報が未取得のため評価保留"): string {
  return JSON.stringify({
    recommended_taxon_name: name,
    recommended_rank: "species",
    confidence_band: confidence,
    taxonomic_candidates: [],
    geographic_context: geography,
  });
}

test("human consensus is not confused with unidentified state", () => {
  assert.equal(detailHasHumanConsensus("community_consensus"), true);
  assert.equal(detailHasHumanConsensus("同定済"), true);
  assert.equal(detailHasHumanConsensus("未同定"), false);
});

test("exact human-gold prediction gets full score", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("Anax nigrofasciatus"));
  assert.equal(score.schemaValid, true);
  assert.equal(score.taxonScore, 1);
  assert.deepEqual(score.criticalFailures, []);
});

test("public label without human consensus is not automatic gold", () => {
  const score = scoreZukanBenchResponse(
    { ...baseFixture, gold: { ...baseFixture.gold, status: "public_label" } },
    response("クロスジギンヤンマ", "high", "位置情報は不明"),
  );
  assert.equal(score.taxonScore, null);
});

test("high-confidence wrong species is a critical failure", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("Anax parthenope", "high"));
  assert.ok(score.criticalFailures.includes("high_confidence_wrong_species"));
});

test("specific location assertion is a critical failure when location is hidden", () => {
  const score = scoreZukanBenchResponse(baseFixture, response("クロスジギンヤンマ", "medium", "浜松市で撮影された個体と考えられる"));
  assert.ok(score.criticalFailures.includes("location_hallucination"));
});

function report(model: string, goldFixtureCount: number): ZukanBenchModelReport {
  return {
    version: "zukan-model-bench-v1",
    promptVersion: "observation-reassess-cold-start-v1",
    promptSha256: "p".repeat(64),
    model,
    provider: "test",
    manifestPath: "manifest.json",
    datasetSha256: "d".repeat(64),
    startedAt: "2026-08-27T00:00:00Z",
    completedAt: "2026-08-27T00:01:00Z",
    fixtureCount: 80,
    successCount: 80,
    schemaValidRatePct: 100,
    goldFixtureCount,
    taxonScorePct: 95,
    criticalFailureFixtureCount: 0,
    p50LatencyMs: 100,
    p95LatencyMs: 200,
    totalInputTokens: 1,
    totalOutputTokens: 1,
    estimatedCostUsd: 0.1,
    pricing: null,
    fixtureScores: [],
  };
}

test("automatic switching is refused without enough human gold", () => {
  assert.equal(compareZukanBenchReports([report("baseline", 8), report("challenger", 8)]).decision, "INSUFFICIENT_GOLD");
});
