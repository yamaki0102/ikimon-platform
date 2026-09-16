import { createHash } from "node:crypto";

export const PROGRAM_HANDOVER_ACCEPTANCE_OPERATION = "program_handover_acceptance_append_v1" as const;

export type ProgramHandoverPlanBinding = {
  tenantId: string;
  workspaceId: string | null;
  logicalPlanId: string;
  planIdentity: string;
  sourceProgramId: string;
  sourceRevision: string;
  targetProgramId: string;
  targetContinuationId: string;
  outgoingResponsibilityRef: string;
  incomingResponsibilityRef: string;
};

export type ProgramHandoverOfferBinding = {
  tenantId: string;
  workspaceId: string | null;
  logicalOfferId: string;
  offerIdentity: string;
  logicalPlanId: string;
  planIdentity: string;
  sourceProgramId: string;
  sourceRevision: string;
  targetProgramId: string;
  targetContinuationId: string;
  outgoingActorRef: string;
  intendedIncomingActorRef: string;
  status: string;
  incomingAcceptance: string;
  responsibilityTransfer: string;
};

export type ProgramHandoverAcceptanceRequest = {
  tenantId: string;
  workspaceId: string | null;
  persistedPlan: {
    logicalPlanId: string;
    planIdentity: string;
  };
  offer: {
    logicalOfferId: string;
    offerIdentity: string;
  };
  currentSource: {
    programId: string;
    revision: string;
  };
  targetScope: {
    programId: string;
    continuationId: string;
  };
  incomingActor: {
    actorId: string;
    scopeProgramId: string;
    authorized: boolean;
  };
  outgoingActor: {
    actorId: string;
    scopeProgramId: string;
    authorized: boolean;
  };
  acceptanceIdempotencyKey: string;
  actorAuditRef: string;
  acceptedAt: string;
  createdAt: string;
};

export type ProgramHandoverAcceptance = {
  status: "accepted_pending_apply";
  logicalAcceptanceId: string;
  acceptanceIdentity: string;
  payloadDigest: string;
  planRef: {
    logicalPlanId: string;
    planIdentity: string;
  };
  offerRef: {
    logicalOfferId: string;
    offerIdentity: string;
  };
  sourceScope: {
    programId: string;
    revision: string;
  };
  targetScope: {
    programId: string;
    continuationId: string;
  };
  incomingActorRef: string;
  outgoingActorRef: string;
  responsibilityTransfer: "pending_apply";
  actorAuditRef: string;
  acceptedAt: string;
  createdAt: string;
};

export type ProgramHandoverAcceptanceOutcome = {
  status: "succeeded" | "replayed" | "conflict" | "blocked";
  dialect: "provider-neutral" | "d1";
  operation: typeof PROGRAM_HANDOVER_ACCEPTANCE_OPERATION;
  tenantId: string;
  workspaceId: string | null;
  acceptanceIdempotencyKey: string;
  acceptance: ProgramHandoverAcceptance | null;
  reasons: string[];
};

