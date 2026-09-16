import {
  normalizeConsentRecord,
  normalizeProgram,
  normalizeProgramParticipant,
  normalizeProgramTeam,
  normalizeQuest,
  normalizeQuestParticipation,
  normalizeReviewDecision,
  type ConsentRecordInput,
  type Program,
  type ProgramParticipant,
  type ProgramTeam,
  type ProgramVisibility,
  type Quest,
  type QuestParticipation,
  type ReviewDecision,
  type ReviewState,
} from "./programOrganizationalCore.js";

export const PROGRAM_OPERATIONAL_ACTIVITY_SUMMARY_SCHEMA_VERSION =
  "zukan.program-operational-activity-summary/v1" as const;

export type OperationalSummaryState = "complete" | "partial" | "unknown";

export type OperationalCount = {
  value: number | null;
  state: OperationalSummaryState;
};

export type ProgramRecordMembership = {
  recordId: string;
  placeId: string;
  observedAt: string;
};

export type ProgramPlaceMembership = {
  placeId: string;
};

export type ProgramActivity = {
  activityId: string;
  status: "planned" | "active" | "completed" | "cancelled";
};

export type RepeatedObservation = {
  placeId: string;
  observationCount: number;
};

export type ProgramContinuation = {
  continuationId: string;
  sourceProgramId: string;
  targetProgramId: string;
  state: "planned" | "accepted" | "completed";
};

export type RegionalViewReference = {
  referenceId: string;
  placeId: string;
  status: "candidate" | "published" | "suppressed";
};

export type VisibilityObservation = {
  visibility: ProgramVisibility;
};

export type OperationalActivitySummaryInput = {
  program: Program;
  participants?: readonly ProgramParticipant[] | null;
  teams?: readonly ProgramTeam[] | null;
  quests?: readonly Quest[] | null;
  questParticipations?: readonly QuestParticipation[] | null;
  activities?: readonly ProgramActivity[] | null;
  places?: readonly ProgramPlaceMembership[] | null;
  records?: readonly ProgramRecordMembership[] | null;
  repeatedObservations?: readonly RepeatedObservation[] | null;
  continuations?: readonly ProgramContinuation[] | null;
  reviews?: readonly ReviewDecision[] | null;
  visibility?: readonly VisibilityObservation[] | null;
  consents?: readonly ConsentRecordInput[] | null;
  regionalViewReferences?: readonly RegionalViewReference[] | null;
};

export type OperationalReviewSummary = {
  state: OperationalSummaryState;
  byState: Partial<Record<ReviewState, number>>;
};

export type OperationalVisibilitySummary = {
  state: OperationalSummaryState;
  byVisibility: Partial<Record<ProgramVisibility, number>>;
};

export type OperationalConsentSummary = {
  state: OperationalSummaryState;
  total: OperationalCount;
  granted: OperationalCount;
  withdrawn: OperationalCount;
  complete: OperationalCount;
};

export type OperationalContinuationSummary = {
  state: OperationalSummaryState;
  total: OperationalCount;
  active: OperationalCount;
  references: ReadonlyArray<Pick<ProgramContinuation, "continuationId" | "sourceProgramId" | "targetProgramId" | "state">>;
};

export type OperationalPublicationSummary = {
  state: OperationalSummaryState;
  regionalViewReferences: readonly RegionalViewReference[];
};

export type OperationalActivitySummary = {
  schemaVersion: typeof PROGRAM_OPERATIONAL_ACTIVITY_SUMMARY_SCHEMA_VERSION;
  program: {
    programId: string;
    revision: string;
    lifecycle: Program["lifecycle"];
  };
  sourceState: OperationalSummaryState;
  counts: {
    participants: OperationalCount;
    teams: OperationalCount;
    quests: OperationalCount;
    questParticipations: OperationalCount;
    activities: OperationalCount;
    places: OperationalCount;
    records: OperationalCount;
    repeatedObservations: OperationalCount;
  };
  review: OperationalReviewSummary;
  visibility: OperationalVisibilitySummary;
  consent: OperationalConsentSummary;
  continuation: OperationalContinuationSummary;
  publication: OperationalPublicationSummary;
};

function countKnown(values: readonly unknown[] | null | undefined): OperationalCount {
  return values == null
    ? { value: null, state: "unknown" }
    : { value: values.length, state: "complete" };
}

function distinctCount(values: readonly string[] | null | undefined): OperationalCount {
  if (values == null) return { value: null, state: "unknown" };
  return { value: new Set(values).size, state: "complete" };
}

