import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationFiles = [
  "0009_zukan_foundation_v2_source_identity.sql",
  "0010_zukan_foundation_v2_predicate_claims.sql",
  "0011_zukan_foundation_v2_authority_resolution.sql",
  "0012_zukan_foundation_v2_governance_rights.sql",
  "0013_zukan_foundation_v2_disputes_coverage.sql",
  "0014_zukan_foundation_v2_integrity_hardening.sql",
] as const;

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const filename of migrationFiles) {
    database.exec(readFileSync(
      new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
      "utf8",
    ));
  }
  return database;
}

function seedClaimGraph(database: DatabaseSync): {
  current: string;
  peer: string;
  stale: string;
  after: string;
  wrongSubject: string;
  wrongPredicate: string;
  lateTime: string;
  watermark: number;
} {
  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('subject', 'tenant-a', 'taxon'),
           ('other-subject', 'tenant-a', 'taxon'),
           ('tenant-b-subject', 'tenant-b', 'taxon');
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
    ) VALUES ('https://zukan.earth/p/name', 1, 'string', 'one', 'positive_only', 'atemporal'),
             ('https://zukan.earth/p/other', 1, 'string', 'one', 'positive_only', 'atemporal');
    INSERT INTO zukan_claims(claim_id, subject_id, predicate_uri, predicate_version, tenant_id)
    VALUES ('claim-main', 'subject', 'https://zukan.earth/p/name', 1, 'tenant-a'),
           ('claim-peer', 'subject', 'https://zukan.earth/p/name', 1, 'tenant-a'),
           ('claim-after', 'subject', 'https://zukan.earth/p/name', 1, 'tenant-a'),
           ('claim-other-subject', 'other-subject', 'https://zukan.earth/p/name', 1, 'tenant-a'),
           ('claim-other-predicate', 'subject', 'https://zukan.earth/p/other', 1, 'tenant-a'),
           ('claim-late-time', 'subject', 'https://zukan.earth/p/name', 1, 'tenant-a');
    INSERT INTO zukan_value_artifacts(artifact_id, value_text)
    VALUES ('artifact-stale', 'stale'),
           ('artifact-current', 'current'),
           ('artifact-peer', 'peer'),
           ('artifact-after', 'after'),
           ('artifact-wrong-subject', 'wrong subject'),
           ('artifact-wrong-predicate', 'wrong predicate'),
           ('artifact-late-time', 'late');
    INSERT INTO zukan_claim_revisions(
      claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
      value_artifact_id, recorded_at, visibility, supersedes_claim_revision_id
    ) VALUES
      ('revision-stale', 'claim-main', 1, 'https://zukan.earth/p/name', 1, 'artifact-stale', '2026-07-28T09:00:00.000Z', 'public', NULL),
      ('revision-current', 'claim-main', 2, 'https://zukan.earth/p/name', 1, 'artifact-current', '2026-07-28T10:00:00.000Z', 'public', 'revision-stale'),
      ('revision-peer', 'claim-peer', 1, 'https://zukan.earth/p/name', 1, 'artifact-peer', '2026-07-28T10:00:00.000Z', 'public', NULL),
      ('revision-wrong-subject', 'claim-other-subject', 1, 'https://zukan.earth/p/name', 1, 'artifact-wrong-subject', '2026-07-28T10:00:00.000Z', 'public', NULL),
      ('revision-wrong-predicate', 'claim-other-predicate', 1, 'https://zukan.earth/p/other', 1, 'artifact-wrong-predicate', '2026-07-28T10:00:00.000Z', 'public', NULL),
      ('revision-late-time', 'claim-late-time', 1, 'https://zukan.earth/p/name', 1, 'artifact-late-time', '2026-07-28 12:00:00', 'public', NULL);
  `);
  const watermark = Number(
    (database.prepare(
      "SELECT MAX(recorded_sequence) AS recorded_sequence FROM zukan_claim_revisions",
    ).get() as { recorded_sequence: number }).recorded_sequence,
  );
  database.exec(`
    INSERT INTO zukan_claim_revisions(
      claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
      value_artifact_id, recorded_at, visibility
    ) VALUES (
      'revision-after', 'claim-after', 1, 'https://zukan.earth/p/name', 1,
      'artifact-after', '2026-07-28T10:00:00.000Z', 'public'
    );
    INSERT INTO zukan_resolution_policy_versions(
      resolution_policy_id, policy_key, policy_version, rules_json
    ) VALUES ('policy', 'name', 1, '{}');
  `);
  database.prepare(`
    INSERT INTO zukan_resolution_runs(
      resolution_run_id, tenant_id, subject_id, predicate_uri, predicate_version,
      candidate_query_id, candidate_query_version, claim_store_snapshot_token,
      claim_store_sequence_watermark, recorded_time_watermark,
      predicate_registry_snapshot_hash, authority_snapshot_hash,
      resolution_policy_id, evaluator_build, input_hash, output_hash, run_status
    ) VALUES (
      'run', 'tenant-a', 'subject', 'https://zukan.earth/p/name', 1,
      'query', 1, ?, ?, '2026-07-28T11:00:00.000Z',
      ?, ?, 'policy', 'test', ?, ?, 'resolved'
    )
  `).run(
    `sequence:${watermark}`,
    watermark,
    "a".repeat(64),
    "b".repeat(64),
    "c".repeat(64),
    "d".repeat(64),
  );
  return {
    current: "revision-current",
    peer: "revision-peer",
    stale: "revision-stale",
    after: "revision-after",
    wrongSubject: "revision-wrong-subject",
    wrongPredicate: "revision-wrong-predicate",
    lateTime: "revision-late-time",
    watermark,
  };
}

test("D1 enforces authoritative resolution scope, latest revision, sequence, and time watermarks", () => {
  const database = createDatabase();
  const revisions = seedClaimGraph(database);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_claims
         SET subject_id = 'tenant-b-subject', tenant_id = 'tenant-b'
       WHERE claim_id = 'claim-main'
    `),
    /claims_immutable/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_subject_identities
         SET tenant_id = 'tenant-b', workspace_id = 'workspace-b'
       WHERE subject_id = 'subject'
    `),
    /subject_identity_scope_immutable/,
  );
  database.exec(`
    UPDATE zukan_subject_identities
       SET metadata_json = '{"label":"metadata-only"}'
     WHERE subject_id = 'subject'
  `);
  database.prepare(`
    INSERT INTO zukan_resolution_run_claims(
      resolution_run_id, claim_revision_id, decision, candidate_ordinal
    ) VALUES ('run', ?, 'accepted', 0)
  `).run(revisions.current);
  for (const revision of [
    revisions.stale,
    revisions.after,
    revisions.wrongSubject,
    revisions.wrongPredicate,
    revisions.lateTime,
  ]) {
    assert.throws(
      () => database.prepare(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, candidate_ordinal
      ) VALUES ('run', ?, 'rejected', 1)
    `).run(revision),
      /exceeds_watermark/,
    );
  }
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES ('spoof-claim', 'subject', 'https://zukan.earth/p/name', 1, 'tenant-b')
    `),
    /claim_subject_scope_mismatch/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO zukan_resolution_runs(
        resolution_run_id, tenant_id, subject_id, predicate_uri, predicate_version,
        candidate_query_id, candidate_query_version, claim_store_snapshot_token,
        claim_store_sequence_watermark, recorded_time_watermark,
        predicate_registry_snapshot_hash, authority_snapshot_hash,
        resolution_policy_id, evaluator_build, input_hash, output_hash, run_status
      ) VALUES (
        'future-run', 'tenant-a', 'subject', 'https://zukan.earth/p/name', 1,
        'query', 1, 'future', ?, '2026-07-28T11:00:00.000Z',
        ?, ?, 'policy', 'test', ?, ?, 'resolved'
      )
    `).run(
      revisions.watermark + 100,
      "a".repeat(64),
      "b".repeat(64),
      "c".repeat(64),
      "d".repeat(64),
    ),
    /watermark_invalid/,
  );
  database.close();
});

