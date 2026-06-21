import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./mapOwnObservations.ts", import.meta.url), "utf8");

test("owner map observations reject smoke and placeholder records even for the signed-in owner", () => {
  assert.match(source, /source_payload->>'source'/);
  assert.match(source, /e2e\|smoke\|fixture\|dummy\|placeholder/);
});

test("owner map observations require a meaningful label source before drawing exact points", () => {
  assert.match(source, /nullif\(o\.vernacular_name, ''\)/);
  assert.match(source, /nullif\(ai\.recommended_taxon_name, ''\)/);
  assert.match(source, /nullif\(v\.note, ''\)/);
  assert.match(source, /is not null/);
});
