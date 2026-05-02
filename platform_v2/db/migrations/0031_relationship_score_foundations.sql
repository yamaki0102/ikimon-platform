-- Relationship Score v0.1 foundations
-- spec: ikimon-internal/docs/spec/ikimon_relationship_score_v0_spec_2026-04-26.md

CREATE TABLE IF NOT EXISTS stewardship_actions (
    action_id           TEXT PRIMARY KEY,
    place_id            TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    occurred_at         TIMESTAMPTZ NOT NULL,
    action_kind         TEXT NOT NULL,
    actor_user_id       TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    linked_visit_id     TEXT REFERENCES visits(visit_id) ON DELETE SET NULL,
    description         TEXT,
    species_status      TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (action_kind IN (
        'cleanup',
        'mowing',
        'invasive_removal',
        'patrol',
        'signage',
        'monitoring',
        'external_program',
        'restoration',
        'community_engagement',
        'other'
    )),
    CHECK (species_status IS NULL OR species_status IN (
        'invasive',
        'dominant_native',
        'disturbance',
        'unknown'
    ))
);

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_place_occurred
    ON stewardship_actions (place_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_visit
    ON stewardship_actions (linked_visit_id)
    WHERE linked_visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_actor
    ON stewardship_actions (actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;


CREATE TABLE IF NOT EXISTS relationship_score_snapshots (
    snapshot_id                 TEXT PRIMARY KEY,
    place_id                    TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
    period_start                DATE NOT NULL,
    period_end                  DATE NOT NULL,
    total_score                 INTEGER NOT NULL,
    axis_scores                 JSONB NOT NULL,
    inputs                      JSONB NOT NULL,
    calc_version                TEXT NOT NULL,
    claims_style_guide_version  TEXT,
    narrative                   JSONB,
    narrative_model             TEXT,
    narrative_validated_at      TIMESTAMPTZ,
    narrative_fallback_used     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (total_score BETWEEN 0 AND 100),
    CHECK (period_end >= period_start),
    UNIQUE (place_id, period_end, calc_version)
);

CREATE INDEX IF NOT EXISTS idx_rss_place_period
    ON relationship_score_snapshots (place_id, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_rss_calc_version
    ON relationship_score_snapshots (calc_version, created_at DESC);
