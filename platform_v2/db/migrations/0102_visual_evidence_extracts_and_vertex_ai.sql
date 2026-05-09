-- AI observation evidence upgrade: normalized visual extracts and Vertex provider telemetry.
-- owner-sensitive-ok: ai_cost_log provider constraint is widened only to add 'vertex';
-- rollback by restoring the previous provider check after confirming no vertex rows exist.

ALTER TABLE ai_cost_log
  DROP CONSTRAINT IF EXISTS ai_cost_log_provider_chk;

ALTER TABLE ai_cost_log
  ADD CONSTRAINT ai_cost_log_provider_chk
  CHECK (provider IN ('gemini', 'vertex', 'claude', 'deepseek', 'openai', 'other'));

CREATE TABLE IF NOT EXISTS visual_evidence_extracts (
    extract_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id          UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    assessment_id      UUID        REFERENCES observation_ai_assessments(assessment_id) ON DELETE CASCADE,
    visit_id           TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id      TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    asset_id           UUID        REFERENCES evidence_assets(asset_id) ON DELETE CASCADE,
    asset_index        INTEGER     NOT NULL DEFAULT 0,
    media_kind         TEXT        NOT NULL DEFAULT 'image',
    frame_time_ms      INTEGER,
    selection_score    NUMERIC(8,5),
    selection_reason   TEXT,
    difference_score   NUMERIC(8,5),
    quality_score      NUMERIC(8,5),
    source_tag         TEXT        NOT NULL DEFAULT '',
    source_model       TEXT        NOT NULL DEFAULT '',
    extract_payload    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT visual_evidence_extracts_kind_chk
      CHECK (media_kind IN ('image', 'video_frame', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_visual_evidence_extracts_visit
    ON visual_evidence_extracts (visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visual_evidence_extracts_ai_run
    ON visual_evidence_extracts (ai_run_id, asset_index);

CREATE INDEX IF NOT EXISTS idx_visual_evidence_extracts_asset_frame
    ON visual_evidence_extracts (asset_id, frame_time_ms);

CREATE TABLE IF NOT EXISTS visual_subject_candidates (
    visual_candidate_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id           UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    assessment_id       UUID        REFERENCES observation_ai_assessments(assessment_id) ON DELETE CASCADE,
    visit_id            TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id       TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    candidate_id        UUID        REFERENCES observation_ai_subject_candidates(candidate_id) ON DELETE SET NULL,
    subject_role        TEXT        NOT NULL DEFAULT 'primary',
    display_name        TEXT,
    scientific_name     TEXT,
    taxon_rank          TEXT,
    confidence_score    NUMERIC(6,5),
    evidence_note       TEXT,
    source_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT visual_subject_candidates_role_chk
      CHECK (subject_role IN ('primary', 'coexisting', 'ambiguous'))
);

CREATE INDEX IF NOT EXISTS idx_visual_subject_candidates_visit
    ON visual_subject_candidates (visit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visual_asset_regions (
    visual_region_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id           UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    assessment_id       UUID        REFERENCES observation_ai_assessments(assessment_id) ON DELETE CASCADE,
    visit_id            TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id       TEXT        REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    candidate_id        UUID        REFERENCES observation_ai_subject_candidates(candidate_id) ON DELETE SET NULL,
    asset_id            UUID        NOT NULL REFERENCES evidence_assets(asset_id) ON DELETE CASCADE,
    asset_index         INTEGER     NOT NULL DEFAULT 0,
    frame_time_ms       INTEGER,
    normalized_rect     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    confidence_score    NUMERIC(6,5),
    note                TEXT,
    source_model        TEXT        NOT NULL DEFAULT '',
    source_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visual_asset_regions_visit
    ON visual_asset_regions (visit_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_visual_asset_regions_asset
    ON visual_asset_regions (asset_id, frame_time_ms);

CREATE TABLE IF NOT EXISTS visual_observation_signals (
    signal_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id           UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    assessment_id       UUID        REFERENCES observation_ai_assessments(assessment_id) ON DELETE CASCADE,
    visit_id            TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    signal_kind         TEXT        NOT NULL,
    label               TEXT        NOT NULL,
    evidence_text       TEXT,
    confidence_score    NUMERIC(6,5),
    source_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visual_observation_signals_visit
    ON visual_observation_signals (visit_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visual_next_capture_suggestions (
    suggestion_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_run_id           UUID        NOT NULL REFERENCES observation_ai_runs(ai_run_id) ON DELETE CASCADE,
    assessment_id       UUID        REFERENCES observation_ai_assessments(assessment_id) ON DELETE CASCADE,
    visit_id            TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    role                TEXT        NOT NULL,
    target              TEXT        NOT NULL,
    rationale           TEXT        NOT NULL,
    priority            TEXT        NOT NULL DEFAULT 'medium',
    source_payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT visual_next_capture_suggestions_priority_chk
      CHECK (priority IN ('high', 'medium'))
);

CREATE INDEX IF NOT EXISTS idx_visual_next_capture_suggestions_visit
    ON visual_next_capture_suggestions (visit_id, created_at DESC);
