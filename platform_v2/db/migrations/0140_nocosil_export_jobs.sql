-- Durable, site-scoped idempotency and delivery lease for explicit NOCOSIL exports.
-- Additive only. Selection, site-owner authorization and rights eligibility are
-- established by the caller before this table is written.
CREATE TABLE IF NOT EXISTS zukan_nocosil_exports (
    export_id UUID PRIMARY KEY,
    site_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    request_digest CHAR(64) NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
    body_digest CHAR(64) NOT NULL CHECK (body_digest ~ '^[0-9a-f]{64}$'),
    body_snapshot JSONB NOT NULL,
    consent_snapshot JSONB NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'processing', 'failed', 'sent')),
    lease_owner TEXT,
    lease_expires_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    result JSONB,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    CONSTRAINT uq_zukan_nocosil_exports_site_idempotency UNIQUE (site_id, idempotency_key),
    CONSTRAINT ck_zukan_nocosil_exports_lease CHECK (
        (state = 'processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL)
        OR (state <> 'processing' AND lease_owner IS NULL AND lease_expires_at IS NULL)
    ),
    CONSTRAINT ck_zukan_nocosil_exports_sent CHECK (
        (state = 'sent' AND sent_at IS NOT NULL)
        OR (state <> 'sent' AND sent_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_zukan_nocosil_exports_pending_lease
    ON zukan_nocosil_exports (lease_expires_at)
    WHERE state IN ('pending', 'failed', 'processing');
