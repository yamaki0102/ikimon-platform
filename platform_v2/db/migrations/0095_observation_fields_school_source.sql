-- Observation fields school source
--
-- Purpose:
--   Treat schools and campuses as first-class observation fields so that
--   classes, clubs, universities, and corporate learning sites can open the
--   same area-snapshot / event-create flows as parks and certified nature
--   sites.
--
-- Data model:
--   - source='school' for imported school/campus records.
--   - admin_level='school' so legacy source checks and map layer filters can
--     style school polygons/points without confusing them with user fields.
--   - entity_key should prefer mext_school:<school_code>, ksj_p29:<code>,
--     osm:<type>:<id>, wikidata:<QID>, geonames:<id>, etc.
--
-- owner-sensitive-ok: This migration only replaces CHECK constraints on the
-- observation_fields table so the app can insert source='school' rows. Deploy
-- through the normal GitHub Actions migration step using the app DB owner role;
-- rollback is to re-run the previous CHECK lists without 'school' after deleting
-- or converting school rows.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'obs_fields_source_chk'
    ) THEN
        ALTER TABLE observation_fields
            DROP CONSTRAINT obs_fields_source_chk;
    END IF;

    ALTER TABLE observation_fields
        ADD CONSTRAINT obs_fields_source_chk
        CHECK (source IN (
            'user_defined',
            'nature_symbiosis_site',
            'tsunag',
            'protected_area',
            'oecm',
            'school'
        ));

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'obs_fields_admin_level_chk'
    ) THEN
        ALTER TABLE observation_fields
            DROP CONSTRAINT obs_fields_admin_level_chk;
    END IF;

    ALTER TABLE observation_fields
        ADD CONSTRAINT obs_fields_admin_level_chk
        CHECK (admin_level IS NULL OR admin_level IN (
            'park',
            'protected',
            'oecm',
            'symbiosis',
            'tsunag',
            'school',
            'osm_park',
            'admin_municipality',
            'admin_prefecture',
            'admin_country'
        ));
END $$;
