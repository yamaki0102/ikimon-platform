CREATE TABLE IF NOT EXISTS guide_hypothesis_prompt_improvement_queue (
    queue_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_type        TEXT        NOT NULL,
    trigger           TEXT        NOT NULL DEFAULT 'wrong_feedback_threshold',
    wrong_count       INTEGER     NOT NULL DEFAULT 0,
    threshold_count   INTEGER     NOT NULL DEFAULT 3,
    queue_status      TEXT        NOT NULL DEFAULT 'open'
        CHECK (queue_status IN ('open', 'in_review', 'resolved', 'dismissed')),
    improvement_ids   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    evidence          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT guide_hypothesis_prompt_improvement_queue_claim_trigger_uniq
        UNIQUE (claim_type, trigger)
);

CREATE INDEX IF NOT EXISTS idx_guide_hypothesis_prompt_improvement_queue_status
    ON guide_hypothesis_prompt_improvement_queue (queue_status, wrong_count DESC, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_hypothesis_prompt_improvement_queue_evidence
    ON guide_hypothesis_prompt_improvement_queue USING GIN (evidence);
