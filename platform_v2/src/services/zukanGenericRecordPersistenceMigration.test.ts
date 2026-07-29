import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const postgresMigration = readFileSync(
  new URL("../../db/migrations/0140_zukan_foundation_v2_records.sql", import.meta.url),
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
const d1Migrations = d1MigrationNames.map((filename) => readFileSync(
  new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
  "utf8",
));
const d1RecordMigration = d1Migrations.at(-1) ?? "";

function id(value: number): string {
  return `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

function createD1Scratch(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const migration of d1Migrations) database.exec(migration);
  return database;
}

function seedRecordGraph(database: DatabaseSync): {
  recordId: string;
  claimRevisionId: string;
  otherSubjectId: string;
  otherSourceEditionId: string;
} {
  const placeId = id(1);
  const entityId = id(2);
  const reviewerId = id(3);
  const otherSubjectId = id(4);
  const sourceWorkId = id(10);
  const sourceEditionId = id(11);
  const otherSourceWorkId = id(12);
  const otherSourceEditionId = id(13);
  const recordArtifactId = id(20);
  const claimArtifactId = id(21);
  const recordId = id(30);
  const claimId = id(40);
  const claimRevisionId = id(41);
  const hashA = "a".repeat(64);
  const hashB = "b".repeat(64);
  const predicate = "https://zukan.earth/predicate/name";

  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES
      ('${placeId}', 'tenant-a', 'place'),
      ('${entityId}', 'tenant-a', 'regional_entity'),
      ('${reviewerId}', 'tenant-a', 'agent'),
      ('${otherSubjectId}', 'tenant-b', 'place');

    INSERT INTO zukan_source_works(source_work_id, tenant_id, title, work_kind)
    VALUES
      ('${sourceWorkId}', 'tenant-a', 'Iwata cultural source', 'regional_source'),
      ('${otherSourceWorkId}', 'tenant-b', 'Other tenant source', 'regional_source');

    INSERT INTO zukan_source_editions(source_edition_id, source_work_id, edition_label)
    VALUES
      ('${sourceEditionId}', '${sourceWorkId}', '2024-03-26'),
      ('${otherSourceEditionId}', '${otherSourceWorkId}', '2024-03-26');

    INSERT INTO zukan_value_artifacts(
      artifact_id, value_json, content_sha256, availability_status
    ) VALUES
      ('${recordArtifactId}', '{"sourceRecordId":"BB00000003"}', '${hashA}', 'available'),
      ('${claimArtifactId}', '"旧見付学校附磐田文庫"', '${hashB}', 'available');

    INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
    VALUES ('${recordArtifactId}', 'tenant-a');

    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality,
      polarity_mode, temporal_profile
    ) VALUES ('${predicate}', 1, 'string', 'one', 'positive_only', 'valid_time');

    INSERT INTO zukan_claims(
      claim_id, subject_id, predicate_uri, predicate_version, tenant_id
    ) VALUES ('${claimId}', '${entityId}', '${predicate}', 1, 'tenant-a');

    INSERT INTO zukan_claim_revisions(
      claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
      value_artifact_id, asserted_by_subject_id, visibility, metadata_json
    ) VALUES (
      '${claimRevisionId}', '${claimId}', 1, '${predicate}', 1,
      '${claimArtifactId}', '${reviewerId}', 'workspace', '{}'
    );

    INSERT INTO zukan_records(
      record_id, tenant_id, record_kind, recorded_at, occurred_at,
      payload_artifact_id, provenance_status, visibility
    ) VALUES (
      '${recordId}', 'tenant-a', 'source_record',
      '2026-07-28T00:00:00.000Z', '2024-03-26T00:00:00.000Z',
      '${recordArtifactId}', 'known', 'workspace'
    );

    INSERT INTO zukan_record_subject_links(record_id, subject_id, subject_role, ordinal)
    VALUES
      ('${recordId}', '${placeId}', 'place', 0),
      ('${recordId}', '${entityId}', 'entity', 0);

    INSERT INTO zukan_record_source_links(
      record_id, source_edition_id, link_role, source_selector_json
    ) VALUES (
      '${recordId}', '${sourceEditionId}', 'provenance',
      '{"locator":"linkdata-record:BB00000003"}'
    );

    INSERT INTO zukan_claim_record_links(claim_revision_id, record_id, link_role)
    VALUES ('${claimRevisionId}', '${recordId}', 'reviewed_from');
  `);
  return { recordId, claimRevisionId, otherSubjectId, otherSourceEditionId };
}

