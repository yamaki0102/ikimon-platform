import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("photo upload, queue, cron, Gemini Batch, and review target form one durable reassessment path", async () => {
  const [source, dualWrite, geminiBatch, qualityBacklog, wrangler] = await Promise.all([
    readFile(new URL("./index.ts", import.meta.url), "utf8"),
    readFile(new URL("./cloudflareObservationAiDualWrite.ts", import.meta.url), "utf8"),
    readFile(new URL("./geminiObservationBatch.ts", import.meta.url), "utf8"),
    readFile(new URL("./observationAiQualityBacklog.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  ]);
  const runtime = `${source}\n${dualWrite}\n${geminiBatch}\n${qualityBacklog}`;

  assert.match(source, /"observation\.reassess"/);
  assert.match(source, /runScheduledObservationReassessments/);
  assert.match(source, /env\.GEMINI_API_KEY/);
  assert.match(source, /submitGeminiObservationReassessmentGroups/);
  assert.match(source, /resumeGeminiObservationBatchGroups/);
  assert.match(runtime, /gemini-3\.5-flash-lite/);
  assert.match(runtime, /gemini-3\.1-flash-lite/);
  assert.match(runtime, /batchGenerateContent/);
  assert.doesNotMatch(runtime, /@cf\/moondream/);
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
  assert.match(source, /imageBytesToBase64\(transformed\)/);
  assert.match(runtime, /buildGeminiPrimaryRequest/);
  assert.match(runtime, /buildGeminiCensusRequest/);
  assert.match(runtime, /buildGeminiEnvironmentRequest/);
  assert.match(runtime, /buildGeminiSpecialistRequest/);
  assert.match(runtime, /buildGeminiSummaryRequest/);
  assert.match(source, /if \(!decision\?\.required\) continue/);
  assert.match(source, /ensureGeminiBatch\(\s*env\.GEMINI_API_KEY,\s*GEMINI_SPECIALIST_MODEL/);
  assert.match(source, /specialistDisplayName: geminiBatchDisplayName\(claimId, "specialist"\)/);
  assert.match(source, /asset\.public_derivative_key/);
  assert.match(source, /trim:\s*\{\s*top,/);
  assert.match(source, /specialist-crop-v1/);
  assert.match(source, /specialistStatus: selection \? "pending" : "skipped"/);
  assert.match(source, /geminiBatchTerminalFailure\(specialist\)/);
  assert.match(runtime, /generationConfig\([^\n]+, 2048,/);
  assert.match(source, /humanReviewRequired: true/);
  assert.match(source, /latest_public_record_ai_upgrade_v3/);
  assert.match(source, /await recentPublicRecordCards\(env, 120\)[\s\S]+Boolean\(item\.photoUrl\)[\s\S]+\.slice\(0, 30\)/);
  assert.match(source, /FROM observations o\s+LEFT JOIN observation_reassessment_requests/);
  assert.match(source, /reason: "missing_reassessment_request"/);
  assert.match(source, /ON CONFLICT\(observation_id, request_kind, actor_user_id\) DO NOTHING/);
  assert.match(source, /public_record_ai_quality_backlog_v3/);
  assert.match(qualityBacklog, /GEMINI_QUALITY_BACKLOG_MAX_ACTIVE = 40/);
  assert.match(qualityBacklog, /GEMINI_QUALITY_BACKLOG_MAX_REQUEUE_PER_TICK = 10/);
  assert.match(qualityBacklog, /candidate_rank IN \('class', 'order', 'lifeform', 'unknown'\)/);
  assert.match(qualityBacklog, /json_valid\(rr\.source_payload_json\)[\s\S]+json_extract\(rr\.source_payload_json, '\$\.ruleVersion'\)[\s\S]+\) <> \?/);
  assert.match(qualityBacklog, /EXISTS \(\s*SELECT 1 FROM asset_ledger/);
  assert.match(source, /WHERE request_id = \? AND request_state IN \('completed', 'failed'\) AND source_payload_json = \?/);
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
