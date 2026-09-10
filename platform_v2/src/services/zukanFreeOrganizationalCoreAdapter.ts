import {
  normalizeProgram,
  normalizeProgramParticipant,
  type Program,
  type ProgramParticipant,
  type ProgramRole,
  type ProgramRoleAssignment,
} from "./programOrganizationalCore.js";
import {
  buildProgramOperationalActivitySummary,
  type OperationalActivitySummary,
  type OperationalActivitySummaryInput,
} from "./programOperationalActivitySummary.js";
import {
  decideProgramPublicationEligibility,
  type ProgramPublicationEligibilityInput,
  type ProgramPublicationEligibilityReasonCode,
  type ProgramPublicationCandidate,
} from "./programPublicationEligibility.js";

export const ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION =
  "zukan.free-organizational-core-adapter/v1" as const;

export type AdapterEffects = {
  readonly databaseReads: 0;
  readonly databaseWrites: 0;
  readonly networkCalls: 0;
  readonly publicationEffects: 0;
};

const noEffects: AdapterEffects = Object.freeze({
  databaseReads: 0,
  databaseWrites: 0,
  networkCalls: 0,
  publicationEffects: 0,
});

export type OrganizationAuthoritySource = {
  readonly organizationId: string;
  readonly organizationName: string;
  readonly programIds: readonly string[];
  readonly source: string;
};

export type SharedPlaceReference = {
  readonly placeId: string;
  readonly source: "place-domain" | "observation-event";
};

export type ProgramParticipationBinding = {
  readonly schemaVersion: typeof ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION;
  readonly organization: {
    readonly organizationId: string;
    readonly organizationName: string;
    readonly source: string;
  };
  readonly program: Pick<Program, "programId" | "revision">;
  readonly participant: Pick<ProgramParticipant, "participantId" | "subjectId" | "status">;
  readonly roles: readonly ProgramRole[];
  readonly sharedPlaceReferences: readonly SharedPlaceReference[];
};

export type ProgramParticipationBindingReasonCode =
  | "PROGRAM_PARTICIPATION_BOUND"
  | "ORGANIZATION_AUTHORITY_MISSING"
  | "ORGANIZATION_AUTHORITY_AMBIGUOUS"
  | "PROGRAM_PARTICIPANT_MISMATCH"
  | "PROGRAM_PARTICIPANT_NOT_ACTIVE"
  | "PROGRAM_ROLE_NOT_BOUND";

export type ProgramParticipationBindingInput = {
  readonly organizationAuthorities: readonly OrganizationAuthoritySource[] | null;
  readonly program: Program;
  readonly participant: ProgramParticipant;
  readonly roleAssignments: readonly ProgramRoleAssignment[];
  readonly sharedPlaceReferences?: readonly SharedPlaceReference[] | null;
};

export type ProgramParticipationBindingResult = {
  readonly schemaVersion: typeof ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION;
  readonly decision: "ALLOW" | "DENY";
  readonly reasonCode: ProgramParticipationBindingReasonCode;
  readonly binding: ProgramParticipationBinding | null;
  readonly effects: AdapterEffects;
};

export type FreeOperationalSummary = OperationalActivitySummary & {
  readonly adapterSchemaVersion: typeof ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION;
};

export type FreeOperationalSummaryResult = {
  readonly summary: FreeOperationalSummary;
  readonly effects: AdapterEffects;
};

export type ViewPublicationCandidate = {
  readonly schemaVersion: typeof ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION;
  readonly decision: "ALLOW" | "DENY";
  readonly reasonCode: ProgramPublicationEligibilityReasonCode | Exclude<ProgramParticipationBindingReasonCode, "PROGRAM_PARTICIPATION_BOUND">;
  readonly candidate: ProgramPublicationCandidate | null;
  readonly effects: AdapterEffects;
};