test("D1 seals resolution and projection aggregates when immutable descendants issue", () => {
  const database = createDatabase();
  const revisions = seedClaimGraph(database);

  database.prepare(`
    INSERT INTO zukan_resolution_run_claims(
      resolution_run_id, claim_revision_id, decision, candidate_ordinal
    ) VALUES ('run', ?, 'accepted', 0)
  `).run(revisions.current);
  database.prepare(`
    INSERT INTO zukan_projection_snapshots(
      projection_snapshot_id, resolution_run_id, snapshot_hash,
      reproducibility_at_issue, issued_at
    ) VALUES ('snapshot', 'run', ?, 'full', '2026-07-28T11:30:00.000Z')
  `).run("e".repeat(64));

  assert.throws(
    () => database.prepare(`
      INSERT INTO zukan_resolution_run_claims(
        resolution_run_id, claim_revision_id, decision, candidate_ordinal
      ) VALUES ('run', ?, 'accepted', 1)
    `).run(revisions.peer),
    /resolution_run_claims_sealed_by_snapshot/,
  );

  database.prepare(`
    INSERT INTO zukan_projection_entries(
      projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id,
      entry_payload_json
    ) VALUES ('snapshot', 'before-publication', ?, 'artifact-current', '{}')
  `).run(revisions.current);
  database.exec(`
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, value_artifact_id, purpose, basis, valid_from
    ) VALUES (
      'publication-rights', 'artifact-current', 'publication', 'allowed',
      '2026-07-28T00:00:00.000Z'
    )
  `);
  database.prepare(`
    INSERT INTO zukan_publication_editions(
      publication_edition_id, publication_key, edition_label,
      projection_snapshot_id, manifest_hash, manifest_payload_json, issued_at
    ) VALUES (
      'publication', 'taxon-name', '2026-07-28', 'snapshot', ?, '{}',
      '2026-07-28T12:00:00.000Z'
    )
  `).run("f".repeat(64));

  assert.throws(
    () => database.prepare(`
      INSERT INTO zukan_projection_entries(
        projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id,
        entry_payload_json
      ) VALUES ('snapshot', 'after-publication', ?, 'artifact-current', '{}')
    `).run(revisions.current),
    /projection_entries_sealed_by_publication/,
  );
  assert.deepEqual(
    database.prepare(`
      SELECT entry_key
        FROM zukan_projection_entries
       WHERE projection_snapshot_id = 'snapshot'
       ORDER BY entry_key
    `).all().map((row) => (row as { entry_key: string }).entry_key),
    ["before-publication"],
  );
  database.close();
});

