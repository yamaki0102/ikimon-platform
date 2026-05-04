-- Observation field identity legacy column compatibility
--
-- Some long-lived staging/prod databases created observation_fields before the
-- current 0036/0080 definitions were complete. Add the columns needed by the
-- identity backfill in a separate migration so the next migration can safely
-- reference them after this file has committed.
--
-- owner-sensitive-ok: adds nullable/defaulted observation_fields columns only;
-- rollback is dropping these compatibility columns before app code depends on
-- them.

ALTER TABLE observation_fields
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS valid_from DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS superseded_by UUID
        REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS entity_key TEXT;

ALTER TABLE observation_fields
    ALTER COLUMN valid_from SET DEFAULT current_date,
    ALTER COLUMN entity_key SET DEFAULT '';
