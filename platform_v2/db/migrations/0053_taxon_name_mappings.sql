-- Biodiversity Freshness OS: taxon_name_mappings
--
-- Purpose:
--   Map vernacular / synonym / misspelling / legacy name variants to a
--   canonical scientific name. Powers Hot-path lookup when users supply
--   Japanese 和名 or older synonyms.

CREATE TABLE IF NOT EXISTS taxon_name_mappings (
    mapping_id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name_canonical  TEXT         NOT NULL,
    gbif_usage_key             BIGINT,
    name_variant               TEXT         NOT NULL,
    name_kind                  TEXT         NOT NULL,
    language                   TEXT         NOT NULL DEFAULT '',
    confidence                 NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    source_snapshot_id         UUID         REFERENCES source_snapshots(snapshot_id) ON DELETE SET NULL,
    valid_from                 DATE         NOT NULL DEFAULT CURRENT_DATE,
    valid_to                   DATE,
    curator_run_id             UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT taxon_name_mappings_kind_chk
        CHECK (name_kind IN ('vernacular', 'synonym', 'misspelling', 'legacy_scientific', 'common_name', 'alt_orthography')),
    CONSTRAINT taxon_name_mappings_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT taxon_name_mappings_valid_range_chk
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_taxon_name_mappings_variant
    ON taxon_name_mappings (lower(name_variant), name_kind, language);

CREATE INDEX IF NOT EXISTS idx_taxon_name_mappings_canonical
    ON taxon_name_mappings (lower(scientific_name_canonical));

CREATE INDEX IF NOT EXISTS idx_taxon_name_mappings_current
    ON taxon_name_mappings (lower(name_variant))
    WHERE valid_to IS NULL;
