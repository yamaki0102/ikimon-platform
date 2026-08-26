import assert from "node:assert/strict";
import test from "node:test";
import {
  detailHasHumanConsensus,
  scoreZukanBenchResponse,
  type ZukanBenchFixture,
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

test("human consensus is not confused with unidentified state", () => {
  assert.equal(detailHasHumanConsensus("community_consensus"), true);
  assert.equal(detailHasHumanConsensus("同定済"), true);
  assert.equal(detailHasHumanConsensus("未同定"), false);
});

test("exact human-gold prediction gets full score", () => {
  const score = scoreZukanBenchResponse(baseFixture, JSON.stringify({
    recommended_taxon_name: "Anax nigrofasciatus",
    recommended_rank: "species",
    confidence_band: "medium",
    taxonomic_candidates: [],
    geographic_context: "位置情報が未取得のため評価保留",
  }));
  assert.equal(score.schemaValid, true);
  assert.equal(score.taxonScore, 1);
  assert.deepEqual(score.criticalFailures, []);
});

test("public label without human consensus is not gold", () => {
  const score = scoreZukanBenchResponse({ ...baseFixture, gold: { ...baseFixture.gold, status: "public_label" } }, JSON.stringify({
    recommended_taxon_name: "クロスジギンヤンマ",
    recommended_rank: "species",
    confidence_band: "high",
    taxonomic_candidates: [],
    geographic_context: "位置情報は不明",
  }));
  assert.equal(score.taxonScore, null);
});
