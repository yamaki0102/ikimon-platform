-- Biodiversity Freshness OS: ai_cost_log
--
-- Purpose:
--   One row per LLM invocation across Hot / Warm / Cold layers. Drives the
--   monthly budget gate (aiBudgetGate.ts) and the /admin/data-health cost panel.
--
-- Design principles (see docs/spec/ikimon_biodiversity_freshness_os_spec.md §3.3):
--   * NO LLM call may bypass aiCostLogger.log() (asserted in app layer)
--   * cache_hit=TRUE rows record cache reuse (cost_jpy=0) for hit-ratio calc
--   * escalated=TRUE marks Pro re-runs after Flash Lite first-pass
--   * partition-friendly: monthly index on date_trunc('month', occurred_at)

CREATE TABLE IF NOT EXISTS ai_cost_log (
    cost_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    layer          TEXT          NOT NULL,
    endpoint       TEXT          NOT NULL,
    provider       TEXT          NOT NULL,
    model          TEXT          NOT NULL,
    input_tokens   INTEGER       NOT NULL DEFAULT 0,
    output_tokens  INTEGER       NOT NULL DEFAULT 0,
    cost_usd       NUMERIC(14,10) NOT NULL DEFAULT 0,
    cost_jpy       NUMERIC(12,4)  NOT NULL DEFAULT 0,
    user_id        TEXT,
    visit_id       UUID,
    occurrence_id  UUID,
    agent_run_id   UUID          REFERENCES ai_curator_runs(run_id) ON DELETE SET NULL,
    cache_key      TEXT,
    escalated      BOOLEAN       NOT NULL DEFAULT FALSE,
    cache_hit      BOOLEAN       NOT NULL DEFAULT FALSE,
    latency_ms     INTEGER,
    metadata       JSONB         NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ai_cost_log_layer_chk
        CHECK (layer IN ('hot', 'warm', 'cold')),
    CONSTRAINT ai_cost_log_provider_chk
        CHECK (provider IN ('gemini', 'claude', 'deepseek', 'openai', 'other')),
    CONSTRAINT ai_cost_log_tokens_chk
        CHECK (input_tokens >= 0 AND output_tokens >= 0),
    CONSTRAINT ai_cost_log_cost_chk
        CHECK (cost_usd >= 0 AND cost_jpy >= 0),
    CONSTRAINT ai_cost_log_endpoint_len_chk
        CHECK (char_length(endpoint) BETWEEN 1 AND 120)
);

-- Monthly aggregation index (drives aiBudgetGate.summarizeMonth).
-- date_trunc(timestamptz) is STABLE, not IMMUTABLE, so it cannot appear in
-- an expression index. Use a plain BTree on (occurred_at DESC, layer) and
-- rely on range predicates (occurred_at >= :ms AND occurred_at < :next) in queries.
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_occurred_at_layer
    ON ai_cost_log (occurred_at DESC, layer);

-- Per-user monthly cost (for the "1 user month AI cost" Evaluation Gate metric).
-- Same IMMUTABLE caveat — query the range explicitly.
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_user_occurred_at
    ON ai_cost_log (user_id, occurred_at DESC)
    WHERE user_id IS NOT NULL;

-- Curator run cost rollup
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_agent_run
    ON ai_cost_log (agent_run_id, occurred_at DESC)
    WHERE agent_run_id IS NOT NULL;

-- Endpoint diagnostics
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_endpoint_time
    ON ai_cost_log (endpoint, occurred_at DESC);

-- Cache hit ratio queries
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_cache_hit
    ON ai_cost_log (endpoint, cache_hit, occurred_at DESC);
