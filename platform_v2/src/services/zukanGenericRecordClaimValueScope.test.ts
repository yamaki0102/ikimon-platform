import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  deterministicRegionalKnowledgeUuid,
  planRegionalKnowledgeEnvelope,
} from "./zukanRegionalKnowledgeEnvelope.js";
import { planGenericRecordPersistence } from "./zukanGenericRecordPersistencePlan.js";

const tenantId = "tenant-claim-value-scope";

function rid(kind: string, externalId: string): string {
  return deterministicRegionalKnowledgeUuid({ tenantId, entityKind: kind, externalId });
}

function uuid(value: number): string {
  return `20000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
}

const d1MigrationNames = [
  "0009_zukan_foundation_v2_source_identity.sql",
  "0010_zukan_foundation_v2_predicate_claims.sql",
  "0011_zukan_foundation_v2_authority_resolution.sql",
  "0012_zukan_foundation_v2_governance_rights.sql",
  "0013_zukan_foundation_v2_disputes_coverage.sql",
  "0014_zukan_foundation_v2_integrity_hardening.sql",
  "0015_zukan_foundation_v2_records.sql",
  "0016_zukan_foundation_v2_record_claim_value_scopes.sql",
] as const;

test("mapper emits one Claim value scope per persisted Claim value artifact", () => {
  const placeId = rid("subject:place", "iwata");
  const entityId = rid("subject:entity", "heritage");
  const sourceEditionId = rid("source_edition", "cultural-2024");
  const reviewerId = rid("subject:reviewer", "reviewer");
  const rightsId = rid("rights_evaluation", "publication");
  const envelope = planRegionalKnowledgeEnvelope({
    tenantId,
    externalRecordId: "record:heritage",
    recordKind: "source_record",
    recordedAt: "2026-07-28T00:00:00Z",
    occurredAt: "2024-03-26T00:00:00Z",
    placeSubjectIds: [placeId],
    entitySubjectIds: [entityId],
    sourceEditionIds: [sourceEditionId],
    evidenceObjectIds: [],
    rightsBasisIds: [rightsId],
    provenanceStatus: "known",
    visibility: "workspace",
    payload: { sourceLocator: "row:1" },
    claims: [{
      externalClaimId: "claim:name",
      subjectId: entityId,
      predicateUri: "https://zukan.earth/predicate/name",
      predicateVersion: 1,
      value: "旧見付学校附磐田文庫",
      evidenceRefs: [sourceEditionId],
      reviewState: "human_reviewed",
      accountableReviewerId: reviewerId,
      assertedAt: "2026-07-29T00:00:00Z",
      visibility: "public_candidate",
    }],
    publication: null,
    action: null,
  });
  const plan = planGenericRecordPersistence(envelope);

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts.claimValueScopes, 1);
  assert.equal(plan.claimValueScopes.length, plan.claimRevisions.length);
  assert.equal(
    plan.claimValueScopes[0]?.valueArtifactId,
    plan.claimRevisions[0]?.valueArtifactId,
  );
  assert.equal(plan.claimValueScopes[0]?.tenantId, tenantId);
  assert.notEqual(
    plan.claimValueScopes[0]?.valueArtifactId,
    plan.recordPayloadScopes[0]?.payloadArtifactId,
  );
});

test("D1 rejects a Claim-Record link without a matching Claim value scope", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  try {
    for (const filename of d1MigrationNames) {
      database.exec(readFileSync(
        new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
        "utf8",
      ));
    }

    const entityId = uuid(1);
    const recordArtifactId = uuid(2);
    const claimArtifactId = uuid(3);
    const recordId = uuid(4);
    const claimId = uuid(5);
    const revisionId = uuid(6);
    const predicate = "https://zukan.earth/predicate/name";
    database.exec(`
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${entityId}', 'tenant-a', 'regional_entity');
      INSERT INTO zukan_value_artifacts(artifact_id, value_json, content_sha256)
      VALUES
        ('${recordArtifactId}', '{}', '${"a".repeat(64)}'),
        ('${claimArtifactId}', '"name"', '${"b".repeat(64)}');
      INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
      VALUES ('${recordArtifactId}', 'tenant-a');
      INSERT INTO zukan_records(
        record_id, tenant_id, record_kind, recorded_at,
        payload_artifact_id, provenance_status, visibility
      ) VALUES (
        '${recordId}', 'tenant-a', 'source_record', '2026-07-28T00:00:00.000Z',
        '${recordArtifactId}', 'known', 'workspace'
      );
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality,
        polarity_mode, temporal_profile
      ) VALUES ('${predicate}', 1, 'string', 'one', 'positive_only', 'valid_time');
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES ('${claimId}', '${entityId}', '${predicate}', 1, 'tenant-a');
      INSERT INTO zukan_claim_revisions(
        claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
        value_artifact_id, visibility, metadata_json
      ) VALUES (
        '${revisionId}', '${claimId}', 1, '${predicate}', 1,
        '${claimArtifactId}', 'workspace', '{}'
      );
    `);

    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_claim_record_links(claim_revision_id, record_id, link_role)
        VALUES ('${revisionId}', '${recordId}', 'asserted_from')
      `),
      /zukan_claim_value_scope_mismatch/,
    );

    database.exec(`
      INSERT INTO zukan_claim_value_scopes(value_artifact_id, tenant_id)
      VALUES ('${claimArtifactId}', 'tenant-a');
      INSERT INTO zukan_claim_record_links(claim_revision_id, record_id, link_role)
      VALUES ('${revisionId}', '${recordId}', 'asserted_from');
    `);
    const count = database.prepare(
      "SELECT COUNT(*) AS count FROM zukan_claim_record_links",
    ).get() as { count: number };
    assert.equal(count.count, 1);
  } finally {
    database.close();
  }
});

