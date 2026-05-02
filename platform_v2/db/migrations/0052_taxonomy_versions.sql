-- Biodiversity Freshness OS: taxonomy_versions
--
-- Purpose:
--   Versioned snapshot of GBIF / Catalogue of Life backbone taxonomy.
--   Lets Hot path resolve a name as of any historical date.

CREATE TABLE IF NOT EXISTS taxonomy_versions (
    version_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    backbone_authority  TEXT         NOT NULL DEFAULT 'gbif',
    backbone_version    TEXT         NOT NULL,
    gbif_usage_key      BIGINT       NOT NULL,
    scientific_name     TEXT         NOT NULL,
    taxon_rank          TEXT         NOT NULL,
    taxonomic_status    TEXT         NOT NULL DEFAULT 'accepted',
    parent_usage_key    BIGINT,
    accepted_usage_key  BIGINT,
    kingdom             TEXT,
    phylum              TEXT,
    class_name          TEXT,
    order_name          TEXT,
    family              TEXT,
    genus               TEXT,
    species             TEXT,
    source_snapshot_id  UUID         NOT NULL REFERENCES source_snapshots(snapshot_id) ON DELETE RESTRICT,
    valid_from          DATE         NOT NULL,
    valid_to            DATE,
    superseded_by       UUID         REFERENCES taxonomy_versions(version_id) ON DELETE SET NULL,
    curator_run_id      UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT taxonomy_versions_authority_chk
        CHECK (backbone_authority IN ('gbif', 'col', 'itis', 'worms')),
    CONSTRAINT taxonomy_versions_status_chk
        CHECK (taxonomic_status IN ('accepted', 'synonym', 'doubtful', 'misapplied', 'heterotypic_synonym', 'homotypic_synonym')),
    CONSTRAINT taxonomy_versions_valid_range_chk
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_versions_current
    ON taxonomy_versions (gbif_usage_key)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_taxonomy_versions_name
    ON taxonomy_versions (lower(scientific_name), valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_taxonomy_versions_backbone
    ON taxonomy_versions (backbone_authority, backbone_version);
