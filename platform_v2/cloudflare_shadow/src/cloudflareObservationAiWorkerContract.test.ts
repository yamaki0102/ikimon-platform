import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("photo upload, queue, cron, Workers AI, and review target form one durable reassessment path", async () => {
  const [source, dualWrite, wrangler] = await Promise.all([
    readFile(new URL("./index.ts", import.meta.url), "utf8"),
    readFile(new URL("./cloudflareObservationAiDualWrite.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);
  const runtime = `${source}\n${dualWrite}`;

  assert.match(source, /"observation\.reassess"/);
  assert.match(source, /runScheduledObservationReassessments/);
  assert.match(source, /env\.AI\.run\(OBSERVATION_VISION_MODEL/);
  assert.match(source, /INSERT INTO observation_ai_review_targets/);
  assert.match(runtime, /INSERT INTO record_observations/);
  assert.match(runtime, /INSERT INTO record_observation_media/);
  assert.match(runtime, /INSERT INTO observation_ai_suggestions/);
  assert.match(runtime, /INSERT INTO record_observation_consistency_ledger/);
  assert.match(runtime, /observationAiSubjects\(input\.candidate\)/);
  assert.match(runtime, /origin[\s\S]*assertion_status[\s\S]*'ai', 'provisional'/);
  assert.match(runtime, /verification_status[\s\S]*'unreviewed'/);
  assert.match(runtime, /data_use_scope[\s\S]*'personal_only'/);
  assert.match(runtime, /accepted_identification_id[\s\S]*NULL/);
  assert.doesNotMatch(runtime, /INSERT INTO occurrence_projection_versions[\s\S]{0,500}projection_status[^\n]*'active'/);
  assert.match(source, /request_state = 'completed'/);
  assert.match(source, /request_state IN \('pending', 'failed'\)/);
  assert.match(source, /attemptCount/);
  assert.match(source, /imageBytesToDataUri\(transformed, "image\/webp"\)/);
  assert.match(source, /task: "query"/);
  assert.match(source, /question: observationAiQuestion\(\)/);
  assert.match(source, /response\.result/);
  assert.match(source, /humanReviewRequired: true/);
  assert.match(source, /OBSERVATION_DUAL_WRITE_MODE \?\? "off"/);
  assert.equal((wrangler.match(/"binding": "AI"/g) ?? []).length, 4);
  assert.equal((wrangler.match(/"OBSERVATION_DUAL_WRITE_MODE": "off"/g) ?? []).length, 2);
  assert.equal((wrangler.match(/"OBSERVATION_DUAL_WRITE_MODE": "on"/g) ?? []).length, 2);
  assert.equal((wrangler.match(/"OBSERVATION_READ_CUTOVER_MODE": "off"/g) ?? []).length, 2);
  assert.equal((wrangler.match(/"OBSERVATION_READ_CUTOVER_MODE": "on"/g) ?? []).length, 2);

  const envStart = wrangler.indexOf('"env": {');
  const shadowStart = wrangler.indexOf('"shadow": {', envStart);
  const stagingStart = wrangler.indexOf('"staging": {', shadowStart);
  const productionStart = wrangler.indexOf('"production": {', stagingStart);
  assert.ok(envStart >= 0 && shadowStart > envStart && stagingStart > shadowStart && productionStart > stagingStart);
  const environmentBlocks = {
    shadow: wrangler.slice(shadowStart, stagingStart),
    staging: wrangler.slice(stagingStart, productionStart),
    production: wrangler.slice(productionStart),
  };
  for (const flag of ["OBSERVATION_DUAL_WRITE_MODE", "OBSERVATION_READ_CUTOVER_MODE"]) {
    assert.match(environmentBlocks.shadow, new RegExp(`"${flag}": "off"`));
    assert.match(environmentBlocks.staging, new RegExp(`"${flag}": "on"`));
    assert.match(environmentBlocks.production, new RegExp(`"${flag}": "on"`));
  }
});
