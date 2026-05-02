-- Biodiversity Freshness OS: risk_status_versions
--
-- Purpose:
--   Versioned record of red list / threatened status assessments
--   (IUCN, 環境省, prefecture). Same INSERT-only pattern as invasive_status_versions.

CREATE TABLE IF NOT EXISTS risk_status_versions (
    version_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name    TEXT         NOT NULL,
    gbif_usage_key     BIGINT,
    region_scope       TEXT         NOT NULL DEFAULT 'JP',
    redlist_authority  TEXT         NOT NULL,
    redlist_category   TEXT         NOT NULL,
    assessed_year      INTEGER,
    population_trend   TEXT,
    source_snapshot_id UUID         NOT NULL REFERENCES source_snapshots(snapshot_id) ON DELETE RESTRICT,
    source_excerpt     TEXT         NOT NULL DEFAULT '',
    valid_from         DATE         NOT NULL,
    valid_to           DATE,
    superseded_by      UUID         REFERENCES risk_status_versions(version_id) ON DELETE SET NULL,
    curator_run_id     UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT risk_status_versions_authority_chk
        CHECK (redlist_authority IN ('iucn', 'env_jp', 'prefecture')),
    CONSTRAINT risk_status_versions_category_chk
        CHECK (redlist_category IN ('CR', 'EN', 'VU', 'NT', 'LC', 'DD', 'NE', 'EX', 'EW')),
    CONSTRAINT risk_status_versions_population_trend_chk
        CHECK (population_trend IS NULL OR population_trend IN ('decreasing', 'stable', 'increasing', 'unknown')),
    CONSTRAINT risk_status_versions_excerpt_len_chk
        CHECK (char_length(source_excerpt) <= 600),
    CONSTRAINT risk_status_versions_valid_range_chk
        CHECK (valid_to IS NULL OR valid_to >= valid_from),
    CONSTRAINT risk_status_versions_year_chk
        CHECK (assessed_year IS NULL OR assessed_year BETWEEN 1900 AND 2100)
);

CREATE INDEX IF NOT EXISTS idx_risk_status_versions_current
    ON risk_status_versions (lower(scientific_name), region_scope, redlist_authority)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_risk_status_versions_time_travel
    ON risk_status_versions (lower(scientific_name), region_scope, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_risk_status_versions_gbif
    ON risk_status_versions (gbif_usage_key)
    WHERE gbif_usage_key IS NOT NULL;
