import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(moduleDirectory, "../..");
function sql(file: string): string { return readFileSync(path.join(platformRoot, `db/migrations/${file}`), "utf8") }

test("AI usage migrations are isolated from ai_cost_log and Foundation", () => {
  const combined = ["0140_ai_usage_control.sql", "0141_ai_usage_control_hardening.sql", "0142_ai_usage_metadata_allowlist.sql", "0143_ai_usage_contract_v2.sql"].map(sql).join("\n");
  assert.match(combined, /CREATE TABLE IF NOT EXISTS ai_execution_guards/u);
  assert.match(combined, /CREATE TABLE IF NOT EXISTS ai_usage_events/u);
  assert.doesNotMatch(combined, /ALTER TABLE\s+ai_cost_log/iu);
  assert.doesNotMatch(combined, /zukan_(?:claims|resolution|source)/iu);
});

test("v2 migration enforces full scope fencing and provider request idempotency", () => {
  const v2 = sql("0143_ai_usage_contract_v2.sql");
  assert.match(v2, /project TEXT NOT NULL/u);
  assert.match(v2, /workspace_id TEXT/u);
  assert.match(v2, /canonical_input_digest CHAR\(64\)/u);
  assert.match(v2, /lease_generation BIGINT/u);
  assert.match(v2, /max_lease/u);
  assert.match(v2, /ai_usage_guard_scope_mismatch/u);
  assert.match(v2, /ai_usage_guard_fencing_mismatch/u);
  assert.match(v2, /uq_ai_usage_provider_request/u);
});

test("usage and attempt events remain append-only with strict metadata", () => {
  const base = sql("0140_ai_usage_control.sql");
  const allowlist = sql("0142_ai_usage_metadata_allowlist.sql");
  assert.match(base, /trg_ai_execution_attempt_events_append_only/u);
  assert.match(base, /trg_ai_usage_events_append_only/u);
  assert.match(allowlist, /RETURN FALSE/u);
  assert.match(allowlist, /prompt_tokens/u);
  assert.doesNotMatch(allowlist, /request_body/u);
});