test("D1 prevents tenant rehome through SourceWork and SourceEdition edges", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_subject_identities(
      subject_id, tenant_id, workspace_id, subject_kind
    ) VALUES
      ('publisher-a', 'tenant-a', NULL, 'publisher'),
      ('publisher-a-workspace', 'tenant-a', 'workspace-a', 'publisher'),
      ('publisher-b', 'tenant-b', NULL, 'publisher');
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_source_works(
        source_work_id, tenant_id, title, work_kind, publisher_subject_id
      ) VALUES ('cross-tenant-work', 'tenant-a', 'Cross tenant', 'regional', 'publisher-b')
    `),
    /publisher_scope_mismatch/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_source_works(
        source_work_id, tenant_id, title, work_kind, publisher_subject_id
      ) VALUES (
        'workspace-work', 'tenant-a', 'Workspace publisher', 'regional',
        'publisher-a-workspace'
      )
    `),
    /publisher_scope_mismatch/,
  );
  database.exec(`
    INSERT INTO zukan_source_works(
      source_work_id, tenant_id, title, work_kind, publisher_subject_id
    ) VALUES
      ('work-a', 'tenant-a', 'Work A', 'regional', 'publisher-a'),
      ('work-b', 'tenant-b', 'Work B', 'regional', 'publisher-b');
    INSERT INTO zukan_source_editions(
      source_edition_id, source_work_id, edition_label
    ) VALUES ('edition-a', 'work-a', 'Edition A');
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_source_works
         SET tenant_id = 'tenant-b', publisher_subject_id = 'publisher-b'
       WHERE source_work_id = 'work-a'
    `),
    /source_work_identity_immutable/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_source_works
         SET title = 'Rewritten identity'
       WHERE source_work_id = 'work-a'
    `),
    /source_work_identity_immutable/,
  );
  database.exec(`
    UPDATE zukan_source_works
       SET metadata_json = '{"label":"metadata-only"}'
     WHERE source_work_id = 'work-a'
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_source_editions
         SET source_work_id = 'work-b'
       WHERE source_edition_id = 'edition-a'
    `),
    /source_edition_identity_immutable/,
  );
  database.exec(`
    UPDATE zukan_source_editions
       SET lifecycle_status = 'retired', metadata_json = '{"reason":"retired"}'
     WHERE source_edition_id = 'edition-a'
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_source_editions
         SET lifecycle_status = 'active'
       WHERE source_edition_id = 'edition-a'
    `),
    /lifecycle_irreversible/,
  );
  assert.equal(
    (database.prepare(`
      SELECT lifecycle_status FROM zukan_source_editions
       WHERE source_edition_id = 'edition-a'
    `).get() as { lifecycle_status: string }).lifecycle_status,
    "retired",
  );
  database.close();
});

test("D1 permits watermark zero only while the claim store is empty", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('subject', 'tenant-a', 'taxon');
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
    ) VALUES ('https://zukan.earth/p/name', 1, 'string', 'one', 'positive_only', 'atemporal');
    INSERT INTO zukan_resolution_policy_versions(
      resolution_policy_id, policy_key, policy_version, rules_json
    ) VALUES ('policy', 'name', 1, '{}');
  `);
  const insert = database.prepare(`
    INSERT INTO zukan_resolution_runs(
      resolution_run_id, tenant_id, subject_id, predicate_uri, predicate_version,
      candidate_query_id, candidate_query_version, claim_store_snapshot_token,
      claim_store_sequence_watermark, recorded_time_watermark,
      predicate_registry_snapshot_hash, authority_snapshot_hash,
      resolution_policy_id, evaluator_build, input_hash, output_hash, run_status
    ) VALUES (?, 'tenant-a', 'subject', 'https://zukan.earth/p/name', 1,
      'query', 1, 'empty', ?, '2026-07-28T11:00:00.000Z',
      ?, ?, 'policy', 'test', ?, ?, 'empty')
  `);
  insert.run("empty-run", 0, "a".repeat(64), "b".repeat(64), "c".repeat(64), "d".repeat(64));
  assert.throws(
    () => insert.run(
      "future-empty-run",
      1,
      "a".repeat(64),
      "b".repeat(64),
      "c".repeat(64),
      "d".repeat(64),
    ),
    /watermark_invalid/,
  );
  database.close();
});

