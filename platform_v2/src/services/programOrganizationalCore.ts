import {
  OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
  normalizeObservationDataRights,
  type ObservationDataRights,
  type ObservationDataRightsInput,
  type WithdrawalStatus,
} from "./observationDataRights.js";
import { planProgramHandover, type ProgramHandoverInput, type ProgramHandoverResult } from "./programHandoverPlanner.js";

export type { ProgramHandoverInput } from "./programHandoverPlanner.js";

export const PROGRAM_ORGANIZATIONAL_CORE_SCHEMA_VERSION = "zukan.program-organizational-core/v1";

export type ProgramLifecycle = "draft" | "active" | "ended" | "archived";
export type ProgramVisibility = "private" | "program_restricted" | "shared" | "public_candidate" | "public" | "withdrawn";
export type ProgramParticipantStatus = "invited" | "active" | "left" | "removed";
export type ProgramTeamStatus = "active" | "archived";
export type ProgramRole = "owner" | "organizer" | "reviewer" | "participant";
export type ProgramRoleAssignmentStatus = "active" | "revoked";
export type QuestStatus = "draft" | "active" | "completed" | "archived";
export type QuestParticipationStatus = "not_started" | "in_progress" | "completed" | "withdrawn";
export type ReviewState = "requested" | "in_review" | "changes_requested" | "held" | "approved" | "rejected" | "withdrawn";

export type Program = {
  programId: string;
  revision: string;
  title: string;
  lifecycle: ProgramLifecycle;
  visibility: ProgramVisibility;
};

export type ProgramParticipant = {
  participantId: string;
  programId: string;
  subjectId: string;
  status: ProgramParticipantStatus;
  joinedAt: string;
};

export type ProgramTeam = {
  teamId: string;
  programId: string;
  label: string;
  participantIds: string[];
  status: ProgramTeamStatus;
};

export type ProgramRoleAssignment = {
  assignmentId: string;
  programId: string;
  actorId: string;
  role: ProgramRole;
  scope: "program";
  status: ProgramRoleAssignmentStatus;
  assignedAt: string;
  source: string;
};

export type Quest = {
  questId: string;
  programId: string;
  revision: string;
  title: string;
  status: QuestStatus;
};

export type QuestParticipation = {
  participationId: string;
  programId: string;
  questId: string;
  participantId: string;
  status: QuestParticipationStatus;
};

export type ConsentRecord = {
  consentId: string;
  programId: string;
  subjectId: string;
  guardianId: string | null;
  purpose: string;
  grantedAt: string;
  withdrawnAt: string | null;
  withdrawalStatus: WithdrawalStatus;
  consentPolicyVersion: string;
  rights: ObservationDataRights;
};

export type ConsentRecordInput = {
  consentId: string;
  programId: string;
  subjectId: string;
  guardianId?: string | null;
  purpose: string;
  grantedAt: string;
  withdrawnAt?: string | null;
  rights: ObservationDataRightsInput;
};

export type ReviewHistoryEntry = {
  state: ReviewState;
  actorId: string;
  occurredAt: string;
  source: string;
  note: string | null;
};

export type ReviewDecision = {
  reviewId: string;
  programId: string;
  subjectId: string;
  state: ReviewState;
  history: ReviewHistoryEntry[];
};

export type ReviewDecisionInput = Omit<ReviewDecision, "state"> & {
  state?: ReviewState;
};

export type ProgramHandover = {
  schemaVersion: string;
  sourceProgramId: string;
  targetProgramId: string;
  continuationId: string;
  selectedRefs: ProgramHandoverResult["reuseRefs"];
  plannerResult: ProgramHandoverResult;
};

function stableId(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field}_required`);
  return value.trim();
}

function requiredText(value: unknown, field: string): string {
  return stableId(value, field);
}

function isoTimestamp(value: unknown, field: string): string {
  const timestamp = stableId(value, field);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${field}_invalid`);
  return timestamp;
}

function uniqueSortedIds(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => stableId(value, "reference")))].sort();
}

export function normalizeProgram(input: Program): Program {
  return {
    programId: stableId(input.programId, "program_id"),
    revision: stableId(input.revision, "program_revision"),
    title: requiredText(input.title, "program_title"),
    lifecycle: input.lifecycle,
    visibility: input.visibility,
  };
}

export function normalizeProgramParticipant(input: ProgramParticipant): ProgramParticipant {
  return {
    participantId: stableId(input.participantId, "participant_id"),
    programId: stableId(input.programId, "program_id"),
    subjectId: stableId(input.subjectId, "subject_id"),
    status: input.status,
    joinedAt: isoTimestamp(input.joinedAt, "participant_joined_at"),
  };
}

export function normalizeProgramTeam(input: ProgramTeam): ProgramTeam {
  return {
    teamId: stableId(input.teamId, "team_id"),
    programId: stableId(input.programId, "program_id"),
    label: requiredText(input.label, "team_label"),
    participantIds: uniqueSortedIds(input.participantIds),
    status: input.status,
  };
}

