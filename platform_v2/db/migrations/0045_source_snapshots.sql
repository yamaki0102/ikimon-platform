-- Biodiversity Freshness OS: source_snapshots
--
-- Purpose:
--   Authoritative external sources (MHLW invasive list, IUCN Red List, OpenAlex,
--   GBIF backbone, STAC tiles, etc.) are fetched as raw artifacts and stored here
--   immutably. All downstream *_versions tables FK back to a source_snapshot_id
--   so that every claim and version can be traced to a verifiable artifact.
--
-- Design principles (see docs/spec/ikimon_biodiversity_freshness_os_spec.md §3.1):
--   * snapshots are append-only (never UPDATE / DELETE)
--   * (source_kind, content_sha256) is unique to deduplicate identical refetches
--   * storage_path points to object storage / disk (raw bytes are not in Postgres)
--   * license is recorded per snapshot to enforce trust boundary §1.5

CREATE TABLE IF NOT EXISTS source_snapshots (
    snapshot_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_kind      TEXT         NOT NULL,
    source_url       TEXT         NOT NULL,
    fetched_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    http_etag        TEXT,
    http_last_mod    TIMESTAMPTZ,
    content_sha256   TEXT         NOT NULL,
    content_bytes    INTEGER      NOT NULL,
    storage_backend  TEXT         NOT NULL DEFAULT 'local_disk',
    storage_path     TEXT         NOT NULL,
    license          TEXT         NOT NULL,
    curator_run_id   UUID,
    notes            JSONB        NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT source_snapshots_kind_chk
        CHECK (source_kind IN (
            'mhlw_invasive',
            'env_invasive_jp',
            'iucn_redlist',
            'env_redlist_pdf',
            'prefecture_redlist',
            'gbif_backbone',
            'col_checklist',
            'griis',
            'openalex',
            'crossref',
            'jstage',
            'stac_landuse',
            'stac_impervious',
            'mlit_landuse_mesh',
            'nasa_impervious',
            'planetary_computer',
            'other'
        )),
    CONSTRAINT source_snapshots_storage_backend_chk
        CHECK (storage_backend IN ('local_disk', 's3', 'gcs', 'r2')),
    CONSTRAINT source_snapshots_license_chk
        CHECK (license IN (
            'public-domain',
            'cc0',
            'cc-by-4.0',
            'cc-by-sa-4.0',
            'cc-by-nc-4.0',
            'oa-license-verified',
            'all-rights-reserved',
            'gov-jp-open',
            'unknown'
        )),
    CONSTRAINT source_snapshots_content_bytes_chk
        CHECK (content_bytes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_kind_time
    ON source_snapshots (source_kind, fetched_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_source_snapshots_kind_hash
    ON source_snapshots (source_kind, content_sha256);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_curator_run
    ON source_snapshots (curator_run_id)
    WHERE curator_run_id IS NOT NULL;
