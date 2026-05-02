-- Biodiversity Freshness OS: invasive_status_versions
--
-- Purpose:
--   Versioned record of invasive species classification (MHLW / 環境省 /
--   prefecture). New facts are INSERTed; existing rows are never UPDATEd.
--   The "current" view is WHERE valid_to IS NULL.

CREATE TABLE IF NOT EXISTS invasive_status_versions (
    version_id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name    TEXT         NOT NULL,
    gbif_usage_key     BIGINT,
    region_scope       TEXT         NOT NULL DEFAULT 'JP',
    mhlw_category      TEXT         NOT NULL,
    designation_basis  TEXT         NOT NULL DEFAULT '',
    source_snapshot_id UUID         NOT NULL REFERENCES source_snapshots(snapshot_id) ON DELETE RESTRICT,
    source_excerpt     TEXT         NOT NULL DEFAULT '',
    valid_from         DATE         NOT NULL,
    valid_to           DATE,
    superseded_by      UUID         REFERENCES invasive_status_versions(version_id) ON DELETE SET NULL,
    curator_run_id     UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT invasive_status_versions_category_chk
        CHECK (mhlw_category IN ('iaspecified', 'priority', 'industrial', 'prevention', 'none')),
    CONSTRAINT invasive_status_versions_excerpt_len_chk
        CHECK (char_length(source_excerpt) <= 600),
    CONSTRAINT invasive_status_versions_valid_range_chk
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Current-version lookup for Hot path (the dominant query).
CREATE INDEX IF NOT EXISTS idx_invasive_status_versions_current
    ON invasive_status_versions (lower(scientific_name), region_scope)
    WHERE valid_to IS NULL;

-- Time-travel lookup (occurred_at within valid_from..valid_to).
CREATE INDEX IF NOT EXISTS idx_invasive_status_versions_time_travel
    ON invasive_status_versions (lower(scientific_name), region_scope, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_invasive_status_versions_gbif
    ON invasive_status_versions (gbif_usage_key)
    WHERE gbif_usage_key IS NOT NULL;
