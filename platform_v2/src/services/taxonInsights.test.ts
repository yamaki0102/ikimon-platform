import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./taxonInsights.ts", import.meta.url), "utf8");

test("taxon insight generation requires a Latin scientific name", () => {
  assert.match(source, /function looksLikeScientificName\(value: string\)/);
  assert.match(source, /const sn = looksLikeScientificName\(opts\.scientificName\) \? opts\.scientificName\.trim\(\) : "";/);
  assert.match(source, /const cacheKey = sn \|\| vn;/);
  assert.match(source, /if \(!sn\) return empty\(sn, vn\);[\s\S]*\/\/ cacheOnly:/);
  assert.match(source, /fireBackgroundInsightGeneration\(fire\);/);
});
