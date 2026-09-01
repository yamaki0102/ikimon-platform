import type { ProgramHandoverResult } from "./programHandoverPlanner.js";

export const PROGRAM_HANDOVER_PERSISTENCE_OPERATION = "program_handover_plan_persist_v1" as const;

export type ProgramHandoverScope = {
  sourceProgramId: string;
  sourceRevision: string;
  targetProgramId: string;
  targetContinuationId: string;
};

export type ProgramHandoverPersistenceRequest = {
  tenantId: string;
  workspaceId: string | null;
  acceptedPlan: ProgramHandoverResult;
  currentScope: ProgramHandoverScope;
  idempotencyKey: string;
  actorAuditRef: string;
  createdAt: string;
};

export type ProgramHandoverPersistenceOutcome = {
  status: "succeeded" | "replayed" | "conflict" | "blocked";
  dialect: "provider-neutral" | "d1";
  operation: typeof PROGRAM_HANDOVER_PERSISTENCE_OPERATION;
  tenantId: string;
  workspaceId: string | null;
  idempotencyKey: string;
  logicalPlanId: string | null;
  planIdentity: string | null;
  payloadDigest: string | null;
  receiptId: string | null;
  reasons: string[];
};

export type ProgramHandoverPlanSnapshot = {
  tenantId: string;
  workspaceId: string | null;
  logicalPlanId: string;
  planIdentity: string;
  payloadDigest: string;
  sourceProgramId: string;
  sourceRevision: string;
  targetProgramId: string;
  targetContinuationId: string;
  selectedRefsJson: string;
  resetStateJson: string;
  outgoingResponsibilityRef: string;
  incomingResponsibilityRef: string;
  observedAt: string;
  actorAuditRef: string;
  createdAt: string;
};

export interface ProgramHandoverPlanRepository {
  readonly dialect: "provider-neutral" | "d1";
  persistAcceptedPlan(input: ProgramHandoverPersistenceRequest): Promise<ProgramHandoverPersistenceOutcome>;
}

const REQUIRED_RESET_STATE = {
  participant: "not_started",
  consent: "not_granted",
  review: "not_started",
  publicationApproval: "not_granted",
  visibility: "private",
} as const;

const REQUIRED_NON_TRANSFERABLE = [
  "participant",
  "consent",
  "review",
  "publicationApproval",
  "withdrawal",
  "retention",
  "visibility",
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function validTimestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function validRefList(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every(nonEmpty)
    && new Set(value).size === value.length;
}

function blockedOutcome(
  input: ProgramHandoverPersistenceRequest,
  reasons: string[],
): ProgramHandoverPersistenceOutcome {
  return {
    status: "blocked",
    dialect: "provider-neutral",
    operation: PROGRAM_HANDOVER_PERSISTENCE_OPERATION,
    tenantId: input.tenantId || "",
    workspaceId: input.workspaceId ?? null,
    idempotencyKey: input.idempotencyKey || "",
    logicalPlanId: null,
    planIdentity: input.acceptedPlan?.planIdentity || null,
    payloadDigest: input.acceptedPlan?.payloadDigest || null,
    receiptId: null,
    reasons: [...new Set(reasons)],
  };
}

export function validateProgramHandoverPersistenceRequest(
  input: ProgramHandoverPersistenceRequest,
): ProgramHandoverPersistenceOutcome | null {
  const plan = input.acceptedPlan;
  const reasons: string[] = [];
  if (!nonEmpty(input.tenantId)) reasons.push("tenant_scope_missing");
  if (input.workspaceId !== null && !nonEmpty(input.workspaceId)) reasons.push("workspace_scope_invalid");
  if (!plan || plan.decision !== "accepted" || plan.status !== "planned") reasons.push("plan_not_accepted");
  if (!nonEmpty(input.idempotencyKey)) reasons.push("idempotency_key_missing");
  if (!nonEmpty(input.actorAuditRef)) reasons.push("actor_audit_ref_missing");
  if (!validTimestamp(input.createdAt)) reasons.push("created_at_invalid");
  if (!validDigest(plan?.planIdentity)) reasons.push("plan_identity_invalid");
  if (!validDigest(plan?.payloadDigest)) reasons.push("payload_digest_invalid");
  if (!nonEmpty(plan?.logicalPlanId)) reasons.push("logical_plan_id_missing");
  if (!nonEmpty(plan?.provenance?.source?.programId) || !nonEmpty(plan?.provenance?.source?.revision)) reasons.push("source_provenance_missing");
  if (!nonEmpty(plan?.provenance?.target?.programId) || !nonEmpty(plan?.provenance?.target?.continuationId)) reasons.push("target_provenance_missing");
  if (!validTimestamp(plan?.provenance?.observedAt)) reasons.push("observed_at_invalid");
  if (!input.currentScope
    || plan?.provenance?.source?.programId !== input.currentScope.sourceProgramId
    || plan?.provenance?.source?.revision !== input.currentScope.sourceRevision
    || plan?.provenance?.target?.programId !== input.currentScope.targetProgramId
    || plan?.provenance?.target?.continuationId !== input.currentScope.targetContinuationId) {
    reasons.push("source_target_scope_mismatch");
  }
  if (!plan?.reuseRefs || !validRefList(plan.reuseRefs.placeIds) || !validRefList(plan.reuseRefs.recordIds)
    || !validRefList(plan.reuseRefs.questIds) || !validRefList(plan.reuseRefs.templateIds)) {
    reasons.push("selected_refs_invalid");
  }
  if (canonicalJson(plan?.resetState) !== canonicalJson(REQUIRED_RESET_STATE)) reasons.push("reset_state_invalid");
  if (!REQUIRED_NON_TRANSFERABLE.every((item) => plan?.nonTransferableState?.includes(item))) {
    reasons.push("non_transferable_state_incomplete");
  }
  if (!nonEmpty(plan?.responsibility?.outgoing?.actorId) || !nonEmpty(plan?.responsibility?.incoming?.actorId)) {
    reasons.push("responsibility_ref_missing");
  }
  return reasons.length > 0 ? blockedOutcome(input, reasons) : null;
}

export function programHandoverPlanSnapshot(
  input: ProgramHandoverPersistenceRequest,
): ProgramHandoverPlanSnapshot {
  const plan = input.acceptedPlan;
  return {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    logicalPlanId: plan.logicalPlanId!,
    planIdentity: plan.planIdentity,
    payloadDigest: plan.payloadDigest,
    sourceProgramId: plan.provenance.source.programId,
    sourceRevision: plan.provenance.source.revision,
    targetProgramId: plan.provenance.target.programId,
    targetContinuationId: plan.provenance.target.continuationId,
    selectedRefsJson: canonicalJson(plan.reuseRefs),
    resetStateJson: canonicalJson(REQUIRED_RESET_STATE),
    outgoingResponsibilityRef: plan.responsibility.outgoing.actorId,
    incomingResponsibilityRef: plan.responsibility.incoming.actorId,
    observedAt: plan.provenance.observedAt,
    actorAuditRef: input.actorAuditRef,
    createdAt: input.createdAt,
  };
}

export function providerNeutralBlockedPersistence(
  input: ProgramHandoverPersistenceRequest,
): ProgramHandoverPersistenceOutcome {
  return validateProgramHandoverPersistenceRequest(input)
    ?? blockedOutcome(input, ["provider_adapter_not_bound"]);
}
