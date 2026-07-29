import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(moduleDirectory, "../..");

function migrationSql(file: string): string {
  return readFileSync(path.join(platformRoot, `db/migrations/${file}`), "utf8");
}

test("AI usage persistence creates one authoritative event store without altering ai_cost_log", () => {
  const sql = migrationSql("0140_ai_usage_control.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_execution_guards/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_execution_attempt_events/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_usage_events/u);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS ai_usage_budget_overrides/u);
  assert.doesNotMatch(sql, /ALTER TABLE\s+ai_cost_log/iu);
  assert.doesNotMatch(sql, /DROP TABLE\s+ai_cost_log/iu);
});

test("attempt and usage event tables are append-only and lineage is fail-closed", () => {
  const base = migrationSql("0140_ai_usage_control.sql");
  const hardening = migrationSql("0141_ai_usage_control_hardening.sql");
  assert.match(base, /trg_ai_execution_attempt_events_append_only/u);
  assert.match(base, /trg_ai_usage_events_append_only/u);
  assert.match(base, /trg_ai_usage_events_validate_lineage/u);
  assert.match(base, /ai_usage_events_lineage_shape_chk/u);
  assert.match(hardening, /ai_usage_events_execution_guard_fk/u);
  assert.match(hardening, /ai_usage_attempt_not_started/u);
  assert.match(hardening, /IS DISTINCT FROM NEW\.execution_key/u);
  assert.match(hardening, /ai_retry_target_scope_mismatch/u);
  assert.match(hardening, /ai_adjustment_target_scope_mismatch/u);
});

test("execution leases and budget overrides have explicit time and audit bounds", () => {
  const base = migrationSql("0140_ai_usage_control.sql");
  const hardening = migrationSql("0141_ai_usage_control_hardening.sql");
  assert.match(base, /lease_expires_at > acquired_at/u);
  assert.match(base, /valid_until > valid_from/u);
  assert.match(hardening, /jsonb_typeof\(raw_usage\) = 'object'/u);
  assert.match(hardening, /valid_from \+ INTERVAL '24 hours'/u);
  assert.match(hardening, /trg_ai_usage_budget_overrides_guard/u);
  assert.match(hardening, /only_allows_one_revocation/u);
});

test("provider usage metadata is strict allowlist-only", () => {
  const allowlist = migrationSql("0142_ai_usage_metadata_allowlist.sql");
  assert.match(allowlist, /prompttokencount/u);
  assert.match(allowlist, /prompt_tokens/u);
  assert.match(allowlist, /cache_creation_input_tokens/u);
  assert.match(allowlist, /RETURN FALSE/u);
  assert.match(allowlist, /value_type NOT IN \('number', 'null'\)/u);
  assert.doesNotMatch(allowlist, /request_body/u);
  assert.doesNotMatch(allowlist, /response_body/u);
});
