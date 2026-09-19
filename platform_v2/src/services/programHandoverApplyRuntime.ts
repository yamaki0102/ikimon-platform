import { createHash } from "node:crypto";
import type { FoundationD1Database } from "./zukanFoundationV2D1Repository.js";

export type HandoverApplyInput = {
  tenantId: string;
  workspaceId: string | null;
  targetProgramId: string;
  logicalAcceptanceId: string;
  acceptanceIdentity: string;
  actorUserId: string;
  expectedTargetRevision: string;
  idempotencyKey: string;
  actorAuditRef: string;
  occurredAt: string;
};

export type HandoverRollbackInput = {
  targetProgramId: string;
  logicalApplyId: string;
  applyIdentity: string;
  actorUserId: string;
  expectedTargetRevision: string;
  idempotencyKey: string;
  actorAuditRef: string;
  occurredAt: string;
};
export type HandoverApplyReceipt = {
  logicalApplyId: string;
  applyIdentity: string;
  logicalAcceptanceId: string;
  acceptanceIdentity: string;
  sourceProgramId: string;
  sourceRevision: string;
  targetProgramId: string;
  targetContinuationId: string;
  outgoingActorRef: string;
  incomingActorRef: string;
  targetRevisionBefore: string;
  targetRevisionAfter: string;
  appliedAt: string;
};

export type HandoverRollbackReceipt = {
  logicalRollbackId: string;
  rollbackIdentity: string;
  logicalApplyId: string;
  applyIdentity: string;
  targetProgramId: string;
  outgoingActorRef: string;
  incomingActorRef: string;
  targetRevisionBefore: string;
  targetRevisionAfter: string;
  rolledBackAt: string;
};
export type HandoverOutcome<T> = {
  status: "succeeded" | "replayed" | "blocked" | "conflict";
  receipt: T | null;
  reasons: string[];
};

type AcceptanceRow = {
  tenant_id: string;
  workspace_id: string | null;
  logical_acceptance_id: string;
  acceptance_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  incoming_actor_ref: string;
  outgoing_actor_ref: string;
  status: string;
  responsibility_transfer: string;
};

type EventRow = {
  session_id: string;
  organizer_user_id: string;
  updated_at: string;
  template_source_session_id: string | null;
};
type ApplyRow = {
  idempotency_key: string;
  logical_apply_id: string;
  apply_identity: string;
  payload_sha256: string;
  logical_acceptance_id: string;
  acceptance_identity: string;
  source_program_id: string;
  source_revision: string;
  target_program_id: string;
  target_continuation_id: string;
  outgoing_actor_ref: string;
  incoming_actor_ref: string;
  target_revision_before: string;
  target_revision_after: string;
  applied_at: string;
};

type RollbackRow = {
  idempotency_key: string;
  logical_rollback_id: string;
  rollback_identity: string;
  payload_sha256: string;
  logical_apply_id: string;
  apply_identity: string;
  target_program_id: string;  outgoing_actor_ref: string;
  incoming_actor_ref: string;
  target_revision_before: string;
  target_revision_after: string;
  rolled_back_at: string;
};

