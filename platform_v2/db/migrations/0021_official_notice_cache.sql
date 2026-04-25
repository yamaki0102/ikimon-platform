-- Official municipal/source notice cache.
--
-- Stores the normalized snapshot for each configured public source so the
-- UI can keep rendering the last known good payload even when the upstream
-- page is slow or temporarily unavailable.

CREATE TABLE IF NOT EXISTS official_notice_cache (
    source_id TEXT PRIMARY KEY,
    parser_key TEXT NOT NULL,
    source_page_url TEXT NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_official_notice_cache_expires
    ON official_notice_cache (expires_at);
