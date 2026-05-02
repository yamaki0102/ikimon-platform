-- Biodiversity Freshness OS: inferred_absence_candidates
--
-- Purpose:
--   Grid cells where the satellite-update-curator estimates "high natural
--   value but zero observations" — candidates for absence data inference.
--   Drives the absence-data strategy (memory: project_absence_data_strategy).

CREATE TABLE IF NOT EXISTS inferred_absence_candidates (
    candidate_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    grid_id               TEXT         NOT NULL,
    grid_z                INTEGER      NOT NULL,
    grid_x                INTEGER      NOT NULL,
    grid_y                INTEGER      NOT NULL,
    centroid_latitude     NUMERIC(9,6) NOT NULL,
    centroid_longitude    NUMERIC(9,6) NOT NULL,
    naturalness_score     NUMERIC(4,3) NOT NULL,
    observation_count     INTEGER      NOT NULL DEFAULT 0,
    expected_taxa_groups  TEXT[]       NOT NULL DEFAULT '{}',
    confidence            NUMERIC(4,3) NOT NULL DEFAULT 0.500,
    source_snapshot_id    UUID         REFERENCES source_snapshots(snapshot_id) ON DELETE SET NULL,
    curator_run_id        UUID         REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT inferred_absence_naturalness_chk
        CHECK (naturalness_score >= 0 AND naturalness_score <= 1),
    CONSTRAINT inferred_absence_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1),
    CONSTRAINT inferred_absence_observation_count_chk
        CHECK (observation_count >= 0),
    CONSTRAINT inferred_absence_grid_chk
        CHECK (grid_z >= 0 AND grid_z <= 22)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inferred_absence_grid
    ON inferred_absence_candidates (grid_id);

CREATE INDEX IF NOT EXISTS idx_inferred_absence_high_priority
    ON inferred_absence_candidates (naturalness_score DESC, observation_count ASC)
    WHERE observation_count = 0;

CREATE INDEX IF NOT EXISTS idx_inferred_absence_centroid
    ON inferred_absence_candidates (centroid_latitude, centroid_longitude);
