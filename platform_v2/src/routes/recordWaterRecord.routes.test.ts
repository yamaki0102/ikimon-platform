import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("record form sends water record extension fields without replacing the normal route", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");

  assert.match(source, /name="catchOutcome"/);
  assert.match(source, /name="captureMethod"/);
  assert.match(source, /name="publicWaterbodyLabel"/);
  assert.match(source, /waterRecord: catchOutcome/);
  assert.match(source, /no_catch_semantics/);
  assert.match(source, /capture_attempt_not_species_absence/);
});

test("record form sends field scan and governance context without changing the normal route", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "routes", "read.ts"), "utf8");

  assert.match(source, /name="fieldScanMode"/);
  assert.match(source, /name="fixedPointId"/);
  assert.match(source, /name="routeId"/);
  assert.match(source, /name="areaId"/);
  assert.match(source, /fieldScan: fieldScanMode/);
  assert.match(source, /governanceContext: fieldScanMode \|\| recordMode === 'survey'/);
  assert.match(source, /publicPrecisionPolicy: 'system_risk_cap'/);
});
