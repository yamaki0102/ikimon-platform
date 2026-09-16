-- ZUKAN M7.3 append-only incoming handover acceptance receipts.
-- Definition only: M7.3 source-only delivery does not apply this migration to
-- staging or production.

CREATE TABLE IF NOT EXISTS zukan_program_handover_acceptances (
  idempotency_key TEXT PRIMARY KEY CHECK (length(trim(idempotency_key)) > 0),
  tenant_id TEXT NOT NULL CHECK (length(trim(tenant_id)) > 0),
  workspace_id TEXT,
  logical_acceptance_id TEXT NOT NULL UNIQUE CHECK (length(trim(logical_acceptance_id)) > 0),
  acceptance_identity TEXT NOT NULL CHECK (
    length(acceptance_identity) = 64 AND acceptance_identity NOT GLOB '*[^0-9a-f]*'
  ),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  logical_plan_id TEXT NOT NULL CHECK (length(trim(logical_plan_id)) > 0),
  plan_identity TEXT NOT NULL CHECK (
    length(plan_identity) = 64 AND plan_identity NOT GLOB '*[^0-9a-f]*'
  ),
  logical_offer_id TEXT NOT NULL CHECK (length(trim(logical_offer_id)) > 0),
  offer_identity TEXT NOT NULL CHECK (
    length(offer_identity) = 64 AND offer_identity NOT GLOB '*[^0-9a-f]*'
  ),
  source_program_id TEXT NOT NULL CHECK (length(trim(source_program_id)) > 0),
  source_revision TEXT NOT NULL CHECK (length(trim(source_revision)) > 0),
  target_program_id TEXT NOT NULL CHECK (length(trim(target_program_id)) > 0),
  target_continuation_id TEXT NOT NULL CHECK (length(trim(target_continuation_id)) > 0),
  incoming_actor_ref TEXT NOT NULL CHECK (length(trim(incoming_actor_ref)) > 0),
  outgoing_actor_ref TEXT NOT NULL CHECK (length(trim(outgoing_actor_ref)) > 0),
  status TEXT NOT NULL CHECK (status = 'accepted_pending_apply'),
  responsibility_transfer TEXT NOT NULL CHECK (responsibility_transfer = 'pending_apply'),
  actor_audit_ref TEXT NOT NULL CHECK (length(trim(actor_audit_ref)) > 0),
  accepted_at TEXT NOT NULL CHECK (julianday(accepted_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_program_handover_acceptances_scope
  ON zukan_program_handover_acceptances(tenant_id, workspace_id, source_program_id, target_program_id);

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_acceptances_no_update
BEFORE UPDATE ON zukan_program_handover_acceptances
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_acceptance_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_acceptances_no_delete
BEFORE DELETE ON zukan_program_handover_acceptances
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_acceptance_immutable');
END;
