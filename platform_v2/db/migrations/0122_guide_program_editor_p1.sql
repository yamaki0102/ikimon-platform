-- P1 guide relay program editor audit trail.
-- Admin edits are reversible only if the actor, action, and before/after
-- payloads are retained. This table stores admin metadata only; no user
-- unlock coordinates or visit coordinates are copied here.
-- owner-sensitive-ok: adds one non-unique index to existing guide_programs and
-- a companion audit table. Deploy through the normal owner-capable migration
-- runner; rollback is to drop idx_guide_programs_status_updated and
-- guide_program_audit after application rollback.

CREATE TABLE IF NOT EXISTS guide_program_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id TEXT REFERENCES guide_programs(program_id) ON DELETE SET NULL,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL
        CHECK (action IN ('create', 'update', 'status_change', 'replace_spots')),
    before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_programs_status_updated
    ON guide_programs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_program_audit_program_recent
    ON guide_program_audit (program_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_program_audit_actor_recent
    ON guide_program_audit (actor_user_id, created_at DESC);