export interface ProgramHandoverAcceptanceRepository {
  readonly dialect: "provider-neutral" | "d1";
  createAcceptance(input: ProgramHandoverAcceptanceRequest): Promise<ProgramHandoverAcceptanceOutcome>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validTimestamp(value: unknown): value is string {
  return nonEmpty(value) && Number.isFinite(Date.parse(value));
}

function validDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
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

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function programHandoverAcceptancePayload(
  input: ProgramHandoverAcceptanceRequest,
): Record<string, unknown> {
  return {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    logicalPlanId: input.persistedPlan.logicalPlanId,
    planIdentity: input.persistedPlan.planIdentity,
    logicalOfferId: input.offer.logicalOfferId,
    offerIdentity: input.offer.offerIdentity,
    sourceProgramId: input.currentSource.programId,
    sourceRevision: input.currentSource.revision,
    targetProgramId: input.targetScope.programId,
    targetContinuationId: input.targetScope.continuationId,
    incomingActorRef: input.incomingActor.actorId,
    incomingActorScopeProgramId: input.incomingActor.scopeProgramId,
    outgoingActorRef: input.outgoingActor.actorId,
    outgoingActorScopeProgramId: input.outgoingActor.scopeProgramId,
    status: "accepted_pending_apply",
    responsibilityTransfer: "pending_apply",
    actorAuditRef: input.actorAuditRef,
    acceptedAt: input.acceptedAt,
    createdAt: input.createdAt,
  };
}

export function programHandoverAcceptanceIdentity(input: ProgramHandoverAcceptanceRequest): {
  payloadDigest: string;
  acceptanceIdentity: string;
  logicalAcceptanceId: string;
} {
  const payloadDigest = digest(programHandoverAcceptancePayload(input));
  const acceptanceIdentity = digest({
    operation: PROGRAM_HANDOVER_ACCEPTANCE_OPERATION,
    payloadDigest,
  });
  const logicalAcceptanceId = digest({
    operation: PROGRAM_HANDOVER_ACCEPTANCE_OPERATION,
    acceptanceIdempotencyKey: input.acceptanceIdempotencyKey,
    payloadDigest,
  });
  return { payloadDigest, acceptanceIdentity, logicalAcceptanceId };
}

function blockedOutcome(
  input: ProgramHandoverAcceptanceRequest,
  reasons: string[],
): ProgramHandoverAcceptanceOutcome {
  return {
    status: "blocked",
    dialect: "provider-neutral",
    operation: PROGRAM_HANDOVER_ACCEPTANCE_OPERATION,
    tenantId: input?.tenantId || "",
    workspaceId: input?.workspaceId ?? null,
    acceptanceIdempotencyKey: input?.acceptanceIdempotencyKey || "",
    acceptance: null,
    reasons: [...new Set(reasons)],
  };
}

export function validateProgramHandoverAcceptanceRequest(
  input: ProgramHandoverAcceptanceRequest,
): string[] {
  const request = input as Partial<ProgramHandoverAcceptanceRequest>;
  const reasons: string[] = [];
  if (!nonEmpty(request.tenantId)) reasons.push("tenant_scope_missing");
  if (request.workspaceId !== null && !nonEmpty(request.workspaceId)) reasons.push("workspace_scope_invalid");
  if (!nonEmpty(request.persistedPlan?.logicalPlanId)) reasons.push("persisted_plan_id_missing");
  if (!validDigest(request.persistedPlan?.planIdentity)) reasons.push("plan_identity_invalid");
  if (!nonEmpty(request.offer?.logicalOfferId)) reasons.push("offer_id_missing");
  if (!validDigest(request.offer?.offerIdentity)) reasons.push("offer_identity_invalid");
  if (!nonEmpty(request.currentSource?.programId) || !nonEmpty(request.currentSource?.revision)) {
    reasons.push("source_binding_missing");
  }
  if (!nonEmpty(request.targetScope?.programId) || !nonEmpty(request.targetScope?.continuationId)) {
    reasons.push("target_scope_missing");
  }
  if (!nonEmpty(request.incomingActor?.actorId)) reasons.push("incoming_actor_missing");
  if (request.incomingActor?.authorized !== true) reasons.push("incoming_actor_unauthorized");
  if (request.incomingActor?.scopeProgramId !== request.targetScope?.programId) {
    reasons.push("incoming_actor_scope_mismatch");
  }
  if (!nonEmpty(request.outgoingActor?.actorId)) reasons.push("outgoing_actor_missing");
  if (request.outgoingActor?.authorized !== true) reasons.push("outgoing_actor_unauthorized");
  if (request.outgoingActor?.scopeProgramId !== request.currentSource?.programId) {
    reasons.push("outgoing_actor_scope_mismatch");
  }
  if (!nonEmpty(request.acceptanceIdempotencyKey)) reasons.push("acceptance_idempotency_key_missing");
  if (!nonEmpty(request.actorAuditRef)) reasons.push("actor_audit_ref_missing");
  if (!validTimestamp(request.acceptedAt)) reasons.push("accepted_at_invalid");
  if (!validTimestamp(request.createdAt)) reasons.push("created_at_invalid");
  return [...new Set(reasons)];
}

export function validateProgramHandoverAcceptanceBindings(
  input: ProgramHandoverAcceptanceRequest,
  plan: ProgramHandoverPlanBinding | null,
  offer: ProgramHandoverOfferBinding | null,
): string[] {
  const reasons = validateProgramHandoverAcceptanceRequest(input);
  if (!plan) reasons.push("persisted_plan_missing");
  if (!offer) reasons.push("offer_missing");

  if (plan) {
    if (plan.tenantId !== input.tenantId) reasons.push("tenant_scope_mismatch");
    if (plan.workspaceId !== input.workspaceId) reasons.push("workspace_scope_mismatch");
    if (plan.logicalPlanId !== input.persistedPlan.logicalPlanId) reasons.push("plan_reference_mismatch");
    if (plan.planIdentity !== input.persistedPlan.planIdentity) reasons.push("plan_identity_mismatch");
    if (plan.sourceProgramId !== input.currentSource.programId) reasons.push("source_program_scope_mismatch");
    if (plan.sourceRevision !== input.currentSource.revision) reasons.push("source_revision_stale");
    if (plan.targetProgramId !== input.targetScope.programId
      || plan.targetContinuationId !== input.targetScope.continuationId) {
      reasons.push("target_scope_mismatch");
    }
    if (plan.outgoingResponsibilityRef !== input.outgoingActor.actorId) reasons.push("outgoing_actor_mismatch");
    if (plan.incomingResponsibilityRef !== input.incomingActor.actorId) reasons.push("incoming_actor_mismatch");
  }

  if (offer) {
    if (offer.tenantId !== input.tenantId) reasons.push("tenant_scope_mismatch");
    if (offer.workspaceId !== input.workspaceId) reasons.push("workspace_scope_mismatch");
    if (offer.logicalOfferId !== input.offer.logicalOfferId) reasons.push("offer_reference_mismatch");
    if (offer.offerIdentity !== input.offer.offerIdentity) reasons.push("offer_identity_mismatch");
    if (offer.logicalPlanId !== input.persistedPlan.logicalPlanId
      || offer.planIdentity !== input.persistedPlan.planIdentity) {
      reasons.push("plan_offer_mismatch");
    }
    if (offer.sourceProgramId !== input.currentSource.programId) reasons.push("source_program_scope_mismatch");
    if (offer.sourceRevision !== input.currentSource.revision) reasons.push("source_revision_stale");
    if (offer.targetProgramId !== input.targetScope.programId
      || offer.targetContinuationId !== input.targetScope.continuationId) {
      reasons.push("target_scope_mismatch");
    }
    if (offer.outgoingActorRef !== input.outgoingActor.actorId) reasons.push("outgoing_actor_mismatch");
    if (offer.intendedIncomingActorRef !== input.incomingActor.actorId) reasons.push("incoming_actor_mismatch");
    if (offer.status !== "pending_acceptance") reasons.push("offer_not_pending");
    if (offer.incomingAcceptance !== "not_started") reasons.push("offer_acceptance_already_started");
    if (offer.responsibilityTransfer !== "not_started") reasons.push("offer_transfer_already_started");
  }

  return [...new Set(reasons)];
}

export function buildProgramHandoverAcceptance(
  input: ProgramHandoverAcceptanceRequest,
): ProgramHandoverAcceptance {
  const identity = programHandoverAcceptanceIdentity(input);
  return {
    status: "accepted_pending_apply",
    logicalAcceptanceId: identity.logicalAcceptanceId,
    acceptanceIdentity: identity.acceptanceIdentity,
    payloadDigest: identity.payloadDigest,
    planRef: { ...input.persistedPlan },
    offerRef: { ...input.offer },
    sourceScope: { ...input.currentSource },
    targetScope: { ...input.targetScope },
    incomingActorRef: input.incomingActor.actorId,
    outgoingActorRef: input.outgoingActor.actorId,
    responsibilityTransfer: "pending_apply",
    actorAuditRef: input.actorAuditRef,
    acceptedAt: input.acceptedAt,
    createdAt: input.createdAt,
  };
}

export function providerNeutralBlockedAcceptance(
  input: ProgramHandoverAcceptanceRequest,
): ProgramHandoverAcceptanceOutcome {
  const reasons = validateProgramHandoverAcceptanceRequest(input);
  return blockedOutcome(input, reasons.length > 0 ? reasons : ["provider_adapter_not_bound"]);
}
