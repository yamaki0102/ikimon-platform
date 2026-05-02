CREATE TABLE IF NOT EXISTS observation_ai_runs (
    ai_run_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id                 TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    trigger_occurrence_id    TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    pipeline_version         TEXT        NOT NULL DEFAULT '',
    model_provider           TEXT        NOT NULL DEFAULT '',
    model_name               TEXT        NOT NULL DEFAULT '',
    model_version            TEXT        NOT NULL DEFAULT '',
    prompt_version           TEXT        NOT NULL DEFAULT '',
    taxonomy_version         TEXT        NOT NULL DEFAULT '',
    input_asset_fingerprint  TEXT        NOT NULL DEFAULT '',
    trigger_kind             TEXT        NOT NULL DEFAULT 'manual_reassess',
    triggered_by             TEXT,
    supersedes_run_id        UUID        REFERENCES observation_ai_runs(ai_run_id) ON DELETE SET NULL,
    run_status               TEXT        NOT NULL DEFAULT 'succeeded',
    source_payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    generated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_observation_ai_runs_visit_generated
    ON observation_ai_runs (visit_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_ai_runs_trigger_occurrence
    ON observation_ai_runs (trigger_occurrence_id, generated_at DESC);

ALTER TABLE observation_ai_assessments
    ADD COLUMN IF NOT EXISTS ai_run_id UUID REFERENCES observation_ai_runs(ai_run_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pipeline_version TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS taxonomy_version TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS interpretation_status TEXT NOT NULL DEFAULT 'selected';

CREATE INDEX IF NOT EXISTS idx_ai_assessments_ai_run
    ON observation_ai_assessments (ai_run_id);

CREATE TABLE IF NOT EXISTS visit_display_state (
    visit_id                 TEXT        PRIMARY KEY REFERENCES visits(visit_id) ON DELETE CASCADE,
    featured_occurrence_id   TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    selected_reason          TEXT        NOT NULL DEFAULT '',
    selection_source         TEXT        NOT NULL DEFAULT 'system_stable',
    locked_by_human          BOOLEAN     NOT NULL DEFAULT FALSE,
    derived_from_ai_run_id   UUID        REFERENCES observation_ai_runs(ai_run_id) ON DELETE SET NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT visit_display_state_selection_source_chk
        CHECK (selection_source IN ('human_consensus', 'specialist_lock', 'system_stable', 'latest_ai_default'))
);

CREATE TABLE IF NOT EXISTS observation_ai_subject_candidates (
    candidate_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id                UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    visit_id                 TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    suggested_occurrence_id  TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    candidate_key            TEXT        NOT NULL,
    vernacular_name          TEXT,
    scientific_name          TEXT,
    taxon_rank               TEXT,
    confidence_score         NUMERIC(6,5),
    candidate_status         TEXT        NOT NULL DEFAULT 'proposed',
    note                     TEXT,
    source_payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_ai_subject_candidates_status_chk
        CHECK (candidate_status IN ('proposed', 'matched', 'adopted', 'dismissed')),
    CONSTRAINT observation_ai_subject_candidates_key_uniq
        UNIQUE (ai_run_id, candidate_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_subject_candidates_visit
    ON observation_ai_subject_candidates (visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_subject_candidates_occurrence
    ON observation_ai_subject_candidates (suggested_occurrence_id);

CREATE TABLE IF NOT EXISTS subject_media_regions (
    region_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id                UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    occurrence_id            TEXT        REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    candidate_id             UUID        REFERENCES observation_ai_subject_candidates(candidate_id) ON DELETE CASCADE,
    asset_id                 UUID        NOT NULL REFERENCES evidence_assets(asset_id) ON DELETE CASCADE,
    normalized_rect          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    frame_time_ms            INTEGER,
    confidence_score         NUMERIC(6,5),
    source_kind              TEXT        NOT NULL DEFAULT 'ai',
    source_model             TEXT        NOT NULL DEFAULT '',
    source_payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT subject_media_regions_subject_ref_chk
        CHECK (occurrence_id IS NOT NULL OR candidate_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_subject_media_regions_ai_run
    ON subject_media_regions (ai_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subject_media_regions_occurrence
    ON subject_media_regions (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_subject_media_regions_candidate
    ON subject_media_regions (candidate_id);

CREATE INDEX IF NOT EXISTS idx_subject_media_regions_asset
    ON subject_media_regions (asset_id);
