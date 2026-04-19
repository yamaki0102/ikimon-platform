CREATE TABLE IF NOT EXISTS specialist_authorities (
    authority_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    granted_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',
    authority_kind TEXT NOT NULL DEFAULT 'taxon_identification',
    scope_taxon_name TEXT NOT NULL,
    scope_taxon_rank TEXT,
    scope_taxon_key TEXT,
    scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('active', 'revoked')),
    CHECK (authority_kind = 'taxon_identification')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialist_authorities_active_unique
    ON specialist_authorities (
        subject_user_id,
        authority_kind,
        lower(scope_taxon_name),
        coalesce(scope_taxon_rank, ''),
        coalesce(scope_taxon_key, '')
    )
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialist_authorities_subject_status
    ON specialist_authorities (subject_user_id, status, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_specialist_authorities_scope_name
    ON specialist_authorities (lower(scope_taxon_name));

CREATE INDEX IF NOT EXISTS idx_specialist_authorities_granted_by
    ON specialist_authorities (granted_by_user_id, granted_at DESC);

CREATE TABLE IF NOT EXISTS specialist_authority_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id UUID NOT NULL REFERENCES specialist_authorities(authority_id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    title TEXT NOT NULL,
    issuer_name TEXT,
    url TEXT,
    notes TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (evidence_type IN ('field_event', 'webinar', 'literature', 'reference_owned', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_specialist_authority_evidence_authority
    ON specialist_authority_evidence (authority_id, created_at DESC);

CREATE TABLE IF NOT EXISTS specialist_authority_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authority_id UUID REFERENCES specialist_authorities(authority_id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (action IN ('grant', 'revoke', 'update'))
);

CREATE INDEX IF NOT EXISTS idx_specialist_authority_audit_authority
    ON specialist_authority_audit (authority_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_specialist_authority_audit_actor
    ON specialist_authority_audit (actor_user_id, created_at DESC);
