import assert from "node:assert/strict";
import test from "node:test";
import { inferSafePublicRank } from "./observationPackage.js";

test("inferSafePublicRank coarsens high-risk species until scoped review", () => {
  assert.equal(inferSafePublicRank({ taxonRank: "species", evidenceTier: 1, riskLane: "rare" }), "genus");
  assert.equal(inferSafePublicRank({ taxonRank: "species", evidenceTier: 3, riskLane: "rare" }), "species");
});

test("inferSafePublicRank keeps coarse and normal reviewed states", () => {
  assert.equal(inferSafePublicRank({ taxonRank: "genus", evidenceTier: 1, riskLane: "normal" }), "genus");
  assert.equal(inferSafePublicRank({ taxonRank: "species", evidenceTier: 2, riskLane: "normal" }), "species");
  assert.equal(inferSafePublicRank({ taxonRank: null, evidenceTier: null, riskLane: "normal" }), "unknown");
});
