import type {
  FoundationD1Database,
} from "./zukanFoundationV2D1Repository.js";
import {
  programHandoverPlanSnapshot,
  validateProgramHandoverPersistenceRequest,
  type ProgramHandoverPersistenceOutcome,
  type ProgramHandoverPersistenceRequest,
  type ProgramHandoverPlanRepository,
  type ProgramHandoverPlanSnapshot,
} from "./programHandoverRepositoryContract.js";

type StoredPlanRow = {
  idempotency_key: string;
  tenant_id: string;
  workspace_id: string | null;
  logical_plan_id: string;
  plan_identity: string;
  payload_sha256: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  selected_refs_json: string;
  reset_state_json: string;
  outgoing_responsibility_ref: string;
  incoming_responsibility_ref: string;
  observed_at: string;
  actor_audit_ref: string;
  created_at: string;
};

type BatchResult = {
  meta?: { changes?: number };
  results?: unknown[];
};

function baseOutcome(
  input: ProgramHandoverPersistenceRequest,
  status: ProgramHandoverPersistenceOutcome["status"],
  reasons: string[],
  row?: StoredPlanRow | null,
): ProgramHandoverPersistenceOutcome {
  return {
    status,
    dialect: "d1",
    operation: "program_handover_plan_persist_v1",
    tenantId: input.tenantId || "",
    workspaceId: input.workspaceId ?? null,
    idempotencyKey: input.idempotencyKey || "",
    logicalPlanId: row?.logical_plan_id ?? input.acceptedPlan?.logicalPlanId ?? null,
    planIdentity: row?.plan_identity ?? input.acceptedPlan?.planIdentity ?? null,
    payloadDigest: row?.payload_sha256 ?? input.acceptedPlan?.payloadDigest ?? null,
    receiptId: status === "succeeded" || status === "replayed" ? input.idempotencyKey : null,
    reasons: [...new Set(reasons)],
  };
}

function storedPlanPayloadMatches(row: StoredPlanRow, snapshot: ProgramHandoverPlanSnapshot, key: string): boolean {
  return row.idempotency_key === key
    && row.tenant_id === snapshot.tenantId
    && row.workspace_id === snapshot.workspaceId
    && row.logical_plan_id === snapshot.logicalPlanId
    && row.plan_identity === snapshot.planIdentity
    && row.payload_sha256 === snapshot.payloadDigest
    && row.source_program_id === snapshot.sourceProgramId
    && row.source_revision === snapshot.sourceRevision
    && row.target_program_id === snapshot.targetProgramId
    && row.target_continuation_id === snapshot.targetContinuationId
    && row.selected_refs_json === snapshot.selectedRefsJson
    && row.reset_state_json === snapshot.resetStateJson
    && row.outgoing_responsibility_ref === snapshot.outgoingResponsibilityRef
    && row.incoming_responsibility_ref === snapshot.incomingResponsibilityRef
    && row.observed_at === snapshot.observedAt;
}

export class ProgramHandoverD1Repository implements ProgramHandoverPlanRepository {
  readonly dialect = "d1" as const;

  constructor(private readonly database: FoundationD1Database) {}

  async persistAcceptedPlan(input: ProgramHandoverPersistenceRequest): Promise<ProgramHandoverPersistenceOutcome> {
    const invalid = validateProgramHandoverPersistenceRequest(input);
    if (invalid) return { ...invalid, dialect: "d1" };
    const snapshot = programHandoverPlanSnapshot(input);
    try {
      const results = await this.database.batch([
        this.database.prepare(`
          INSERT OR IGNORE INTO zukan_program_handover_plan_receipts(
            idempotency_key, tenant_id, workspace_id, logical_plan_id, plan_identity,
            payload_sha256, source_program_id, source_revision, target_program_id,
            target_continuation_id, selected_refs_json, reset_state_json,
            outgoing_responsibility_ref, incoming_responsibility_ref, observed_at,
            actor_audit_ref, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          input.idempotencyKey,
          snapshot.tenantId,
          snapshot.workspaceId,
          snapshot.logicalPlanId,
          snapshot.planIdentity,
          snapshot.payloadDigest,
          snapshot.sourceProgramId,
          snapshot.sourceRevision,
          snapshot.targetProgramId,
          snapshot.targetContinuationId,
          snapshot.selectedRefsJson,
          snapshot.resetStateJson,
          snapshot.outgoingResponsibilityRef,
          snapshot.incomingResponsibilityRef,
          snapshot.observedAt,
          snapshot.actorAuditRef,
          snapshot.createdAt,
        ),
        this.database.prepare(`
          SELECT idempotency_key, tenant_id, workspace_id, logical_plan_id, plan_identity,
                 payload_sha256, source_program_id, source_revision, target_program_id,
                 target_continuation_id, selected_refs_json, reset_state_json,
                 outgoing_responsibility_ref, incoming_responsibility_ref, observed_at,
                 actor_audit_ref, created_at
            FROM zukan_program_handover_plan_receipts
           WHERE idempotency_key = ?
        `).bind(input.idempotencyKey),
      ]);
      const row = ((results[1] as BatchResult | undefined)?.results?.[0] ?? null) as StoredPlanRow | null;
      if (!row) return baseOutcome(input, "blocked", ["write_not_observed"]);
      if (!storedPlanPayloadMatches(row, snapshot, input.idempotencyKey)) {
        return baseOutcome(input, "conflict", ["same_key_different_payload_or_scope"], row);
      }
      const changes = Number((results[0] as BatchResult | undefined)?.meta?.changes ?? 0);
      return baseOutcome(input, changes > 0 ? "succeeded" : "replayed", [
        changes > 0 ? "plan_persisted" : "idempotent_replay",
      ], row);
    } catch {
      return baseOutcome(input, "blocked", ["write_failed"]);
    }
  }
}
