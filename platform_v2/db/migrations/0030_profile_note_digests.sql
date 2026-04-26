CREATE TABLE IF NOT EXISTS profile_note_digests (
    user_id                 TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    digest_version          INTEGER     NOT NULL DEFAULT 1,
    today_reading           TEXT        NOT NULL DEFAULT '',
    learning_highlight      TEXT        NOT NULL DEFAULT '',
    local_contribution      TEXT        NOT NULL DEFAULT '',
    growth_story            TEXT        NOT NULL DEFAULT '',
    contribution_story      TEXT        NOT NULL DEFAULT '',
    place_chapters          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    source_stats            JSONB       NOT NULL DEFAULT '{}'::jsonb,
    source_observation_id   TEXT,
    source_kind             TEXT        NOT NULL DEFAULT 'local',
    provider                TEXT        NOT NULL DEFAULT 'local',
    model                   TEXT        NOT NULL DEFAULT '',
    estimated_input_tokens  INTEGER     NOT NULL DEFAULT 0,
    estimated_output_tokens INTEGER     NOT NULL DEFAULT 0,
    estimated_cost_usd      NUMERIC(12,8) NOT NULL DEFAULT 0,
    generated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_note_digests_updated
    ON profile_note_digests (updated_at DESC);

CREATE TABLE IF NOT EXISTS profile_note_digest_usage (
    usage_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    operation               TEXT        NOT NULL DEFAULT 'profile_note_digest',
    provider                TEXT        NOT NULL,
    model                   TEXT        NOT NULL,
    input_tokens            INTEGER     NOT NULL DEFAULT 0,
    output_tokens           INTEGER     NOT NULL DEFAULT 0,
    estimated_cost_usd      NUMERIC(12,8) NOT NULL DEFAULT 0,
    source_observation_id   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_note_digest_usage_month
    ON profile_note_digest_usage (created_at DESC, provider, model);

CREATE INDEX IF NOT EXISTS idx_profile_note_digest_usage_user
    ON profile_note_digest_usage (user_id, created_at DESC);
