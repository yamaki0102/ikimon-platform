-- Observation source-record rights for Site Intelligence area profiles.
--
-- Purpose:
--   Keep source records immutable and explicit about whether they may
--   contribute to public area profiles. Public aggregation is separate from
--   external dataset export and stays fail-closed by default.

ALTER TABLE observation_data_rights
    ADD COLUMN IF NOT EXISTS area_profile_use_consent TEXT NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS public_aggregation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS public_profile_attribution_mode TEXT NOT NULL DEFAULT 'hidden',
    ADD COLUMN IF NOT EXISTS consent_source TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS rights_policy_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v1';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_data_rights_area_profile_use_chk'
    ) THEN
        ALTER TABLE observation_data_rights
            ADD CONSTRAINT observation_data_rights_area_profile_use_chk
            CHECK (area_profile_use_consent IN ('none', 'internal', 'aggregated_public', 'manager_report', 'external_export'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_data_rights_public_attribution_chk'
    ) THEN
        ALTER TABLE observation_data_rights
            ADD CONSTRAINT observation_data_rights_public_attribution_chk
            CHECK (public_profile_attribution_mode IN ('anonymous', 'credited', 'hidden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_data_rights_consent_source_chk'
    ) THEN
        ALTER TABLE observation_data_rights
            ADD CONSTRAINT observation_data_rights_consent_source_chk
            CHECK (consent_source IN ('default', 'user_selected', 'manager_policy', 'migration_backfill'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'observation_data_rights_policy_version_chk'
    ) THEN
        ALTER TABLE observation_data_rights
            ADD CONSTRAINT observation_data_rights_policy_version_chk
            CHECK (length(trim(rights_policy_version)) > 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observation_data_rights_area_profile_public
    ON observation_data_rights (public_aggregation_allowed, withdrawal_status, updated_at DESC)
    WHERE area_profile_use_consent IN ('aggregated_public', 'external_export');

CREATE INDEX IF NOT EXISTS idx_observation_data_rights_area_profile_policy
    ON observation_data_rights (rights_policy_version, updated_at DESC);
