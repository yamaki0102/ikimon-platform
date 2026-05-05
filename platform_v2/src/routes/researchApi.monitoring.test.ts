import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("research API exposes monitoring readiness and license guard fields", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "researchApi.ts"), "utf8");

  assert.match(source, /export_ready_only/);
  assert.match(source, /observation_data_rights/);
  assert.match(source, /civic_observation_contexts/);
  assert.match(source, /dataGeneralizations/);
  assert.match(source, /informationWithheld/);
  assert.match(source, /licenseStatus/);
});
