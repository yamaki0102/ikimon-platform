import type { FoundationD1Database } from "./zukanFoundationV2D1Repository.js";
import {
  buildProgramHandoverOffer,
  providerNeutralBlockedOffer,
  validateProgramHandoverOfferRequest,
  type ProgramHandoverOffer,
  type ProgramHandoverOfferOutcome,
  type ProgramHandoverOfferRepository,
  type ProgramHandoverOfferRequest,
} from "./programHandoverOfferRepositoryContract.js";

type StoredPlanRow = {
  tenant_id: string;
  workspace_id: string | null;
  logical_plan_id: string;
  plan_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  outgoing_responsibility_ref: string;
  incoming_responsibility_ref: string;
};

type StoredOfferRow = {
  idempotency_key: string;
  tenant_id: string;
  workspace_id: string | null;
  logical_offer_id: string;
  offer_identity: string;
  payload_sha256: string;
  logical_plan_id: string;
  plan_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  outgoing_actor_ref: string;
  intended_incoming_actor_ref: string;
  status: "pending_acceptance";
  incoming_acceptance: "not_started";
  responsibility_transfer: "not_started";
  actor_audit_ref: string;
  offered_at: string;
  created_at: string;
};

type BatchResult = { meta?: { changes?: number }; results?: unknown[] };

function baseOutcome(
  input: ProgramHandoverOfferRequest,
  status: ProgramHandoverOfferOutcome["status"],
  reasons: string[],
  offer: ProgramHandoverOffer | null = null,
): ProgramHandoverOfferOutcome {
  return {
    status,
    dialect: "d1",
    operation: "program_handover_offer_append_v1",
    tenantId: input.tenantId || "",
    workspaceId: input.workspaceId ?? null,
    offerIdempotencyKey: input.offerIdempotencyKey || "",
    offer,
    reasons: [...new Set(reasons)],
  };
}

function rowToOffer(row: StoredOfferRow): ProgramHandoverOffer {
  return {
    status: row.status,
    logicalOfferId: row.logical_offer_id,
    offerIdentity: row.offer_identity,
    payloadDigest: row.payload_sha256,
    planRef: { logicalPlanId: row.logical_plan_id, planIdentity: row.plan_identity },
    sourceScope: { programId: row.source_program_id, revision: row.source_revision },
    targetScope: { programId: row.target_program_id, continuationId: row.target_continuation_id },
    outgoingActorRef: row.outgoing_actor_ref,
    intendedIncomingActorRef: row.intended_incoming_actor_ref,
    incomingAcceptance: row.incoming_acceptance,
    responsibilityTransfer: row.responsibility_transfer,
    actorAuditRef: row.actor_audit_ref,
    offeredAt: row.offered_at,
    createdAt: row.created_at,
  };
}

function planBindingReasons(plan: StoredPlanRow, input: ProgramHandoverOfferRequest): string[] {
  const reasons: string[] = [];
  if (plan.tenant_id !== input.tenantId) reasons.push("tenant_scope_mismatch");
  if (plan.workspace_id !== input.workspaceId) reasons.push("workspace_scope_mismatch");
  if (plan.plan_identity !== input.persistedPlan.planIdentity) reasons.push("plan_identity_mismatch");
  if (plan.source_program_id !== input.currentSource.programId) reasons.push("source_program_scope_mismatch");
  if (plan.source_revision !== input.currentSource.revision) reasons.push("source_revision_stale");
  if (plan.target_program_id !== input.targetScope.programId
    || plan.target_continuation_id !== input.targetScope.continuationId) reasons.push("target_scope_mismatch");
  if (plan.outgoing_responsibility_ref !== input.outgoingActor.actorId) reasons.push("outgoing_actor_scope_mismatch");
  if (plan.incoming_responsibility_ref !== input.intendedIncomingActorRef) reasons.push("intended_incoming_actor_mismatch");
  return reasons;
}

function offerRowMatches(row: StoredOfferRow, desired: ProgramHandoverOffer, key: string): boolean {
  return row.idempotency_key === key
    && row.logical_offer_id === desired.logicalOfferId
    && row.offer_identity === desired.offerIdentity
    && row.payload_sha256 === desired.payloadDigest
    && row.logical_plan_id === desired.planRef.logicalPlanId
    && row.plan_identity === desired.planRef.planIdentity
    && row.source_program_id === desired.sourceScope.programId
    && row.source_revision === desired.sourceScope.revision
    && row.target_program_id === desired.targetScope.programId
    && row.target_continuation_id === desired.targetScope.continuationId
    && row.outgoing_actor_ref === desired.outgoingActorRef
    && row.intended_incoming_actor_ref === desired.intendedIncomingActorRef
    && row.status === desired.status
    && row.incoming_acceptance === desired.incomingAcceptance
    && row.responsibility_transfer === desired.responsibilityTransfer
    && row.actor_audit_ref === desired.actorAuditRef
    && row.offered_at === desired.offeredAt
    && row.created_at === desired.createdAt;
}

function offerRowMatchesRequest(row: StoredOfferRow, desired: ProgramHandoverOffer, input: ProgramHandoverOfferRequest): boolean {
  return offerRowMatches(row, desired, input.offerIdempotencyKey)
    && row.tenant_id === input.tenantId
    && row.workspace_id === input.workspaceId;
}

export class ProgramHandoverOfferD1Repository implements ProgramHandoverOfferRepository {
  readonly dialect = "d1" as const;

  constructor(private readonly database: FoundationD1Database) {}

