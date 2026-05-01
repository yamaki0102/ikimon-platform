import assert from "node:assert/strict";
import test from "node:test";
import { guideEnvironmentDiagnosisSql, __test__ } from "./guideEnvironmentDiagnostics.js";

test("guide environment diagnosis SQL separates aggregatable records, mesh matches, and public threshold", () => {
  const sql = guideEnvironmentDiagnosisSql();

  assert.match(sql, /with day_records as/);
  assert.match(sql, /jsonb_array_length\(detected_features\) > 0/);
  assert.match(sql, /sample_record_ids \? \(dr\.guide_record_id::text\)/);
  assert.match(sql, /guide_record_count >= 3 or contributor_count >= 2/);
  assert.match(sql, /unmatched_aggregatable_count/);
});

test("guide environment diagnosis likely blocker is root-cause oriented", () => {
  assert.equal(__test__.likelyBlocker({
    date: "2026-04-30",
    guideRecordCount: 0,
    withLatLngCount: 0,
    withDetectedFeaturesCount: 0,
    aggregatableCount: 0,
    latencyStateCount: 0,
    meshMatchedRecordCount: 0,
    unmatchedAggregatableCount: 0,
    meshCellCount: 0,
    publicMeshCellCount: 0,
    suppressedByPublicThresholdCount: 0,
  }), "no_guide_records");

  assert.equal(__test__.likelyBlocker({
    date: "2026-04-30",
    guideRecordCount: 4,
    withLatLngCount: 4,
    withDetectedFeaturesCount: 4,
    aggregatableCount: 4,
    latencyStateCount: 4,
    meshMatchedRecordCount: 0,
    unmatchedAggregatableCount: 4,
    meshCellCount: 0,
    publicMeshCellCount: 0,
    suppressedByPublicThresholdCount: 0,
  }), "mesh_rebuild_needed");

  assert.equal(__test__.likelyBlocker({
    date: "2026-04-30",
    guideRecordCount: 2,
    withLatLngCount: 2,
    withDetectedFeaturesCount: 2,
    aggregatableCount: 2,
    latencyStateCount: 2,
    meshMatchedRecordCount: 2,
    unmatchedAggregatableCount: 0,
    meshCellCount: 2,
    publicMeshCellCount: 0,
    suppressedByPublicThresholdCount: 2,
  }), "public_threshold_only");
});