export function normalizeProgramRoleAssignment(input: ProgramRoleAssignment): ProgramRoleAssignment {
  if (input.scope !== "program") throw new Error("role_scope_invalid");
  return {
    assignmentId: stableId(input.assignmentId, "assignment_id"),
    programId: stableId(input.programId, "program_id"),
    actorId: stableId(input.actorId, "actor_id"),
    role: input.role,
    scope: "program",
    status: input.status,
    assignedAt: isoTimestamp(input.assignedAt, "role_assigned_at"),
    source: requiredText(input.source, "role_source"),
  };
}

export function canActInProgram(
  actorId: string,
  programId: string,
  assignments: readonly ProgramRoleAssignment[],
  allowedRoles: readonly ProgramRole[] = ["owner", "organizer", "reviewer"],
): boolean {
  const actor = stableId(actorId, "actor_id");
  const program = stableId(programId, "program_id");
  return assignments.some((assignment) =>
    assignment.status === "active"
    && assignment.scope === "program"
    && assignment.actorId === actor
    && assignment.programId === program
    && allowedRoles.includes(assignment.role)
  );
}

export function normalizeQuest(input: Quest): Quest {
  return {
    questId: stableId(input.questId, "quest_id"),
    programId: stableId(input.programId, "program_id"),
    revision: stableId(input.revision, "quest_revision"),
    title: requiredText(input.title, "quest_title"),
    status: input.status,
  };
}

export function normalizeQuestParticipation(input: QuestParticipation): QuestParticipation {
  return {
    participationId: stableId(input.participationId, "participation_id"),
    programId: stableId(input.programId, "program_id"),
    questId: stableId(input.questId, "quest_id"),
    participantId: stableId(input.participantId, "participant_id"),
    status: input.status,
  };
}

export function normalizeConsentRecord(input: ConsentRecordInput): ConsentRecord {
  const consentId = stableId(input.consentId, "consent_id");
  const programId = stableId(input.programId, "program_id");
  const subjectId = stableId(input.subjectId, "subject_id");
  const guardianId = input.guardianId ? stableId(input.guardianId, "guardian_id") : null;
  const purpose = requiredText(input.purpose, "consent_purpose");
  const grantedAt = isoTimestamp(input.grantedAt, "consent_granted_at");
  const withdrawnAt = input.withdrawnAt == null ? null : isoTimestamp(input.withdrawnAt, "consent_withdrawn_at");
  const rights = normalizeObservationDataRights({
    ...input.rights,
    visitId: subjectId,
    sourcePayload: {
      ...(input.rights.sourcePayload ?? {}),
      consentId,
      programId,
      purpose,
      guardianId,
    },
  });
  return {
    consentId,
    programId,
    subjectId,
    guardianId,
    purpose,
    grantedAt,
    withdrawnAt,
    withdrawalStatus: rights.withdrawalStatus,
    consentPolicyVersion: rights.rightsPolicyVersion || OBSERVATION_DATA_RIGHTS_POLICY_VERSION,
    rights,
  };
}

function normalizeReviewHistory(history: readonly ReviewHistoryEntry[], reviewId: string): ReviewHistoryEntry[] {
  if (history.length === 0) throw new Error(`${reviewId}_history_required`);
  return history.map((entry) => ({
    state: entry.state,
    actorId: stableId(entry.actorId, "review_actor_id"),
    occurredAt: isoTimestamp(entry.occurredAt, "review_occurred_at"),
    source: requiredText(entry.source, "review_source"),
    note: entry.note == null ? null : String(entry.note),
  }));
}

export function normalizeReviewDecision(input: ReviewDecisionInput): ReviewDecision {
  const reviewId = stableId(input.reviewId, "review_id");
  const history = normalizeReviewHistory(input.history, reviewId);
  const currentState = history[history.length - 1]?.state;
  if (!currentState) throw new Error(`${reviewId}_state_required`);
  if (input.state && input.state !== currentState) throw new Error("review_state_history_mismatch");
  return {
    reviewId,
    programId: stableId(input.programId, "program_id"),
    subjectId: stableId(input.subjectId, "subject_id"),
    state: currentState,
    history,
  };
}

export function appendReviewDecision(
  current: ReviewDecision,
  entry: ReviewHistoryEntry,
): ReviewDecision {
  const normalized = normalizeReviewDecision(current);
  const next = normalizeReviewHistory([...normalized.history, entry], normalized.reviewId);
  return { ...normalized, state: next[next.length - 1]!.state, history: next };
}

export function planProgramHandoverBinding(input: ProgramHandoverInput): ProgramHandover {
  const plannerResult = planProgramHandover(input);
  return {
    schemaVersion: PROGRAM_ORGANIZATIONAL_CORE_SCHEMA_VERSION,
    sourceProgramId: input.source.programId,
    targetProgramId: input.target.programId,
    continuationId: input.target.continuationId,
    selectedRefs: plannerResult.reuseRefs,
    plannerResult,
  };
}
