import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Cloudflare AI backfill only queues image records without a confirmed or existing AI target", async () => {
  const sql = await readFile(new URL("../migrations/observations/0066_cloudflare_native_observation_ai_backfill.sql", import.meta.url), "utf8");
  assert.match(sql, /COALESCE\(TRIM\(o\.taxon_label\), ''\) = ''/);
  assert.match(sql, /a\.processing_state = 'uploaded'/);
  assert.match(sql, /a\.mime LIKE 'image\/%'/);
  assert.match(sql, /NOT EXISTS[\s\S]*observation_ai_review_targets/);
  assert.match(sql, /ON CONFLICT\(observation_id, request_kind, actor_user_id\) DO NOTHING/);
});
