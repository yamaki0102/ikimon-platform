-- Biodiversity Freshness OS: claim_review_queue
--
-- Purpose:
--   Queue for human review of curator-proposed knowledge_claims transitions
--   (promote to use_in_feedback, demote, archive, edit). Hot path NEVER
--   reads from a claim until the queue entry is decided=approved.

CREATE TABLE IF NOT EXISTS claim_review_queue (
    queue_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id          UUID         NOT NULL REFERENCES knowledge_claims(claim_id) ON DELETE CASCADE,
    proposed_action   TEXT         NOT NULL,
    proposed_by_run   UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    severity          TEXT         NOT NULL DEFAULT 'normal',
    reviewer_id       TEXT,
    decision          TEXT,
    decided_at        TIMESTAMPTZ,
    rationale         TEXT         NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT claim_review_queue_action_chk
        CHECK (proposed_action IN ('promote_to_feedback', 'demote', 'archive', 'edit', 'reject')),
    CONSTRAINT claim_review_queue_severity_chk
        CHECK (severity IN ('low', 'normal', 'high', 'critical')),
    CONSTRAINT claim_review_queue_decision_chk
        CHECK (decision IS NULL OR decision IN ('approved', 'rejected', 'deferred')),
    CONSTRAINT claim_review_queue_rationale_len_chk
        CHECK (char_length(rationale) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_claim_review_queue_pending
    ON claim_review_queue (severity, created_at DESC)
    WHERE decision IS NULL;

CREATE INDEX IF NOT EXISTS idx_claim_review_queue_claim
    ON claim_review_queue (claim_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_claim_review_queue_run
    ON claim_review_queue (proposed_by_run)
    WHERE proposed_by_run IS NOT NULL;
