import assert from "node:assert/strict";
import test from "node:test";
import { deterministicRegionalKnowledgeUuid } from "./zukanRegionalKnowledgeEnvelope.js";
import {
  planIwataCulturalSliceV2,
  type IwataCulturalReview,
} from "./zukanIwataCulturalSliceV2.js";

const tenantId = "tenant-zukan-iwata-cultural-v2";
const sourceRecordId = "BB00000003";

function id(kind: string, externalId: string): string {
  return deterministicRegionalKnowledgeUuid({ tenantId, entityKind: kind, externalId });
}

function review(): IwataCulturalReview {
  return {
    reviewerSubjectId: id("subject:reviewer", "iwata-cultural-reviewer"),
    reviewedAt: "2026-07-29T03:00:00Z",
    approvedFields: ["name", "summary", "source_updated_at"],
    rightsBasisId: id("rights_evaluation", "iwata-cultural-publication"),
    publicationOwnerSubjectId: id("subject:publication-owner", "zukan"),
  };
}

test("unreviewed real cultural Record stays private to workflow and produces no Publication", () => {
  const plan = planIwataCulturalSliceV2({ tenantId, sourceRecordId });

  assert.equal(plan.mode, "shadow_only");
  assert.equal(plan.sourceItem.name, "旧見付学校附磐田文庫");
  assert.equal(plan.envelope.record.recordKind, "source_record");
  assert.equal(plan.envelope.claims.length, 3);
  assert.equal(plan.envelope.publication, null);
  assert.equal(plan.publicationCandidates.length, 0);
  assert.equal(plan.persistence.writeEnabled, false);
  assert.equal(plan.persistence.counts.records, 1);
  assert.equal(plan.persistence.counts.recordPayloadScopes, 1);
  assert.deepEqual(plan.blockers, []);
  assert.ok(plan.gates.includes("human_review_pending"));
  assert.ok(plan.gates.includes("rights_basis_materialization_pending"));
});

test("reviewed Claims generate two outputs while persistence remains dry-run", () => {
  const plan = planIwataCulturalSliceV2({
    tenantId,
    sourceRecordId,
    review: review(),
  });

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.persistence.writeEnabled, false);
  assert.equal(plan.persistence.counts.claims, 3);
  assert.equal(plan.persistence.counts.claimRevisions, 3);
  assert.equal(plan.persistence.counts.claimRecordLinks, 3);
  assert.equal(plan.publicationCandidates.length, 2);
  assert.deepEqual(
    plan.publicationCandidates.map((candidate) => candidate.outputKind).sort(),
    ["regional_view", "review_csv"],
  );
  const [regionalView, reviewCsv] = plan.publicationCandidates;
  assert.ok(regionalView);
  assert.ok(reviewCsv);
  assert.deepEqual(regionalView.sourceRecordIds, reviewCsv.sourceRecordIds);
  assert.deepEqual(
    regionalView.selectedClaimCandidateIds,
    reviewCsv.selectedClaimCandidateIds,
  );
  assert.deepEqual(regionalView.rightsBasisIds, reviewCsv.rightsBasisIds);
  assert.notEqual(regionalView.manifestSha256, reviewCsv.manifestSha256);
  assert.ok(plan.warnings.includes(
    "publication_candidate_requires_resolution_snapshot_before_persistence",
  ));
});

test("missing location remains missing and same-place hint never auto-merges", () => {
  const plan = planIwataCulturalSliceV2({
    tenantId,
    sourceRecordId,
    review: review(),
  });

  assert.equal(plan.viewCandidate.location.state, "missing_in_source");
  assert.equal(plan.viewCandidate.location.latitude, null);
  assert.equal(plan.viewCandidate.location.longitude, null);
  assert.equal(plan.viewCandidate.location.address, null);
  assert.equal(plan.viewCandidate.identityCandidates.length, 1);
  assert.equal(plan.viewCandidate.identityCandidates[0]?.automaticMergeAllowed, false);
  assert.equal(
    plan.viewCandidate.identityCandidates[0]?.targetExternalRecordId,
    "iwata:tourism:9",
  );
  assert.ok(plan.gates.includes("identity_link_human_review_pending"));
});

test("equivalent approved-field order produces the same plan", () => {
  const firstReview = review();
  const secondReview = review();
  secondReview.approvedFields = [...secondReview.approvedFields].reverse();

  const first = planIwataCulturalSliceV2({ tenantId, sourceRecordId, review: firstReview });
  const second = planIwataCulturalSliceV2({ tenantId, sourceRecordId, review: secondReview });

  assert.equal(second.payloadSha256, first.payloadSha256);
  assert.deepEqual(second.persistence, first.persistence);
  assert.deepEqual(second.publicationCandidates, first.publicationCandidates);
});

test("invalid review identity and rights references fail closed", () => {
  const invalid = review();
  invalid.reviewerSubjectId = "reviewer:not-a-uuid";
  invalid.rightsBasisId = "rights:not-a-uuid";
  invalid.publicationOwnerSubjectId = "owner:not-a-uuid";

  const plan = planIwataCulturalSliceV2({ tenantId, sourceRecordId, review: invalid });

  assert.equal(plan.publicationCandidates.length, 0);
  assert.ok(plan.blockers.includes("reviewer_subject_not_canonical_uuid"));
  assert.ok(plan.blockers.includes("rights_basis_not_canonical_uuid"));
  assert.ok(plan.blockers.includes("publication_owner_not_canonical_uuid"));
  assert.ok(plan.blockers.some((blocker) =>
    blocker.startsWith("claim_reviewer_not_canonical_uuid:")));
});

test("unknown source Record fails closed", () => {
  assert.throws(
    () => planIwataCulturalSliceV2({ tenantId, sourceRecordId: "UNKNOWN" }),
    /iwata_cultural_source_record_not_found/,
  );
});

test("cultural slice does not reuse biodiversity semantics", () => {
  const serialized = JSON.stringify(planIwataCulturalSliceV2({
    tenantId,
    sourceRecordId,
    review: review(),
  }));

  assert.doesNotMatch(serialized, /taxon|occurrence|identification/iu);
  assert.match(serialized, /source_record/u);
  assert.match(serialized, /recordPayloadScopes/u);
});
