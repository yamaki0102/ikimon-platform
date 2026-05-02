-- Biodiversity Freshness OS: place_environment_snapshots
--
-- Purpose:
--   Versioned environmental context per place (impervious %, forest %,
--   landuse class, etc.) sourced from STAC tiles (国交省 / NASA / MPC).
--   Drives Layer 4 (Site Condition) freshness and absence-data inference.

CREATE TABLE IF NOT EXISTS place_environment_snapshots (
    snapshot_id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id              TEXT         NOT NULL,
    metric_kind           TEXT         NOT NULL,
    metric_value          NUMERIC(10,4) NOT NULL,
    metric_unit           TEXT         NOT NULL DEFAULT '',
    tile_z                INTEGER,
    tile_x                INTEGER,
    tile_y                INTEGER,
    observed_on           DATE         NOT NULL,
    source_snapshot_id    UUID         NOT NULL REFERENCES source_snapshots(snapshot_id) ON DELETE RESTRICT,
    valid_from            DATE         NOT NULL,
    valid_to              DATE,
    superseded_by         UUID         REFERENCES place_environment_snapshots(snapshot_id) ON DELETE SET NULL,
    curator_run_id        UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    metadata              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT place_environment_snapshots_metric_kind_chk
        CHECK (metric_kind IN (
            'impervious_pct',
            'forest_pct',
            'water_pct',
            'cropland_pct',
            'urban_pct',
            'ndvi_mean',
            'ndvi_max',
            'landuse_class',
            'elevation_m',
            'slope_deg'
        )),
    CONSTRAINT place_environment_snapshots_valid_range_chk
        CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_place_env_snapshots_current
    ON place_environment_snapshots (place_id, metric_kind)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_place_env_snapshots_time_travel
    ON place_environment_snapshots (place_id, metric_kind, valid_from DESC);

CREATE INDEX IF NOT EXISTS idx_place_env_snapshots_tile
    ON place_environment_snapshots (tile_z, tile_x, tile_y, metric_kind)
    WHERE tile_z IS NOT NULL;
