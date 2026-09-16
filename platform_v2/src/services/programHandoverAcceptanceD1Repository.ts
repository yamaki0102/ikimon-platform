import type { FoundationD1Database } from "./zukanFoundationV2D1Repository.js";
import {
  buildProgramHandoverAcceptance,
  providerNeutralBlockedAcceptance,
  validateProgramHandoverAcceptanceBindings,
  validateProgramHandoverAcceptanceRequest,
  type ProgramHandoverAcceptance,
  type ProgramHandoverAcceptanceOutcome,
  type ProgramHandoverAcceptanceRepository,
  type ProgramHandoverAcceptanceRequest,
  type ProgramHandoverOfferBinding,
  type ProgramHandoverPlanBinding,
} from "./programHandoverAcceptanceRepositoryContract.js";

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
  tenant_id: string;
  workspace_id: string | null;
  logical_offer_id: string;
  offer_identity: string;
  logical_plan_id: string;
  plan_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  outgoing_actor_ref: string;
  intended_incoming_actor_ref: string;
  status: string;
  incoming_acceptance: string;
  responsibility_transfer: string;
};

type StoredAcceptanceRow = {
  idempotency_key: string;
  tenant_id: string;
  workspace_id: string | null;
  logical_acceptance_id: string;
  acceptance_identity: string;
  payload_sha256: string;
  logical_plan_id: string;
  plan_identity: string;
  logical_offer_id: string;
  offer_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  incoming_actor_ref: string;
  outgoing_actor_ref: string;
  status: "accepted_pending_apply";
  responsibility_transfer: "pending_apply";
  actor_audit_ref: string;
  accepted_at: string;
  created_at: string;
};

type BatchResult = { meta?: { changes?: number }; results?: unknown[] };

function baseOutcome(
  input: ProgramHandoverAcceptanceRequest,
  status: ProgramHandoverAcceptanceOutcome["status"],
  reasons: string[],
  acceptance: ProgramHandoverAcceptance | null = null,
): ProgramHandoverAcceptanceOutcome {
  return {
    status,
    dialect: "d1",
    operation: "program_handover_acceptance_append_v1",
    tenantId: input.tenantId || "",
    workspaceId: input.workspaceId ?? null,
    acceptanceIdempotencyKey: input.acceptanceIdempotencyKey || "",
    acceptance,
    reasons: [...new Set(reasons)],
  };
}

function rowToAcceptance(row: StoredAcceptanceRow): ProgramHandoverAcceptance {
  return {
    status: row.status,
    logicalAcceptanceId: row.logical_acceptance_id,
    acceptanceIdentity: row.acceptance_identity,
    payloadDigest: row.payload_sha256,
    planRef: {
      logicalPlanId: row.logical_plan_id,
      planIdentity: row.plan_identity,
    },
    offerRef: {
      logicalOfferId: row.logical_offer_id,
      offerIdentity: row.offer_identity,
    },
    sourceScope: {
      programId: row.source_program_id,
      revision: row.source_revision,
    },
    targetScope: {
      programId: row.target_program_id,
      continuationId: row.target_continuation_id,
    },
    incomingActorRef: row.incoming_actor_ref,
    outgoingActorRef: row.outgoing_actor_ref,
    responsibilityTransfer: row.responsibility_transfer,
    actorAuditRef: row.actor_audit_ref,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  };
}

function rowToPlanBinding(row: StoredPlanRow): ProgramHandoverPlanBinding {
  return {
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    logicalPlanId: row.logical_plan_id,
    planIdentity: row.plan_identity,
    sourceProgramId: row.source_program_id,
    sourceRevision: row.source_revision,
    targetProgramId: row.target_program_id,
    targetContinuationId: row.target_continuation_id,
    outgoingResponsibilityRef: row.outgoing_responsibility_ref,
    incomingResponsibilityRef: row.incoming_responsibility_ref,
  };
}

