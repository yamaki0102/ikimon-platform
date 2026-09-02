-- ZUKAN M7.2 append-only outgoing handover offers.
-- Definition only: M7.2 source-only delivery does not apply this migration to
-- staging or production.

CREATE TABLE IF NOT EXISTS zukan_program_handover_offers (
  idempotency_key TEXT PRIMARY KEY CHECK (length(trim(idempotency_key)) > 0),
  tenant_id TEXT NOT NULL CHECK (length(trim(tenant_id)) > 0),
  workspace_id TEXT,
  logical_offer_id TEXT NOT NULL UNIQUE CHECK (length(trim(logical_offer_id)) > 0),
  offer_identity TEXT NOT NULL CHECK (
    length(offer_identity) = 64 AND offer_identity NOT GLOB '*[^0-9a-f]*'
  ),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64 AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  logical_plan_id TEXT NOT NULL CHECK (length(trim(logical_plan_id)) > 0),
  plan_identity TEXT NOT NULL CHECK (
    length(plan_identity) = 64 AND plan_identity NOT GLOB '*[^0-9a-f]*'
  ),
  source_program_id TEXT NOT NULL CHECK (length(trim(source_program_id)) > 0),
  source_revision TEXT NOT NULL CHECK (length(trim(source_revision)) > 0),
  target_program_id TEXT NOT NULL CHECK (length(trim(target_program_id)) > 0),
  target_continuation_id TEXT NOT NULL CHECK (length(trim(target_continuation_id)) > 0),
  outgoing_actor_ref TEXT NOT NULL CHECK (length(trim(outgoing_actor_ref)) > 0),
  intended_incoming_actor_ref TEXT NOT NULL CHECK (length(trim(intended_incoming_actor_ref)) > 0),
  status TEXT NOT NULL CHECK (status = 'pending_acceptance'),
  incoming_acceptance TEXT NOT NULL CHECK (incoming_acceptance = 'not_started'),
  responsibility_transfer TEXT NOT NULL CHECK (responsibility_transfer = 'not_started'),
  actor_audit_ref TEXT NOT NULL CHECK (length(trim(actor_audit_ref)) > 0),
  offered_at TEXT NOT NULL CHECK (julianday(offered_at) IS NOT NULL),
  created_at TEXT NOT NULL CHECK (julianday(created_at) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_zukan_program_handover_offers_scope
  ON zukan_program_handover_offers(tenant_id, workspace_id, source_program_id, target_program_id);

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_offers_no_update
BEFORE UPDATE ON zukan_program_handover_offers
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_offer_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_program_handover_offers_no_delete
BEFORE DELETE ON zukan_program_handover_offers
BEGIN
  SELECT RAISE(ABORT, 'zukan_program_handover_offer_immutable');
END;
