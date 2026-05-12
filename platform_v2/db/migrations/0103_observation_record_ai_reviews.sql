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

UPDATE occurrences o
SET
    ai_assessment_status = 'ai_judgement',
    data_quality = COALESCE(NULLIF(o.data_quality, ''), 'ai_only_unreviewed'),
    quality_grade = COALESCE(NULLIF(o.quality_grade, ''), 'ai_judgement'),
    evidence_tier = CASE
        WHEN o.evidence_tier IS NULL OR o.evidence_tier > 0.5 THEN 0.5
        ELSE o.evidence_tier
    END,
    source_payload = COALESCE(o.source_payload, '{}'::jsonb)
        || jsonb_build_object(
            'ai_judgement',
            jsonb_build_object(
                'status', 'ai_judgement',
                'source', 'migration_0103_existing_assessment',
                'materialized_at', NOW()
            )
        ),
    updated_at = NOW()
WHERE EXISTS (
        SELECT 1
        FROM observation_ai_assessments a
        WHERE a.occurrence_id = o.occurrence_id
    )
    AND NOT EXISTS (
        SELECT 1
        FROM identifications i
        WHERE i.occurrence_id = o.occurrence_id
            AND i.actor_kind = 'human'
    )
    AND COALESCE(o.ai_assessment_status, '') NOT IN ('reviewer_verified', 'reviewer_rejected');
