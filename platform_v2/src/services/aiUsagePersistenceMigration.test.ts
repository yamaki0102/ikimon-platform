import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(moduleDirectory, "../..");
const migrationPath = path.join(platformRoot, "db/migrations/0140_ai_usage_control.sql");

function migrationSql(): string {
  return readFileSync(migrationPath, "utf8");
}

test("AI usage persistence migration creates one authoritative event store", () => {
  const sql = migrationSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_execution_guards/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_execution_attempt_events/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_usage_events/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_usage_budget_overrides/u);
  assert.doesNotMatch(sql, /ALTER TABLE\s+ai_cost_log/iu);
  assert.doesNotMatch(sql, /DROP TABLE\s+ai_cost_log/iu);
});

test("attempt and usage event tables are append-only and lineage is fail-closed", () => {
  const sql = migrationSql();
  assert.match(sql, /trg_ai_execution_attempt_events_append_only/u);
  assert.match(sql, /trg_ai_usage_events_append_only/u);
  assert.match(sql, /trg_ai_usage_events_validate_lineage/u);
  assert.match(sql, /ai_retry_target_scope_mismatch/u);
  assert.match(sql, /ai_adjustment_target_scope_mismatch/u);
  assert.match(sql, /ai_usage_events_lineage_shape_chk/u);
});

test("execution leases and temporary budget overrides have explicit time bounds", () => {
  const sql = migrationSql();
  assert.match(sql, /lease_expires_at > acquired_at/u);
  assert.match(sql, /valid_until > valid_from/u);
  assert.match(sql, /revoked_at/u);
});
