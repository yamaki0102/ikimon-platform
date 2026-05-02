-- Aggregated Live Guide environment cells.
-- This table stores vegetation / land-use clues as 100m-ish cells so guide
-- routes can grow into regional layers without exposing raw personal routes.

CREATE TABLE IF NOT EXISTS guide_environment_mesh_cells (
    mesh_key              TEXT        PRIMARY KEY,
    grid_size_m           INTEGER     NOT NULL DEFAULT 100,
    center_lat            DOUBLE PRECISION NOT NULL,
    center_lng            DOUBLE PRECISION NOT NULL,
    guide_record_count    INTEGER     NOT NULL DEFAULT 0,
    contributor_hashes    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    contributor_count     INTEGER     NOT NULL DEFAULT 0,
    vegetation_counts     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    landform_counts       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    structure_counts      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sound_counts          JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sample_record_ids     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    first_seen_at         TIMESTAMPTZ,
    last_seen_at          TIMESTAMPTZ,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_environment_mesh_last_seen
    ON guide_environment_mesh_cells (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_guide_environment_mesh_center
    ON guide_environment_mesh_cells (center_lat, center_lng);
