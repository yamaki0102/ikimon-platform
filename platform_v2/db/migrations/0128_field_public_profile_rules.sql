-- Field public profile threshold rules.
--
-- Purpose:
--   Prevent thin "aggregates" from exposing one or two source records. These
--   rules control which area profile details may be public; manager/internal
--   views can still inspect source records under separate permissions.

CREATE TABLE IF NOT EXISTS field_public_profile_rules (
    field_id UUID PRIMARY KEY REFERENCES observation_fields(field_id) ON DELETE CASCADE,
    min_observation_count INTEGER NOT NULL DEFAULT 5,
    min_observer_count INTEGER NOT NULL DEFAULT 3,
    min_time_span_days INTEGER NOT NULL DEFAULT 14,
    suppress_if_single_source BOOLEAN NOT NULL DEFAULT TRUE,
    suppress_sensitive_context BOOLEAN NOT NULL DEFAULT TRUE,
    display_suppression_reason TEXT NOT NULL DEFAULT '確認記録が少ないため、詳細な傾向はまだ表示していません',
    ruleset_version TEXT NOT NULL DEFAULT 'site_intelligence_p0_v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (min_observation_count >= 1),
    CHECK (min_observer_count >= 1),
    CHECK (min_time_span_days >= 0),
    CHECK (length(trim(ruleset_version)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_field_public_profile_rules_version
    ON field_public_profile_rules (ruleset_version, updated_at DESC);