test("D1 rejects cross-tenant Claim value scope even when Claim and Record match", () => {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON");
  try {
    for (const filename of d1MigrationNames) {
      database.exec(readFileSync(
        new URL(`../../cloudflare_shadow/migrations/core/${filename}`, import.meta.url),
        "utf8",
      ));
    }

    const entityId = uuid(20);
    const recordArtifactId = uuid(21);
    const claimArtifactId = uuid(22);
    const recordId = uuid(23);
    const claimId = uuid(24);
    const revisionId = uuid(25);
    const predicate = "https://zukan.earth/predicate/name";
    database.exec(`
      INSERT INTO zukan_subject_identities(subject_id, tenant_id, subject_kind)
      VALUES ('${entityId}', 'tenant-a', 'regional_entity');
      INSERT INTO zukan_value_artifacts(artifact_id, value_json, content_sha256)
      VALUES
        ('${recordArtifactId}', '{}', '${"c".repeat(64)}'),
        ('${claimArtifactId}', '"name"', '${"d".repeat(64)}');
      INSERT INTO zukan_record_payload_scopes(payload_artifact_id, tenant_id)
      VALUES ('${recordArtifactId}', 'tenant-a');
      INSERT INTO zukan_claim_value_scopes(value_artifact_id, tenant_id)
      VALUES ('${claimArtifactId}', 'tenant-b');
      INSERT INTO zukan_records(
        record_id, tenant_id, record_kind, recorded_at,
        payload_artifact_id, provenance_status, visibility
      ) VALUES (
        '${recordId}', 'tenant-a', 'source_record', '2026-07-28T00:00:00.000Z',
        '${recordArtifactId}', 'known', 'workspace'
      );
      INSERT INTO zukan_predicate_definitions(
        predicate_uri, predicate_version, value_type, cardinality,
        polarity_mode, temporal_profile
      ) VALUES ('${predicate}', 1, 'string', 'one', 'positive_only', 'valid_time');
      INSERT INTO zukan_claims(
        claim_id, subject_id, predicate_uri, predicate_version, tenant_id
      ) VALUES ('${claimId}', '${entityId}', '${predicate}', 1, 'tenant-a');
      INSERT INTO zukan_claim_revisions(
        claim_revision_id, claim_id, revision, predicate_uri, predicate_version,
        value_artifact_id, visibility, metadata_json
      ) VALUES (
        '${revisionId}', '${claimId}', 1, '${predicate}', 1,
        '${claimArtifactId}', 'workspace', '{}'
      );
    `);

    assert.throws(
      () => database.exec(`
        INSERT INTO zukan_claim_record_links(claim_revision_id, record_id, link_role)
        VALUES ('${revisionId}', '${recordId}', 'asserted_from')
      `),
      /zukan_claim_value_scope_mismatch/,
    );
  } finally {
    database.close();
  }
});
