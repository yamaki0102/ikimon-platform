-- Site Intelligence field profile foundation.
--
-- Purpose:
--   Promote observation_fields from reusable event areas into the canonical
--   place registry for public area profiles. Source records stay separate; this
--   table only defines the field/profile default policy and review state.
--
-- Safety:
--   Defaults are fail-closed. Existing fields remain draft/private until a
--   manager or internal process explicitly enables public summaries.

ALTER TABLE observation_fields
    ADD COLUMN IF NOT EXISTS profile_status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS default_public_location_mode TEXT NOT NULL DEFAULT 'site',
    ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS profile_policy_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v1',
    ADD COLUMN IF NOT EXISTS profile_notes TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_fields_profile_status_chk'
    ) THEN
        ALTER TABLE observation_fields
            ADD CONSTRAINT observation_fields_profile_status_chk
            CHECK (profile_status IN ('draft', 'private', 'public_summary', 'manager_review', 'hidden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_fields_public_location_mode_chk'
    ) THEN
        ALTER TABLE observation_fields
            ADD CONSTRAINT observation_fields_public_location_mode_chk
            CHECK (default_public_location_mode IN ('exact', 'site', 'grid_250m', 'grid_1km', 'municipality', 'hidden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_fields_profile_policy_version_chk'
    ) THEN
        ALTER TABLE observation_fields
            ADD CONSTRAINT observation_fields_profile_policy_version_chk
            CHECK (length(trim(profile_policy_version)) > 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observation_fields_public_profile
    ON observation_fields (public_profile_enabled, profile_status, updated_at DESC)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_observation_fields_profile_policy_version
    ON observation_fields (profile_policy_version, updated_at DESC);
