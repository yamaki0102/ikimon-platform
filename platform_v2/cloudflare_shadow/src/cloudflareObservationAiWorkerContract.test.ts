import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("photo upload, queue, cron, Workers AI, and review target form one durable reassessment path", async () => {
  const [source, wrangler] = await Promise.all([
    readFile(new URL("./index.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);

  assert.match(source, /"observation\.reassess"/);
  assert.match(source, /runScheduledObservationReassessments/);
  assert.match(source, /env\.AI\.run\(OBSERVATION_VISION_MODEL/);
  assert.match(source, /INSERT INTO observation_ai_review_targets/);
  assert.match(source, /request_state = 'completed'/);
  assert.match(source, /request_state IN \('pending', 'failed'\)/);
  assert.match(source, /attemptCount/);
  assert.match(source, /Array\.from\(new Uint8Array\(transformed\)\)/);
  assert.match(source, /humanReviewRequired: true/);
  assert.equal((wrangler.match(/"binding": "AI"/g) ?? []).length, 4);
});
