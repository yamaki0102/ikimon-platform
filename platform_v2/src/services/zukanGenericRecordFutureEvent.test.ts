import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const postgresMigration = readFileSync(
  new URL("../../db/migrations/0145_zukan_foundation_v2_records.sql", import.meta.url),
  "utf8",
);
const d1MigrationNames = [
  "0009_zukan_foundation_v2_source_identity.sql",
  "0010_zukan_foundation_v2_predicate_claims.sql",
  "0011_zukan_foundation_v2_authority_resolution.sql",
  "0012_zukan_foundation_v2_governance_rights.sql",
  "0013_zukan_foundation_v2_disputes_coverage.sql",
  "0014_zukan_foundation_v2_integrity_hardening.sql",
  "0015_zukan_foundation_v2_records.sql",
] as const;

function id(value: number): string {
  return `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

test("generic Record schema does not force occurrence time before ingestion time", () => {
  assert.doesNotMatch(
    postgresMigration,
    /occurred_at\s+IS\s+NULL\s+OR\s+occurred_at\s*<=\s*recorded_at/iu,
  );

  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  try {
    for (const filename of d1MigrationNames) {
      database.exec(readFileSync(
        new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
        "utf8",
      ));
    }

    const artifactId = id(1);
    const recordId = id(2);
    database.exec(`
      INSERT INTO zukan_value_artifacts(
        artifact_id, value_json, content_sha256, availability_status
      ) VALUES (
        '${artifactId}', '{"event":"future"}', '${"f".repeat(64)}', 'available'
      );
      INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
      VALUES ('${artifactId}', 'tenant-event');
      INSERT INTO zukan_records(
        record_id, tenant_id, record_kind, recorded_at, occurred_at,
        payload_artifact_id, provenance_status, visibility
      ) VALUES (
        '${recordId}', 'tenant-event', 'event_record',
        '2026-07-29T00:00:00.000Z', '2026-09-01T10:00:00.000Z',
        '${artifactId}', 'known', 'workspace'
      );
    `);

    const row = database.prepare(`
      SELECT record_kind, recorded_at, occurred_at
        FROM zukan_records
       WHERE record_id = ?
    `).get(recordId) as Record<string, unknown>;
    assert.equal(row.record_kind, "event_record");
    assert.equal(row.recorded_at, "2026-07-29T00:00:00.000Z");
    assert.equal(row.occurred_at, "2026-09-01T10:00:00.000Z");
  } finally {
    database.close();
  }
});
