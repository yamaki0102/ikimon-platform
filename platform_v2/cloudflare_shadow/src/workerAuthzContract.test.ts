import assert from "node:assert/strict";
import test from "node:test";
import { readWorkerSourceSync } from "./workerSource.testSupport.js";

const workerSource = readWorkerSourceSync();

test("Place Memory remains locked until the viewer records the same cell", () => {
  assert.match(workerSource, /async function placeMemoryViewerHasCellAccessNative/);
  assert.match(workerSource, /WHERE user_id = \?[\s\S]*AND cell_id = \?[\s\S]*AND deleted_at IS NULL/);
  assert.match(workerSource, /unlocked: false, items: \[\]/);
  assert.match(workerSource, /unlocked: true, items: rows\.map/);
  assert.match(workerSource, /place_memory_not_found/);
});

test("Place Memory moderation is owner-safe and reporter-idempotent", () => {
  assert.match(workerSource, /place_memory_own_like_not_allowed/);
  assert.match(workerSource, /SELECT report_id FROM place_memory_reports WHERE entry_id = \? AND user_id = \?/);
  assert.match(workerSource, /SELECT COUNT\(DISTINCT user_id\) AS count FROM place_memory_reports WHERE entry_id = \?/);
  assert.match(workerSource, /duplicate: true/);
});

test("observation upsert refuses an existing id owned by another user", () => {
  assert.match(workerSource, /const requestedObservationId = normalizeOptionalId\(input\.observationId\)/);
  assert.match(workerSource, /SELECT owner_user_id FROM observations WHERE observation_id = \?/);
  assert.match(workerSource, /existingObservation\.owner_user_id !== input\.userId/);
  assert.match(workerSource, /return json\(\{ ok: false, error: "forbidden" \}, 403/);
});

test("authorization hardening preserves D1 rally post-save auto-match", () => {
  assert.match(workerSource, /async function autoMatchObservationToActiveRalliesNative/);
  assert.match(workerSource, /observation_auto_match/);
  assert.match(workerSource, /exact_location_stored: false/);
});