test("D1 freezes referenced ValueArtifact payloads and only permits one-way erasure", () => {
  const database = createDatabase();
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_value_artifacts(artifact_id, availability_status)
      VALUES ('bad-suppressed', 'suppressed')
    `),
    /suppression_uses_events/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_value_artifacts(
        artifact_id, content_sha256, availability_status, redacted_at
      ) VALUES (
        'bad-erased', '${"a".repeat(64)}', 'erased',
        '2026-07-28T12:00:00.000Z'
      )
    `),
    /tombstone_must_be_empty/,
  );
  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('artifact-subject', 'tenant-a', 'taxon');
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
    ) VALUES ('https://zukan.earth/p/artifact', 1, 'string', 'one', 'positive_only', 'atemporal');
    INSERT INTO zukan_value_artifacts(
      artifact_id, value_json, value_text, content_sha256, storage_locator, created_at
    ) VALUES (
      'artifact', '{"name":"old"}', 'old', '${"b".repeat(64)}', 'r2://artifact',
      '2026-07-28T10:00:00.000Z'
    );
    INSERT INTO zukan_claims(
      claim_id, subject_id, predicate_uri, predicate_version, tenant_id
    ) VALUES (
      'artifact-claim', 'artifact-subject', 'https://zukan.earth/p/artifact', 1, 'tenant-a'
    );
    INSERT INTO zukan_claim_revisions(
      claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
      value_artifact_id
    ) VALUES (
      'artifact-revision', 'artifact-claim', 1,
      'https://zukan.earth/p/artifact', 1, 'artifact'
    );
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_value_artifacts
         SET value_text = 'rewritten'
       WHERE artifact_id = 'artifact'
    `),
    /mutation_not_allowed/,
  );
  assert.throws(
    () => database.exec(`
      DELETE FROM zukan_value_artifacts
       WHERE artifact_id = 'artifact'
    `),
    /value_artifact_immutable/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_value_artifacts
         SET availability_status = 'redacted',
             redacted_at = '2026-07-28T12:00:00.000Z'
       WHERE artifact_id = 'artifact'
    `),
    /(tombstone_must_be_empty|mutation_not_allowed|governance_incomplete)/,
  );
  database.exec(`
    INSERT INTO zukan_content_governance_events(
      governance_event_id, action, target_kind, target_id, reason, effective_at
    ) VALUES (
      'artifact-redact', 'redact', 'value_artifact', 'artifact', 'test redaction',
      '2026-07-28T12:00:00.000Z'
    );
    UPDATE zukan_value_artifacts
       SET value_json = NULL,
           value_text = NULL,
           content_sha256 = NULL,
           storage_locator = NULL,
           availability_status = 'redacted',
           redacted_at = '2026-07-28T12:00:00.000Z'
     WHERE artifact_id = 'artifact'
  `);
  assert.deepEqual(
    { ...(database.prepare(`
      SELECT artifact_id, content_object_id, value_json, value_text,
             content_sha256, storage_locator, availability_status, redacted_at
        FROM zukan_value_artifacts
       WHERE artifact_id = 'artifact'
    `).get() as Record<string, unknown>) },
    {
      artifact_id: "artifact",
      content_object_id: null,
      value_json: null,
      value_text: null,
      content_sha256: null,
      storage_locator: null,
      availability_status: "redacted",
      redacted_at: "2026-07-28T12:00:00.000Z",
    },
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_value_artifacts
         SET redacted_at = '2026-07-28T12:01:00.000Z'
       WHERE artifact_id = 'artifact'
    `),
    /mutation_not_allowed/,
  );
  database.exec(`
    INSERT INTO zukan_content_governance_events(
      governance_event_id, action, target_kind, target_id, reason, effective_at
    ) VALUES (
      'artifact-erase', 'erase', 'value_artifact', 'artifact', 'test erasure',
      '2026-07-28T12:01:00.000Z'
    );
    UPDATE zukan_value_artifacts
       SET availability_status = 'erased'
     WHERE artifact_id = 'artifact'
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_value_artifacts
         SET availability_status = 'available',
             value_text = 'restored',
             redacted_at = NULL
       WHERE artifact_id = 'artifact'
    `),
    /mutation_not_allowed/,
  );
  database.close();
});

test("D1 keeps PublicIdentifier identity permanent while allowing retirement", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('subject', 'tenant-a', 'taxon');
    INSERT INTO zukan_public_identifiers(
      public_identifier_id, identifier_uri, target_kind, target_id
    ) VALUES ('public-id', 'https://zukan.earth/id/example', 'subject_identity', 'subject')
  `);
  database.exec(`
    UPDATE zukan_public_identifiers
       SET sensitivity_status = 'restricted', retired_at = '2026-07-28'
     WHERE public_identifier_id = 'public-id'
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_public_identifiers
         SET sensitivity_status = 'normal'
       WHERE public_identifier_id = 'public-id'
    `),
    /privacy_irreversible/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_public_identifiers
         SET sensitivity_status = 'existence_sensitive'
       WHERE public_identifier_id = 'public-id'
    `),
    /privacy_irreversible/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_public_identifiers
         SET retired_at = NULL
       WHERE public_identifier_id = 'public-id'
    `),
    /privacy_irreversible/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_public_identifiers
         SET identifier_uri = 'https://zukan.earth/id/reused'
       WHERE public_identifier_id = 'public-id'
    `),
    /identity_immutable/,
  );
  assert.throws(
    () => database.exec("DELETE FROM zukan_public_identifiers WHERE public_identifier_id = 'public-id'"),
    /never_reused/,
  );
  database.close();
});

test("D1 stages source ContentObjects, binds fixity, and preserves byte/privacy identity", () => {
  const database = createDatabase();
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_content_objects(
        content_object_id, object_kind, content_sha256, availability_status
      ) VALUES ('direct', 'source_object', '${"a".repeat(64)}', 'available')
    `),
    /must_stage_missing_with_sha256/,
  );
  database.exec(`
    INSERT INTO zukan_content_objects(
      content_object_id, object_kind, content_sha256, storage_locator, availability_status
    ) VALUES ('object', 'source_object', '${"a".repeat(64)}', 'r2://object', 'missing')
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_content_fixity_events(
        fixity_event_id, content_object_id, content_sha256,
        verification_status, verifier, verified_at
      ) VALUES ('invalid-time', 'object', '${"a".repeat(64)}', 'failed', 'test', 'not-a-time')
    `),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_content_fixity_events(
        fixity_event_id, content_object_id, content_sha256,
        verification_status, verifier, verified_at
      ) VALUES ('wrong-fixity', 'object', '${"b".repeat(64)}', 'verified', 'test', '2026-07-28')
    `),
    /digest_must_match_object/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_content_fixity_events(
        fixity_event_id, content_object_id, content_sha256,
        verification_status, verifier, verified_at
      ) VALUES ('orphan-fixity', 'missing-object', '${"a".repeat(64)}', 'verified', 'test', '2026-07-28')
    `),
    /FOREIGN KEY|digest_must_match_object/,
  );
  database.exec(`
    INSERT INTO zukan_content_fixity_events(
      fixity_event_id, content_object_id, content_sha256,
      verification_status, verifier, verified_at
    ) VALUES ('fixity', 'object', '${"a".repeat(64)}', 'verified', 'test', '2026-07-28');
    UPDATE zukan_content_objects
       SET availability_status = 'available'
     WHERE content_object_id = 'object';
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_content_objects
         SET storage_locator = 'r2://replacement'
       WHERE content_object_id = 'object'
    `),
    /byte_identity_immutable/,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_content_objects
         SET availability_status = 'redacted'
       WHERE content_object_id = 'object'
    `),
    /(lifecycle_invalid|governance_incomplete)/,
  );
  database.exec(`
    INSERT INTO zukan_content_governance_events(
      governance_event_id, action, target_kind, target_id, reason, effective_at
    ) VALUES (
      'object-redact', 'redact', 'content_object', 'object', 'test redaction',
      '2026-07-28T12:00:00.000Z'
    );
    UPDATE zukan_content_objects
       SET availability_status = 'redacted', storage_locator = NULL
     WHERE content_object_id = 'object'
  `);
  assert.throws(
    () => database.exec(`
      UPDATE zukan_content_objects
         SET availability_status = 'available'
       WHERE content_object_id = 'object'
    `),
    /lifecycle_invalid/,
  );
  assert.throws(
    () => database.exec("DELETE FROM zukan_content_objects WHERE content_object_id = 'object'"),
    /content_objects_immutable/,
  );
  database.close();
});

test("D1 rejects breaking predicate revisions under the same URI", () => {
  const database = createDatabase();
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
      ) VALUES ('https://zukan.earth/p/starts-at-two', 2, 'string', 'one', 'positive_only', 'atemporal')
    `),
    /breaking_change_requires_new_uri/,
  );
  database.exec(`
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
    ) VALUES ('https://zukan.earth/p/tags', 1, 'string', 'many', 'positive_or_negative', 'valid_time')
  `);
  database.exec(`
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, value_schema_json,
      cardinality, polarity_mode, temporal_profile
    ) VALUES (
      'https://zukan.earth/p/schema', 1, 'string',
      '{"type":"string","maxLength":100}', 'one', 'positive_only', 'atemporal'
    );
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, value_schema_json,
      cardinality, polarity_mode, temporal_profile
    ) VALUES (
      'https://zukan.earth/p/schema', 2, 'string',
      '{"maxLength":100,"type":"string"}', 'one', 'positive_only', 'atemporal'
    );
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, value_schema_json,
        cardinality, polarity_mode, temporal_profile
      ) VALUES (
        'https://zukan.earth/p/schema', 3, 'string',
        '{"type":"string","maxLength":10}', 'one', 'positive_only', 'atemporal'
      )
    `),
    /breaking_change_requires_new_uri/,
  );
  for (const values of [
    "2, 'number', 'many', 'positive_or_negative', 'valid_time'",
    "2, 'string', 'many', 'positive_only', 'valid_time'",
    "2, 'string', 'many', 'positive_or_negative', 'atemporal'",
    "2, 'string', 'one', 'positive_or_negative', 'valid_time'",
    "3, 'string', 'many', 'positive_or_negative', 'valid_time'",
  ]) {
    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_predicate_definitions(
          predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
        ) VALUES ('https://zukan.earth/p/tags', ${values})
      `),
      /breaking_change_requires_new_uri/,
    );
  }
  database.exec(`
    INSERT INTO zukan_predicate_definitions(
      predicate_uri, predicate_version, value_type, cardinality, polarity_mode, temporal_profile
    ) VALUES ('https://zukan.earth/p/tags', 2, 'string', 'many', 'positive_or_negative', 'valid_time')
  `);
  database.close();
});

test("D1 enforces ExtractionRun terminal shape and completed-survey non-detection", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_content_objects(content_object_id, object_kind)
    VALUES ('input', 'other');
  `);
  const insertExtraction = database.prepare(`
    INSERT INTO zukan_extraction_runs(
      extraction_run_id, input_content_object_id, extractor_kind,
      extractor_version, code_version, input_hash, output_hash, run_status,
      started_at, finished_at
    ) VALUES (?, 'input', 'fixture', '1', '1', ?, ?, ?, ?, ?)
  `);
  assert.throws(
    () => insertExtraction.run(
      "bad-running",
      "a".repeat(64),
      "b".repeat(64),
      "running",
      "2026-07-28T10:00:00.000Z",
      "2026-07-28T10:01:00.000Z",
    ),
    /initial_state_invalid/,
  );
  assert.throws(
    () => insertExtraction.run(
      "bad-success",
      "a".repeat(64),
      null,
      "succeeded",
      "2026-07-28T10:00:00.000Z",
      "2026-07-28T10:01:00.000Z",
    ),
    /initial_state_invalid/,
  );
  insertExtraction.run(
    "run-failed",
    "a".repeat(64),
    null,
    "running",
    "2026-07-28T10:00:00.000Z",
    null,
  );
  database.exec(`
    UPDATE zukan_extraction_runs
       SET run_status = 'failed', finished_at = '2026-07-28T10:01:00.000Z'
     WHERE extraction_run_id = 'run-failed'
  `);
  insertExtraction.run(
    "run-success",
    "a".repeat(64),
    null,
    "running",
    "2026-07-28T10:00:00.000Z",
    null,
  );
  assert.throws(
    () => database.exec(`
      UPDATE zukan_extraction_runs
         SET run_status = 'succeeded', finished_at = '2026-07-28T10:01:00.000Z'
       WHERE extraction_run_id = 'run-success'
    `),
    /transition_invalid/,
  );
  database.exec(`
    UPDATE zukan_extraction_runs
       SET run_status = 'succeeded',
           output_hash = '${"b".repeat(64)}',
           finished_at = '2026-07-28T10:01:00.000Z'
     WHERE extraction_run_id = 'run-success'
  `);

  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('survey-subject', 'tenant-a', 'taxon');
    INSERT INTO zukan_survey_events(
      survey_event_id, tenant_id, subject_scope_json, method_json, effort_json,
      started_at
    ) VALUES (
      'survey', 'tenant-a', '{}', '{}', '{}', '2026-07-28T10:00:00.000Z'
    )
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_detection_outcomes(
        detection_outcome_id, survey_event_id, subject_id, outcome, recorded_at
      ) VALUES (
        'premature', 'survey', 'survey-subject', 'not_detected',
        '2026-07-28T10:30:00.000Z'
      )
    `),
    /scope_mismatch/,
  );
  database.exec(`
    UPDATE zukan_survey_events
       SET ended_at = '2026-07-28T11:00:00.000Z'
     WHERE survey_event_id = 'survey'
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_detection_outcomes(
        detection_outcome_id, survey_event_id, subject_id, outcome, recorded_at
      ) VALUES (
        'backdated', 'survey', 'survey-subject', 'not_detected',
        '2026-07-28T10:59:59.000Z'
      )
    `),
    /scope_mismatch/,
  );
  database.exec(`
    INSERT INTO zukan_detection_outcomes(
      detection_outcome_id, survey_event_id, subject_id, outcome, recorded_at
    ) VALUES (
      'complete', 'survey', 'survey-subject', 'not_detected',
      '2026-07-28T11:00:01.000Z'
    )
  `);
  database.close();
});

test("D1 bounds inherited rights and rejects overlapping contradictory rights", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_content_objects(content_object_id, object_kind)
    VALUES ('parent', 'other');
    INSERT INTO zukan_content_objects(
      content_object_id, parent_content_object_id, object_kind
    ) VALUES ('child', 'parent', 'other');
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, content_object_id, purpose, basis, valid_from,
      valid_to, basis_review_due
    ) VALUES (
      'parent-right', 'parent', 'publication', 'allowed',
      '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z',
      '2026-12-01T00:00:00.000Z'
    );
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, content_object_id, purpose, basis, valid_from,
      valid_to, basis_review_due, inherited_from_rights_evaluation_id
    ) VALUES (
      'child-right', 'child', 'publication', 'allowed',
      '2026-02-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z',
      '2026-10-01T00:00:00.000Z', 'parent-right'
    )
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_rights_evaluations(
        rights_evaluation_id, content_object_id, purpose, basis, valid_from,
        valid_to, inherited_from_rights_evaluation_id
      ) VALUES (
        'widened', 'child', 'publication', 'allowed',
        '2026-01-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z',
        'parent-right'
      )
    `),
    /inheritance_(scope_mismatch|validity_invalid)/,
  );
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_rights_evaluations(
        rights_evaluation_id, content_object_id, purpose, basis, valid_from,
        valid_to
      ) VALUES (
        'contradiction', 'parent', 'publication', 'denied',
        '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'
      )
    `),
    /rights_interval_conflict/,
  );
  database.close();
});

test("D1 workflow events require initial state, strict time, and legal transitions", () => {
  const database = createDatabase();
  database.exec(`
    INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
    VALUES ('workflow-subject', 'tenant-a', 'taxon');
    INSERT INTO zukan_correction_requests(
      correction_request_id, subject_id, request_payload_json, requested_at
    ) VALUES (
      'correction', 'workflow-subject', '{}', '2026-07-28T10:00:00.000Z'
    )
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_correction_request_events(
        correction_request_event_id, correction_request_id, event_type, recorded_at
      ) VALUES (
        'skip-initial', 'correction', 'under_review', '2026-07-28T10:01:00.000Z'
      )
    `),
    /correction_event_transition_invalid/,
  );
  database.exec(`
    INSERT INTO zukan_correction_request_events(
      correction_request_event_id, correction_request_id, event_type, recorded_at
    ) VALUES (
      'submitted', 'correction', 'submitted', '2026-07-28T10:01:00.000Z'
    )
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_correction_request_events(
        correction_request_event_id, correction_request_id, event_type, recorded_at
      ) VALUES (
        'same-time', 'correction', 'under_review', '2026-07-28T10:01:00.000Z'
      )
    `),
    /correction_event_transition_invalid/,
  );
  database.exec(`
    INSERT INTO zukan_correction_request_events(
      correction_request_event_id, correction_request_id, event_type, recorded_at
    ) VALUES (
      'review', 'correction', 'under_review', '2026-07-28T10:02:00.000Z'
    )
  `);
  assert.throws(
    () => database.exec(`
      INSERT INTO zukan_correction_request_events(
        correction_request_event_id, correction_request_id, event_type, recorded_at
      ) VALUES (
        'restart', 'correction', 'submitted', '2026-07-28T10:03:00.000Z'
      )
    `),
    /correction_event_transition_invalid/,
  );
  database.close();
});

test("D1 migration aborts and rolls back on a legacy non-canonical audit hash", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const filename of migrationFiles.slice(0, -1)) {
    database.exec(readFileSync(
      new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
      "utf8",
    ));
  }
  database.prepare(`
    INSERT INTO zukan_value_artifacts(artifact_id, content_sha256)
    VALUES ('legacy-uppercase', ?)
  `).run("A".repeat(64));
  database.exec("BEGIN IMMEDIATE");
  assert.throws(
    () => database.exec(readFileSync(
      new URL(
        "../../cloudflare_shadow/migrations/core/0014_zukan_foundation_v2_integrity_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    )),
    /CHECK constraint failed/,
  );
  database.exec("ROLLBACK");
  const columns = database.prepare("PRAGMA table_info(zukan_subject_identities)").all() as Array<{
    name: string;
  }>;
  assert.equal(columns.some((column) => column.name === "metadata_json"), false);
  database.close();
});

test("D1 migration fails closed on legacy row-level suppression", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  for (const filename of migrationFiles.slice(0, -1)) {
    database.exec(readFileSync(
      new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
      "utf8",
    ));
  }
  database.exec(`
    INSERT INTO zukan_value_artifacts(artifact_id, availability_status)
    VALUES ('legacy-suppressed', 'suppressed')
  `);
  database.exec("BEGIN IMMEDIATE");
  assert.throws(
    () => database.exec(readFileSync(
      new URL(
        "../../cloudflare_shadow/migrations/core/0014_zukan_foundation_v2_integrity_hardening.sql",
        import.meta.url,
      ),
      "utf8",
    )),
    /CHECK constraint failed/,
  );
  database.exec("ROLLBACK");
  const columns = database.prepare("PRAGMA table_info(zukan_subject_identities)").all() as Array<{
    name: string;
  }>;
  assert.equal(columns.some((column) => column.name === "metadata_json"), false);
  database.close();
});

test("D1 publication gate blocks stale rights and subject corrections until withdrawn", () => {
  const database = createDatabase();
  const revisions = seedClaimGraph(database);
  database.prepare(`
    INSERT INTO zukan_resolution_run_claims(
      resolution_run_id, claim_revision_id, decision, candidate_ordinal
    ) VALUES ('run', ?, 'accepted', 0)
  `).run(revisions.current);
  database.prepare(`
    INSERT INTO zukan_projection_snapshots(
      projection_snapshot_id, resolution_run_id, snapshot_hash,
      reproducibility_at_issue, issued_at
    ) VALUES ('snapshot', 'run', ?, 'full', '2026-07-28T11:30:00.000Z')
  `).run("e".repeat(64));
  database.exec(`
    INSERT INTO zukan_projection_entries(
      projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
    ) VALUES (
      'snapshot', 'name', 'revision-current', 'artifact-current'
    );
    INSERT INTO zukan_snapshot_status_events(
      snapshot_status_event_id, projection_snapshot_id, reproducibility_status,
      affected_entry_keys_json, recorded_at
    ) VALUES (
      'snapshot-initial-full', 'snapshot', 'full', '[]',
      '2026-07-28T11:31:00.000Z'
    );
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, value_artifact_id, purpose, basis, valid_from,
      basis_review_due
    ) VALUES (
      'stale-right', 'artifact-current', 'publication', 'allowed',
      '2026-07-28T00:00:00.000Z', '2026-07-28T11:45:00.000Z'
    )
  `);
  const publish = () => database.prepare(`
    INSERT INTO zukan_publication_editions(
      publication_edition_id, publication_key, edition_label,
      projection_snapshot_id, manifest_hash, manifest_payload_json, issued_at
    ) VALUES (
      'publication', 'taxon-name', '2026-07-28', 'snapshot', ?, '{}',
      '2026-07-28T12:00:00.000Z'
    )
  `).run("f".repeat(64));
  assert.throws(publish, /public_gate_failed/);
  database.exec(`
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, value_artifact_id, purpose, basis, valid_from,
      basis_review_due
    ) VALUES (
      'fresh-right', 'artifact-current', 'publication', 'allowed',
      '2026-07-28T00:00:00.000Z', '2026-07-29T00:00:00.000Z'
    );
    INSERT INTO zukan_correction_requests(
      correction_request_id, subject_id, request_payload_json, requested_at
    ) VALUES (
      'subject-correction', 'subject', '{}', '2026-07-28T11:40:00.000Z'
    );
    INSERT INTO zukan_correction_request_events(
      correction_request_event_id, correction_request_id, event_type, recorded_at
    ) VALUES (
      'correction-submitted', 'subject-correction', 'submitted',
      '2026-07-28T11:41:00.000Z'
    )
  `);
  assert.throws(publish, /public_gate_failed/);
  database.exec(`
    INSERT INTO zukan_correction_request_events(
      correction_request_event_id, correction_request_id, event_type, recorded_at
    ) VALUES (
      'correction-withdrawn', 'subject-correction', 'withdrawn',
      '2026-07-28T11:42:00.000Z'
    )
  `);
  publish();
  database.close();
});

test("D1 publication gate blocks governed or degraded snapshot inputs", () => {
  const database = createDatabase();
  const revisions = seedClaimGraph(database);
  database.prepare(`
    INSERT INTO zukan_resolution_run_claims(
      resolution_run_id, claim_revision_id, decision, candidate_ordinal
    ) VALUES ('run', ?, 'accepted', 0)
  `).run(revisions.current);
  database.prepare(`
    INSERT INTO zukan_projection_snapshots(
      projection_snapshot_id, resolution_run_id, snapshot_hash,
      reproducibility_at_issue, issued_at
    ) VALUES ('snapshot', 'run', ?, 'full', '2026-07-28T11:30:00.000Z')
  `).run("e".repeat(64));
  database.exec(`
    INSERT INTO zukan_projection_entries(
      projection_snapshot_id, entry_key, claim_revision_id, value_artifact_id
    ) VALUES (
      'snapshot', 'name', 'revision-current', 'artifact-current'
    );
    INSERT INTO zukan_rights_evaluations(
      rights_evaluation_id, value_artifact_id, purpose, basis, valid_from
    ) VALUES (
      'fresh-right', 'artifact-current', 'publication', 'allowed',
      '2026-07-28T00:00:00.000Z'
    );
    INSERT INTO zukan_content_governance_events(
      governance_event_id, action, target_kind, target_id, reason,
      effective_at, recorded_at
    ) VALUES (
      'suppress-artifact', 'suppress', 'value_artifact', 'artifact-current',
      'legal review', '2026-07-28T11:31:00.000Z',
      '2026-07-28T11:32:00.000Z'
    );
    INSERT INTO zukan_snapshot_status_events(
      snapshot_status_event_id, projection_snapshot_id, governance_event_id,
      reproducibility_status, affected_entry_keys_json, recorded_at
    ) VALUES (
      'snapshot-redacted', 'snapshot', 'suppress-artifact', 'redacted',
      '["name"]', '2026-07-28T11:33:00.000Z'
    )
  `);
  assert.throws(
    () => database.prepare(`
      INSERT INTO zukan_publication_editions(
        publication_edition_id, publication_key, edition_label,
        projection_snapshot_id, manifest_hash, manifest_payload_json, issued_at
      ) VALUES (
        'publication', 'taxon-name', '2026-07-28', 'snapshot', ?, '{}',
        '2026-07-28T12:00:00.000Z'
      )
    `).run("f".repeat(64)),
    /public_gate_failed/,
  );
  database.close();
});

test("D1 hardening keeps every SQL statement below the Cloudflare limit", () => {
  const sql = readFileSync(
    new URL(
      "../../cloudflare_shadow/migrations/core/0014_zukan_foundation_v2_integrity_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const statements: string[] = [];
  let current: string[] = [];
  let trigger = false;
  for (const line of sql.split(/\r?\n/u)) {
    current.push(line);
    if (/^CREATE TRIGGER\b/u.test(line)) trigger = true;
    const statementEnded = trigger
      ? /^END;$/u.test(line.trim())
      : /;$/u.test(line.trim());
    if (statementEnded) {
      statements.push(current.join("\n"));
      current = [];
      trigger = false;
    }
  }
  assert.equal(current.join("").trim(), "");
  const statementBytes = statements.map(
    (statement) => new TextEncoder().encode(statement).byteLength,
  );
  assert.ok(statementBytes.length > 50);
  assert.ok(Math.max(...statementBytes) < 100_000);
});
