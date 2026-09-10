import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProgramOperationalActivitySummary,
  type OperationalActivitySummaryInput,
} from "./programOperationalActivitySummary.js";

function fixture(overrides: Partial<OperationalActivitySummaryInput> = {}): OperationalActivitySummaryInput {
  return {
    program: {
      programId: " program-1 ",
      revision: "rev-2",
      title: "River activity",
      lifecycle: "active",
      visibility: "program_restricted",
    },
    participants: [{ participantId: "participant-1", programId: "program-1", subjectId: "subject-1", status: "active", joinedAt: "2026-09-10T00:00:00Z" }],
    teams: [{ teamId: "team-1", programId: "program-1", label: "River team", participantIds: ["participant-1"], status: "active" }],
    quests: [{ questId: "quest-1", programId: "program-1", revision: "rev-1", title: "River quest", status: "active" }],
    questParticipations: [{ participationId: "participation-1", programId: "program-1", questId: "quest-1", participantId: "participant-1", status: "in_progress" }],
    activities: [{ activityId: "activity-1", status: "active" }],
    places: [{ placeId: "place-1" }, { placeId: "place-1" }, { placeId: "place-2" }],
    records: [
      { recordId: "record-2", placeId: "place-1", observedAt: "2026-09-10T02:00:00Z" },
      { recordId: "record-1", placeId: "place-1", observedAt: "2026-09-10T01:00:00Z" },
    ],
    repeatedObservations: [{ placeId: "place-1", observationCount: 2 }],
    continuations: [{ continuationId: "continuation-1", sourceProgramId: "program-1", targetProgramId: "program-2", state: "accepted" }],
    reviews: [{ reviewId: "review-1", programId: "program-1", subjectId: "record-1", state: "approved", history: [{ state: "approved", actorId: "reviewer-1", occurredAt: "2026-09-10T03:00:00Z", source: "fixture", note: null }] }],
    visibility: [{ visibility: "program_restricted" }, { visibility: "shared" }],
    consents: [{ consentId: "consent-1", programId: "program-1", subjectId: "subject-1", purpose: "participation", grantedAt: "2026-09-10T00:00:00Z", rights: { visitId: "visit-1", recordConsent: "public_summary", areaProfileUseConsent: "aggregated_public", publicAggregationAllowed: true, consentSource: "user_selected" } }],
    regionalViewReferences: [{ referenceId: "view-1", placeId: "place-1", status: "candidate" }],
    ...overrides,
  };
}

test("builds deterministic operational indicators without paid-derived fields", () => {
  const first = buildProgramOperationalActivitySummary(fixture());
  const second = buildProgramOperationalActivitySummary(fixture());

  assert.deepEqual(first, second);
  assert.equal(first.sourceState, "complete");
  assert.deepEqual(first.counts.places, { value: 2, state: "complete" });
  assert.deepEqual(first.counts.records, { value: 2, state: "complete" });
  assert.deepEqual(first.counts.repeatedObservations, { value: 1, state: "complete" });
  assert.deepEqual(first.review.byState, { approved: 1 });
  assert.deepEqual(first.visibility.byVisibility, { program_restricted: 1, shared: 1 });
  assert.deepEqual(first.consent.complete, { value: 1, state: "complete" });
  assert.deepEqual(first.continuation.active, { value: 1, state: "complete" });
  assert.deepEqual(first.publication.regionalViewReferences, [{ referenceId: "view-1", placeId: "place-1", status: "candidate" }]);
});

test("counts only entities bound to the summarized Program", () => {
  const base = fixture();
  const foreignParticipant = { ...base.participants![0]!, participantId: "participant-foreign", programId: "program-2" };
  const foreignTeam = { ...base.teams![0]!, teamId: "team-foreign", programId: "program-2" };
  const foreignQuest = { ...base.quests![0]!, questId: "quest-foreign", programId: "program-2" };
  const foreignParticipation = { ...base.questParticipations![0]!, participationId: "participation-foreign", programId: "program-2" };
  const foreignReview = { ...base.reviews![0]!, reviewId: "review-foreign", programId: "program-2" };
  const summary = buildProgramOperationalActivitySummary(fixture({
    participants: [...base.participants!, foreignParticipant],
    teams: [...base.teams!, foreignTeam],
    quests: [...base.quests!, foreignQuest],
    questParticipations: [...base.questParticipations!, foreignParticipation],
    reviews: [...base.reviews!, foreignReview],
  }));

  assert.deepEqual(summary.counts.participants, { value: 1, state: "complete" });
  assert.deepEqual(summary.counts.teams, { value: 1, state: "complete" });
  assert.deepEqual(summary.counts.quests, { value: 1, state: "complete" });
  assert.deepEqual(summary.counts.questParticipations, { value: 1, state: "complete" });
  assert.deepEqual(summary.review.byState, { approved: 1 });
});

test("null source collections stay explicit as unknown while empty collections mean known zero", () => {
  const summary = buildProgramOperationalActivitySummary(fixture({
    participants: null,
    teams: [],
    quests: null,
    consents: null,
    regionalViewReferences: [],
  }));

  assert.equal(summary.sourceState, "partial");
  assert.deepEqual(summary.counts.participants, { value: null, state: "unknown" });
  assert.deepEqual(summary.counts.teams, { value: 0, state: "complete" });
  assert.deepEqual(summary.counts.quests, { value: null, state: "unknown" });
  assert.equal(summary.consent.state, "unknown");
  assert.deepEqual(summary.publication.regionalViewReferences, []);
  assert.equal(summary.publication.state, "complete");
});

test("withdrawn consent is not complete and does not become a publication permission", () => {
  const summary = buildProgramOperationalActivitySummary(fixture({
    consents: [{
      ...fixture().consents![0]!,
      rights: { ...fixture().consents![0]!.rights, withdrawalStatus: "withdrawn" },
      withdrawnAt: "2026-09-11T00:00:00Z",
    }],
  }));

  assert.deepEqual(summary.consent.withdrawn, { value: 1, state: "complete" });
  assert.deepEqual(summary.consent.complete, { value: 0, state: "complete" });
});

test("only active consent lifecycle contributes to granted and complete counts", () => {
  const active = fixture().consents![0]!;
  const summary = buildProgramOperationalActivitySummary(fixture({
    consents: [
      active,
      { ...active, consentId: "consent-delete-requested", rights: { ...active.rights, withdrawalStatus: "delete_requested" } },
      { ...active, consentId: "consent-deleted", rights: { ...active.rights, withdrawalStatus: "deleted" } },
      { ...active, consentId: "consent-foreign", programId: "program-2" },
    ],
  }));

  assert.deepEqual(summary.consent.total, { value: 3, state: "complete" });
  assert.deepEqual(summary.consent.granted, { value: 1, state: "complete" });
  assert.deepEqual(summary.consent.withdrawn, { value: 0, state: "complete" });
  assert.deepEqual(summary.consent.complete, { value: 1, state: "complete" });
});

test("free summary has no taxon, species, biodiversity, comparison, or report output surface", () => {
  const summary = buildProgramOperationalActivitySummary(fixture());
  const serialized = JSON.stringify(summary);

  assert.doesNotMatch(serialized, /taxon|species|biodiversity|composition|comparison|report|csv|excel|pdf/i);
});
