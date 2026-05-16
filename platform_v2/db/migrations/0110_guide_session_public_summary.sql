-- Public-facing guide session summaries.
-- This table is a derived cache. guide_records remain the source of truth and
-- are not deleted or rewritten by this migration.

CREATE TABLE IF NOT EXISTS guide_session_public_summary (
    summary_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT        NOT NULL,
    session_id          TEXT        NOT NULL,
    lang                TEXT        NOT NULL DEFAULT 'ja',
    visibility          TEXT        NOT NULL DEFAULT 'viewer_only'
        CHECK (visibility IN ('viewer_only', 'public_safe', 'hidden')),
    record_count        INTEGER     NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    representative_guide_record_id UUID,
    headline            TEXT        NOT NULL,
    body                TEXT        NOT NULL,
    evidence_line       TEXT        NOT NULL,
    motivation_line     TEXT        NOT NULL,
    claim_boundary      TEXT        NOT NULL,
    primary_theme       TEXT        NOT NULL DEFAULT 'place',
    featured_subjects   TEXT[]      NOT NULL DEFAULT '{}',
    feature_counts      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    public_location_label TEXT,
    observer_avatar_url TEXT,
    media_thumb_url     TEXT,
    source_checksum     TEXT        NOT NULL,
    generated_by        TEXT        NOT NULL DEFAULT 'deterministic_v1',
    summary_payload     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, session_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_guide_session_public_summary_user_time
    ON guide_session_public_summary (user_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_session_public_summary_visibility_time
    ON guide_session_public_summary (visibility, ended_at DESC);