function rowToOfferBinding(row: StoredOfferRow): ProgramHandoverOfferBinding {
  return {
    tenantId: row.tenant_id,
    workspaceId: row.workspace_id,
    logicalOfferId: row.logical_offer_id,
    offerIdentity: row.offer_identity,
    logicalPlanId: row.logical_plan_id,
    planIdentity: row.plan_identity,
    sourceProgramId: row.source_program_id,
    sourceRevision: row.source_revision,
    targetProgramId: row.target_program_id,
    targetContinuationId: row.target_continuation_id,
    outgoingActorRef: row.outgoing_actor_ref,
    intendedIncomingActorRef: row.intended_incoming_actor_ref,
    status: row.status,
    incomingAcceptance: row.incoming_acceptance,
    responsibilityTransfer: row.responsibility_transfer,
  };
}

function storedAcceptanceMatchesRequest(
  row: StoredAcceptanceRow,
  desired: ProgramHandoverAcceptance,
  input: ProgramHandoverAcceptanceRequest,
): boolean {
  return row.idempotency_key === input.acceptanceIdempotencyKey
    && row.tenant_id === input.tenantId
    && row.workspace_id === input.workspaceId
    && row.logical_acceptance_id === desired.logicalAcceptanceId
    && row.acceptance_identity === desired.acceptanceIdentity
    && row.payload_sha256 === desired.payloadDigest
    && row.logical_plan_id === desired.planRef.logicalPlanId
    && row.plan_identity === desired.planRef.planIdentity
    && row.logical_offer_id === desired.offerRef.logicalOfferId
    && row.offer_identity === desired.offerRef.offerIdentity
    && row.source_program_id === desired.sourceScope.programId
    && row.source_revision === desired.sourceScope.revision
    && row.target_program_id === desired.targetScope.programId
    && row.target_continuation_id === desired.targetScope.continuationId
    && row.incoming_actor_ref === desired.incomingActorRef
    && row.outgoing_actor_ref === desired.outgoingActorRef
    && row.status === desired.status
    && row.responsibility_transfer === desired.responsibilityTransfer
    && row.actor_audit_ref === desired.actorAuditRef
    && row.accepted_at === desired.acceptedAt
    && row.created_at === desired.createdAt;
}

function acceptanceSelect(): string {
  return `
    SELECT idempotency_key, tenant_id, workspace_id, logical_acceptance_id,
           acceptance_identity, payload_sha256, logical_plan_id, plan_identity,
           logical_offer_id, offer_identity, source_program_id, source_revision,
           target_program_id, target_continuation_id, incoming_actor_ref,
           outgoing_actor_ref, status, responsibility_transfer, actor_audit_ref,
           accepted_at, created_at
      FROM zukan_program_handover_acceptances
     WHERE idempotency_key = ?
  `;
}

export class ProgramHandoverAcceptanceD1Repository implements ProgramHandoverAcceptanceRepository {
  readonly dialect = "d1" as const;

  constructor(private readonly database: FoundationD1Database) {}

