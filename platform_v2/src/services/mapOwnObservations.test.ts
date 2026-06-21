import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isMeaningfulOwnObservationLabel } from "./mapOwnObservations.js";

const source = readFileSync(new URL("./mapOwnObservations.ts", import.meta.url), "utf8");

test("owner map observations reject smoke and placeholder records even for the signed-in owner", () => {
  assert.match(source, /source_payload->>'source'/);
  assert.match(source, /e2e\|smoke\|fixture\|dummy\|placeholder/);
  assert.match(source, /regression\[-_\]\?seed/);
});

test("owner map observations require a meaningful label source before drawing exact points", () => {
  assert.match(source, /nullif\(o\.vernacular_name, ''\)/);
  assert.match(source, /nullif\(ai\.recommended_taxon_name, ''\)/);
  assert.match(source, /nullif\(v\.note, ''\)/);
  assert.match(source, /is not null/);
});

test("owner map observations only use promoted observation visits for exact owner pins", () => {
  assert.match(source, /v\.source_kind = 'v2_observation'/);
  assert.match(source, /coalesce\(v\.session_mode, ''\) = 'standard'/);
  assert.match(source, /coalesce\(v\.visit_mode, 'manual'\) in \('manual', 'survey'\)/);
});

test("owner map observations reject labels that would render as empty-looking history", () => {
  for (const label of ["", " ", "同定待ち", "名前を確認中", "写真", "記録", "scan", "dummy plant", "Regression Manual Finch"]) {
    assert.equal(isMeaningfulOwnObservationLabel(label), false, label);
  }
  for (const label of ["アカメガシワ", "朝の水辺メモ", "白い花の群落"]) {
    assert.equal(isMeaningfulOwnObservationLabel(label), true, label);
  }
});
