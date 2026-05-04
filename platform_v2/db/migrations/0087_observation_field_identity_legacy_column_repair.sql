-- Observation field identity legacy column repair
--
-- 0086 is intentionally duplicated under a new filename because staging may
-- have recorded 0086 while still missing one or more columns after earlier
-- failed deploy attempts. This migration is column repair only; 0088 performs
-- the data backfill after these columns are definitely present.
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
