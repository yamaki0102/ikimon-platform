import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const postgres = readFileSync(
  new URL("../../db/migrations/0146_zukan_foundation_v2_record_claim_value_scopes.sql", import.meta.url),
  "utf8",
);
const d1 = readFileSync(
  new URL("../../cloudflare_shadow/migrations/core/0016_zukan_foundation_v2_record_claim_value_scopes.sql", import.meta.url),
  "utf8",
);

test("PostgreSQL Claim value scope migration is additive and Record-link bounded", () => {
  assert.doesNotMatch(postgres, /^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  assert.doesNotMatch(postgres, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
  assert.match(postgres, /CREATE TABLE IF NOT EXISTS zukan_claim_value_scopes/);
  assert.match(postgres, /value_artifact_id UUID PRIMARY KEY REFERENCES zukan_value_artifacts/);
  assert.match(postgres, /zukan_validate_claim_record_value_scope/);
  assert.match(postgres, /zukan_claim_value_scope_not_found/);
  assert.match(postgres, /zukan_claim_value_scope_mismatch/);
  assert.match(postgres, /zukan_claim_value_artifact_not_available/);
  assert.match(postgres, /BEFORE INSERT ON zukan_claim_record_links/);
  assert.match(postgres, /BEFORE UPDATE OR DELETE ON zukan_claim_value_scopes/);
});

test("D1 Claim value scope migration preserves the same fail-closed boundary", () => {
  assert.doesNotMatch(d1, /^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  assert.doesNotMatch(d1, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
  assert.match(d1, /CREATE TABLE IF NOT EXISTS zukan_claim_value_scopes/);
  assert.match(d1, /revision\.value_artifact_id IS NULL/);
  assert.match(d1, /scope\.tenant_id = record\.tenant_id/);
  assert.match(d1, /scope\.workspace_id IS record\.workspace_id/);
  assert.match(d1, /artifact\.availability_status = 'available'/);
  assert.match(d1, /zukan_claim_value_scope_mismatch/);
  assert.match(d1, /zukan_claim_value_scopes_immutable/);
});
