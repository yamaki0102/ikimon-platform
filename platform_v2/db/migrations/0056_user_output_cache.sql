-- Biodiversity Freshness OS: user_output_cache
--
-- Purpose:
--   Hot-path cache of personalized AI outputs (observation assessments,
--   weekly mypage copy, site reports). Keyed by sha256 of the canonical
--   inputs (prompt_version + user + visit + asset blobs + digest_version
--   + knowledge_version_set). Cache is invalidated when any referenced
--   knowledge version changes (cf. runCacheInvalidate cron in Sprint 3).

CREATE TABLE IF NOT EXISTS user_output_cache (
    cache_key             TEXT         PRIMARY KEY,
    user_id               TEXT         NOT NULL,
    output_kind           TEXT         NOT NULL,
    prompt_version        TEXT         NOT NULL,
    visit_id              UUID,
    occurrence_id         UUID,
    knowledge_version_set JSONB        NOT NULL DEFAULT '{}'::jsonb,
    output_payload        JSONB        NOT NULL,
    cost_jpy              NUMERIC(10,4) NOT NULL DEFAULT 0,
    cost_usd              NUMERIC(12,8) NOT NULL DEFAULT 0,
    hit_count             INTEGER      NOT NULL DEFAULT 0,
    generated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at            TIMESTAMPTZ,
    last_hit_at           TIMESTAMPTZ,
    CONSTRAINT user_output_cache_kind_chk
        CHECK (output_kind IN (
            'observation_assessment',
            'taxon_insight',
            'mypage_weekly',
            'site_report',
            'event_quest',
            'guide_scene'
        )),
    CONSTRAINT user_output_cache_hit_count_chk
        CHECK (hit_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_user_output_cache_user_kind
    ON user_output_cache (user_id, output_kind, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_output_cache_visit
    ON user_output_cache (visit_id, output_kind)
    WHERE visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_output_cache_active
    ON user_output_cache (output_kind, generated_at DESC)
    WHERE expires_at IS NULL;

-- GIN index on knowledge_version_set keys for cache invalidation queries
-- ("which cache rows reference invasive version_id X?").
CREATE INDEX IF NOT EXISTS idx_user_output_cache_kvs_gin
    ON user_output_cache USING GIN (knowledge_version_set);