type BatchResult = { meta?: { changes?: number }; results?: unknown[] };

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isTimestamp(value: unknown): value is string {
  return isText(value) && Number.isFinite(Date.parse(value));
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => canonicalJson(item)));
  if (value && typeof value === "object") {
    return JSON.stringify(Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalJson(item)]),
    ));
  }
  return JSON.stringify(value);
}
function sha(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function blocked<T>(...reasons: string[]): HandoverOutcome<T> {
  return { status: "blocked", receipt: null, reasons: [...new Set(reasons)] };
}

function applyIdentity(input: HandoverApplyInput) {
  const logicalApplyId = sha({
    kind: "program_handover_apply_v1",
    acceptanceIdentity: input.acceptanceIdentity,
    targetProgramId: input.targetProgramId,
  });
  const payloadSha = sha({
    logicalApplyId,
    actorUserId: input.actorUserId,
    expectedTargetRevision: input.expectedTargetRevision,
  });
  return {
    logicalApplyId,
    payloadSha,
    applyIdentity: sha({ kind: "program_handover_apply_v1", payloadSha }),
  };
}

function rollbackIdentity(input: HandoverRollbackInput) {
  const logicalRollbackId = sha({
    kind: "program_handover_rollback_v1",
    applyIdentity: input.applyIdentity,
    targetProgramId: input.targetProgramId,
  });  const payloadSha = sha({
    logicalRollbackId,
    actorUserId: input.actorUserId,
    expectedTargetRevision: input.expectedTargetRevision,
  });
  return {
    logicalRollbackId,
    payloadSha,
    rollbackIdentity: sha({ kind: "program_handover_rollback_v1", payloadSha }),
  };
}

function applySelect(where: string): string {
  return [
    "SELECT idempotency_key, logical_apply_id, apply_identity, payload_sha256,",
    "logical_acceptance_id, acceptance_identity, source_program_id, source_revision,",
    "target_program_id, target_continuation_id, outgoing_actor_ref, incoming_actor_ref,",
    "target_revision_before, target_revision_after, applied_at",
    "FROM zukan_program_handover_runtime_applies WHERE " + where,
  ].join(" ");
}

function rollbackSelect(where: string): string {
  return [
    "SELECT idempotency_key, logical_rollback_id, rollback_identity, payload_sha256,",
    "logical_apply_id, apply_identity, target_program_id, outgoing_actor_ref, incoming_actor_ref,",
    "target_revision_before, target_revision_after, rolled_back_at",
    "FROM zukan_program_handover_runtime_rollbacks WHERE " + where,
  ].join(" ");
}
function toApply(row: ApplyRow): HandoverApplyReceipt {
  return {
    logicalApplyId: row.logical_apply_id,
    applyIdentity: row.apply_identity,
    logicalAcceptanceId: row.logical_acceptance_id,
    acceptanceIdentity: row.acceptance_identity,
    sourceProgramId: row.source_program_id,
    sourceRevision: row.source_revision,
    targetProgramId: row.target_program_id,
    targetContinuationId: row.target_continuation_id,
    outgoingActorRef: row.outgoing_actor_ref,
    incomingActorRef: row.incoming_actor_ref,
    targetRevisionBefore: row.target_revision_before,
    targetRevisionAfter: row.target_revision_after,
    appliedAt: row.applied_at,
  };
}

function toRollback(row: RollbackRow): HandoverRollbackReceipt {
  return {
    logicalRollbackId: row.logical_rollback_id,
    rollbackIdentity: row.rollback_identity,
    logicalApplyId: row.logical_apply_id,
    applyIdentity: row.apply_identity,
    targetProgramId: row.target_program_id,
    outgoingActorRef: row.outgoing_actor_ref,
    incomingActorRef: row.incoming_actor_ref,
    targetRevisionBefore: row.target_revision_before,
    targetRevisionAfter: row.target_revision_after,
    rolledBackAt: row.rolled_back_at,
  };
}
export class ProgramHandoverApplyRuntime {
  constructor(
    private readonly coreDb: FoundationD1Database,
    private readonly observationDb: FoundationD1Database,
  ) {}

  async apply(input: HandoverApplyInput): Promise<HandoverOutcome<HandoverApplyReceipt>> {
    if (!isText(input.tenantId) || !isText(input.targetProgramId)
      || !isText(input.logicalAcceptanceId) || !isDigest(input.acceptanceIdentity)
      || !isText(input.actorUserId) || !isText(input.expectedTargetRevision)
      || !isText(input.idempotencyKey) || !isText(input.actorAuditRef)
      || !isTimestamp(input.occurredAt)) {
      return blocked("apply_request_invalid");
    }

    const identity = applyIdentity(input);
    const existing = await this.observationDb.batch([
      this.observationDb.prepare(applySelect("idempotency_key = ?"))
        .bind(input.idempotencyKey),
      this.observationDb.prepare(applySelect("logical_acceptance_id = ?"))
        .bind(input.logicalAcceptanceId),
    ]);
    const byKey = ((existing[0] as BatchResult)?.results?.[0] ?? null) as ApplyRow | null;
    const byAcceptance = ((existing[1] as BatchResult)?.results?.[0] ?? null) as ApplyRow | null;

    if (byKey || byAcceptance) {
      const row = byKey ?? byAcceptance!;
      const same = row.logical_apply_id === identity.logicalApplyId
        && row.apply_identity === identity.applyIdentity
        && row.payload_sha256 === identity.payloadSha
        && row.logical_acceptance_id === input.logicalAcceptanceId
        && row.acceptance_identity === input.acceptanceIdentity
        && row.target_program_id === input.targetProgramId
        && row.incoming_actor_ref === input.actorUserId
        && row.target_revision_before === input.expectedTargetRevision;
      return {
        status: same ? "replayed" : "conflict",
        receipt: toApply(row),
        reasons: [same ? "idempotent_replay" : "apply_identity_conflict"],
      };
    }

    const acceptance = await this.coreDb.prepare(
      [
        "SELECT tenant_id, workspace_id, logical_acceptance_id, acceptance_identity,",
        "source_program_id, source_revision, target_program_id, target_continuation_id,",
        "incoming_actor_ref, outgoing_actor_ref, status, responsibility_transfer",
        "FROM zukan_program_handover_acceptances",
        "WHERE logical_acceptance_id = ? AND acceptance_identity = ?",
      ].join(" "),
    ).bind(input.logicalAcceptanceId, input.acceptanceIdentity).first<AcceptanceRow>();

    if (!acceptance) return blocked("accepted_handover_not_found");
    if (acceptance.tenant_id !== input.tenantId || acceptance.workspace_id !== input.workspaceId) {
      return blocked("scope_mismatch");
    }
    if (acceptance.target_program_id !== input.targetProgramId) {
      return blocked("target_program_mismatch");
    }    if (acceptance.status !== "accepted_pending_apply"
      || acceptance.responsibility_transfer !== "pending_apply") {
      return blocked("acceptance_not_pending_apply");
    }
    if (acceptance.incoming_actor_ref !== input.actorUserId) {
      return blocked("incoming_actor_mismatch");
    }
    if (acceptance.source_program_id === acceptance.target_program_id) {
      return blocked("source_target_must_differ");
    }

    const runtime = await this.observationDb.batch([
      this.observationDb.prepare(
        "SELECT session_id, organizer_user_id, updated_at, template_source_session_id " +
        "FROM observation_event_sessions WHERE session_id = ?",
      ).bind(acceptance.source_program_id),
      this.observationDb.prepare(
        "SELECT session_id, organizer_user_id, updated_at, template_source_session_id " +
        "FROM observation_event_sessions WHERE session_id = ?",
      ).bind(acceptance.target_program_id),
      this.observationDb.prepare(
        "SELECT count(*) AS count FROM observation_event_participants WHERE session_id = ?",
      ).bind(acceptance.target_program_id),
    ]);
    const source = ((runtime[0] as BatchResult)?.results?.[0] ?? null) as EventRow | null;
    const target = ((runtime[1] as BatchResult)?.results?.[0] ?? null) as EventRow | null;
    const participantCount = Number(
      ((runtime[2] as BatchResult)?.results?.[0] as { count?: number } | undefined)?.count ?? 0,
    );
    const reasons: string[] = [];
    if (!source) reasons.push("source_program_not_found");
    if (!target) reasons.push("target_program_not_found");
    if (source && source.updated_at !== acceptance.source_revision) {
      reasons.push("source_revision_stale");
    }
    if (source && source.organizer_user_id !== acceptance.outgoing_actor_ref) {
      reasons.push("source_responsibility_changed");
    }
    if (target && target.organizer_user_id !== acceptance.outgoing_actor_ref) {
      reasons.push("target_responsibility_changed");
    }
    if (target && target.updated_at !== input.expectedTargetRevision) {
      reasons.push("target_revision_stale");
    }
    if (target && target.template_source_session_id !== acceptance.source_program_id) {
      reasons.push("target_not_bound_to_source_rehost");
    }
    if (participantCount !== 0) reasons.push("target_participation_already_started");
    if (reasons.length > 0) return blocked(...reasons);

    const update = [
      "UPDATE observation_event_sessions",
      "SET organizer_user_id = ?, updated_at = ?",
      "WHERE session_id = ? AND organizer_user_id = ? AND updated_at = ?",
      "AND template_source_session_id = ?",
      "AND NOT EXISTS (SELECT 1 FROM observation_event_participants WHERE session_id = ?)",
      "AND EXISTS (SELECT 1 FROM observation_event_sessions s",
      "WHERE s.session_id = ? AND s.updated_at = ? AND s.organizer_user_id = ?)",
    ].join(" ");
    const insert = [
      "INSERT INTO zukan_program_handover_runtime_applies(",
      "idempotency_key, logical_apply_id, apply_identity, payload_sha256,",
      "logical_acceptance_id, acceptance_identity, source_program_id, source_revision,",
      "target_program_id, target_continuation_id, outgoing_actor_ref, incoming_actor_ref,",
      "target_revision_before, target_revision_after, actor_audit_ref, applied_at, created_at)",
      "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
      "WHERE EXISTS (SELECT 1 FROM observation_event_sessions",
      "WHERE session_id = ? AND organizer_user_id = ? AND updated_at = ?)",
      "AND EXISTS (SELECT 1 FROM observation_event_sessions",
      "WHERE session_id = ? AND organizer_user_id = ? AND updated_at = ?)",
    ].join(" ");

    try {
      const results = await this.observationDb.batch([
        this.observationDb.prepare(update).bind(
          acceptance.incoming_actor_ref,
          input.occurredAt,
          acceptance.target_program_id,
          acceptance.outgoing_actor_ref,
          input.expectedTargetRevision,
          acceptance.source_program_id,
          acceptance.target_program_id,
          acceptance.source_program_id,
          acceptance.source_revision,
          acceptance.outgoing_actor_ref,
        ),
        this.observationDb.prepare(insert).bind(
          input.idempotencyKey,
          identity.logicalApplyId,
          identity.applyIdentity,
          identity.payloadSha,
          acceptance.logical_acceptance_id,
          acceptance.acceptance_identity,
          acceptance.source_program_id,
          acceptance.source_revision,
          acceptance.target_program_id,
          acceptance.target_continuation_id,
          acceptance.outgoing_actor_ref,
          acceptance.incoming_actor_ref,
          input.expectedTargetRevision,
          input.occurredAt,
          input.actorAuditRef,
          input.occurredAt,
          input.occurredAt,
          acceptance.target_program_id,
          acceptance.incoming_actor_ref,
          input.occurredAt,
          acceptance.source_program_id,
          acceptance.outgoing_actor_ref,
          acceptance.source_revision,
        ),
        this.observationDb.prepare(applySelect("idempotency_key = ?")).bind(input.idempotencyKey),
      ]);
      const changed = Number((results[0] as BatchResult)?.meta?.changes ?? 0);
      const inserted = Number((results[1] as BatchResult)?.meta?.changes ?? 0);
      const stored = ((results[2] as BatchResult)?.results?.[0] ?? null) as ApplyRow | null;
      if (changed !== 1 || inserted !== 1 || !stored) return blocked("apply_not_observed");
      return { status: "succeeded", receipt: toApply(stored), reasons: ["responsibility_applied"] };
    } catch {
      const recovered = await this.observationDb.prepare(
        applySelect("idempotency_key = ? OR logical_acceptance_id = ?"),
      ).bind(input.idempotencyKey, input.logicalAcceptanceId).first<ApplyRow>();
      if (!recovered) return blocked("apply_write_failed");
      const same = recovered.apply_identity === identity.applyIdentity
        && recovered.payload_sha256 === identity.payloadSha;
      return {
        status: same ? "replayed" : "conflict",
        receipt: toApply(recovered),
        reasons: [same ? "idempotent_replay" : "concurrent_apply_conflict"],
      };
    }
  }

  async rollback(input: HandoverRollbackInput): Promise<HandoverOutcome<HandoverRollbackReceipt>> {
    if (!isText(input.targetProgramId) || !isText(input.logicalApplyId)
      || !isDigest(input.applyIdentity) || !isText(input.actorUserId)
      || !isText(input.expectedTargetRevision) || !isText(input.idempotencyKey)
      || !isText(input.actorAuditRef) || !isTimestamp(input.occurredAt)) {
      return blocked("rollback_request_invalid");
    }

    const identity = rollbackIdentity(input);
    const existing = await this.observationDb.batch([
      this.observationDb.prepare(
        applySelect("logical_apply_id = ? AND apply_identity = ?"),
      ).bind(input.logicalApplyId, input.applyIdentity),
      this.observationDb.prepare(rollbackSelect("idempotency_key = ?"))
        .bind(input.idempotencyKey),
      this.observationDb.prepare(rollbackSelect("logical_apply_id = ?"))
        .bind(input.logicalApplyId),
    ]);
    const apply = ((existing[0] as BatchResult)?.results?.[0] ?? null) as ApplyRow | null;
    const byKey = ((existing[1] as BatchResult)?.results?.[0] ?? null) as RollbackRow | null;
    const byApply = ((existing[2] as BatchResult)?.results?.[0] ?? null) as RollbackRow | null;

    if (byKey || byApply) {
      const row = byKey ?? byApply!;
      const same = row.logical_rollback_id === identity.logicalRollbackId
        && row.rollback_identity === identity.rollbackIdentity
        && row.payload_sha256 === identity.payloadSha
        && row.logical_apply_id === input.logicalApplyId
        && row.apply_identity === input.applyIdentity
        && row.target_program_id === input.targetProgramId
        && row.incoming_actor_ref === input.actorUserId
        && row.target_revision_before === input.expectedTargetRevision;
      return {
        status: same ? "replayed" : "conflict",
        receipt: toRollback(row),
        reasons: [same ? "idempotent_replay" : "rollback_identity_conflict"],
      };
    }

    if (!apply) return blocked("apply_not_found");
    if (apply.target_program_id !== input.targetProgramId) {
      return blocked("target_program_mismatch");
    }
    if (apply.incoming_actor_ref !== input.actorUserId) {
      return blocked("rollback_actor_mismatch");
    }
    if (input.expectedTargetRevision !== apply.target_revision_after) {
      return blocked("rollback_revision_not_apply_revision");
    }

    const runtime = await this.observationDb.batch([
      this.observationDb.prepare(
        "SELECT session_id, organizer_user_id, updated_at, template_source_session_id " +
        "FROM observation_event_sessions WHERE session_id = ?",
      ).bind(apply.target_program_id),
      this.observationDb.prepare(
        "SELECT count(*) AS count FROM observation_event_participants WHERE session_id = ?",
      ).bind(apply.target_program_id),
    ]);    const target = ((runtime[0] as BatchResult)?.results?.[0] ?? null) as EventRow | null;
    const participantCount = Number(
      ((runtime[1] as BatchResult)?.results?.[0] as { count?: number } | undefined)?.count ?? 0,
    );
    if (!target) return blocked("target_program_not_found");
    if (target.organizer_user_id !== apply.incoming_actor_ref) {
      return blocked("target_responsibility_changed");
    }
    if (target.updated_at !== input.expectedTargetRevision) {
      return blocked("target_revision_stale");
    }
    if (participantCount !== 0) return blocked("target_participation_already_started");

    const update = [
      "UPDATE observation_event_sessions",
      "SET organizer_user_id = ?, updated_at = ?",
      "WHERE session_id = ? AND organizer_user_id = ? AND updated_at = ?",
      "AND NOT EXISTS (SELECT 1 FROM observation_event_participants WHERE session_id = ?)",
    ].join(" ");

    const insert = [
      "INSERT INTO zukan_program_handover_runtime_rollbacks(",
      "idempotency_key, logical_rollback_id, rollback_identity, payload_sha256,",
      "logical_apply_id, apply_identity, target_program_id, outgoing_actor_ref, incoming_actor_ref,",
      "target_revision_before, target_revision_after, actor_audit_ref, rolled_back_at, created_at)",
      "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?",
      "WHERE EXISTS (SELECT 1 FROM observation_event_sessions",
      "WHERE session_id = ? AND organizer_user_id = ? AND updated_at = ?)",
    ].join(" ");
    try {
      const results = await this.observationDb.batch([
        this.observationDb.prepare(update).bind(
          apply.outgoing_actor_ref,
          input.occurredAt,
          apply.target_program_id,
          apply.incoming_actor_ref,
          input.expectedTargetRevision,
          apply.target_program_id,
        ),
        this.observationDb.prepare(insert).bind(
          input.idempotencyKey,
          identity.logicalRollbackId,
          identity.rollbackIdentity,
          identity.payloadSha,
          apply.logical_apply_id,
          apply.apply_identity,
          apply.target_program_id,
          apply.outgoing_actor_ref,
          apply.incoming_actor_ref,
          input.expectedTargetRevision,
          input.occurredAt,
          input.actorAuditRef,
          input.occurredAt,
          input.occurredAt,
          apply.target_program_id,
          apply.outgoing_actor_ref,
          input.occurredAt,
        ),
        this.observationDb.prepare(rollbackSelect("idempotency_key = ?")).bind(input.idempotencyKey),
      ]);
      const changed = Number((results[0] as BatchResult)?.meta?.changes ?? 0);
      const inserted = Number((results[1] as BatchResult)?.meta?.changes ?? 0);
      const stored = ((results[2] as BatchResult)?.results?.[0] ?? null) as RollbackRow | null;
      if (changed !== 1 || inserted !== 1 || !stored) return blocked("rollback_not_observed");
      return {
        status: "succeeded",
        receipt: toRollback(stored),
        reasons: ["responsibility_rolled_back"],
      };
    } catch {
      const recovered = await this.observationDb.prepare(
        rollbackSelect("idempotency_key = ? OR logical_apply_id = ?"),
      ).bind(input.idempotencyKey, input.logicalApplyId).first<RollbackRow>();
      if (!recovered) return blocked("rollback_write_failed");
      const same = recovered.rollback_identity === identity.rollbackIdentity
        && recovered.payload_sha256 === identity.payloadSha;
      return {
        status: same ? "replayed" : "conflict",
        receipt: toRollback(recovered),
        reasons: [same ? "idempotent_replay" : "concurrent_rollback_conflict"],
      };
    }
  }
}