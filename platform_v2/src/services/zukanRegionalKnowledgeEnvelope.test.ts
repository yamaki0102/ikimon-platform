import assert from "node:assert/strict";
import test from "node:test";
import {
  planRegionalKnowledgeEnvelope,
  type RegionalKnowledgeEnvelopeInput,
} from "./zukanRegionalKnowledgeEnvelope.js";

function heritageFixture(): RegionalKnowledgeEnvelopeInput {
  return {
    tenantId: "tenant-zukan-regional-shadow",
    externalRecordId: "fixture:iwata:heritage:record-001",
    recordKind: "source_record",
    recordedAt: "2026-07-29T00:00:00Z",
    occurredAt: null,
    placeSubjectIds: ["place:iwata"],
    entitySubjectIds: ["entity:heritage:fixture-001"],
    sourceEditionIds: ["source-edition:iwata-cultural-properties:2024-03-26"],
    evidenceObjectIds: [],
    rightsBasisIds: ["rights:cc-by-3.0:metadata-fixture"],
    provenanceStatus: "known",
    visibility: "public_candidate",
    payload: {
      fixture: true,
      note: "Synthetic contract fixture. Not a verified cultural-property fact.",
      sourceRecordLocator: "fixture-row-001",
    },
    claims: [{
      externalClaimId: "fixture:iwata:heritage:claim-name-001",
      subjectId: "entity:heritage:fixture-001",
      predicateUri: "https://zukan.earth/predicate/display-name",
      predicateVersion: 1,
      value: { ja: "文化財契約テスト項目" },
      evidenceRefs: ["source-edition:iwata-cultural-properties:2024-03-26"],
      reviewState: "human_reviewed",
      accountableReviewerId: "publisher:iwata-city:fixture-reviewer",
      assertedAt: "2026-07-29T01:00:00Z",
      specialistConclusion: false,
      visibility: "public_candidate",
    }],
    publication: {
      externalPublicationId: "fixture:iwata:view:heritage-001",
      audience: "public-contract-test",
      purpose: "regional-view-candidate",
      selectedClaimExternalIds: ["fixture:iwata:heritage:claim-name-001"],
    },
    action: null,
  };
}

test("non-biological Record stays separate from Claim and Publication", () => {
  const plan = planRegionalKnowledgeEnvelope(heritageFixture());

  assert.equal(plan.mode, "shadow_only");
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.counts.records, 1);
  assert.equal(plan.counts.claims, 1);
  assert.equal(plan.counts.publications, 1);
  assert.equal(plan.counts.actions, 0);
  assert.equal(plan.record.recordKind, "source_record");
  assert.equal(plan.record.sourceEditionIds[0], "source-edition:iwata-cultural-properties:2024-03-26");
  assert.notEqual(plan.record.recordId, plan.claims[0]?.claimCandidateId);
  assert.equal(plan.claims[0]?.sourceRecordId, plan.record.recordId);
  assert.equal(plan.claims[0]?.assertedAt, "2026-07-29T01:00:00.000Z");
  assert.deepEqual(plan.publication?.sourceRecordIds, [plan.record.recordId]);
  assert.deepEqual(
    plan.publication?.selectedClaimCandidateIds,
    [plan.claims[0]?.claimCandidateId],
  );
  assert.doesNotMatch(JSON.stringify(plan), /taxon|occurrence|identification/iu);
});

test("equivalent reference and Claim order produces the same envelope digest", () => {
  const fixture = heritageFixture();
  fixture.placeSubjectIds = ["place:iwata", "place:shizuoka", "place:iwata"];
  fixture.entitySubjectIds = ["entity:heritage:fixture-002", "entity:heritage:fixture-001"];
  fixture.sourceEditionIds = [
    "source-edition:secondary",
    "source-edition:iwata-cultural-properties:2024-03-26",
  ];
  fixture.evidenceObjectIds = ["evidence:b", "evidence:a"];
  fixture.rightsBasisIds = ["rights:b", "rights:a"];
  fixture.claims = [
    ...(fixture.claims ?? []),
    {
      externalClaimId: "fixture:iwata:heritage:claim-status-001",
      subjectId: "entity:heritage:fixture-001",
      predicateUri: "https://zukan.earth/predicate/review-status",
      predicateVersion: 1,
      value: "candidate",
      evidenceRefs: ["evidence:b", "evidence:a"],
      reviewState: "ai_candidate",
      assertedAt: "2026-07-29T00:30:00Z",
      visibility: "workspace",
    },
  ];
  fixture.publication = null;

  const first = planRegionalKnowledgeEnvelope(fixture);
  const second = planRegionalKnowledgeEnvelope({
    ...fixture,
    placeSubjectIds: [...fixture.placeSubjectIds].reverse(),
    entitySubjectIds: [...fixture.entitySubjectIds].reverse(),
    sourceEditionIds: [...fixture.sourceEditionIds].reverse(),
    evidenceObjectIds: [...fixture.evidenceObjectIds].reverse(),
    rightsBasisIds: [...fixture.rightsBasisIds].reverse(),
    claims: [...(fixture.claims ?? [])].reverse().map((claim) => ({
      ...claim,
      evidenceRefs: [...claim.evidenceRefs].reverse(),
    })),
  });

  assert.equal(second.payloadSha256, first.payloadSha256);
  assert.deepEqual(second.record, first.record);
  assert.deepEqual(second.claims, first.claims);
});

