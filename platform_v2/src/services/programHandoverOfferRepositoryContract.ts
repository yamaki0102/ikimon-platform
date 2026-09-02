import { createHash } from "node:crypto";

export const PROGRAM_HANDOVER_OFFER_OPERATION = "program_handover_offer_append_v1" as const;

export type ProgramHandoverOfferRequest = {
  tenantId: string;
  workspaceId: string | null;
  persistedPlan: {
    logicalPlanId: string;
    planIdentity: string;
  };
  currentSource: {
    programId: string;
    revision: string;
  };
  outgoingActor: {
    actorId: string;
    sourceProgramId: string;
    authorized: boolean;
  };
  intendedIncomingActorRef: string;
  targetScope: {
    programId: string;
    continuationId: string;
  };
  offerIdempotencyKey: string;
  actorAuditRef: string;
  offeredAt: string;
  createdAt: string;
};

export type ProgramHandoverOffer = {
  status: "pending_acceptance";
  logicalOfferId: string;
  offerIdentity: string;
  payloadDigest: string;
  planRef: {
    logicalPlanId: string;
    planIdentity: string;
  };
  sourceScope: {
    programId: string;
    revision: string;
  };
  targetScope: {
    programId: string;
    continuationId: string;
  };
  outgoingActorRef: string;
  intendedIncomingActorRef: string;
  incomingAcceptance: "not_started";
  responsibilityTransfer: "not_started";
  actorAuditRef: string;
  offeredAt: string;
  createdAt: string;
};

export type ProgramHandoverOfferOutcome = {
  status: "succeeded" | "replayed" | "conflict" | "blocked";
  dialect: "provider-neutral" | "d1";
  operation: typeof PROGRAM_HANDOVER_OFFER_OPERATION;
  tenantId: string;
  workspaceId: string | null;
  offerIdempotencyKey: string;
  offer: ProgramHandoverOffer | null;
  reasons: string[];
};

export interface ProgramHandoverOfferRepository {
  readonly dialect: "provider-neutral" | "d1";
  createOffer(input: ProgramHandoverOfferRequest): Promise<ProgramHandoverOfferOutcome>;
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

export function programHandoverOfferPayload(input: ProgramHandoverOfferRequest): Record<string, unknown> {
  return {
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    logicalPlanId: input.persistedPlan.logicalPlanId,
    planIdentity: input.persistedPlan.planIdentity,
    sourceProgramId: input.currentSource.programId,
    sourceRevision: input.currentSource.revision,
    outgoingActorRef: input.outgoingActor.actorId,
    outgoingActorSourceProgramId: input.outgoingActor.sourceProgramId,
    intendedIncomingActorRef: input.intendedIncomingActorRef,
    targetProgramId: input.targetScope.programId,
    targetContinuationId: input.targetScope.continuationId,
    status: "pending_acceptance",
    actorAuditRef: input.actorAuditRef,
    offeredAt: input.offeredAt,
    createdAt: input.createdAt,
  };
}

export function programHandoverOfferIdentity(input: ProgramHandoverOfferRequest): {
  payloadDigest: string;
  offerIdentity: string;
  logicalOfferId: string;
} {
  const payloadDigest = digest(programHandoverOfferPayload(input));
  const offerIdentity = digest({ operation: PROGRAM_HANDOVER_OFFER_OPERATION, payloadDigest });
  const logicalOfferId = digest({
    operation: PROGRAM_HANDOVER_OFFER_OPERATION,
    offerIdempotencyKey: input.offerIdempotencyKey,
    payloadDigest,
  });
  return { payloadDigest, offerIdentity, logicalOfferId };
}

function blockedOutcome(input: ProgramHandoverOfferRequest, reasons: string[]): ProgramHandoverOfferOutcome {
  return {
    status: "blocked",
    dialect: "provider-neutral",
    operation: PROGRAM_HANDOVER_OFFER_OPERATION,
    tenantId: input.tenantId || "",
    workspaceId: input.workspaceId ?? null,
    offerIdempotencyKey: input.offerIdempotencyKey || "",
    offer: null,
    reasons: [...new Set(reasons)],
  };
}

export function validateProgramHandoverOfferRequest(input: ProgramHandoverOfferRequest): string[] {
  const reasons: string[] = [];
  if (!nonEmpty(input.tenantId)) reasons.push("tenant_scope_missing");
  if (input.workspaceId !== null && !nonEmpty(input.workspaceId)) reasons.push("workspace_scope_invalid");
  if (!nonEmpty(input.persistedPlan?.logicalPlanId)) reasons.push("persisted_plan_id_missing");
  if (!validDigest(input.persistedPlan?.planIdentity)) reasons.push("plan_identity_invalid");
  if (!nonEmpty(input.currentSource?.programId) || !nonEmpty(input.currentSource?.revision)) reasons.push("source_binding_missing");
  if (!nonEmpty(input.outgoingActor?.actorId) || !nonEmpty(input.outgoingActor?.sourceProgramId)) reasons.push("outgoing_actor_missing");
  if (input.outgoingActor?.authorized !== true) reasons.push("outgoing_actor_unauthorized");
  if (input.outgoingActor?.sourceProgramId !== input.currentSource?.programId) reasons.push("outgoing_actor_source_scope_mismatch");
  if (!nonEmpty(input.intendedIncomingActorRef)) reasons.push("intended_incoming_actor_missing");
  if (!nonEmpty(input.targetScope?.programId) || !nonEmpty(input.targetScope?.continuationId)) reasons.push("target_scope_missing");
  if (!nonEmpty(input.offerIdempotencyKey)) reasons.push("offer_idempotency_key_missing");
  if (!nonEmpty(input.actorAuditRef)) reasons.push("actor_audit_ref_missing");
  if (!validTimestamp(input.offeredAt)) reasons.push("offered_at_invalid");
  if (!validTimestamp(input.createdAt)) reasons.push("created_at_invalid");
  return [...new Set(reasons)];
}

export function buildProgramHandoverOffer(input: ProgramHandoverOfferRequest): ProgramHandoverOffer {
  const identity = programHandoverOfferIdentity(input);
  return {
    status: "pending_acceptance",
    logicalOfferId: identity.logicalOfferId,
    offerIdentity: identity.offerIdentity,
    payloadDigest: identity.payloadDigest,
    planRef: { ...input.persistedPlan },
    sourceScope: { ...input.currentSource },
    targetScope: { ...input.targetScope },
    outgoingActorRef: input.outgoingActor.actorId,
    intendedIncomingActorRef: input.intendedIncomingActorRef,
    incomingAcceptance: "not_started",
    responsibilityTransfer: "not_started",
    actorAuditRef: input.actorAuditRef,
    offeredAt: input.offeredAt,
    createdAt: input.createdAt,
  };
}

export function providerNeutralBlockedOffer(input: ProgramHandoverOfferRequest): ProgramHandoverOfferOutcome {
  const reasons = validateProgramHandoverOfferRequest(input);
  return blockedOutcome(input, reasons.length > 0 ? reasons : ["provider_adapter_not_bound"]);
}
