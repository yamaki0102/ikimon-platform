import {
  canActInProgram,
  normalizeReviewDecision,
  type ConsentRecord,
  type Program,
  type ProgramRoleAssignment,
  type ReviewDecision,
} from "./programOrganizationalCore.js";
import type { ObservationDataRights } from "./observationDataRights.js";
import {
  decideObservationPublicationPolicy,
  type ObservationPublicationPolicy,
} from "./observationPublicationPolicy.js";
import type { FieldProfilePolicy } from "./fieldProfilePolicy.js";
import type { CivicObservationContext } from "./civicNatureContext.js";

export const PROGRAM_PUBLICATION_ELIGIBILITY_SCHEMA_VERSION = "zukan.program-publication-eligibility/v1" as const;

export type PublicationSafety = {
  readonly privacy: "safe" | "unsafe";
  readonly location: "safe" | "unsafe";
  readonly minor: "safe" | "unsafe";
  readonly rareSpecies: "safe" | "unsafe";
};

export type ProgramPublicationEligibilityInput = {
  readonly actorId: string;
  readonly subjectId: string;
  readonly program: Program;
  readonly roleAssignments: readonly ProgramRoleAssignment[];
  readonly consent: ConsentRecord | null;
  readonly review: ReviewDecision | null;
  readonly fieldPolicy: FieldProfilePolicy | null;
  readonly safety: PublicationSafety;
  readonly civicContext?: Pick<CivicObservationContext, "riskLane" | "publicPrecision" | "contextKind"> | null;
  readonly identification?: {
    readonly aiOnly?: boolean | null;
    readonly confidence?: number | null;
    readonly taxonSensitive?: boolean | null;
  } | null;
  readonly now?: Date;
};

export type ProgramPublicationEligibilityReasonCode =
  | "PROGRAM_PUBLICATION_ELIGIBLE"
  | "PROGRAM_NOT_ACTIVE"
  | "PROGRAM_VISIBILITY_NOT_ELIGIBLE"
  | "PROGRAM_ROLE_NOT_PERMITTED"
  | "CONSENT_NOT_PUBLIC_SAFE"
  | "REVIEW_NOT_APPROVED"
  | "PUBLIC_PROFILE_NOT_ELIGIBLE"
  | "PUBLICATION_SAFETY_NOT_EXPLICIT";

export type ProgramPublicationCandidate = {
  readonly programId: string;
  readonly subjectId: string;
  readonly visibility: "public_candidate";
  readonly publicLocationMode: ObservationPublicationPolicy["publicLocationMode"];
  readonly publicTimePrecision: ObservationPublicationPolicy["publicTimePrecision"];
  readonly policyRulesetVersion: string;
};

export type ProgramPublicationEligibilityResult = {
  readonly schema_version: typeof PROGRAM_PUBLICATION_ELIGIBILITY_SCHEMA_VERSION;
  readonly decision: "ALLOW" | "DENY";
  readonly reasonCode: ProgramPublicationEligibilityReasonCode;
  readonly candidate: ProgramPublicationCandidate | null;
  readonly effects: {
    readonly databaseReads: 0;
    readonly databaseWrites: 0;
    readonly networkCalls: 0;
    readonly publicationEffects: 0;
    readonly paymentEffects: 0;
  };
};

const noEffects = Object.freeze({
  databaseReads: 0 as const,
  databaseWrites: 0 as const,
  networkCalls: 0 as const,
  publicationEffects: 0 as const,
  paymentEffects: 0 as const,
});

function deny(reasonCode: ProgramPublicationEligibilityReasonCode): ProgramPublicationEligibilityResult {
  return {
    schema_version: PROGRAM_PUBLICATION_ELIGIBILITY_SCHEMA_VERSION,
    decision: "DENY",
    reasonCode,
    candidate: null,
    effects: noEffects,
  };
}

function approvedReview(input: ProgramPublicationEligibilityInput): boolean {
  if (!input.review) return false;
  try {
    const review = normalizeReviewDecision(input.review);
    return review.programId === input.program.programId
      && review.subjectId === input.subjectId
      && review.state === "approved";
  } catch (_) {
    return false;
  }
}

function publicSafeConsent(input: ProgramPublicationEligibilityInput): boolean {
  const consent = input.consent;
  if (!consent || consent.programId !== input.program.programId || consent.subjectId !== input.subjectId) return false;
  const rights: ObservationDataRights = consent.rights;
  return rights.withdrawalStatus === "active"
    && rights.publicAggregationAllowed === true
    && (rights.recordConsent === "public_summary" || rights.recordConsent === "external_export");
}

function explicitSafety(input: ProgramPublicationEligibilityInput): boolean {
  return input.safety.privacy === "safe"
    && input.safety.location === "safe"
    && input.safety.minor === "safe"
    && input.safety.rareSpecies === "safe";
}

export function decideProgramPublicationEligibility(
  input: ProgramPublicationEligibilityInput,
): ProgramPublicationEligibilityResult {
  if (input.program.lifecycle !== "active") return deny("PROGRAM_NOT_ACTIVE");
  if (input.program.visibility !== "public_candidate") return deny("PROGRAM_VISIBILITY_NOT_ELIGIBLE");
  if (!canActInProgram(input.actorId, input.program.programId, input.roleAssignments)) {
    return deny("PROGRAM_ROLE_NOT_PERMITTED");
  }
  if (!publicSafeConsent(input)) return deny("CONSENT_NOT_PUBLIC_SAFE");
  if (!approvedReview(input)) return deny("REVIEW_NOT_APPROVED");
  if (!explicitSafety(input)) return deny("PUBLICATION_SAFETY_NOT_EXPLICIT");

  const policy = decideObservationPublicationPolicy({
    fieldPolicy: input.fieldPolicy,
    dataRights: input.consent?.rights ?? null,
    civicContext: input.civicContext,
    identification: input.identification,
    now: input.now,
  });
  if (policy.publicLocationMode === "hidden" || policy.publicTimePrecision === "hidden" || policy.sensitivityStatus === "uncertain") {
    return deny("PUBLIC_PROFILE_NOT_ELIGIBLE");
  }

  return {
    schema_version: PROGRAM_PUBLICATION_ELIGIBILITY_SCHEMA_VERSION,
    decision: "ALLOW",
    reasonCode: "PROGRAM_PUBLICATION_ELIGIBLE",
    candidate: {
      programId: input.program.programId,
      subjectId: input.subjectId,
      visibility: "public_candidate",
      publicLocationMode: policy.publicLocationMode,
      publicTimePrecision: policy.publicTimePrecision,
      policyRulesetVersion: policy.policyRulesetVersion,
    },
    effects: noEffects,
  };
}
