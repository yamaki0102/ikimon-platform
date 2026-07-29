-- AI usage control: durable execution lease, append-only attempts, and authoritative usage events.
--
-- This migration is intentionally separate from ZUKAN Foundation v2 migrations.
-- `ai_usage_events` becomes the authoritative USD-micro usage/reconciliation store.
-- Existing `ai_cost_log` remains a bounded compatibility projection only and must not
-- be treated as a second authority after runtime cutover.

CREATE TABLE IF NOT EXISTS ai_execution_guards (
    execution_key          CHAR(64) PRIMARY KEY,
    tenant_id              TEXT NOT NULL,
    feature                TEXT NOT NULL,
    source_digest          CHAR(64) NOT NULL,
    extraction_run_id      TEXT,
    policy_version         TEXT NOT NULL,
    prompt_version         TEXT NOT NULL,
    model_id               TEXT NOT NULL,
    holder_attempt_id      TEXT NOT NULL,
    acquired_at            TIMESTAMPTZ NOT NULL,
    lease_expires_at       TIMESTAMPTZ NOT NULL,
    state                  TEXT NOT NULL,
    settled_at             TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ai_execution_guards_key_chk
        CHECK (execution_key ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ai_execution_guards_source_digest_chk
        CHECK (source_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ai_execution_guards_state_chk
        CHECK (state IN ('active', 'succeeded', 'failed')),
    CONSTRAINT ai_execution_guards_time_chk
        CHECK (lease_expires_at > acquired_at),
    CONSTRAINT ai_execution_guards_settlement_chk
        CHECK (
            (state = 'active' AND settled_at IS NULL)
            OR (state IN ('succeeded', 'failed') AND settled_at IS NOT NULL AND settled_at >= acquired_at)
        )
);

CREATE INDEX IF NOT EXISTS idx_ai_execution_guards_tenant_feature
    ON ai_execution_guards (tenant_id, feature, state, lease_expires_at);

CREATE TABLE IF NOT EXISTS ai_execution_attempt_events (
    event_id              TEXT PRIMARY KEY,
    recorded_sequence     BIGSERIAL NOT NULL UNIQUE,
    execution_key         CHAR(64) NOT NULL REFERENCES ai_execution_guards(execution_key),
    attempt_id            TEXT NOT NULL,
    occurred_at           TIMESTAMPTZ NOT NULL,
    kind                  TEXT NOT NULL,
    detail                TEXT,
    CONSTRAINT ai_execution_attempt_events_kind_chk
        CHECK (kind IN ('started', 'succeeded', 'failed', 'lease_expired')),
    CONSTRAINT ai_execution_attempt_events_detail_len_chk
        CHECK (detail IS NULL OR char_length(detail) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_ai_execution_attempt_events_execution
    ON ai_execution_attempt_events (execution_key, recorded_sequence);

CREATE TABLE IF NOT EXISTS ai_usage_events (
    event_id                  TEXT PRIMARY KEY,
    recorded_sequence         BIGSERIAL NOT NULL UNIQUE,
    occurred_at               TIMESTAMPTZ NOT NULL,
    tenant_id                 TEXT NOT NULL,
    project                   TEXT NOT NULL,
    feature                   TEXT NOT NULL,
    request_id                TEXT NOT NULL,
    execution_key             CHAR(64),
    attempt_id                TEXT,
    provider                  TEXT NOT NULL,
    provider_request_id       TEXT,
    model_id                  TEXT NOT NULL,
    pricing_version           TEXT NOT NULL,
    prompt_version            TEXT NOT NULL,
    input_tokens              BIGINT NOT NULL,
    cached_input_tokens       BIGINT NOT NULL DEFAULT 0,
    cache_write_tokens        BIGINT NOT NULL DEFAULT 0,
    output_tokens             BIGINT NOT NULL,
    cost_usd_micros           BIGINT NOT NULL,
    retry_count               INTEGER NOT NULL DEFAULT 0,
    fallback_depth            INTEGER NOT NULL DEFAULT 0,
    provider_failure_count    INTEGER NOT NULL DEFAULT 0,
    event_kind                TEXT NOT NULL,
    outcome                   TEXT NOT NULL,
    reconciliation_status     TEXT NOT NULL,
    raw_usage                 JSONB NOT NULL DEFAULT '{}'::jsonb,
    retry_of_event_id         TEXT REFERENCES ai_usage_events(event_id),
    adjustment_of_event_id    TEXT REFERENCES ai_usage_events(event_id),
    CONSTRAINT ai_usage_events_execution_key_chk
        CHECK (execution_key IS NULL OR execution_key ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ai_usage_events_tokens_chk
        CHECK (
            input_tokens >= 0
            AND cached_input_tokens >= 0
            AND cache_write_tokens >= 0
            AND output_tokens >= 0
        ),
    CONSTRAINT ai_usage_events_counts_chk
        CHECK (retry_count >= 0 AND fallback_depth >= 0 AND provider_failure_count >= 0),
    CONSTRAINT ai_usage_events_kind_chk
        CHECK (event_kind IN ('usage', 'adjustment')),
    CONSTRAINT ai_usage_events_outcome_chk
        CHECK (outcome IN ('ok', 'error', 'timeout', 'refused', 'aborted')),
    CONSTRAINT ai_usage_events_reconciliation_chk
        CHECK (reconciliation_status IN ('pending', 'matched', 'adjusted')),
    CONSTRAINT ai_usage_events_lineage_shape_chk
        CHECK (
            (
                event_kind = 'usage'
                AND adjustment_of_event_id IS NULL
                AND reconciliation_status IN ('pending', 'matched')
                AND cost_usd_micros >= 0
            )
            OR (
                event_kind = 'adjustment'
                AND retry_of_event_id IS NULL
                AND adjustment_of_event_id IS NOT NULL
                AND reconciliation_status = 'adjusted'
            )
        ),
    CONSTRAINT ai_usage_events_no_self_reference_chk
        CHECK (
            (retry_of_event_id IS NULL OR retry_of_event_id <> event_id)
            AND (adjustment_of_event_id IS NULL OR adjustment_of_event_id <> event_id)
        )
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_tenant_time
    ON ai_usage_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_tenant_feature_time
    ON ai_usage_events (tenant_id, feature, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_request
    ON ai_usage_events (provider, provider_request_id)
    WHERE provider_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_execution
    ON ai_usage_events (execution_key, occurred_at DESC)
    WHERE execution_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_reconciliation
    ON ai_usage_events (reconciliation_status, occurred_at DESC);

CREATE OR REPLACE FUNCTION ai_usage_events_validate_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target ai_usage_events%ROWTYPE;
BEGIN
    IF NEW.retry_of_event_id IS NOT NULL THEN
        SELECT * INTO target FROM ai_usage_events WHERE event_id = NEW.retry_of_event_id;
        IF NOT FOUND OR target.event_kind <> 'usage' THEN
            RAISE EXCEPTION 'ai_retry_target_not_found';
        END IF;
        IF target.tenant_id <> NEW.tenant_id
           OR target.project <> NEW.project
           OR target.feature <> NEW.feature
           OR (
               target.execution_key IS NOT NULL
               AND NEW.execution_key IS NOT NULL
               AND target.execution_key <> NEW.execution_key
           ) THEN
            RAISE EXCEPTION 'ai_retry_target_scope_mismatch';
        END IF;
    END IF;

    IF NEW.adjustment_of_event_id IS NOT NULL THEN
        SELECT * INTO target FROM ai_usage_events WHERE event_id = NEW.adjustment_of_event_id;
        IF NOT FOUND OR target.event_kind <> 'usage' THEN
            RAISE EXCEPTION 'ai_adjustment_target_not_found';
        END IF;
        IF target.tenant_id <> NEW.tenant_id
           OR target.project <> NEW.project
           OR target.feature <> NEW.feature
           OR (
               target.execution_key IS NOT NULL
               AND NEW.execution_key IS NOT NULL
               AND target.execution_key <> NEW.execution_key
           ) THEN
            RAISE EXCEPTION 'ai_adjustment_target_scope_mismatch';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_usage_events_validate_lineage ON ai_usage_events;
CREATE TRIGGER trg_ai_usage_events_validate_lineage
BEFORE INSERT ON ai_usage_events
FOR EACH ROW EXECUTE FUNCTION ai_usage_events_validate_lineage();

CREATE OR REPLACE FUNCTION ai_usage_append_only_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_execution_attempt_events_append_only ON ai_execution_attempt_events;
CREATE TRIGGER trg_ai_execution_attempt_events_append_only
BEFORE UPDATE OR DELETE ON ai_execution_attempt_events
FOR EACH ROW EXECUTE FUNCTION ai_usage_append_only_guard();

DROP TRIGGER IF EXISTS trg_ai_usage_events_append_only ON ai_usage_events;
CREATE TRIGGER trg_ai_usage_events_append_only
BEFORE UPDATE OR DELETE ON ai_usage_events
FOR EACH ROW EXECUTE FUNCTION ai_usage_append_only_guard();

CREATE TABLE IF NOT EXISTS ai_usage_budget_overrides (
    override_id        TEXT PRIMARY KEY,
    tenant_id          TEXT NOT NULL,
    feature            TEXT,
    valid_from         TIMESTAMPTZ NOT NULL,
    valid_until        TIMESTAMPTZ NOT NULL,
    approved_by        TEXT NOT NULL,
    reason             TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at         TIMESTAMPTZ,
    CONSTRAINT ai_usage_budget_overrides_time_chk
        CHECK (valid_until > valid_from),
    CONSTRAINT ai_usage_budget_overrides_reason_chk
        CHECK (char_length(reason) BETWEEN 1 AND 2000),
    CONSTRAINT ai_usage_budget_overrides_revoke_chk
        CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_budget_overrides_active
    ON ai_usage_budget_overrides (tenant_id, feature, valid_until)
    WHERE revoked_at IS NULL;
