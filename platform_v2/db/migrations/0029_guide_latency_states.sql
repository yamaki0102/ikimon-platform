-- Live Guide latency-tolerant delivery state.
-- A guide record can describe a scene captured several seconds before it is
-- surfaced, so store capture/return timing and delivery visibility explicitly.

ALTER TABLE guide_records
    ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_distance_m REAL,
    ADD COLUMN IF NOT EXISTS delivery_state TEXT NOT NULL DEFAULT 'ready',
    ADD COLUMN IF NOT EXISTS seen_state TEXT NOT NULL DEFAULT 'unseen',
    ADD COLUMN IF NOT EXISTS frame_thumb TEXT,
    ADD COLUMN IF NOT EXISTS primary_subject JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS environment_context TEXT,
    ADD COLUMN IF NOT EXISTS seasonal_note TEXT,
    ADD COLUMN IF NOT EXISTS coexisting_taxa TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS confidence_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS media_refs JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE guide_records
    DROP CONSTRAINT IF EXISTS guide_records_delivery_state_check,
    ADD CONSTRAINT guide_records_delivery_state_check
        CHECK (delivery_state IN ('pending', 'ready', 'surfaced', 'deferred', 'archived'));

ALTER TABLE guide_records
    DROP CONSTRAINT IF EXISTS guide_records_seen_state_check,
    ADD CONSTRAINT guide_records_seen_state_check
        CHECK (seen_state IN ('unseen', 'seen', 'dismissed', 'saved'));

CREATE INDEX IF NOT EXISTS idx_guide_records_delivery
    ON guide_records (delivery_state, returned_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_records_captured
    ON guide_records (captured_at DESC)
    WHERE captured_at IS NOT NULL;