test("PostgreSQL Record migration is additive, scoped, and append-only", () => {
  assert.doesNotMatch(postgresMigration, /^\s*(?:UPDATE|DELETE\s+FROM|TRUNCATE)\b/im);
  assert.doesNotMatch(postgresMigration, /\bDROP\s+(?:TABLE|COLUMN)\b/i);
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS zukan_record_payload_scopes/);
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS zukan_records/);
  assert.match(postgresMigration, /recorded_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE/);
  assert.match(postgresMigration, /payload_artifact_id UUID NOT NULL REFERENCES zukan_record_payload_scopes/);
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS zukan_record_subject_links/);
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS zukan_record_source_links/);
  assert.match(postgresMigration, /CREATE TABLE IF NOT EXISTS zukan_claim_record_links/);
  assert.match(postgresMigration, /zukan_record_payload_scope_mismatch/);
  assert.match(postgresMigration, /zukan_record_subject_scope_mismatch/);
  assert.match(postgresMigration, /zukan_record_source_scope_mismatch/);
  assert.match(postgresMigration, /zukan_claim_record_scope_mismatch/);
  assert.match(postgresMigration, /BEFORE UPDATE OR DELETE ON zukan_record_payload_scopes/);
  assert.match(postgresMigration, /BEFORE UPDATE OR DELETE ON zukan_records/);
});

test("D1 Record migration has parity tables, scope guards, and immutable triggers", () => {
  assert.match(d1RecordMigration, /CREATE TABLE IF NOT EXISTS zukan_record_payload_scopes/);
  assert.match(d1RecordMigration, /CREATE TABLE IF NOT EXISTS zukan_records/);
  assert.match(d1RecordMigration, /recorded_sequence INTEGER PRIMARY KEY AUTOINCREMENT/);
  assert.match(d1RecordMigration, /json_type\(source_selector_json\) = 'object'/);
  assert.match(d1RecordMigration, /zukan_record_payload_scope_mismatch/);
  assert.match(d1RecordMigration, /zukan_record_subject_scope_mismatch/);
  assert.match(d1RecordMigration, /zukan_record_source_scope_mismatch/);
  assert.match(d1RecordMigration, /zukan_claim_record_scope_mismatch/);
  assert.match(d1RecordMigration, /zukan_record_payload_scopes_immutable/);
  assert.match(d1RecordMigration, /zukan_records_immutable/);
});

test("D1 scratch DB persists one Record graph and rejects mutation", () => {
  const database = createD1Scratch();
  try {
    const seeded = seedRecordGraph(database);
    const row = database.prepare(`
      SELECT r.record_id, r.record_kind, a.value_json, scope.tenant_id AS payload_tenant,
             COUNT(DISTINCT s.subject_id) AS subject_count,
             COUNT(DISTINCT e.source_edition_id) AS source_count,
             COUNT(DISTINCT c.claim_revision_id) AS claim_count
        FROM zukan_records r
        JOIN zukan_value_artifacts a ON a.artifact_id = r.payload_artifact_id
        JOIN zukan_record_payload_scopes scope ON scope.payload_artifact_id = r.payload_artifact_id
        LEFT JOIN zukan_record_subject_links s ON s.record_id = r.record_id
        LEFT JOIN zukan_record_source_links e ON e.record_id = r.record_id
        LEFT JOIN zukan_claim_record_links c ON c.record_id = r.record_id
       WHERE r.record_id = ?
       GROUP BY r.record_id, r.record_kind, a.value_json, scope.tenant_id
    `).get(seeded.recordId) as Record<string, unknown>;

    assert.equal(row.record_kind, "source_record");
    assert.equal(row.value_json, '{"sourceRecordId":"BB00000003"}');
    assert.equal(row.payload_tenant, "tenant-a");
    assert.equal(row.subject_count, 2);
    assert.equal(row.source_count, 1);
    assert.equal(row.claim_count, 1);
    assert.throws(
      () => database.exec(`UPDATE zukan_records SET visibility='public' WHERE record_id='${seeded.recordId}'`),
      /zukan_records_immutable/,
    );
  } finally {
    database.close();
  }
});

