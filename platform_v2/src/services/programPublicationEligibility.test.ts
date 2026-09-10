import assert from "node:assert/strict";
import test from "node:test";
import {
  decideProgramPublicationEligibility,
  type ProgramPublicationEligibilityInput,
} from "./programPublicationEligibility.js";
import { normalizeObservationDataRights } from "./observationDataRights.js";

const program = {
  programId: "program-1",
  revision: "r1",
  title: "River walk",
  lifecycle: "active",
  visibility: "public_candidate",
} as const;

const assignment = {
  assignmentId: "assignment-1",
  programId: "program-1",
  actorId: "organizer-1",
  role: "organizer",
  scope: "program",
  status: "active",
  assignedAt: "2026-09-01T00:00:00.000Z",
  source: "program-admin",
} as const;

const rights = normalizeObservationDataRights({
  visitId: "visit-1",
  recordConsent: "public_summary",
  researchUseConsent: "research_allowed",
  areaProfileUseConsent: "aggregated_public",
  publicAggregationAllowed: true,
  withdrawalStatus: "active",
});

const consent = {
  consentId: "consent-1",
  programId: "program-1",
  subjectId: "subject-1",
  guardianId: null,
  purpose: "public nature record",
  grantedAt: "2026-09-01T00:00:00.000Z",
  withdrawnAt: null,
  withdrawalStatus: "active",
  consentPolicyVersion: "site_intelligence_p0_v1",
  rights,
} as const;

const review = {
  reviewId: "review-1",
  programId: "program-1",
  subjectId: "subject-1",
  state: "approved",
  history: [{
    state: "approved",
    actorId: "reviewer-1",
    occurredAt: "2026-09-02T00:00:00.000Z",
    source: "program-review",
    note: null,
  }],
} as const;

const fieldPolicy = {
  profileStatus: "public_summary",
  defaultPublicLocationMode: "site",
  publicProfileEnabled: true,
  profilePolicyVersion: "site_intelligence_p0_v1",
  profileNotes: "public-safe site profile",
} as const;

const safety = { privacy: "safe", location: "safe", minor: "safe", rareSpecies: "safe" } as const;

function baseInput(): ProgramPublicationEligibilityInput {
  return {
    actorId: "organizer-1",
    subjectId: "subject-1",
    program,
    roleAssignments: [assignment],
    consent,
    review,
    fieldPolicy,
    safety,
    now: new Date("2026-09-10T00:00:00.000Z"),
  };
}

test("allows only a public-safe reviewed candidate and has no effects", () => {
  const result = decideProgramPublicationEligibility(baseInput());
  assert.equal(result.decision, "ALLOW");
  assert.equal(result.reasonCode, "PROGRAM_PUBLICATION_ELIGIBLE");
  assert.deepEqual(result.candidate, {
    programId: "program-1",
    subjectId: "subject-1",
    visibility: "public_candidate",
    publicLocationMode: "site",
    publicTimePrecision: "date",
    policyRulesetVersion: "site_intelligence_p0_v1",
  });
  assert.deepEqual(result.effects, {
    databaseReads: 0,
    databaseWrites: 0,
    networkCalls: 0,
    publicationEffects: 0,
    paymentEffects: 0,
  });
});

test("paid, unpaid and absent payment metadata cannot change authorization", () => {
  const evaluate = (paymentMetadata: unknown) => decideProgramPublicationEligibility({
    ...baseInput(),
    paymentMetadata,
  } as ProgramPublicationEligibilityInput);
  const paid = evaluate({ status: "paid", plan: "pro" });
  const unpaid = evaluate({ status: "unpaid", plan: "free" });
  const absent = evaluate(undefined);
  assert.deepEqual(paid, unpaid);
  assert.deepEqual(unpaid, absent);
  assert.equal(absent.decision, "ALLOW");
});

test("fails closed for role, consent and review failures", () => {
  assert.equal(
    decideProgramPublicationEligibility({ ...baseInput(), roleAssignments: [{ ...assignment, status: "revoked" }] }).reasonCode,
    "PROGRAM_ROLE_NOT_PERMITTED",
  );
  assert.equal(
    decideProgramPublicationEligibility({
      ...baseInput(),
      consent: { ...consent, rights: normalizeObservationDataRights({ ...rights, withdrawalStatus: "withdrawn" }) },
    }).reasonCode,
    "CONSENT_NOT_PUBLIC_SAFE",
  );
  for (const state of ["held", "rejected", "withdrawn"] as const) {
    assert.equal(
      decideProgramPublicationEligibility({ ...baseInput(), review: { ...review, state, history: [{ ...review.history[0], state }] } }).reasonCode,
      "REVIEW_NOT_APPROVED",
    );
  }
});

test("fails closed for ineligible visibility, profile and every missing safety signal", () => {
  assert.equal(
    decideProgramPublicationEligibility({ ...baseInput(), program: { ...program, visibility: "private" } }).reasonCode,
    "PROGRAM_VISIBILITY_NOT_ELIGIBLE",
  );
  assert.equal(
    decideProgramPublicationEligibility({ ...baseInput(), fieldPolicy: { ...fieldPolicy, profileStatus: "manager_review" } }).reasonCode,
    "PUBLIC_PROFILE_NOT_ELIGIBLE",
  );
  for (const key of ["privacy", "location", "minor", "rareSpecies"] as const) {
    assert.equal(
      decideProgramPublicationEligibility({ ...baseInput(), safety: { ...safety, [key]: "unsafe" } }).reasonCode,
      "PUBLICATION_SAFETY_NOT_EXPLICIT",
    );
  }
});

test("fails closed when required public-safe inputs are absent", () => {
  assert.equal(decideProgramPublicationEligibility({ ...baseInput(), consent: null }).decision, "DENY");
  assert.equal(decideProgramPublicationEligibility({ ...baseInput(), review: null }).decision, "DENY");
  assert.equal(decideProgramPublicationEligibility({ ...baseInput(), fieldPolicy: null }).decision, "DENY");
  assert.equal(decideProgramPublicationEligibility({ ...baseInput(), safety: {} as typeof safety }).decision, "DENY");
  assert.equal(decideProgramPublicationEligibility({ ...baseInput(), safety: undefined } as unknown as ProgramPublicationEligibilityInput).decision, "DENY");
});
