-- Field Guide auto-accumulation records.
-- Each row is one scene the guide analysed during a session.
-- Rows flow into Field Note drafts (Stage 3a → Stage 4 in the Field Loop).

CREATE TABLE IF NOT EXISTS guide_records (
    guide_record_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       TEXT        NOT NULL,
    user_id          TEXT,
    occurrence_id    TEXT,
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    scene_hash       TEXT,
    scene_summary    TEXT,
    detected_species TEXT[]      NOT NULL DEFAULT '{}',
    detected_features JSONB      NOT NULL DEFAULT '[]'::jsonb,
    tts_script       TEXT,
    lang             TEXT        NOT NULL DEFAULT 'ja',
    source           TEXT        NOT NULL DEFAULT 'guide',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_records_session
    ON guide_records (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_records_user
    ON guide_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_records_created
    ON guide_records (created_at DESC);
