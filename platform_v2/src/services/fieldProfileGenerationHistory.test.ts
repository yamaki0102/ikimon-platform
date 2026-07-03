import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIELD_PROFILE_GENERATION_HISTORY_VERSION,
  buildFieldProfileGenerationLedger,
} from "./fieldProfileGenerationHistory.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

test("field profile generation ledger records source records, AI runs, and human decisions", () => {
  const ledger = buildFieldProfileGenerationLedger({
    fieldId: "field-1",
    rulesetVersion: "site_intelligence_p0_v1",
    generatedBy: "system",
    visibility: "public",
    sourceRecords: [
      { visitId: "visit-1", occurrenceId: "occ-1", contributionStatus: "public", policyReason: "ordinary_public_area_profile" },
      { visitId: "visit-2", occurrenceId: "occ-2", contributionStatus: "suppressed", policyReason: "taxon_sensitive" },
    ],
    aiRunIds: ["ai-run-1"],
    humanDecisionIds: ["review-1"],
    profilePayload: { species: ["ツバメ"] },
    limitationsPayload: { notes: ["少数記録は抑制"] },
  });

  assert.equal(ledger.schemaVersion, FIELD_PROFILE_GENERATION_HISTORY_VERSION);
  assert.equal(ledger.run.inputRecordCount, 2);
  assert.equal(ledger.run.publicRecordCount, 1);
  assert.equal(ledger.run.suppressedRecordCount, 1);
  assert.deepEqual(ledger.run.aiRunIds, ["ai-run-1"]);
  assert.deepEqual(ledger.run.humanDecisionIds, ["review-1"]);
  assert.equal(ledger.sourceRecords[1]?.contributionStatus, "suppressed");
  assert.deepEqual(ledger.snapshot.profilePayload, { species: ["ツバメ"] });
});

test("field profile generation ledger defaults to internal visibility and empty payloads", () => {
  const ledger = buildFieldProfileGenerationLedger({
    fieldId: "field-1",
    sourceRecords: [],
  });

  assert.equal(ledger.run.visibility, "internal");
  assert.equal(ledger.run.rulesetVersion, "site_intelligence_p0_v1");
  assert.equal(ledger.run.generatedBy, "system");
  assert.equal(ledger.run.inputRecordCount, 0);
  assert.deepEqual(ledger.snapshot.profilePayload, {});
  assert.deepEqual(ledger.snapshot.limitationsPayload, {});
});

test("field profile generation history migration keeps run, snapshot, and source record tables", () => {
  const sql = readFileSync(
    path.join(dirname, "..", "..", "db", "migrations", "0129_field_profile_generation_history.sql"),
    "utf8",
  );

  assert.match(sql, /CREATE TABLE IF NOT EXISTS field_profile_generation_runs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS field_profile_snapshots/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS field_profile_source_records/);
  assert.match(sql, /ruleset_version TEXT NOT NULL/);
  assert.match(sql, /profile_payload JSONB NOT NULL DEFAULT '\{\}'::jsonb/);
  assert.doesNotMatch(sql, /^\s*(DROP|TRUNCATE|DELETE)\b/im);
});
