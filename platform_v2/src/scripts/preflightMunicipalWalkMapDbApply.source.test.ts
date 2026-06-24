import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/scripts/preflightMunicipalWalkMapDbApply.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};

test("municipal walk map DB apply preflight is read-only and blocks unsafe targets", () => {
  assert.match(source, /current_database\(\)/);
  assert.match(source, /pg_extension/);
  assert.match(source, /schema_migrations/);
  assert.match(source, /0123_municipal_walk_maps\.sql/);
  assert.match(source, /database_name_looks_production/);
  assert.match(source, /required_extensions_missing/);
  assert.match(source, /target_migration_checksum_mismatch/);
  assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
});

test("municipal walk map DB apply preflight records location-safety evidence", () => {
  assert.match(source, /sensitive_context/);
  assert.match(source, /public_access/);
  assert.match(source, /exact_location_column_count/);
  assert.match(source, /emergencyHidden/);
  assert.match(source, /municipal_tables_have_exact_location_columns/);
  assert.match(source, /emergency_hidden_public_rows_present/);
});

test("municipal walk map DB apply preflight is exposed as an npm script", () => {
  assert.equal(
    packageJson.scripts?.["db:preflight:municipal-walk-map-apply"],
    "tsx src/scripts/preflightMunicipalWalkMapDbApply.ts",
  );
});