test("D1 scratch DB rejects missing and cross-tenant Record payload scopes", () => {
  const database = createD1Scratch();
  try {
    const missingArtifact = id(60);
    const wrongScopeArtifact = id(61);
    database.exec(`
      INSERT INTO zukan_value_artifacts(artifact_id, value_json, content_sha256)
      VALUES
        ('${missingArtifact}', '{}', '${"d".repeat(64)}'),
        ('${wrongScopeArtifact}', '{}', '${"e".repeat(64)}');
      INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
      VALUES ('${wrongScopeArtifact}', 'tenant-b');
    `);
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_records(
          record_id, tenant_id, record_kind, recorded_at,
          payload_artifact_id, provenance_status, visibility
        ) VALUES (
          '${id(62)}', 'tenant-a', 'source_record', '2026-07-28T00:00:00.000Z',
          '${missingArtifact}', 'unknown', 'workspace'
        )
      `),
      /zukan_record_payload_scope_mismatch/,
    );
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_records(
          record_id, tenant_id, record_kind, recorded_at,
          payload_artifact_id, provenance_status, visibility
        ) VALUES (
          '${id(63)}', 'tenant-a', 'source_record', '2026-07-28T00:00:00.000Z',
          '${wrongScopeArtifact}', 'unknown', 'workspace'
        )
      `),
      /zukan_record_payload_scope_mismatch/,
    );
  } finally {
    database.close();
  }
});

test("D1 scratch DB rejects cross-tenant Subject, Source, and Claim links", () => {
  const database = createD1Scratch();
  try {
    const seeded = seedRecordGraph(database);
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_record_subject_links(record_id, subject_id, subject_role, ordinal)
        VALUES ('${seeded.recordId}', '${seeded.otherSubjectId}', 'other', 0)
      `),
      /zukan_record_subject_scope_mismatch/,
    );
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_record_source_links(record_id, source_edition_id, link_role)
        VALUES ('${seeded.recordId}', '${seeded.otherSourceEditionId}', 'evidence')
      `),
      /zukan_record_source_scope_mismatch/,
    );

    const otherRecordArtifact = id(70);
    const otherRecord = id(71);
    database.exec(`
      INSERT INTO zukan_value_artifacts(artifact_id, value_json, content_sha256)
      VALUES ('${otherRecordArtifact}', '{}', '${"c".repeat(64)}');
      INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
      VALUES ('${otherRecordArtifact}', 'tenant-b');
      INSERT INTO zukan_records(
        record_id, tenant_id, record_kind, recorded_at,
        payload_artifact_id, provenance_status, visibility
      ) VALUES (
        '${otherRecord}', 'tenant-b', 'source_record', '2026-07-28T00:00:00.000Z',
        '${otherRecordArtifact}', 'unknown', 'workspace'
      );
    `);
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_claim_record_links(claim_revision_id, record_id, link_role)
        VALUES ('${seeded.claimRevisionId}', '${otherRecord}', 'asserted_from')
      `),
      /zukan_claim_record_scope_mismatch/,
    );
  } finally {
    database.close();
  }
});
