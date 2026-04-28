import assert from "node:assert/strict";
import test from "node:test";
import { assertNoSecretLeak, dedupeInvasiveRows, validateInvasiveLawRows } from "./curatorTrustBoundary.js";

test("trust boundary rejects exact secret and sk-like token patterns", () => {
  assert.throws(() => assertNoSecretLeak("payload abc-secret", ["abc-secret"]), /curator_payload_secret_leak_detected/);
  assert.throws(() => assertNoSecretLeak("payload sk-abcdefghijklmnopqrstuvwxyz", []), /curator_payload_secret_pattern_detected/);
});

test("invasive-law row validator accepts only schema-safe rows", () => {
  const result = validateInvasiveLawRows([
    {
      scientific_name: "Solenopsis invicta",
      vernacular_jp: "ヒアリ",
      mhlw_category: "iaspecified",
      source_excerpt: "ヒアリ Solenopsis invicta",
    },
    { scientific_name: "bad", mhlw_category: "iaspecified", source_excerpt: "bad" },
    { scientific_name: "Linepithema humile", mhlw_category: "bad", source_excerpt: "bad" },
    { scientific_name: "Myocastor coypus", mhlw_category: "priority", source_excerpt: "x".repeat(601) },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.dropped.length, 3);
});

test("invasive-law dedupe uses scientific name plus category", () => {
  const rows = dedupeInvasiveRows([
    {
      scientific_name: "Solenopsis invicta",
      mhlw_category: "iaspecified",
      source_excerpt: "a",
    },
    {
      scientific_name: "Solenopsis invicta",
      mhlw_category: "iaspecified",
      source_excerpt: "b",
    },
    {
      scientific_name: "Solenopsis invicta",
      mhlw_category: "priority",
      source_excerpt: "c",
    },
  ]);
  assert.equal(rows.length, 2);
});
