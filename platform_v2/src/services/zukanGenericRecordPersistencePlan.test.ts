import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicRegionalKnowledgeUuid,
  planRegionalKnowledgeEnvelope,
  type RegionalKnowledgeEnvelopePlan,
} from "./zukanRegionalKnowledgeEnvelope.js";
import {
  planGenericRecordPersistence,
} from "./zukanGenericRecordPersistencePlan.js";
import {
  ZUKAN_REGIONAL_CORE_PREDICATES,
  regionalCorePredicateByUri,
} from "./zukanRegionalCorePredicates.js";

const tenantId = "tenant-generic-record-fixture";
const reviewAssertedAt = "2026-07-28T18:00:00Z";
const reviewRecordedAt = "2026-07-29T02:00:00Z";

function id(kind: string, externalId: string): string {
  return deterministicRegionalKnowledgeUuid({ tenantId, entityKind: kind, externalId });
}

function reviewedEnvelope(): RegionalKnowledgeEnvelopePlan {
  const placeId = id("subject:place", "iwata");
  const entityId = id("subject:entity", "heritage-1");
  const sourceEditionId = id("source_edition", "iwata-cultural-2024");
  const reviewerId = id("subject:reviewer", "iwata-reviewer");
  const rightsId = id("rights_evaluation", "iwata-publication");
  return planRegionalKnowledgeEnvelope({
    tenantId,
    externalRecordId: "iwata:cultural:BB00000003",
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
    payload: {
      sourceLocator: "linkdata-record:BB00000003",
      sourceUpdatedAt: "2024-03-26T00:00:00.000Z",
      name: "旧見付学校附磐田文庫",
    },
    claims: [
      {
        externalClaimId: "claim:name",
        subjectId: entityId,
        predicateUri: "https://zukan.earth/predicate/name",
        predicateVersion: 1,
        value: "旧見付学校附磐田文庫",
        evidenceRefs: [sourceEditionId],
        reviewState: "human_reviewed",
        accountableReviewerId: reviewerId,
        assertedAt: reviewAssertedAt,
        recordedAt: reviewRecordedAt,
        visibility: "public_candidate",
      },
      {
        externalClaimId: "claim:summary",
        subjectId: entityId,
        predicateUri: "https://zukan.earth/predicate/summary",
        predicateVersion: 1,
        value: "文化財オープンデータと観光施設データの接続候補。",
        evidenceRefs: [sourceEditionId],
        reviewState: "human_reviewed",
        accountableReviewerId: reviewerId,
        assertedAt: reviewAssertedAt,
        recordedAt: reviewRecordedAt,
        visibility: "public_candidate",
      },
    ],
    publication: {
      externalPublicationId: "publication:iwata-cultural-preview",
      audience: "public-shadow",
      purpose: "regional-view-preview",
      selectedClaimExternalIds: ["claim:name", "claim:summary"],
    },
    action: null,
  });
}

