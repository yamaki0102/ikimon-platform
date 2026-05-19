import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
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

test("profile note digest keeps contribution receipt context in the local fallback", () => {
  const source = readFileSync(path.join(process.cwd(), "src/services/profileNoteDigest.ts"), "utf8");

  assert.match(source, /観察インパクト・レシート/);
  assert.match(source, /地域・再訪・同定の手がかり/);
  assert.match(source, /immediate rereading or follow-up value/);
});
