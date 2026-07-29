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
        visibility: "public_candidate",
      },
      {
        externalClaimId: "claim:source-updated-at",
        subjectId: entityId,
        predicateUri: "https://zukan.earth/predicate/source-updated-at",
        predicateVersion: 1,
        value: "2024-03-26T00:00:00.000Z",
        evidenceRefs: [sourceEditionId],
        reviewState: "human_reviewed",
        accountableReviewerId: reviewerId,
        visibility: "public_candidate",
      },
    ],
    publication: {
      externalPublicationId: "publication:iwata-cultural-preview",
      audience: "public-shadow",
      purpose: "regional-view-preview",
      selectedClaimExternalIds: ["claim:name", "claim:source-updated-at"],
    },
    action: null,
  });
}

test("regional core predicates are unique and versioned", () => {
  const keys = ZUKAN_REGIONAL_CORE_PREDICATES.map((predicate) =>
    `${predicate.predicateUri}@${predicate.predicateVersion}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(
    regionalCorePredicateByUri("https://zukan.earth/predicate/name", 1)?.valueType,
    "string",
  );
  assert.equal(regionalCorePredicateByUri("https://zukan.earth/predicate/name", 2), null);
});

test("persistence plan keeps Record payload and Claim values in separate artifacts", () => {
  const envelope = reviewedEnvelope();
  const plan = planGenericRecordPersistence(envelope);

  assert.equal(plan.mode, "dry_run");
  assert.equal(plan.writeEnabled, false);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts.records, 1);
  assert.equal(plan.counts.claims, 2);
  assert.equal(plan.counts.claimRevisions, 2);
  assert.equal(plan.counts.claimRecordLinks, 2);
  assert.equal(plan.counts.valueArtifacts, 3);
  assert.equal(plan.counts.subjectLinks, 2);
  assert.equal(plan.counts.sourceLinks, 1);
  assert.notEqual(plan.records[0]?.payloadArtifactId, plan.claimRevisions[0]?.valueArtifactId);
  assert.ok(plan.claimRecordLinks.every((link) => link.recordId === plan.records[0]?.recordId));
  assert.ok(plan.claimRecordLinks.every((link) => link.linkRole === "reviewed_from"));
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
});

test("public candidates require accountable review and a canonical rights dependency", () => {
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
