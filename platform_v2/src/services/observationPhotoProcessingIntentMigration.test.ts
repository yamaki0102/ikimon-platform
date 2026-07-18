import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const migration = readFileSync(
  path.join(process.cwd(), "db/migrations/0132_atomic_observation_photo_processing_intent.sql"),
  "utf8",
);

test("photo asset migration persists processing intent in the same PostgreSQL transaction", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION enqueue_observation_photo_processing_intent/);
  assert.match(migration, /AFTER INSERT OR UPDATE OF/);
  assert.match(migration, /ON evidence_assets/);
  assert.match(migration, /WHEN \(NEW\.asset_role = 'observation_photo'\)/);
  assert.match(migration, /INSERT INTO media_processing_jobs/);
  assert.match(migration, /'photo_ready_reassess'/);
  assert.match(migration, /'pending'/);
  assert.match(migration, /'transactional_intent', true/);
  assert.match(migration, /ON CONFLICT DO NOTHING/);
});

test("photo processing trigger does not backfill or execute a provider call", () => {
  assert.doesNotMatch(migration, /INSERT INTO media_processing_jobs[\s\S]*SELECT[\s\S]*FROM evidence_assets/i);
  assert.doesNotMatch(migration, /http|fetch|gemini|vertex|openai/i);
});
