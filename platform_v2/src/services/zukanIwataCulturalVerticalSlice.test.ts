import assert from "node:assert/strict";
import test from "node:test";
import {
  planIwataCulturalVerticalSlice,
  type IwataCulturalReviewApproval,
} from "./zukanIwataCulturalVerticalSlice.js";

const tenantId = "tenant-zukan-iwata-cultural-shadow";
const sourceRecordId = "BB00000003";

function approval(): IwataCulturalReviewApproval {
  return {
    reviewerSubjectId: "subject:iwata-cultural-reviewer:fixture",
    reviewedAt: "2026-07-29T01:00:00Z",
    approvedFields: ["name", "source_updated_at", "summary"],
    rightsBasisId: "rights:iwata-linkdata-attribution:fixture",
    publicationOwnerSubjectId: "subject:zukan-publication-owner:fixture",
  };
}

test("real Iwata cultural source record enters as Record with review gates", () => {
  const plan = planIwataCulturalVerticalSlice({ tenantId, sourceRecordId });

  assert.equal(plan.mode, "shadow_only");
  assert.equal(plan.sourceItem.name, "旧見付学校附磐田文庫");
  assert.equal(plan.sourceItem.dataset, "cultural");
  assert.equal(plan.envelope.record.recordKind, "source_record");
  assert.equal(plan.envelope.record.sourceEditionIds[0], plan.sourceEditionId);
  assert.equal(plan.envelope.claims.length, 3);
  assert.equal(plan.publicationCandidates.length, 0);
  assert.ok(plan.gates.includes("human_review_pending"));
  assert.ok(plan.gates.includes("rights_basis_materialization_pending"));
  assert.ok(plan.gates.includes("identity_link_human_review_pending"));
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.foundationReadiness.writerEnabled, false);
  assert.equal(plan.foundationReadiness.runtimeReaderEnabled, false);
});

test("approved Claims produce two outputs from the same Record and Claim selection", () => {
  const plan = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: approval(),
  });

  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.publicationCandidates.length, 2);
  assert.deepEqual(
    plan.publicationCandidates.map((candidate) => candidate.outputKind).sort(),
    ["regional_view", "review_csv"],
  );
  const [first, second] = plan.publicationCandidates;
  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(first.sourceRecordIds, second.sourceRecordIds);
  assert.deepEqual(first.selectedClaimCandidateIds, second.selectedClaimCandidateIds);
  assert.deepEqual(first.sourceEditionIds, second.sourceEditionIds);
  assert.deepEqual(first.rightsBasisIds, second.rightsBasisIds);
  assert.notEqual(first.publicationCandidateId, second.publicationCandidateId);
  assert.notEqual(first.manifestSha256, second.manifestSha256);
  assert.equal(plan.viewCandidate.reviewState, "reviewed_for_shadow_publication");
  assert.equal(plan.envelope.publication?.sourceRecordIds[0], plan.envelope.record.recordId);
});

test("missing source location remains missing and a same-place hint never auto-merges", () => {
  const plan = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: approval(),
  });

  assert.equal(plan.viewCandidate.location.state, "missing_in_source");
  assert.equal(plan.viewCandidate.location.latitude, null);
  assert.equal(plan.viewCandidate.location.longitude, null);
  assert.equal(plan.viewCandidate.location.address, null);
  assert.equal(plan.viewCandidate.identityLinkCandidates.length, 1);
  assert.equal(plan.viewCandidate.identityLinkCandidates[0]?.state, "candidate");
  assert.equal(plan.viewCandidate.identityLinkCandidates[0]?.automaticMergeAllowed, false);
  assert.equal(
    plan.viewCandidate.identityLinkCandidates[0]?.targetExternalRecordId,
    "iwata:tourism:9",
  );
});

test("equivalent approved-field order produces the same plan digest", () => {
  const first = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: approval(),
  });
  const reversed = approval();
  reversed.approvedFields = [...reversed.approvedFields].reverse();
  const second = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: reversed,
  });

  assert.equal(second.payloadSha256, first.payloadSha256);
  assert.deepEqual(second.envelope, first.envelope);
  assert.deepEqual(second.publicationCandidates, first.publicationCandidates);
});

test("unknown cultural source record fails closed", () => {
  assert.throws(
    () => planIwataCulturalVerticalSlice({
      tenantId,
      sourceRecordId: "DOES_NOT_EXIST",
    }),
    /iwata_cultural_source_record_not_found/,
  );
});

test("invalid publication approval does not create outputs", () => {
  const invalid = approval();
  invalid.approvedFields = [];
  invalid.rightsBasisId = "";
  invalid.publicationOwnerSubjectId = "";

  const plan = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: invalid,
  });

  assert.equal(plan.publicationCandidates.length, 0);
  assert.ok(plan.blockers.includes("approved_claim_required_for_publication"));
  assert.ok(plan.blockers.includes("rights_basis_required_for_publication"));
  assert.ok(plan.blockers.includes("publication_owner_required"));
});

test("vertical slice does not reuse biodiversity semantics", () => {
  const plan = planIwataCulturalVerticalSlice({
    tenantId,
    sourceRecordId,
    review: approval(),
  });
  const serialized = JSON.stringify(plan);

  assert.doesNotMatch(serialized, /taxon|occurrence|identification/iu);
  assert.match(serialized, /source_record/u);
  assert.match(serialized, /publicationCandidates/u);
});