  async createAcceptance(input: ProgramHandoverAcceptanceRequest): Promise<ProgramHandoverAcceptanceOutcome> {
    const invalid = validateProgramHandoverAcceptanceRequest(input);
    if (invalid.length > 0) return { ...providerNeutralBlockedAcceptance(input), dialect: "d1" };

    const desired = buildProgramHandoverAcceptance(input);
    try {
      const results = await this.database.batch([
        this.database.prepare(`
          SELECT tenant_id, workspace_id, logical_plan_id, plan_identity,
                 source_program_id, source_revision, target_program_id,
                 target_continuation_id, outgoing_responsibility_ref,
                 incoming_responsibility_ref
            FROM zukan_program_handover_plan_receipts
           WHERE logical_plan_id = ?
        `).bind(input.persistedPlan.logicalPlanId),
        this.database.prepare(`
          SELECT tenant_id, workspace_id, logical_offer_id, offer_identity,
                 logical_plan_id, plan_identity, source_program_id,
                 source_revision, target_program_id, target_continuation_id,
                 outgoing_actor_ref, intended_incoming_actor_ref, status,
                 incoming_acceptance, responsibility_transfer
            FROM zukan_program_handover_offers
           WHERE logical_offer_id = ?
        `).bind(input.offer.logicalOfferId),
        this.database.prepare(acceptanceSelect()).bind(input.acceptanceIdempotencyKey),
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_program_handover_acceptances(
            idempotency_key, tenant_id, workspace_id, logical_acceptance_id,
            acceptance_identity, payload_sha256, logical_plan_id, plan_identity,
            logical_offer_id, offer_identity, source_program_id, source_revision,
            target_program_id, target_continuation_id, incoming_actor_ref,
            outgoing_actor_ref, status, responsibility_transfer, actor_audit_ref,
            accepted_at, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
             AND EXISTS (
             SELECT 1
               FROM zukan_program_handover_offers
              WHERE tenant_id = ? AND workspace_id IS ?
                AND logical_offer_id = ? AND offer_identity = ?
                AND logical_plan_id = ? AND plan_identity = ?
                AND source_program_id = ? AND source_revision = ?
                AND target_program_id = ? AND target_continuation_id = ?
                AND outgoing_actor_ref = ?
                AND intended_incoming_actor_ref = ?
                AND status = 'pending_acceptance'
                AND incoming_acceptance = 'not_started'
                AND responsibility_transfer = 'not_started'
           )
        `).bind(
          input.acceptanceIdempotencyKey,
          input.tenantId,
          input.workspaceId,
          desired.logicalAcceptanceId,
          desired.acceptanceIdentity,
          desired.payloadDigest,
          desired.planRef.logicalPlanId,
          desired.planRef.planIdentity,
          desired.offerRef.logicalOfferId,
          desired.offerRef.offerIdentity,
          desired.sourceScope.programId,
          desired.sourceScope.revision,
          desired.targetScope.programId,
          desired.targetScope.continuationId,
          desired.incomingActorRef,
          desired.outgoingActorRef,
          desired.status,
          desired.responsibilityTransfer,
          desired.actorAuditRef,
          desired.acceptedAt,
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
          desired.incomingActorRef,
          input.tenantId,
          input.workspaceId,
          desired.offerRef.logicalOfferId,
          desired.offerRef.offerIdentity,
          desired.planRef.logicalPlanId,
          desired.planRef.planIdentity,
          desired.sourceScope.programId,
          desired.sourceScope.revision,
          desired.targetScope.programId,
          desired.targetScope.continuationId,
          desired.outgoingActorRef,
          desired.incomingActorRef,
        ),
        this.database.prepare(acceptanceSelect()).bind(input.acceptanceIdempotencyKey),
      ]);

      const plan = ((results[0] as BatchResult | undefined)?.results?.[0] ?? null) as StoredPlanRow | null;
      const offer = ((results[1] as BatchResult | undefined)?.results?.[0] ?? null) as StoredOfferRow | null;
      const existing = ((results[2] as BatchResult | undefined)?.results?.[0] ?? null) as StoredAcceptanceRow | null;
      const stored = ((results[4] as BatchResult | undefined)?.results?.[0] ?? null) as StoredAcceptanceRow | null;
      const bindingReasons = validateProgramHandoverAcceptanceBindings(
        input,
        plan ? rowToPlanBinding(plan) : null,
        offer ? rowToOfferBinding(offer) : null,
      );
      if (bindingReasons.length > 0) return baseOutcome(input, "blocked", bindingReasons);
      if (!stored) {
        return baseOutcome(input, "blocked", existing ? ["acceptance_not_observed"] : ["write_not_observed"]);
      }
      if (!storedAcceptanceMatchesRequest(stored, desired, input)) {
        return baseOutcome(input, "conflict", ["same_key_different_acceptance_payload"], rowToAcceptance(stored));
      }
      const changes = Number((results[3] as BatchResult | undefined)?.meta?.changes ?? 0);
      return baseOutcome(
        input,
        changes > 0 ? "succeeded" : "replayed",
        [changes > 0 ? "acceptance_appended" : "idempotent_replay"],
        rowToAcceptance(stored),
      );
    } catch {
      return baseOutcome(input, "blocked", ["write_failed"]);
    }
  }
}
