CREATE TABLE IF NOT EXISTS scene_targets (
    scene_target_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id              TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    asset_id              UUID        REFERENCES evidence_assets(asset_id) ON DELETE SET NULL,
    candidate_id          UUID        REFERENCES observation_ai_subject_candidates(candidate_id) ON DELETE SET NULL,
    occurrence_id         TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    target_type           TEXT        NOT NULL DEFAULT 'organism',
    media_kind            TEXT        NOT NULL DEFAULT 'unknown',
    label                 TEXT        NOT NULL DEFAULT '',
    memo                  TEXT        NOT NULL DEFAULT '',
    normalized_rect       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    start_second          NUMERIC(10,3),
    end_second            NUMERIC(10,3),
    ai_suggestions        JSONB       NOT NULL DEFAULT '[]'::jsonb,
    status                TEXT        NOT NULL DEFAULT 'draft',
    source_kind           TEXT        NOT NULL DEFAULT 'user',
    created_by_user_id    TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    source_payload        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT scene_targets_target_type_chk
        CHECK (target_type IN ('organism', 'sound', 'trace', 'habitat', 'unknown')),
    CONSTRAINT scene_targets_media_kind_chk
        CHECK (media_kind IN ('image', 'video', 'audio', 'unknown')),
    CONSTRAINT scene_targets_status_chk
        CHECK (status IN ('draft', 'adopted', 'ignored', 'later', 'converted')),
    CONSTRAINT scene_targets_source_kind_chk
        CHECK (source_kind IN ('user', 'ai', 'system')),
    CONSTRAINT scene_targets_time_range_chk
        CHECK (
            start_second IS NULL
            OR end_second IS NULL
            OR end_second >= start_second
        )
);

CREATE INDEX IF NOT EXISTS idx_scene_targets_visit
    ON scene_targets (visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scene_targets_asset
    ON scene_targets (asset_id)
    WHERE asset_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scene_targets_candidate
    ON scene_targets (candidate_id)
    WHERE candidate_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_targets_candidate_unique
    ON scene_targets (candidate_id)
    WHERE candidate_id IS NOT NULL;
