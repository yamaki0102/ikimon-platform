-- Record detail "reading cards".
-- Stores only the rendered card, source links, and generation conditions.
-- It intentionally does not store OCR text, scraped bodies, or long model logs.

CREATE TABLE IF NOT EXISTS record_reading_cards (
    card_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id             TEXT        NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    axis                 TEXT        NOT NULL,
    title                TEXT        NOT NULL,
    body                 TEXT        NOT NULL,
    sources              JSONB       NOT NULL DEFAULT '[]'::jsonb,
    visibility           TEXT        NOT NULL DEFAULT 'owner_only',
    generation_condition JSONB       NOT NULL DEFAULT '{}'::jsonb,
    quality_gate         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    model_version        TEXT        NOT NULL DEFAULT 'record_reading_cards_v0_1',
    created_by_user_id   TEXT        REFERENCES users(user_id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_reading_cards_axis_check
        CHECK (axis IN ('organism', 'environment', 'human_relation')),
    CONSTRAINT record_reading_cards_visibility_check
        CHECK (visibility IN ('owner_only', 'public', 'hidden')),
    CONSTRAINT record_reading_cards_body_length_check
        CHECK (char_length(body) BETWEEN 80 AND 520),
    CONSTRAINT record_reading_cards_sources_array_check
        CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) >= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_record_reading_cards_visit_axis
    ON record_reading_cards (visit_id, axis);

CREATE INDEX IF NOT EXISTS idx_record_reading_cards_visit_visibility
    ON record_reading_cards (visit_id, visibility);

CREATE INDEX IF NOT EXISTS idx_record_reading_cards_creator_created
    ON record_reading_cards (created_by_user_id, created_at DESC);
