-- ZUKAN M7.1 immutable ProgramHandover plan snapshots.
-- Definition only: this migration is intentionally not applied to staging or
-- production by the M7.1 source-only delivery.

CREATE TABLE IF NOT EXISTS zukan_program_handover_plan_receipts (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL CHECK (length(trim(tenant_id)) > 0),
  workspace_id TEXT,
  logical_plan_id TEXT NOT NULL UNIQUE CHECK (length(trim(logical_plan_id)) > 0),
  plan_identity TEXT NOT NULL CHECK (
    length(plan_identity) = 64 AND plan_identity NOT GLOB '*[^0-9a-f]*'
  ),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  source_program_id TEXT NOT NULL CHECK (length(trim(source_program_id)) > 0),
  source_revision TEXT NOT NULL CHECK (length(trim(source_revision)) > 0),
  target_program_id TEXT NOT NULL CHECK (length(trim(target_program_id)) > 0),
  target_continuation_id TEXT NOT NULL CHECK (length(trim(target_continuation_id)) > 0),
  selected_refs_json TEXT NOT NULL CHECK (json_valid(selected_refs_json)),
  reset_state_json TEXT NOT NULL CHECK (json_valid(reset_state_json)),
  outgoing_responsibility_ref TEXT NOT NULL CHECK (length(trim(outgoing_responsibility_ref)) > 0),
  incoming_responsibility_ref TEXT NOT NULL CHECK (length(trim(incoming_responsibility_ref)) > 0),
  observed_at TEXT NOT NULL CHECK (julianday(observed_at) IS NOT NULL),
  actor_audit_ref TEXT NOT NULL CHECK (length(trim(actor_audit_ref)) > 0),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_program_handover_plan_receipts_scope
  ON zukan_program_handover_plan_receipts(tenant_id, workspace_id, source_program_id, target_program_id);

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_plan_receipts_no_update
BEFORE UPDATE ON zukan_program_handover_plan_receipts
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_plan_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_plan_receipts_no_delete
BEFORE DELETE ON zukan_program_handover_plan_receipts
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_plan_immutable');
END;
