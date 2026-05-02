CREATE TABLE IF NOT EXISTS guide_record_corrections (
    correction_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_record_id   UUID        NOT NULL REFERENCES guide_records(guide_record_id) ON DELETE CASCADE,
    user_id           TEXT        NOT NULL,
    correction_kind   TEXT        NOT NULL DEFAULT 'human_edit'
        CHECK (correction_kind IN ('human_edit', 'backfill', 'system_sanitize')),
    original_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    corrected_payload JSONB       NOT NULL DEFAULT '{}'::jsonb,
    note              TEXT        NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_record_corrections_record
    ON guide_record_corrections (guide_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_record_corrections_user
    ON guide_record_corrections (user_id, created_at DESC);
