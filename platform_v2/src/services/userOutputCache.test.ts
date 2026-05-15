import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildCacheKey } from "./userOutputCache.js";

test("cache persistence columns accept legacy observation ids", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "db", "migrations", "0107_text_ids_for_ai_hot_cache.sql"),
    "utf8",
  );

  assert.match(migration, /ALTER TABLE user_output_cache[\s\S]*visit_id TYPE TEXT[\s\S]*occurrence_id TYPE TEXT/);
  assert.match(migration, /ALTER TABLE ai_cost_log[\s\S]*visit_id TYPE TEXT[\s\S]*occurrence_id TYPE TEXT/);
  assert.doesNotMatch(migration, /visit_id TYPE UUID|occurrence_id TYPE UUID/);
});

test("cache keys stay stable for legacy ids and asset ordering", () => {
  const input = {
    outputKind: "observation_reassess",
    promptVersion: "observation_reassess/v2026-05-15",
    userId: "user-legacy",
    visitId: "record-1778818427350",
    occurrenceId: "occ:record-1778818427350:0",
    assetBlobIds: ["blob-b", "blob-a"],
    knowledgeVersionSet: { checklist: "v1" },
  };

  assert.equal(buildCacheKey(input), buildCacheKey({ ...input, assetBlobIds: ["blob-a", "blob-b"] }));
  assert.notEqual(buildCacheKey(input), buildCacheKey({ ...input, occurrenceId: "occ:record-1778818427350:1" }));
});
