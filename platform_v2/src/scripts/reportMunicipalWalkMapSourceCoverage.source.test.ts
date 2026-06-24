import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./reportMunicipalWalkMapSourceCoverage.ts", import.meta.url), "utf8");

test("municipal walk map source coverage report keeps MECE axes explicit", () => {
  assert.match(source, /primaryType/);
  assert.match(source, /templateId/);
  assert.match(source, /operationalModel/);
  assert.match(source, /municipal_walk_map_source_coverage\/v0/);
  assert.match(source, /walk_route_species_map/);
  assert.match(source, /citizen_science_report/);
  assert.match(source, /worksheet_or_field_note/);
  assert.match(source, /species_distribution_map/);
  assert.match(source, /EXPECTED_MATRIX_COVERAGE/);
  assert.match(source, /axis: "matrix"/);
  assert.match(source, /OPERATIONAL_MODEL_LABELS/);
  assert.match(source, /external_app_campaign/);
  assert.match(source, /national_platform_link/);
});

test("municipal walk map source coverage report supports json and markdown", () => {
  assert.match(source, /--format=/);
  assert.match(source, /renderMarkdown/);
  assert.match(source, /Unsupported format/);
});
