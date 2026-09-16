import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFreeOperationalSummary,
  buildProgramParticipationBinding,
  buildViewPublicationCandidate,
  type ProgramParticipationBindingInput,
  type ViewPublicationCandidateInput,
} from "./zukanFreeOrganizationalCoreAdapter.js";
import { normalizeConsentRecord } from "./programOrganizationalCore.js";

function bindingFixture(overrides: Partial<ProgramParticipationBindingInput> = {}): ProgramParticipationBindingInput {
  return {
    organizationAuthorities: [{
      organizationId: "org-1",
      organizationName: "River Organization",
      programIds: ["program-1"],
      source: "organization-registry-fixture",
    }],
    program: {
      programId: "program-1",
      revision: "rev-1",
      title: "River activity",
      lifecycle: "active",
      visibility: "program_restricted",
    },
    participant: {
      participantId: "participant-1",
      programId: "program-1",
      subjectId: "subject-1",
      status: "active",
      joinedAt: "2026-09-10T00:00:00Z",
    },
    roleAssignments: [{
      assignmentId: "assignment-1",
      programId: "program-1",
      actorId: "subject-1",
      role: "participant",
      scope: "program",
      status: "active",
      assignedAt: "2026-09-10T00:00:00Z",
      source: "fixture",
    }],
    sharedPlaceReferences: [
      { placeId: "place-2", source: "observation-event" },
      { placeId: "place-1", source: "place-domain" },
      { placeId: "place-1", source: "observation-event" },
    ],
    ...overrides,
  };
}

test("maps one authoritative organization/program participant to shared Place references", () => {
  const result = buildProgramParticipationBinding(bindingFixture());

  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reasonCode, "PROGRAM_PARTICIPATION_BOUND");
  assert.deepEqual(result.binding?.sharedPlaceReferences, [
    { placeId: "place-1", source: "place-domain" },
    { placeId: "place-2", source: "observation-event" },
  ]);
  assert.deepEqual(result.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
  });
});

test("fails closed for missing or ambiguous organization authority and inactive participants", () => {
  assert.equal(
    buildProgramParticipationBinding(bindingFixture({ organizationAuthorities: null })).reasonCode,
    "ORGANIZATION_AUTHORITY_MISSING",
  );
  assert.equal(
    buildProgramParticipationBinding(bindingFixture({
      organizationAuthorities: [
        ...bindingFixture().organizationAuthorities!,
        { ...bindingFixture().organizationAuthorities![0]!, organizationId: "org-2" },
      ],
    })).reasonCode,
    "ORGANIZATION_AUTHORITY_AMBIGUOUS",
  );
  assert.equal(
    buildProgramParticipationBinding(bindingFixture({
      participant: { ...bindingFixture().participant, status: "left" },
    })).reasonCode,
    "PROGRAM_PARTICIPANT_NOT_ACTIVE",
  );
});

test("adapts the existing free operational summary without taxon or paid-report output", () => {
  const summary = buildFreeOperationalSummary({
    program: bindingFixture().program,
    participants: [bindingFixture().participant],
    teams: [],
    quests: [],
    questParticipations: [],
    activities: [],
    places: [{ placeId: "place-1" }],
    records: [],
    repeatedObservations: [],
    continuations: [],
    reviews: [],
    visibility: [{ visibility: "program_restricted" }],
    consents: [],
    regionalViewReferences: [],
  }).summary;
  const serialized = JSON.stringify(summary);

  assert.equal(summary.adapterSchemaVersion, "zukan.free-organizational-core-adapter/v1");
  assert.equal(summary.counts.participants.value, 1);
  assert.doesNotMatch(serialized, /taxon|species|biodiversity|inventory|composition|report|csv|excel|pdf/i);
});

test("does not create a publication candidate without rights, consent, or approved review", () => {
  const base: ViewPublicationCandidateInput = {
    actorId: "subject-1",
    subjectId: "record-1",
    program: { ...bindingFixture().program, visibility: "public_candidate" as const },
    roleAssignments: [{
      assignmentId: "assignment-1",
      programId: "program-1",
      actorId: "subject-1",
      role: "reviewer" as const,
      scope: "program" as const,
      status: "active" as const,
      assignedAt: "2026-09-10T00:00:00Z",
      source: "fixture",
    }],
    consent: null,
    review: null,
    fieldPolicy: null,
    safety: { privacy: "safe" as const, location: "safe" as const, minor: "safe" as const, rareSpecies: "safe" as const },
    participation: bindingFixture(),
  };
  const denied = buildViewPublicationCandidate(base);

  assert.equal(denied.decision, "DENY");
  assert.equal(denied.candidate, null);
  assert.equal(denied.reasonCode, "CONSENT_NOT_PUBLIC_SAFE");
  assert.equal(denied.effects.publicationEffects, 0);
});

