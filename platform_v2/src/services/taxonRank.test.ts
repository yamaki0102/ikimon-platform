import { test } from "node:test";
import assert from "node:assert/strict";
import { isRankAtOrFinerThan, normalizeRank, rankFromUnknown, rankOrder } from "./taxonRank.js";

test("normalizeRank recognises canonical rank strings", () => {
  assert.equal(normalizeRank("genus"), "genus");
  assert.equal(normalizeRank("GENUS"), "genus");
  assert.equal(normalizeRank(" Species "), "species");
});

test("normalizeRank maps common aliases", () => {
  assert.equal(normalizeRank("sp."), "species");
  assert.equal(normalizeRank("ssp."), "subspecies");
  assert.equal(normalizeRank("subsp."), "subspecies");
  assert.equal(normalizeRank("species_complex"), "species_group");
  assert.equal(normalizeRank("section"), "species_group");
});

test("normalizeRank returns null for unknown and empty", () => {
  assert.equal(normalizeRank(null), null);
  assert.equal(normalizeRank(""), null);
  assert.equal(normalizeRank("not-a-rank"), null);
});

test("rankFromUnknown defaults to species for safety", () => {
  assert.equal(rankFromUnknown(null), "species");
  assert.equal(rankFromUnknown("unknown-rank"), "species");
  assert.equal(rankFromUnknown("genus"), "genus");
});

test("rankOrder is monotonically increasing from coarse to fine", () => {
  assert.ok(rankOrder("kingdom") < rankOrder("family"));
  assert.ok(rankOrder("family") < rankOrder("genus"));
  assert.ok(rankOrder("genus") < rankOrder("species"));
  assert.ok(rankOrder("species") < rankOrder("subspecies"));
});

test("isRankAtOrFinerThan enforces the scope gate", () => {
  assert.equal(isRankAtOrFinerThan("species", "genus"), true);
  assert.equal(isRankAtOrFinerThan("genus", "genus"), true);
  assert.equal(isRankAtOrFinerThan("subspecies", "species"), true);
  assert.equal(isRankAtOrFinerThan("family", "genus"), false);
  assert.equal(isRankAtOrFinerThan("kingdom", "species"), false);
});
