CREATE TABLE IF NOT EXISTS guide_environment_refresh_runs (
    run_id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_source               TEXT        NOT NULL DEFAULT 'manual'
        CHECK (trigger_source IN ('postdeploy', 'timer', 'manual', 'staging')),
    status                       TEXT        NOT NULL
        CHECK (status IN ('success', 'failure')),
    diagnosis_date               DATE        NOT NULL,
    started_at                   TIMESTAMPTZ NOT NULL,
    finished_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    mesh_rebuild_needed          BOOLEAN     NOT NULL DEFAULT FALSE,
    rebuild_action               TEXT        NOT NULL DEFAULT 'skipped',
    guide_record_count           INTEGER     NOT NULL DEFAULT 0,
    aggregatable_guide_records   INTEGER     NOT NULL DEFAULT 0,
    public_mesh_cell_count       INTEGER     NOT NULL DEFAULT 0,
    suppressed_mesh_cell_count   INTEGER     NOT NULL DEFAULT 0,
    hypotheses_generated         INTEGER     NOT NULL DEFAULT 0,
    hypotheses_written           INTEGER     NOT NULL DEFAULT 0,
    eval_items_count             INTEGER     NOT NULL DEFAULT 0,
    prompt_improvements_written  INTEGER     NOT NULL DEFAULT 0,
    run_payload                  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    error_message                TEXT        NOT NULL DEFAULT '',
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_environment_refresh_runs_started
    ON guide_environment_refresh_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_environment_refresh_runs_status
    ON guide_environment_refresh_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS guide_hypothesis_prompt_improvements (
    improvement_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key       TEXT        NOT NULL UNIQUE,
    improvement_type TEXT        NOT NULL
        CHECK (improvement_type IN ('keep_pattern', 'rewrite_pattern', 'guardrail')),
    label            TEXT        NOT NULL
        CHECK (label IN ('helpful', 'wrong', 'mixed')),
    claim_type       TEXT        NOT NULL DEFAULT '',
    trigger          TEXT        NOT NULL DEFAULT '',
    recommendation   TEXT        NOT NULL,
    prompt_patch     TEXT        NOT NULL DEFAULT '',
    evidence         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    support_count    INTEGER     NOT NULL DEFAULT 0,
    review_status    TEXT        NOT NULL DEFAULT 'auto'
        CHECK (review_status IN ('auto', 'needs_review', 'reviewed', 'rejected')),
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guide_hypothesis_prompt_improvements_recommendation_chk
        CHECK (char_length(recommendation) BETWEEN 1 AND 1200)
);

CREATE INDEX IF NOT EXISTS idx_guide_hypothesis_prompt_improvements_review
    ON guide_hypothesis_prompt_improvements (review_status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_hypothesis_prompt_improvements_claim
    ON guide_hypothesis_prompt_improvements (claim_type, improvement_type, support_count DESC);
