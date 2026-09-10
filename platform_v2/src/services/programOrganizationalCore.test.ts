import assert from "node:assert/strict";
import test from "node:test";
import {
  appendReviewDecision,
  canActInProgram,
  normalizeConsentRecord,
  normalizeProgram,
  normalizeProgramParticipant,
  normalizeProgramRoleAssignment,
  normalizeProgramTeam,
  normalizeQuest,
  normalizeQuestParticipation,
  normalizeReviewDecision,
  planProgramHandoverBinding,
  type ProgramHandoverInput,
} from "./programOrganizationalCore.js";

const rightsInput = (overrides: Record<string, unknown> = {}) => ({
  visitId: "visit-1",
  recordConsent: "public_summary" as const,
  areaProfileUseConsent: "aggregated_public" as const,
  publicAggregationAllowed: true,
  consentSource: "user_selected" as const,
  ...overrides,
});

const handoverInput = (): ProgramHandoverInput => ({
  source: {
    programId: "program-school-2026",
    revision: "rev-1",
    lifecycle: "ended",
    availableRefs: {
      placeIds: ["place-river"],
      recordIds: ["record-1"],
      questIds: ["quest-spring"],
      templateIds: ["template-school"],
    },
  },
  target: { programId: "program-school-2027", continuationId: "continuation-1" },
  selectedRefs: {
    placeIds: ["place-river"],
    recordIds: ["record-1"],
    questIds: ["quest-spring"],
    templateIds: ["template-school"],
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
  idempotency: { key: "handover-1" },
  observed: {
    observedAt: "2026-09-10T00:00:00.000Z",
    lifecycle: { sourceState: "ended", targetState: "draft" },
    rights: {
      boundary: "resolved",
      consent: "valid",
      review: "approved",
      publicationApproval: "approved",
    },
  },
});

test("stable Program and role scope are explicit and independent of plan inputs", () => {
  const program = normalizeProgram({
    programId: " program-1 ",
    revision: "rev-1",
    title: "School field work",
    lifecycle: "active",
    visibility: "program_restricted",
  });
  const assignment = normalizeProgramRoleAssignment({
    assignmentId: "assignment-1",
    programId: program.programId,
    actorId: "teacher-1",
    role: "organizer",
    scope: "program",
    status: "active",
    assignedAt: "2026-09-10T00:00:00.000Z",
    source: "fixture",
  });

  assert.equal(program.programId, "program-1");
  assert.equal(canActInProgram("teacher-1", "program-1", [assignment]), true);
  assert.equal(canActInProgram("teacher-1", "other-program", [assignment]), false);
  assert.equal(canActInProgram("teacher-1", "program-1", [{ ...assignment, status: "revoked" }]), false);
  const unpaidAssignment = { ...assignment, paymentStatus: "unpaid" } as unknown as typeof assignment;
  assert.equal(canActInProgram("teacher-1", "program-1", [unpaidAssignment]), true);
});

test("participant, team, and quest identities remain explicit and stable", () => {
  const participant = normalizeProgramParticipant({
    participantId: " participant-1 ",
    programId: " program-1 ",
    subjectId: " subject-1 ",
    status: "active",
    joinedAt: "2026-09-10T00:00:00.000Z",
  });
  const team = normalizeProgramTeam({
    teamId: "team-1",
    programId: participant.programId,
    label: "River team",
    participantIds: [participant.participantId, participant.participantId],
    status: "active",
  });
  const quest = normalizeQuest({
    questId: "quest-1",
    programId: participant.programId,
    revision: "rev-1",
    title: "Spring quest",
    status: "active",
  });
  const participation = normalizeQuestParticipation({
    participationId: "participation-1",
    programId: quest.programId,
    questId: quest.questId,
    participantId: participant.participantId,
    status: "in_progress",
  });

  assert.equal(participant.participantId, "participant-1");
  assert.deepEqual(team.participantIds, ["participant-1"]);
  assert.equal(participation.questId, "quest-1");
  assert.throws(() => normalizeProgramParticipant({ ...participant, participantId: " " }), /participant_id_required/);
  assert.throws(() => normalizeQuestParticipation({ ...participation, questId: "" }), /quest_id_required/);
});

test("versioned consent reuses observation rights and preserves withdrawal state", () => {
  const active = normalizeConsentRecord({
    consentId: "consent-1",
    programId: "program-1",
    subjectId: "participant-1",
    guardianId: "guardian-1",
    purpose: "program participation and selected public records",
    grantedAt: "2026-09-10T00:00:00.000Z",
    rights: rightsInput(),
  });
  const withdrawn = normalizeConsentRecord({
    consentId: active.consentId,
    programId: active.programId,
    subjectId: active.subjectId,
    guardianId: active.guardianId,
    purpose: active.purpose,
    grantedAt: active.grantedAt,
    rights: rightsInput({ withdrawalStatus: "withdrawn" }),
    withdrawnAt: "2026-09-11T00:00:00.000Z",
  });

  assert.equal(active.consentPolicyVersion, "site_intelligence_p0_v1");
  assert.equal(active.rights.visitId, "visit-1");
  assert.notEqual(active.rights.visitId, active.subjectId);
  assert.equal(active.rights.publicAggregationAllowed, true);
  assert.equal(withdrawn.withdrawalStatus, "withdrawn");
  assert.equal(withdrawn.rights.publicAggregationAllowed, false);
  assert.equal(withdrawn.withdrawnAt, "2026-09-11T00:00:00.000Z");
  assert.throws(() => normalizeConsentRecord({
    consentId: "consent-2",
    programId: "program-1",
    subjectId: "participant-1",
    purpose: "program participation",
    grantedAt: "2026-09-10T00:00:00.000Z",
    withdrawnAt: "2026-09-09T00:00:00.000Z",
    rights: rightsInput(),
  }), /consent_withdrawal_before_grant/);
  assert.throws(() => normalizeConsentRecord({
    consentId: "consent-3",
    programId: "program-1",
    subjectId: "participant-1",
    purpose: "program participation",
    grantedAt: "2026-09-10T00:00:00.000Z",
    withdrawnAt: "2026-09-11T00:00:00.000Z",
    rights: rightsInput(),
  }), /consent_withdrawal_time_mismatch/);
});

test("Review state is derived from immutable ordered history shape", () => {
  const requested = normalizeReviewDecision({
    reviewId: "review-1",
    programId: "program-1",
    subjectId: "record-1",
    history: [{
      state: "requested",
      actorId: "participant-1",
      occurredAt: "2026-09-10T00:00:00.000Z",
      source: "fixture",
      note: null,
    }],
  });
  const approved = appendReviewDecision(requested, {
    state: "approved",
    actorId: "reviewer-1",
    occurredAt: "2026-09-10T01:00:00.000Z",
    source: "staff_review",
    note: "Evidence checked",
  });

  assert.equal(requested.state, "requested");
  assert.equal(approved.state, "approved");
  assert.equal(approved.history.length, 2);
  assert.equal(approved.history[0]?.state, "requested");
  assert.throws(() => normalizeReviewDecision({ ...approved, state: "held" }), /review_state_history_mismatch/);
  assert.deepEqual(requested.history, [{
    state: "requested",
    actorId: "participant-1",
    occurredAt: "2026-09-10T00:00:00.000Z",
    source: "fixture",
    note: null,
  }]);
  assert.throws(() => normalizeReviewDecision({
    ...approved,
    history: [...approved.history, {
      state: "held",
      actorId: "reviewer-2",
      occurredAt: "2026-09-09T23:00:00.000Z",
      source: "fixture",
      note: null,
    }],
  }), /review_history_not_monotonic/);
});

test("handover reuses planner reference integrity and reset semantics", () => {
  const first = planProgramHandoverBinding(handoverInput());
  const retryInput = handoverInput();
  retryInput.idempotency.priorPlan = {
    key: retryInput.idempotency.key,
    payloadDigest: first.plannerResult.payloadDigest,
    planIdentity: first.plannerResult.planIdentity,
  };
  const retry = planProgramHandoverBinding(retryInput);

  assert.equal(first.plannerResult.decision, "accepted");
  assert.deepEqual(first.selectedRefs, {
    placeIds: ["place-river"],
    recordIds: ["record-1"],
    questIds: ["quest-spring"],
    templateIds: ["template-school"],
  });
  assert.equal(first.plannerResult.identityPolicy.referenceOnly, true);
  assert.equal(first.plannerResult.identityPolicy.duplicateCanonicalPlaceRecord, false);
  assert.equal(first.plannerResult.resetState.consent, "not_granted");
  assert.equal(first.plannerResult.resetState.visibility, "private");
  assert.equal(retry.plannerResult.retry.replayed, true);
});

test("invalid handover references fail closed without changing canonical identities", () => {
  const input = handoverInput();
  input.selectedRefs.recordIds = ["record-not-available"];
  const result = planProgramHandoverBinding(input);

  assert.equal(result.plannerResult.decision, "rejected");
  assert.ok(result.plannerResult.blockedReasons.includes("selected_record_ref_unknown"));
  assert.deepEqual(result.selectedRefs.recordIds, ["record-not-available"]);
  assert.equal(result.plannerResult.sideEffects.databaseWrites, 0);
  assert.equal(result.plannerResult.sideEffects.runtimeMutations, 0);
});
