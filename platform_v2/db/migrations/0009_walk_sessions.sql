-- Field Scan (Android app) walk session records.
-- Each row is one outdoor session: start/end time, distance, passive detections summary.
-- Feeds the "今日のさんぽ" widget on Field Note (Stage 3b → Stage 4 in the Field Loop).

CREATE TABLE IF NOT EXISTS walk_sessions (
    walk_session_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id      TEXT        UNIQUE,
    user_id          TEXT        NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL,
    ended_at         TIMESTAMPTZ,
    distance_m       REAL,
    step_count       INTEGER,
    passive_detection_count INTEGER NOT NULL DEFAULT 0,
    top_species      TEXT[]      NOT NULL DEFAULT '{}',
    biome            TEXT,
    source           TEXT        NOT NULL DEFAULT 'fieldscan',
    raw_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_walk_sessions_user_started
    ON walk_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_walk_sessions_external
    ON walk_sessions (external_id);