test("reviewed Claims require a valid assertion time after the source Record", () => {
  const missing = heritageFixture();
  missing.publication = null;
  missing.claims = [{
    ...missing.claims![0]!,
    assertedAt: null,
  }];
  const missingPlan = planRegionalKnowledgeEnvelope(missing);
  assert.ok(missingPlan.blockers.includes(
    "human_review_requires_asserted_at:fixture:iwata:heritage:claim-name-001",
  ));

  const earlier = heritageFixture();
  earlier.publication = null;
  earlier.claims = [{
    ...earlier.claims![0]!,
    assertedAt: "2026-07-28T23:59:59Z",
  }];
  const earlierPlan = planRegionalKnowledgeEnvelope(earlier);
  assert.ok(earlierPlan.blockers.includes(
    "claim_asserted_before_record:fixture:iwata:heritage:claim-name-001",
  ));
});

test("emergency and guaranteed-SLA action requests fail closed", () => {
  const input = heritageFixture();
  input.publication = null;
  input.action = {
    externalCaseId: "fixture:case:urgent-001",
    actionKind: "inspection_request",
    emergency: true,
    responseSlaGuaranteed: true,
    accountablePartyId: "organization:fixture-operator",
  };

  const plan = planRegionalKnowledgeEnvelope(input);
  assert.equal(plan.action, null);
  assert.equal(plan.counts.actions, 0);
  assert.ok(plan.blockers.includes("emergency_action_not_supported"));
  assert.ok(plan.blockers.includes("response_sla_not_supported"));
});

test("non-emergency action is an optional Case reference, not canonical truth", () => {
  const input = heritageFixture();
  input.publication = null;
  input.action = {
    externalCaseId: "fixture:case:correction-001",
    actionKind: "correction_request",
    emergency: false,
    responseSlaGuaranteed: false,
    accountablePartyId: "organization:iwata-fixture-owner",
  };

  const plan = planRegionalKnowledgeEnvelope(input);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.action?.sourceRecordId, plan.record.recordId);
  assert.equal(plan.action?.emergency, false);
  assert.equal(plan.action?.responseSlaGuaranteed, false);
  assert.equal(plan.record.recordKind, "source_record");
});

test("specialist conclusions require an accountable human review", () => {
  const input = heritageFixture();
  input.publication = null;
  input.claims = [{
    externalClaimId: "fixture:tree:safety-conclusion-001",
    subjectId: "entity:heritage:fixture-001",
    predicateUri: "https://zukan.earth/predicate/safety-conclusion",
    predicateVersion: 1,
    value: "safe",
    evidenceRefs: ["source-edition:iwata-cultural-properties:2024-03-26"],
    reviewState: "ai_candidate",
    accountableReviewerId: null,
    assertedAt: "2026-07-29T01:00:00Z",
    specialistConclusion: true,
    visibility: "restricted",
  }];

  const plan = planRegionalKnowledgeEnvelope(input);
  assert.ok(plan.blockers.includes(
    "specialist_conclusion_requires_accountable_review:fixture:tree:safety-conclusion-001",
  ));
});

test("unknown provenance is represented explicitly and never invented", () => {
  const input = heritageFixture();
  input.provenanceStatus = "unknown";
  input.sourceEditionIds = [];
  input.evidenceObjectIds = [];
  input.claims = [];
  input.publication = null;

  const plan = planRegionalKnowledgeEnvelope(input);
  assert.deepEqual(plan.blockers, []);
  assert.ok(plan.warnings.includes("provenance_unknown_explicit"));
  assert.deepEqual(plan.record.sourceEditionIds, []);
  assert.deepEqual(plan.record.evidenceObjectIds, []);
});
