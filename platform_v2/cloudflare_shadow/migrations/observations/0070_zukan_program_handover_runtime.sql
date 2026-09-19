-- ZUKAN M7.4 runtime responsibility mutation receipts.
-- M7.0-M7.3 acceptance remains immutable in CORE_DB.
-- M7.4 changes observation_event_sessions.organizer_user_id in OBS_DB and stores
-- the mutation receipt in the same D1 transaction so completion is never inferred
-- from a cross-database write.

CREATE TABLE IF NOT EXISTS zukan_program_handover_runtime_applies (
  idempotency_key TEXT PRIMARY KEY CHECK (length(trim(idempotency_key)) > 0),
  logical_apply_id TEXT NOT NULL UNIQUE CHECK (length(logical_apply_id) = 64),
  apply_identity TEXT NOT NULL CHECK (length(apply_identity) = 64),
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  logical_acceptance_id TEXT NOT NULL UNIQUE CHECK (length(trim(logical_acceptance_id)) > 0),
  acceptance_identity TEXT NOT NULL CHECK (length(acceptance_identity) = 64),
  source_program_id TEXT NOT NULL CHECK (length(trim(source_program_id)) > 0),
  source_revision TEXT NOT NULL CHECK (length(trim(source_revision)) > 0),
  target_program_id TEXT NOT NULL CHECK (length(trim(target_program_id)) > 0),
  target_continuation_id TEXT NOT NULL CHECK (length(trim(target_continuation_id)) > 0),
  outgoing_actor_ref TEXT NOT NULL CHECK (length(trim(outgoing_actor_ref)) > 0),
  incoming_actor_ref TEXT NOT NULL CHECK (length(trim(incoming_actor_ref)) > 0),
  target_revision_before TEXT NOT NULL CHECK (length(trim(target_revision_before)) > 0),
  target_revision_after TEXT NOT NULL CHECK (length(trim(target_revision_after)) > 0),
  actor_audit_ref TEXT NOT NULL CHECK (length(trim(actor_audit_ref)) > 0),
  applied_at TEXT NOT NULL CHECK (julianday(applied_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_program_handover_runtime_applies_target
  ON zukan_program_handover_runtime_applies(target_program_id, applied_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_runtime_applies_no_update
BEFORE UPDATE ON zukan_program_handover_runtime_applies
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_runtime_apply_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_runtime_applies_no_delete
BEFORE DELETE ON zukan_program_handover_runtime_applies
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_runtime_apply_immutable');
END;

CREATE TABLE IF NOT EXISTS zukan_program_handover_runtime_rollbacks (
  idempotency_key TEXT PRIMARY KEY CHECK (length(trim(idempotency_key)) > 0),
  logical_rollback_id TEXT NOT NULL UNIQUE CHECK (length(logical_rollback_id) = 64),
  rollback_identity TEXT NOT NULL CHECK (length(rollback_identity) = 64),
  payload_sha256 TEXT NOT NULL CHECK (length(payload_sha256) = 64),
  logical_apply_id TEXT NOT NULL UNIQUE CHECK (length(logical_apply_id) = 64),
  apply_identity TEXT NOT NULL CHECK (length(apply_identity) = 64),
  target_program_id TEXT NOT NULL CHECK (length(trim(target_program_id)) > 0),
  outgoing_actor_ref TEXT NOT NULL CHECK (length(trim(outgoing_actor_ref)) > 0),
  incoming_actor_ref TEXT NOT NULL CHECK (length(trim(incoming_actor_ref)) > 0),
  target_revision_before TEXT NOT NULL CHECK (length(trim(target_revision_before)) > 0),
  target_revision_after TEXT NOT NULL CHECK (length(trim(target_revision_after)) > 0),
  actor_audit_ref TEXT NOT NULL CHECK (length(trim(actor_audit_ref)) > 0),
  rolled_back_at TEXT NOT NULL CHECK (julianday(rolled_back_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_program_handover_runtime_rollbacks_target
  ON zukan_program_handover_runtime_rollbacks(target_program_id, rolled_back_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_runtime_rollbacks_no_update
BEFORE UPDATE ON zukan_program_handover_runtime_rollbacks
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_runtime_rollback_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_runtime_rollbacks_no_delete
BEFORE DELETE ON zukan_program_handover_runtime_rollbacks
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_runtime_rollback_immutable');
END;
