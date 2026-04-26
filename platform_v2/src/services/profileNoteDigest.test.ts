import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateProfileDigestCostUsd,
  estimateProfileDigestTokenCount,
} from "./profileNoteDigest.js";

test("profile note digest DeepSeek budget fits 10k posts under 1000 JPY", () => {
  const perPostUsd = estimateProfileDigestCostUsd(2000, 300);
  const tenThousandPostsJpy = perPostUsd * 10_000 * 150;

  assert.equal(perPostUsd, 0.000364);
  assert.ok(tenThousandPostsJpy < 1000, `expected < 1000 JPY, got ${tenThousandPostsJpy}`);
});

test("profile note digest token estimate is conservative for Japanese text", () => {
  assert.ok(estimateProfileDigestTokenCount("地域のノートが少し厚くなった") >= 5);
  assert.ok(estimateProfileDigestTokenCount("a".repeat(6000)) <= 2000);
});