test("regional core predicates are unique, versioned, and exclude SourceEdition metadata", () => {
  const keys = ZUKAN_REGIONAL_CORE_PREDICATES.map((predicate) =>
    `${predicate.predicateUri}@${predicate.predicateVersion}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(ZUKAN_REGIONAL_CORE_PREDICATES.length, 3);
  assert.equal(
    regionalCorePredicateByUri("https://zukan.earth/predicate/name", 1)?.valueType,
    "string",
  );
  assert.equal(regionalCorePredicateByUri("https://zukan.earth/predicate/name", 2), null);
  assert.equal(
    regionalCorePredicateByUri("https://zukan.earth/predicate/source-updated-at", 1),
    null,
  );
});

test("persistence plan keeps Record payload and Claim values in separate scoped artifacts", () => {
  const envelope = reviewedEnvelope();
  const plan = planGenericRecordPersistence(envelope);

  assert.equal(plan.mode, "dry_run");
  assert.equal(plan.writeEnabled, false);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts.records, 1);
  assert.equal(plan.counts.recordPayloadScopes, 1);
  assert.equal(plan.counts.claimValueScopes, 2);
  assert.equal(plan.counts.claims, 2);
  assert.equal(plan.counts.claimRevisions, 2);
  assert.equal(plan.counts.claimRecordLinks, 2);
  assert.equal(plan.counts.valueArtifacts, 3);
  assert.equal(plan.counts.subjectLinks, 2);
  assert.equal(plan.counts.sourceLinks, 1);
  assert.equal(
    plan.recordPayloadScopes[0]?.payloadArtifactId,
    plan.records[0]?.payloadArtifactId,
  );
  assert.equal(plan.recordPayloadScopes[0]?.tenantId, tenantId);
  assert.equal(plan.recordPayloadScopes[0]?.workspaceId, null);
  assert.equal(plan.claimValueScopes.length, plan.claimRevisions.length);
  assert.ok(plan.claimValueScopes.every((scope) => scope.tenantId === tenantId));
  assert.notEqual(plan.records[0]?.payloadArtifactId, plan.claimRevisions[0]?.valueArtifactId);
  assert.ok(plan.claimRecordLinks.every((link) => link.recordId === plan.records[0]?.recordId));
  assert.ok(plan.claimRecordLinks.every((link) => link.linkRole === "reviewed_from"));
  assert.ok(plan.claimRevisions.every((revision) =>
    revision.recordedAt === "2026-07-29T02:00:00.000Z"));
  assert.ok(plan.claimRevisions.every((revision) =>
    revision.recordedAt !== plan.records[0]?.recordedAt));
  assert.ok(plan.claimRevisions.every((revision) => {
    const metadata = JSON.parse(revision.revisionMetadataJson) as Record<string, unknown>;
    return metadata.assertedAt === "2026-07-28T18:00:00.000Z"
      && metadata.recordedAt === "2026-07-29T02:00:00.000Z";
  }));
  assert.ok(plan.warnings.includes(
    "publication_candidate_requires_resolution_snapshot_before_persistence",
  ));
});

test("persistence plan is invariant to equivalent envelope ordering", () => {
  const envelope = reviewedEnvelope();
  const first = planGenericRecordPersistence(envelope);
  const second = planGenericRecordPersistence({
    ...envelope,
    claims: [...envelope.claims].reverse(),
    record: {
      ...envelope.record,
      placeSubjectIds: [...envelope.record.placeSubjectIds].reverse(),
      entitySubjectIds: [...envelope.record.entitySubjectIds].reverse(),
      sourceEditionIds: [...envelope.record.sourceEditionIds].reverse(),
      rightsBasisIds: [...envelope.record.rightsBasisIds].reverse(),
    },
  });

  assert.equal(second.payloadSha256, first.payloadSha256);
  assert.deepEqual(second.valueArtifacts, first.valueArtifacts);
  assert.deepEqual(second.recordPayloadScopes, first.recordPayloadScopes);
  assert.deepEqual(second.claimValueScopes, first.claimValueScopes);
  assert.deepEqual(second.claimRevisions, first.claimRevisions);
});

test("unknown predicates fail closed without creating Claim persistence rows", () => {
  const envelope = reviewedEnvelope();
  const plan = planGenericRecordPersistence({
    ...envelope,
    publication: null,
    claims: [{
      ...envelope.claims[0]!,
      externalClaimId: "claim:unknown",
      predicateUri: "https://zukan.earth/predicate/not-registered",
    }],
  });

  assert.ok(plan.blockers.includes(
    "predicate_not_registered:https://zukan.earth/predicate/not-registered:1",
  ));
  assert.equal(plan.counts.claims, 0);
  assert.equal(plan.counts.claimRevisions, 0);
  assert.equal(plan.counts.claimValueScopes, 0);
});

test("public candidates require accountable review, both times, and rights", () => {
  const envelope = reviewedEnvelope();
  const candidate = envelope.claims[0]!;
  const plan = planGenericRecordPersistence({
    ...envelope,
    publication: null,
    record: { ...envelope.record, rightsBasisIds: [] },
    claims: [{
      ...candidate,
      reviewState: "ai_candidate",
      accountableReviewerId: null,
      assertedAt: null,
      recordedAt: null,
    }],
  });

  assert.ok(plan.blockers.includes("public_claim_requires_accountable_review:claim:name"));
  assert.ok(plan.blockers.includes("public_claim_requires_rights_basis:claim:name"));
});

test("non-canonical references and D1 restricted visibility remain blocked", () => {
  const envelope = reviewedEnvelope();
  const plan = planGenericRecordPersistence({
    ...envelope,
    publication: null,
    record: {
      ...envelope.record,
      placeSubjectIds: ["place:iwata"],
      sourceEditionIds: ["source-edition:iwata"],
    },
    claims: [{
      ...envelope.claims[0]!,
      subjectId: "entity:heritage",
      visibility: "restricted",
    }],
  });

  assert.ok(plan.blockers.some((blocker) => blocker.startsWith("subject_id_not_canonical_uuid:")));
  assert.ok(plan.blockers.some((blocker) => blocker.startsWith("source_edition_id_not_canonical_uuid:")));
  assert.ok(plan.blockers.includes("claim_subject_not_canonical_uuid:claim:name"));
  assert.ok(plan.blockers.includes("d1_restricted_claim_visibility_not_supported:claim:name"));
});
