CREATE TABLE IF NOT EXISTS observation_record_ai_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    ai_run_id UUID REFERENCES observation_ai_runs(ai_run_id) ON DELETE SET NULL,
    candidate_id UUID REFERENCES observation_ai_subject_candidates(candidate_id) ON DELETE SET NULL,
    actor_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    review_state TEXT NOT NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_record_ai_reviews_state_chk
        CHECK (review_state IN ('agree', 'disagree', 'later')),
    CONSTRAINT observation_record_ai_reviews_unique_actor
        UNIQUE (occurrence_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_observation_record_ai_reviews_occurrence
    ON observation_record_ai_reviews (occurrence_id, review_state, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_record_ai_reviews_actor
    ON observation_record_ai_reviews (actor_user_id, updated_at DESC);
