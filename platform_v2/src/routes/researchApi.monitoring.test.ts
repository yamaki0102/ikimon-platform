import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("research API exposes monitoring readiness and license guard fields", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "researchApi.ts"), "utf8");

  assert.match(source, /export_ready_only/);
  assert.match(source, /\/api\/v1\/research\/darwin-core\.csv/);
  assert.match(source, /\/api\/v1\/research\/export-qa-report/);
  assert.match(source, /forceExportReadyOnly: true/);
  assert.match(source, /observation_data_rights/);
  assert.match(source, /civic_observation_contexts/);
  assert.match(source, /dataGeneralizations/);
  assert.match(source, /informationWithheld/);
  assert.match(source, /licenseStatus/);
  assert.match(source, /darwin_core_csv_v0/);
  assert.match(source, /trendAbundancePolicy/);
  assert.match(source, /field_scan_contexts/);
  assert.match(source, /observation_governance_contexts/);
  assert.match(source, /observation_package_events/);
  assert.match(source, /include_machine_observations/);
  assert.match(source, /MachineObservation/);
  assert.match(source, /observation_method_contexts/);
  assert.match(source, /machineObservationReady/);
  assert.match(source, /machineEvidenceLayer/);
  assert.match(source, /calibrationDecision/);
  assert.match(source, /not_a_confirmed_species_record/);
  assert.match(source, /reviewed_machine_observation/);
  assert.match(source, /machineStatus === "reviewer_verified"/);
});
