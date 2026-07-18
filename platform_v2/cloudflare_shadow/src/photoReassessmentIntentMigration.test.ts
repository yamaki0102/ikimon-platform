import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = readFileSync(
  path.join(process.cwd(), "migrations/observations/0055_atomic_photo_reassessment_intent.sql"),
  "utf8",
);

test("D1 photo ledger trigger atomically records an idempotent reassessment request", () => {
  assert.match(migration, /CREATE TRIGGER trg_asset_photo_reassessment_insert/);
  assert.match(migration, /CREATE TRIGGER trg_asset_photo_reassessment_update/);
  assert.match(migration, /AFTER INSERT ON asset_ledger/);
  assert.match(migration, /AFTER UPDATE OF[\s\S]*ON asset_ledger/);
  assert.match(migration, /NEW\.processing_state = 'uploaded'/);
  assert.match(migration, /lower\(NEW\.mime\) LIKE 'image\/%'/);
  assert.match(migration, /INSERT INTO observation_reassessment_requests/);
  assert.match(migration, /'standard'/);
  assert.match(migration, /'pending'/);
  assert.match(migration, /ON CONFLICT\(observation_id, request_kind, actor_user_id\) DO UPDATE SET/);
  assert.match(migration, /'transactionalIntent', 1/);
});

test("D1 trigger does not pretend to execute or complete AI analysis", () => {
  assert.doesNotMatch(migration, /request_state\s*=\s*'completed'/i);
  assert.doesNotMatch(migration, /fetch|http|gemini|vertex|openai/i);
});
