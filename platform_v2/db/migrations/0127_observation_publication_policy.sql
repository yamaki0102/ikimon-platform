-- Recalculable public publication policy for source records.
--
-- Purpose:
--   Store the current public location/time decision separately from source
--   records. This lets later taxon updates, manager policy changes, and consent
--   withdrawals recalculate public exposure without mutating the observation.

CREATE TABLE IF NOT EXISTS observation_publication_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id TEXT NOT NULL REFERENCES visits(visit_id) ON DELETE CASCADE,
    occurrence_id TEXT REFERENCES occurrences(occurrence_id) ON DELETE SET NULL,
    field_id UUID REFERENCES observation_fields(field_id) ON DELETE SET NULL,
    public_location_mode TEXT NOT NULL DEFAULT 'hidden',
    public_time_precision TEXT NOT NULL DEFAULT 'hidden',
    sensitivity_status TEXT NOT NULL DEFAULT 'uncertain',
    sensitivity_reason TEXT NOT NULL DEFAULT 'not_calculated',
    policy_ruleset_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v1',
    input_policy_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    recalculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (visit_id),
    CHECK (public_location_mode IN ('exact', 'site', 'grid_250m', 'grid_1km', 'municipality', 'hidden')),
    CHECK (public_time_precision IN ('datetime', 'date', 'month', 'season', 'hidden')),
    CHECK (sensitivity_status IN ('none', 'taxon_sensitive', 'context_sensitive', 'human_sensitive', 'manager_restricted', 'uncertain')),
    CHECK (length(trim(policy_ruleset_version)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_observation_publication_policies_public
    ON observation_publication_policies (public_location_mode, sensitivity_status, recalculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_publication_policies_field
    ON observation_publication_policies (field_id, recalculated_at DESC)
    WHERE field_id IS NOT NULL;