  async createOffer(input: ProgramHandoverOfferRequest): Promise<ProgramHandoverOfferOutcome> {
    const invalid = validateProgramHandoverOfferRequest(input);
    if (invalid.length > 0) return { ...providerNeutralBlockedOffer(input), dialect: "d1" };
    const desired = buildProgramHandoverOffer(input);
    try {
      const results = await this.database.batch([
        this.database.prepare(`
          SELECT tenant_id, workspace_id, logical_plan_id, plan_identity,
                 source_program_id, source_revision, target_program_id,
                 target_continuation_id, outgoing_responsibility_ref,
                 incoming_responsibility_ref
            FROM zukan_program_handover_plan_receipts
           WHERE tenant_id = ? AND workspace_id IS ? AND logical_plan_id = ?
        `).bind(input.tenantId, input.workspaceId, input.persistedPlan.logicalPlanId),
        this.database.prepare(`
          SELECT idempotency_key, tenant_id, workspace_id, logical_offer_id,
                 offer_identity, payload_sha256, logical_plan_id, plan_identity,
                 source_program_id, source_revision, target_program_id,
                 target_continuation_id, outgoing_actor_ref,
                 intended_incoming_actor_ref, status, incoming_acceptance,
                 responsibility_transfer, actor_audit_ref, offered_at, created_at
            FROM zukan_program_handover_offers
           WHERE idempotency_key = ?
        `).bind(input.offerIdempotencyKey),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_program_handover_offers(
            idempotency_key, tenant_id, workspace_id, logical_offer_id,
            offer_identity, payload_sha256, logical_plan_id, plan_identity,
            source_program_id, source_revision, target_program_id,
            target_continuation_id, outgoing_actor_ref,
            intended_incoming_actor_ref, status, incoming_acceptance,
            responsibility_transfer, actor_audit_ref, offered_at, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE EXISTS (
             SELECT 1
               FROM zukan_program_handover_plan_receipts
              WHERE tenant_id = ? AND workspace_id IS ?
                AND logical_plan_id = ? AND plan_identity = ?
                AND source_program_id = ? AND source_revision = ?
                AND target_program_id = ? AND target_continuation_id = ?
                AND outgoing_responsibility_ref = ?
                AND incoming_responsibility_ref = ?
           )
        `).bind(
          input.offerIdempotencyKey,
          input.tenantId,
          input.workspaceId,
          desired.logicalOfferId,
          desired.offerIdentity,
          desired.payloadDigest,
          desired.planRef.logicalPlanId,
          desired.planRef.planIdentity,
          desired.sourceScope.programId,
          desired.sourceScope.revision,
          desired.targetScope.programId,
          desired.targetScope.continuationId,
          desired.outgoingActorRef,
          desired.intendedIncomingActorRef,
          desired.status,
          desired.incomingAcceptance,
          desired.responsibilityTransfer,
          desired.actorAuditRef,
          desired.offeredAt,
          desired.createdAt,
          input.tenantId,
          input.workspaceId,
          desired.planRef.logicalPlanId,
          desired.planRef.planIdentity,
          desired.sourceScope.programId,
          desired.sourceScope.revision,
          desired.targetScope.programId,
          desired.targetScope.continuationId,
          desired.outgoingActorRef,
          desired.intendedIncomingActorRef,
        ),
        this.database.prepare(`
          SELECT idempotency_key, tenant_id, workspace_id, logical_offer_id,
                 offer_identity, payload_sha256, logical_plan_id, plan_identity,
                 source_program_id, source_revision, target_program_id,
                 target_continuation_id, outgoing_actor_ref,
                 intended_incoming_actor_ref, status, incoming_acceptance,
                 responsibility_transfer, actor_audit_ref, offered_at, created_at
            FROM zukan_program_handover_offers
           WHERE idempotency_key = ?
        `).bind(input.offerIdempotencyKey),
      ]);
      const plan = ((results[0] as BatchResult | undefined)?.results?.[0] ?? null) as StoredPlanRow | null;
      const existing = ((results[1] as BatchResult | undefined)?.results?.[0] ?? null) as StoredOfferRow | null;
      const stored = ((results[3] as BatchResult | undefined)?.results?.[0] ?? null) as StoredOfferRow | null;
      if (!plan) return baseOutcome(input, "blocked", ["persisted_plan_missing"]);
      const bindingReasons = planBindingReasons(plan, input);
      if (bindingReasons.length > 0) {
        const onlyOfferPayload = bindingReasons.length === 1 && bindingReasons[0] === "intended_incoming_actor_mismatch";
        if (existing && onlyOfferPayload && stored && !offerRowMatchesRequest(stored, desired, input)) {
          return baseOutcome(input, "conflict", ["same_key_different_offer_payload"], rowToOffer(stored));
        }
        return baseOutcome(input, "blocked", bindingReasons);
      }
      if (!stored) return baseOutcome(input, "blocked", ["offer_not_observed"]);
      if (!offerRowMatchesRequest(stored, desired, input)) {
        return baseOutcome(input, "conflict", ["same_key_different_offer_payload"], rowToOffer(stored));
      }
      const changes = Number((results[2] as BatchResult | undefined)?.meta?.changes ?? 0);
      return baseOutcome(input, changes > 0 ? "succeeded" : "replayed", [
        changes > 0 ? "offer_appended" : "idempotent_replay",
      ], rowToOffer(stored));
    } catch {
      return baseOutcome(input, "blocked", ["write_failed"]);
    }
  }
}
