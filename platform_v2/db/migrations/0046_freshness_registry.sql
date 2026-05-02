-- Biodiversity Freshness OS: freshness_registry
--
-- Purpose:
--   Per-source-kind operational state. Schedules next fetch, tracks consecutive
--   failures, marks staleness so the Evaluation Gate (/admin/data-health) can
--   surface gaps before they leak into AI output.
--
-- Design principles (see docs/spec/ikimon_biodiversity_freshness_os_spec.md §3.4):
--   * every external source feeding *_versions MUST be registered here
--   * source adapters update last_attempt_at / last_success_at directly
--   * status is derived: fresh|stale|critical|unknown
--   * trust_grade A/B/C affects whether a curator may auto-promote claims

CREATE TABLE IF NOT EXISTS freshness_registry (
    registry_key            TEXT         PRIMARY KEY,
    source_kind             TEXT         NOT NULL,
    fetcher_strategy        TEXT         NOT NULL,
    expected_freshness_days INTEGER      NOT NULL,
    last_attempt_at         TIMESTAMPTZ,
    last_success_at         TIMESTAMPTZ,
    last_snapshot_id        UUID         REFERENCES source_snapshots(snapshot_id) ON DELETE SET NULL,
    consecutive_failures    INTEGER      NOT NULL DEFAULT 0,
    trust_grade             TEXT         NOT NULL DEFAULT 'A',
    status                  TEXT         NOT NULL DEFAULT 'unknown',
    next_due_at             TIMESTAMPTZ,
    config                  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    notes                   TEXT         NOT NULL DEFAULT '',
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT freshness_registry_strategy_chk
        CHECK (fetcher_strategy IN (
            'web_scrape',
            'rest_api',
            'graphql_api',
            'rss_feed',
            'stac_search',
            'manual_upload',
            'pdf_extract'
        )),
    CONSTRAINT freshness_registry_trust_grade_chk
        CHECK (trust_grade IN ('A', 'B', 'C')),
    CONSTRAINT freshness_registry_status_chk
        CHECK (status IN ('fresh', 'stale', 'critical', 'unknown', 'paused')),
    CONSTRAINT freshness_registry_freshness_days_chk
        CHECK (expected_freshness_days > 0),
    CONSTRAINT freshness_registry_consecutive_failures_chk
        CHECK (consecutive_failures >= 0)
);

CREATE INDEX IF NOT EXISTS idx_freshness_registry_status_due
    ON freshness_registry (status, next_due_at);

CREATE INDEX IF NOT EXISTS idx_freshness_registry_kind
    ON freshness_registry (source_kind);

-- Seed the well-known registry keys (idempotent via ON CONFLICT DO NOTHING).
INSERT INTO freshness_registry (registry_key, source_kind, fetcher_strategy, expected_freshness_days, trust_grade, config) VALUES
    ('mhlw_invasive_national', 'mhlw_invasive',     'web_scrape',  7,  'A', '{"region_scope":"JP","schedule":"weekly_mon_0300"}'),
    ('env_invasive_jp',        'env_invasive_jp',   'web_scrape',  7,  'A', '{"region_scope":"JP"}'),
    ('iucn_japan',             'iucn_redlist',      'rest_api',    30, 'A', '{"region_filter":"JP"}'),
    ('env_redlist_jp',         'env_redlist_pdf',   'pdf_extract', 90, 'A', '{}'),
    ('gbif_backbone',          'gbif_backbone',     'rest_api',    30, 'A', '{}'),
    ('openalex_daily',         'openalex',          'rest_api',    1,  'B', '{"keywords_ref":"top_50_taxa"}'),
    ('crossref_daily',         'crossref',          'rest_api',    1,  'B', '{}'),
    ('jstage_weekly',          'jstage',            'rest_api',    7,  'B', '{"lang":"ja"}'),
    ('mlit_landuse_mesh',      'mlit_landuse_mesh', 'manual_upload', 30, 'A', '{"format":"shapefile"}'),
    ('nasa_impervious',        'nasa_impervious',   'stac_search', 30, 'A', '{"collection":"impervious-v3"}')
ON CONFLICT (registry_key) DO NOTHING;
