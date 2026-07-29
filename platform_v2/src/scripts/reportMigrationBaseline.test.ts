import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildMigrationBaselineReport,
  renderMarkdown,
} from "./reportMigrationBaseline.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationDir = path.resolve(currentDir, "../../db/migrations");

test("db migration baseline rehearsal locks the current migration head and risk inventory", async () => {
  const report = await buildMigrationBaselineReport({
    migrationDir,
    generatedAt: "2026-07-29T00:00:00.000Z",
  });

  assert.equal(report.schemaVersion, "platform_migration_baseline_rehearsal/v0");
  assert.equal(report.totalMigrations, 143);
  assert.equal(report.firstMigration, "0001_extensions_and_core.sql");
  assert.equal(report.headMigration, "0145_zukan_foundation_v2_records.sql");
  assert.deepEqual(report.extensionRequirements, ["timescaledb", "vector"]);
  assert.equal(report.riskSummary.destructiveApproved, 14);
  assert.equal(report.riskSummary.destructiveUnapproved, 1);
  assert.equal(report.riskSummary.ownerSensitiveApproved, 36);
  assert.equal(report.riskSummary.ownerSensitiveUnapproved, 9);
  assert.ok(report.stopConditions.some((condition) => condition.includes("production DB")));
});

test("db migration baseline rehearsal surfaces sequence drift and reserved parallel migrations", async () => {
  const report = await buildMigrationBaselineReport({
    migrationDir,
    generatedAt: "2026-07-29T00:00:00.000Z",
  });

  assert.deepEqual(report.missingSequences, [
    "0010",
    "0041",
    "0042",
    "0043",
    "0044",
    "0078",
    "0084",
    "0140",
    "0141",
    "0142",
    "0143",
    "0144",
  ]);
  assert.ok(report.duplicateSequences.some((entry) => entry.sequence === "0018"));
  assert.ok(report.duplicateSequences.some((entry) => entry.sequence === "0119"));
});

test("db migration baseline rehearsal markdown names the unsafe historical debt and Record head", async () => {
  const report = await buildMigrationBaselineReport({
    migrationDir,
    generatedAt: "2026-07-29T00:00:00.000Z",
  });
  const markdown = renderMarkdown(report);

  assert.match(markdown, /0075_normalize_shizuoka_locality_labels\.sql/);
  assert.match(markdown, /0003_delta_sync_idempotency\.sql/);
  assert.match(markdown, /0145_zukan_foundation_v2_records\.sql/);
  assert.match(markdown, /npx tsx src\/scripts\/reportMigrationBaseline\.ts --format=markdown/);
});
