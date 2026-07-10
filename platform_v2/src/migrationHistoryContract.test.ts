import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const observationsMigrationDir = path.join(
  process.cwd(),
  "cloudflare_shadow",
  "migrations",
  "observations",
);

function readMigration(filename: string): string {
  return readFileSync(path.join(observationsMigrationDir, filename), "utf8");
}

test("public_area_label remains owned by its additive migrations", () => {
  const foundation = readMigration("0001_observation_write_contract.sql");
  const publicReadModel = readMigration("0052_public_area_label_readmodel.sql");
  const observationColumn = readMigration("0053_observation_public_area_label.sql");

  assert.doesNotMatch(
    foundation,
    /\bpublic_area_label\b/i,
    "the foundation migration must not pre-create a column added by migration 0052",
  );
  assert.match(
    publicReadModel,
    /ALTER TABLE\s+readmodel_public_observations\s+ADD COLUMN\s+public_area_label\s+TEXT\s*;/i,
  );
  assert.match(
    observationColumn,
    /ALTER TABLE\s+observations\s+ADD COLUMN\s+public_area_label\s+TEXT\s*;/i,
  );
});

test("later observation migrations do not duplicate the public_area_label additions", () => {
  const migrationFiles = readdirSync(observationsMigrationDir)
    .filter((filename) => /^\d{4}_.+\.sql$/.test(filename))
    .sort();

  const readModelOwners: string[] = [];
  const observationOwners: string[] = [];

  for (const filename of migrationFiles) {
    const sql = readMigration(filename);
    if (/ALTER TABLE\s+readmodel_public_observations\s+ADD COLUMN\s+public_area_label\b/i.test(sql)) {
      readModelOwners.push(filename);
    }
    if (/ALTER TABLE\s+observations\s+ADD COLUMN\s+public_area_label\b/i.test(sql)) {
      observationOwners.push(filename);
    }
  }

  assert.deepEqual(readModelOwners, ["0052_public_area_label_readmodel.sql"]);
  assert.deepEqual(observationOwners, ["0053_observation_public_area_label.sql"]);
});