function normalizeId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field}_required`);
  return normalized;
}

function sortedUnique<T extends { [key: string]: string }>(
  values: readonly T[],
  key: keyof T,
): T[] {
  const seen = new Set<string>();
  return values
    .map((value) => ({ ...value, [key]: normalizeId(String(value[key] ?? ""), String(key)) } as T))
    .filter((value) => {
      const id = String(value[key]);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort((left, right) => String(left[key]).localeCompare(String(right[key])));
}

function projectRegionalViewReference(value: RegionalViewReference): RegionalViewReference {
  return {
    referenceId: normalizeId(value.referenceId, "referenceId"),
    placeId: normalizeId(value.placeId, "placeId"),
    status: value.status,
  };
}

function statusDistribution<T extends string>(values: readonly T[] | null | undefined): {
  state: OperationalSummaryState;
  byState: Partial<Record<T, number>>;
} {
  if (values == null) return { state: "unknown", byState: {} };
  const byState: Partial<Record<T, number>> = {};
  for (const value of values) byState[value] = (byState[value] ?? 0) + 1;
  return { state: "complete", byState };
}

function countConsent(
  consents: readonly ConsentRecordInput[] | null | undefined,
  programId: string,
): OperationalConsentSummary {
  if (consents == null) {
    const unknown = { value: null, state: "unknown" as const };
    return { state: "unknown", total: unknown, granted: unknown, withdrawn: unknown, complete: unknown };
  }
  const normalized = consents
    .map(normalizeConsentRecord)
    .filter((consent) => consent.programId === programId);
  const withdrawn = normalized.filter((consent) => consent.withdrawalStatus === "withdrawn");
  const active = normalized.filter((consent) => consent.withdrawalStatus === "active");
  const complete = active.filter((consent) => consent.rights.publicAggregationAllowed);
  return {
    state: "complete",
    total: countKnown(normalized),
    granted: { value: active.length, state: "complete" },
    withdrawn: countKnown(withdrawn),
    complete: countKnown(complete),
  };
}

export function buildProgramOperationalActivitySummary(
  input: OperationalActivitySummaryInput,
): OperationalActivitySummary {
  const program = normalizeProgram(input.program);
  const participants = input.participants?.map(normalizeProgramParticipant)
    .filter((participant) => participant.programId === program.programId);
  const teams = input.teams?.map(normalizeProgramTeam)
    .filter((team) => team.programId === program.programId);
  const quests = input.quests?.map(normalizeQuest)
    .filter((quest) => quest.programId === program.programId);
  const questParticipations = input.questParticipations?.map(normalizeQuestParticipation)
    .filter((participation) => participation.programId === program.programId);
  const reviews = input.reviews?.map(normalizeReviewDecision)
    .filter((review) => review.programId === program.programId);
  const places = input.places == null ? input.places : sortedUnique(input.places, "placeId");
  const records = input.records == null ? input.records : sortedUnique(input.records, "recordId");
  const activities = input.activities == null ? input.activities : sortedUnique(input.activities, "activityId");
  const repeatedObservations = input.repeatedObservations == null
    ? input.repeatedObservations
    : input.repeatedObservations.filter((value) => value.observationCount > 1);
  const continuations = input.continuations == null
    ? input.continuations
    : sortedUnique(input.continuations, "continuationId")
      .filter((continuation) => continuation.sourceProgramId === program.programId);
  const references = input.regionalViewReferences == null
    ? null
    : sortedUnique(input.regionalViewReferences.map(projectRegionalViewReference), "referenceId");

  const sourceValues = [
    input.participants,
    input.teams,
    input.quests,
    input.questParticipations,
    input.activities,
    input.places,
    input.records,
    input.repeatedObservations,
    input.continuations,
    input.reviews,
    input.visibility,
    input.consents,
    input.regionalViewReferences,
  ];
  const sourceState: OperationalSummaryState = sourceValues.every((value) => value != null)
    ? "complete"
    : sourceValues.some((value) => value != null)
      ? "partial"
      : "unknown";

  const continuationActive = continuations?.filter((continuation) => continuation.state === "accepted").length ?? null;
  const continuationReferences = continuations?.map(({ continuationId, sourceProgramId, targetProgramId, state }) => ({
    continuationId,
    sourceProgramId,
    targetProgramId,
    state,
  })) ?? [];

  return {
    schemaVersion: PROGRAM_OPERATIONAL_ACTIVITY_SUMMARY_SCHEMA_VERSION,
    program: { programId: program.programId, revision: program.revision, lifecycle: program.lifecycle },
    sourceState,
    counts: {
      participants: countKnown(participants),
      teams: countKnown(teams),
      quests: countKnown(quests),
      questParticipations: countKnown(questParticipations),
      activities: countKnown(activities),
      places: distinctCount(places?.map((place) => place.placeId)),
      records: distinctCount(records?.map((record) => record.recordId)),
      repeatedObservations: countKnown(repeatedObservations),
    },
    review: {
      state: reviews == null ? "unknown" : "complete",
      byState: statusDistribution(reviews?.map((review) => review.state)).byState,
    },
    visibility: {
      state: input.visibility == null ? "unknown" : "complete",
      byVisibility: statusDistribution(input.visibility?.map((entry) => entry.visibility)).byState,
    },
    consent: countConsent(input.consents, program.programId),
    continuation: {
      state: continuations == null ? "unknown" : "complete",
      total: countKnown(continuations),
      active: continuations == null ? { value: null, state: "unknown" } : { value: continuationActive, state: "complete" },
      references: continuationReferences,
    },
    publication: {
      state: references == null ? "unknown" : "complete",
      regionalViewReferences: references ?? [],
    },
  };
}
