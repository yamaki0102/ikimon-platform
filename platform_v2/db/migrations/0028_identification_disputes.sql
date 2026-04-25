-- Public identification disagreement lane.
--
-- Open disputes block Evidence Tier 3 promotion and research exports until a
-- specialist/admin resolves them. Public alternative IDs may create both an
-- identification row and a dispute row; this table stores the dissent state.

CREATE TABLE IF NOT EXISTS identification_disputes (
    dispute_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    actor_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    kind TEXT NOT NULL,
    proposed_name TEXT,
    proposed_rank TEXT,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    resolved_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('open', 'resolved', 'withdrawn')),
    CHECK (kind IN ('alternative_id', 'needs_more_evidence', 'not_organism', 'location_date_issue'))
);

CREATE INDEX IF NOT EXISTS idx_identification_disputes_occurrence_status
    ON identification_disputes (occurrence_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identification_disputes_open
    ON identification_disputes (occurrence_id, created_at DESC)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_identification_disputes_actor
    ON identification_disputes (actor_user_id, created_at DESC);