test("creates a candidate only after an authoritative participation binding and every publication gate pass", () => {
  const input: ViewPublicationCandidateInput = {
    actorId: "reviewer-1",
    subjectId: "record-1",
    program: { ...bindingFixture().program, visibility: "public_candidate" },
    roleAssignments: [{
      assignmentId: "assignment-1",
      programId: "program-1",
      actorId: "reviewer-1",
      role: "reviewer",
      scope: "program",
      status: "active",
      assignedAt: "2026-09-10T00:00:00Z",
      source: "fixture",
    }],
    consent: normalizeConsentRecord({
      consentId: "consent-1",
      programId: "program-1",
      subjectId: "record-1",
      purpose: "public observation summary",
      grantedAt: "2026-09-10T00:00:00Z",
      rights: {
        visitId: "visit-1",
        recordConsent: "public_summary",
        areaProfileUseConsent: "aggregated_public",
        publicAggregationAllowed: true,
        consentSource: "user_selected",
      },
    }),
    review: {
      reviewId: "review-1",
      programId: "program-1",
      subjectId: "record-1",
      state: "approved",
      history: [{
        state: "approved",
        actorId: "reviewer-1",
        occurredAt: "2026-09-10T01:00:00Z",
        source: "fixture",
        note: null,
      }],
    },
    fieldPolicy: {
      profileStatus: "public_summary",
      defaultPublicLocationMode: "site",
      publicProfileEnabled: true,
      profilePolicyVersion: "fixture-v1",
      profileNotes: "",
    },
    safety: { privacy: "safe", location: "safe", minor: "safe", rareSpecies: "safe" },
    participation: { ...bindingFixture(), program: { ...bindingFixture().program, visibility: "public_candidate" } },
  };

  const result = buildViewPublicationCandidate(input);
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reasonCode, "PROGRAM_PUBLICATION_ELIGIBLE");
  assert.deepEqual(result.candidate, {
    programId: "program-1",
    subjectId: "record-1",
    visibility: "public_candidate",
    publicLocationMode: "site",
    publicTimePrecision: "date",
    policyRulesetVersion: "site_intelligence_p0_v1",
  });
});

test("denies an otherwise eligible publication input when organization authority is absent or ambiguous", () => {
  const eligible = {
    actorId: "reviewer-1",
    subjectId: "record-1",
    program: { ...bindingFixture().program, visibility: "public_candidate" as const },
    roleAssignments: [{
      assignmentId: "assignment-1",
      programId: "program-1",
      actorId: "reviewer-1",
      role: "reviewer" as const,
      scope: "program" as const,
      status: "active" as const,
      assignedAt: "2026-09-10T00:00:00Z",
      source: "fixture",
    }],
    consent: normalizeConsentRecord({
      consentId: "consent-1",
      programId: "program-1",
      subjectId: "record-1",
      purpose: "public observation summary",
      grantedAt: "2026-09-10T00:00:00Z",
      rights: { visitId: "visit-1", recordConsent: "public_summary", areaProfileUseConsent: "aggregated_public", publicAggregationAllowed: true },
    }),
    review: {
      reviewId: "review-1",
      programId: "program-1",
      subjectId: "record-1",
      state: "approved" as const,
      history: [{ state: "approved" as const, actorId: "reviewer-1", occurredAt: "2026-09-10T01:00:00Z", source: "fixture", note: null }],
    },
    fieldPolicy: { profileStatus: "public_summary" as const, defaultPublicLocationMode: "site" as const, publicProfileEnabled: true, profilePolicyVersion: "fixture-v1", profileNotes: "" },
    safety: { privacy: "safe" as const, location: "safe" as const, minor: "safe" as const, rareSpecies: "safe" as const },
  };

  const missing = buildViewPublicationCandidate({ ...eligible, participation: bindingFixture({ organizationAuthorities: null }) });
  const ambiguous = buildViewPublicationCandidate({
    ...eligible,
    participation: bindingFixture({
      organizationAuthorities: [
        ...bindingFixture().organizationAuthorities!,
        { ...bindingFixture().organizationAuthorities![0]!, organizationId: "org-2" },
      ],
    }),
  });
  assert.equal(missing.reasonCode, "ORGANIZATION_AUTHORITY_MISSING");
  assert.equal(ambiguous.reasonCode, "ORGANIZATION_AUTHORITY_AMBIGUOUS");
  assert.equal(missing.candidate, null);
  assert.equal(ambiguous.candidate, null);
});