export type ViewPublicationCandidateInput = ProgramPublicationEligibilityInput & {
  readonly participation: ProgramParticipationBindingInput;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field}_required`);
  return value.trim();
}

function sortedUniqueReferences(
  references: readonly SharedPlaceReference[] | null | undefined,
): readonly SharedPlaceReference[] {
  const seen = new Set<string>();
  return (references ?? [])
    .map((reference) => ({
      placeId: requiredText(reference.placeId, "place_id"),
      source: reference.source,
    }))
    .filter((reference) => {
      if (seen.has(reference.placeId)) return false;
      seen.add(reference.placeId);
      return true;
    })
    .sort((left, right) => left.placeId.localeCompare(right.placeId));
}

function bindingResult(
  decision: ProgramParticipationBindingResult["decision"],
  reasonCode: ProgramParticipationBindingReasonCode,
  binding: ProgramParticipationBinding | null = null,
): ProgramParticipationBindingResult {
  return {
    schemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
    decision,
    reasonCode,
    binding,
    effects: noEffects,
  };
}

export function buildProgramParticipationBinding(
  input: ProgramParticipationBindingInput,
): ProgramParticipationBindingResult {
  const program = normalizeProgram(input.program);
  const participant = normalizeProgramParticipant(input.participant);
  const authorities = (input.organizationAuthorities ?? []).filter((authority) =>
    authority.programIds.includes(program.programId),
  );
  if (authorities.length === 0) return bindingResult("DENY", "ORGANIZATION_AUTHORITY_MISSING");
  if (authorities.length !== 1) return bindingResult("DENY", "ORGANIZATION_AUTHORITY_AMBIGUOUS");
  if (participant.programId !== program.programId) return bindingResult("DENY", "PROGRAM_PARTICIPANT_MISMATCH");
  if (participant.status !== "active") return bindingResult("DENY", "PROGRAM_PARTICIPANT_NOT_ACTIVE");

  const roles = [...new Set(input.roleAssignments
    .filter((assignment) => assignment.programId === program.programId
      && assignment.actorId === participant.subjectId
      && assignment.scope === "program"
      && assignment.status === "active")
    .map((assignment) => assignment.role))].sort();
  if (roles.length === 0) return bindingResult("DENY", "PROGRAM_ROLE_NOT_BOUND");

  const authority = authorities[0]!;
  return bindingResult("ALLOW", "PROGRAM_PARTICIPATION_BOUND", {
    schemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
    organization: {
      organizationId: requiredText(authority.organizationId, "organization_id"),
      organizationName: requiredText(authority.organizationName, "organization_name"),
      source: requiredText(authority.source, "organization_source"),
    },
    program: { programId: program.programId, revision: program.revision },
    participant: {
      participantId: participant.participantId,
      subjectId: participant.subjectId,
      status: participant.status,
    },
    roles,
    sharedPlaceReferences: sortedUniqueReferences(input.sharedPlaceReferences),
  });
}

export function buildFreeOperationalSummary(
  input: OperationalActivitySummaryInput,
): FreeOperationalSummaryResult {
  const summary = buildProgramOperationalActivitySummary(input);
  return {
    summary: {
      ...summary,
      adapterSchemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
    },
    effects: noEffects,
  };
}

export function buildViewPublicationCandidate(
  input: ViewPublicationCandidateInput,
): ViewPublicationCandidate {
  const participation = buildProgramParticipationBinding(input.participation);
  if (participation.decision !== "ALLOW" || !participation.binding) {
    const reasonCode = participation.reasonCode === "PROGRAM_PARTICIPATION_BOUND"
      ? "PROGRAM_PARTICIPANT_MISMATCH"
      : participation.reasonCode;
    return {
      schemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
      decision: "DENY",
      reasonCode,
      candidate: null,
      effects: noEffects,
    };
  }
  if (participation.binding.program.programId !== input.program.programId) {
    return {
      schemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
      decision: "DENY",
      reasonCode: "PROGRAM_PARTICIPANT_MISMATCH",
      candidate: null,
      effects: noEffects,
    };
  }
  const eligibility = decideProgramPublicationEligibility(input);
  return {
    schemaVersion: ZUKAN_FREE_ORGANIZATIONAL_CORE_ADAPTER_SCHEMA_VERSION,
    decision: eligibility.decision,
    reasonCode: eligibility.reasonCode,
    candidate: eligibility.candidate,
    effects: noEffects,
  };
}
