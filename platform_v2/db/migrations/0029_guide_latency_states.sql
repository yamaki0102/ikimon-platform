-- Live Guide latency-tolerant delivery state.
-- Staging/prod may run migrations with a role that can create new tables but
-- is not the owner of legacy guide_records, so latency metadata lives in a
-- companion table keyed by guide_record_id.

CREATE TABLE IF NOT EXISTS guide_record_latency_states (
    guide_record_id     UUID        PRIMARY KEY,
    captured_at         TIMESTAMPTZ,
    returned_at         TIMESTAMPTZ,
    current_distance_m  REAL,
    delivery_state      TEXT        NOT NULL DEFAULT 'ready'
        CHECK (delivery_state IN ('pending', 'ready', 'surfaced', 'deferred', 'archived')),
    seen_state          TEXT        NOT NULL DEFAULT 'unseen'
        CHECK (seen_state IN ('unseen', 'seen', 'dismissed', 'saved')),
    frame_thumb         TEXT,
    primary_subject     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    environment_context TEXT,
    seasonal_note       TEXT,
    coexisting_taxa     TEXT[]      NOT NULL DEFAULT '{}',
    confidence_context  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    media_refs          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    meta                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_record_latency_delivery
    ON guide_record_latency_states (delivery_state, returned_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_record_latency_captured
    ON guide_record_latency_states (captured_at DESC)
    WHERE captured_at IS NOT NULL;
