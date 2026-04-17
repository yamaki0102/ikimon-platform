-- 24-hour SiteSignals cache keyed by geohash-7 (~150m cell).
--
-- When a map tap hits this table within the TTL window, Overpass and GSI
-- elevation fetches are skipped. The cache makes Site Brief feel instant
-- on revisit and prevents hammering free tile / OSM services.
--
-- ttl: 24h default. Cells near water (higher churn) get shorter TTLs in
-- application code; we still store expires_at per-row so a single DELETE
-- keeps the table clean without per-type knowledge.
--
-- geohash7 ≈ 152m × 152m cell — fine enough for Site Brief semantics,
-- coarse enough that nearby taps within the same habitat block reuse the
-- same row.

CREATE TABLE IF NOT EXISTS site_signals_cache (
    geohash7 TEXT PRIMARY KEY,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_signals_cache_expires
    ON site_signals_cache (expires_at);
