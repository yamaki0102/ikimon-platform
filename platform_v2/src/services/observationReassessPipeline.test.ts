import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  OBSERVATION_REASSESS_CANDIDATE_ONLY_CONTRACT,
  OBSERVATION_REASSESS_DELEGATED_WRITE_TARGETS,
  OBSERVATION_REASSESS_DIRECT_SQL_WRITE_TARGETS,
  OBSERVATION_REASSESS_FORBIDDEN_WRITE_TARGETS,
  OBSERVATION_REASSESS_FORBIDDEN_PROMOTION_TARGETS,
  OBSERVATION_REASSESS_PIPELINE_STAGES,
  OBSERVATION_REASSESS_PIPELINE_VERSION,
  observationReassessPipelineWriteTargetNames,
  observationReassessPipelineStageIds,
} from "./observationReassessPipeline.js";

function extractSqlWriteTargets(source: string): string[] {
  return Array.from(new Set(
    Array.from(
      source.matchAll(/\b(?:INSERT\s+INTO\s+([a-z_]+)|UPDATE\s+(?!SET\b)([a-z_]+))/gi),
    )
      .map((match) => match[1] ?? match[2] ?? "")
      .map((target) => target.toLowerCase())
      .filter(Boolean),
  )).sort();
}

test("observation reassess pipeline contract keeps AI output candidate-only", () => {
  assert.equal(OBSERVATION_REASSESS_PIPELINE_VERSION, "observation-reassess/v2-durable");
  assert.equal(
    OBSERVATION_REASSESS_CANDIDATE_ONLY_CONTRACT,
    "observation_reassess_candidate_only_pipeline_contract",
  );
  assert.deepEqual(OBSERVATION_REASSESS_FORBIDDEN_PROMOTION_TARGETS, [
    "reviewed_occurrence",
    "public_claim",
  ]);

  const ids = observationReassessPipelineStageIds();
  assert.deepEqual(ids, [
    "load_observation_package",
    "load_feedback_knowledge",
    "prepare_visual_evidence",
    "render_prompt",
    "run_model_chain",
    "parse_taxonomic_guardrails",
    "persist_ai_run_assessment",
    "persist_candidate_materialization",
    "persist_area_inference",
    "dispatch_alerts_best_effort",
  ]);

  const modelIndex = ids.indexOf("run_model_chain");
  const candidateIndex = ids.indexOf("persist_candidate_materialization");
  const areaIndex = ids.indexOf("persist_area_inference");
  const alertIndex = ids.indexOf("dispatch_alerts_best_effort");
  assert.ok(modelIndex < candidateIndex);
  assert.ok(candidateIndex < areaIndex);
  assert.ok(areaIndex < alertIndex);

  const writes = OBSERVATION_REASSESS_PIPELINE_STAGES.flatMap((stage) => [...stage.writes]);
  const writeNames = new Set<string>(writes);
  assert.ok(writes.includes("ai_judgement_candidate_record"));
  assert.ok(writes.includes("visual_subject_candidate"));
  assert.ok(writes.includes("field_context"));
  assert.ok(writes.includes("management_action_candidate"));
  assert.equal(writeNames.has("reviewed_occurrence"), false);
  assert.equal(writeNames.has("public_claim"), false);

  const alertStage = OBSERVATION_REASSESS_PIPELINE_STAGES.find((stage) => stage.id === "dispatch_alerts_best_effort");
  assert.equal(alertStage?.bestEffort, true);
  assert.equal(alertStage?.trustBoundary, "best_effort_notification");
});

test("observation reassess service uses the shared pipeline version contract", () => {
  const source = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");

  assert.match(source, /OBSERVATION_REASSESS_PIPELINE_VERSION/);
  assert.match(source, /const PIPELINE_VERSION = OBSERVATION_REASSESS_PIPELINE_VERSION/);
  assert.doesNotMatch(source, /const PIPELINE_VERSION = "observation-reassess\/v2-durable"/);
});

test("observation_reassess_candidate_only_pipeline_contract write targets stay in the pipeline allowlist", () => {
  const reassessSource = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");
  const aiJudgementSource = readFileSync(new URL("./aiJudgementObservationRecords.ts", import.meta.url), "utf8");
  const managementActionSource = readFileSync(new URL("./managementActionConfirmation.ts", import.meta.url), "utf8");
  const alertDispatcherSource = readFileSync(new URL("./alertDispatcher.ts", import.meta.url), "utf8");
  const invasiveReportingSource = readFileSync(new URL("./invasiveReporting.ts", import.meta.url), "utf8");

  const directWriteTargets = extractSqlWriteTargets(reassessSource);
  const directWriteTargetSet = new Set<string>(directWriteTargets);
  const delegatedSourceWriteTargets = new Set<string>([
    ...extractSqlWriteTargets(aiJudgementSource),
    ...extractSqlWriteTargets(managementActionSource),
    ...extractSqlWriteTargets(alertDispatcherSource),
    ...extractSqlWriteTargets(invasiveReportingSource),
  ]);

  assert.deepEqual(directWriteTargets, [...OBSERVATION_REASSESS_DIRECT_SQL_WRITE_TARGETS].sort());

  assert.match(reassessSource, /markPrimaryOccurrenceAsAiJudgement/);
  assert.match(reassessSource, /materializeAiJudgementObservationRecord/);
  assert.match(reassessSource, /upsertAiInferredManagementActions/);
  assert.match(reassessSource, /emitAlertsForOccurrence/);
  assert.ok(extractSqlWriteTargets(aiJudgementSource).includes("occurrences"));
  assert.ok(extractSqlWriteTargets(managementActionSource).includes("stewardship_actions"));
  assert.ok(extractSqlWriteTargets(alertDispatcherSource).includes("alert_deliveries"));
  assert.ok(extractSqlWriteTargets(invasiveReportingSource).includes("invasive_reporting_events"));

  const delegatedTargets = new Set(OBSERVATION_REASSESS_DELEGATED_WRITE_TARGETS);
  assert.ok(delegatedTargets.has("occurrences"));
  assert.ok(delegatedTargets.has("stewardship_actions"));
  assert.ok(delegatedTargets.has("alert_deliveries"));
  assert.ok(delegatedTargets.has("invasive_reporting_events"));

  const allWriteTargets = new Set<string>(observationReassessPipelineWriteTargetNames());
  for (const directTarget of OBSERVATION_REASSESS_DIRECT_SQL_WRITE_TARGETS) {
    assert.ok(allWriteTargets.has(directTarget), directTarget);
  }
  for (const delegatedTarget of OBSERVATION_REASSESS_DELEGATED_WRITE_TARGETS) {
    assert.ok(allWriteTargets.has(delegatedTarget), delegatedTarget);
  }
  for (const forbiddenTarget of OBSERVATION_REASSESS_FORBIDDEN_WRITE_TARGETS) {
    assert.equal(allWriteTargets.has(forbiddenTarget), false, forbiddenTarget);
    assert.equal(directWriteTargetSet.has(forbiddenTarget), false, forbiddenTarget);
    assert.equal(delegatedSourceWriteTargets.has(forbiddenTarget), false, forbiddenTarget);
  }
});
