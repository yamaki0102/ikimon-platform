-- GBIF Backbone Taxonomy の match 結果を名前+rank 単位でキャッシュする。
-- occurrences には DwC export / Layer 2 UI 用の lineage カラムを追加する。

CREATE TABLE IF NOT EXISTS taxa_gbif_cache (
    cache_id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    query_name               TEXT        NOT NULL,
    normalized_name          TEXT        NOT NULL,
    query_rank               TEXT,
    gbif_usage_key           BIGINT,
    gbif_accepted_usage_key  BIGINT,
    canonical_name           TEXT,
    rank                     TEXT,
    status                   TEXT,
    match_type               TEXT,
    confidence               INTEGER,
    kingdom                  TEXT,
    phylum                   TEXT,
    class_name               TEXT,
    order_name               TEXT,
    family                   TEXT,
    genus                    TEXT,
    species                  TEXT,
    raw_payload              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    fetched_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ttl_days                 INTEGER     NOT NULL DEFAULT 30
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxa_gbif_cache_lookup
    ON taxa_gbif_cache (normalized_name, COALESCE(query_rank, ''::text));

CREATE INDEX IF NOT EXISTS idx_taxa_gbif_cache_usage_key
    ON taxa_gbif_cache (gbif_usage_key);

COMMENT ON TABLE taxa_gbif_cache IS 'GBIF species match cache (30 day TTL)';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'kingdom' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN kingdom TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'phylum' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN phylum TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'class_name' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN class_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'order_name' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN order_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'family' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN family TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'occurrences'::regclass AND attname = 'genus' AND NOT attisdropped) THEN
        ALTER TABLE occurrences ADD COLUMN genus TEXT;
    END IF;
END
$$;
