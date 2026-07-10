CREATE TABLE IF NOT EXISTS public_map_snapshots (
    snapshot_key TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_sample_size INTEGER NOT NULL DEFAULT 0,
    public_record_count INTEGER NOT NULL DEFAULT 0,
    refreshed_by TEXT NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_public_map_snapshots_generated_at
    ON public_map_snapshots (generated_at DESC);

INSERT INTO freshness_registry (
    registry_key,
    source_kind,
    fetcher_strategy,
    expected_freshness_days,
    trust_grade,
    config,
    notes
) VALUES (
    'public_map_snapshot',
    'public_map_snapshot',
    'manual_upload',
    1,
    'A',
    '{"schedule":"runtime_interval","max_age_hours":6,"refresh_interval_minutes":60}'::jsonb,
    'Public map aggregate snapshot. Refreshed after observation/track writes, legacy import batches, and runtime scheduler ticks.'
)
ON CONFLICT (registry_key) DO NOTHING;
