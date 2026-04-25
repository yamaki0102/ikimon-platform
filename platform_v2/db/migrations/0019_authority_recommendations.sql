CREATE TABLE IF NOT EXISTS authority_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    source_kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    scope_taxon_name TEXT NOT NULL,
    scope_taxon_rank TEXT,
    scope_taxon_key TEXT,
    recommended_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    granted_authority_id UUID REFERENCES specialist_authorities(authority_id) ON DELETE SET NULL,
    resolution_note TEXT,
    resolved_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (source_kind IN ('self_claim', 'ops_registered')),
    CHECK (status IN ('pending', 'granted', 'rejected', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_recommendations_pending_unique
    ON authority_recommendations (
        subject_user_id,
        lower(scope_taxon_name),
        coalesce(scope_taxon_rank, ''),
        coalesce(scope_taxon_key, '')
    )
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_authority_recommendations_subject_status
    ON authority_recommendations (subject_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authority_recommendations_scope_status
    ON authority_recommendations (lower(scope_taxon_name), status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authority_recommendations_recommended_by
    ON authority_recommendations (recommended_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_recommendation_evidence (
    evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES authority_recommendations(recommendation_id) ON DELETE CASCADE,
    evidence_type TEXT NOT NULL,
    title TEXT NOT NULL,
    issuer_name TEXT,
    url TEXT,
    notes TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (evidence_type IN ('field_event', 'webinar', 'literature', 'reference_owned', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_authority_recommendation_evidence_recommendation
    ON authority_recommendation_evidence (recommendation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_recommendation_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES authority_recommendations(recommendation_id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (action IN ('create', 'update', 'grant', 'reject', 'revoke'))
);

CREATE INDEX IF NOT EXISTS idx_authority_recommendation_audit_recommendation
    ON authority_recommendation_audit (recommendation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authority_recommendation_audit_actor
    ON authority_recommendation_audit (actor_user_id, created_at DESC);
