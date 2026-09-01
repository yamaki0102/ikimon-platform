import assert from "node:assert/strict";
import test from "node:test";
import { planProgramHandover, type ProgramHandoverInput } from "./programHandoverPlanner.js";

const baseInput = (): ProgramHandoverInput => ({
  source: {
    programId: "program-school-2026",
    revision: "rev-2026-01",
    lifecycle: "ended",
    availableRefs: {
      placeIds: ["place-river-park"],
      recordIds: ["record-river-01", "record-river-02"],
      questIds: ["quest-spring-walk"],
      templateIds: ["template-school-field"],
    },
  },
  target: {
    programId: "program-school-2027",
    continuationId: "continuation-school-2027",
  },
  selectedRefs: {
    placeIds: ["place-river-park"],
    recordIds: ["record-river-01"],
    questIds: ["quest-spring-walk"],
    templateIds: ["template-school-field"],
  },
  outgoingActor: {
    id: "teacher-2026",
    status: "active",
    scopeProgramId: "program-school-2026",
  },
  incomingActor: {
    id: "teacher-2027",
    status: "authorized",
    scopeProgramId: "program-school-2027",
  },
  idempotency: { key: "handover-school-2027-01" },
  observed: {
    observedAt: "2026-09-02T00:00:00.000Z",
    lifecycle: { sourceState: "ended", targetState: "not_created" },
    rights: {
      boundary: "resolved",
      consent: "valid",
      review: "approved",
      publicationApproval: "approved",
    },
  },
});

test("M7.0 accepts an academic-year handover with explicit provenance and responsibility", () => {
  const result = planProgramHandover(baseInput());
  assert.equal(result.decision, "accepted");
  assert.equal(result.provenance.source.programId, "program-school-2026");
  assert.equal(result.provenance.target.continuationId, "continuation-school-2027");
  assert.equal(result.responsibility.incoming.status, "authorized");
  assert.match(result.planIdentity, /^[a-f0-9]{64}$/u);
});

test("guardian withdrawal fails closed without copying consent", () => {
  const input = baseInput();
  input.observed.rights.consent = "withdrawn";
  const result = planProgramHandover(input);
  assert.equal(result.decision, "rejected");
  assert.ok(result.blockedReasons.includes("rights_consent_unresolved"));
  assert.equal(result.resetState.consent, "not_granted");
});

test("unresolved Review is reference-only and never becomes approved", () => {
  const input = baseInput();
  input.observed.rights.review = "unresolved";
  const result = planProgramHandover(input);
  assert.equal(result.decision, "accepted");
  assert.ok(result.warnings.includes("review_reference_not_approval"));
  assert.equal(result.resetState.review, "not_started");
  assert.equal(result.resetState.publicationApproval, "not_granted");
});

test("Place and Record selections remain canonical references without duplication", () => {
  const result = planProgramHandover(baseInput());
  assert.deepEqual(result.reuseRefs.placeIds, ["place-river-park"]);
  assert.deepEqual(result.reuseRefs.recordIds, ["record-river-01"]);
  assert.equal(result.identityPolicy.duplicateCanonicalPlaceRecord, false);
  assert.equal("copiedRecords" in result, false);
});

test("outgoing actor removed after acceptance remains explicit provenance", () => {
  const input = baseInput();
  input.outgoingActor.status = "removed";
  input.outgoingActor.acceptedAt = "2026-08-01T00:00:00.000Z";
  const result = planProgramHandover(input);
  assert.equal(result.decision, "accepted");
  assert.equal(result.responsibility.outgoing.status, "removed_after_acceptance");
  assert.ok(result.warnings.includes("outgoing_actor_removed_after_acceptance"));
});

test("unknown or unauthorized incoming actor fails closed", () => {
  const input = baseInput();
  input.incomingActor = { id: "unknown", status: "unknown", scopeProgramId: "program-school-2027" };
  const result = planProgramHandover(input);
  assert.equal(result.decision, "rejected");
  assert.ok(result.blockedReasons.includes("incoming_actor_not_authorized"));
});

test("retry converges to one logical plan identity", () => {
  const first = planProgramHandover(baseInput());
  const retryInput = baseInput();
  retryInput.idempotency.priorPlan = {
    key: retryInput.idempotency.key,
    payloadDigest: first.payloadDigest,
    planIdentity: first.planIdentity,
  };
  const retry = planProgramHandover(retryInput);
  assert.equal(retry.decision, "accepted");
  assert.equal(retry.planIdentity, first.planIdentity);
  assert.equal(retry.logicalPlanId, first.logicalPlanId);
  assert.deepEqual(retry.reuseRefs, first.reuseRefs);
});

test("same idempotency key with a different payload is rejected", () => {
  const first = planProgramHandover(baseInput());
  const changed = baseInput();
  changed.selectedRefs.recordIds = ["record-river-02"];
  changed.idempotency.priorPlan = {
    key: changed.idempotency.key,
    payloadDigest: first.payloadDigest,
    planIdentity: first.planIdentity,
  };
  const result = planProgramHandover(changed);
  assert.equal(result.decision, "rejected");
  assert.ok(result.blockedReasons.includes("same_key_different_payload"));
});

test("invalid selected references fail closed", () => {
  const input = baseInput();
  input.selectedRefs.recordIds = ["record-does-not-exist"];
  const result = planProgramHandover(input);
  assert.equal(result.decision, "rejected");
  assert.ok(result.blockedReasons.includes("selected_record_ref_unknown"));
});

test("participant, consent, Review, publication and visibility state never carry over", () => {
  const result = planProgramHandover(baseInput());
  assert.deepEqual(result.resetState, {
    participant: "not_started",
    consent: "not_granted",
    review: "not_started",
    publicationApproval: "not_granted",
    visibility: "private",
  });
  assert.equal(result.identityPolicy.duplicateCanonicalPlaceRecord, false);
  assert.deepEqual(result.sideEffects, { databaseWrites: 0, runtimeMutations: 0, productionMutations: 0 });
});

test("partial or invalid input is never completed", () => {
  const input = baseInput();
  input.source.revision = "";
  const result = planProgramHandover(input);
  assert.equal(result.decision, "rejected");
  assert.ok(result.blockedReasons.includes("source_revision_missing"));
  assert.notEqual(result.status, "completed");
});

test("planner does not mutate its input", () => {
  const input = baseInput();
  const before = structuredClone(input);
  const result = planProgramHandover(Object.freeze(input));
  assert.deepEqual(input, before);
  assert.deepEqual(result.sideEffects, { databaseWrites: 0, runtimeMutations: 0, productionMutations: 0 });
});
