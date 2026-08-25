-- AI usage contract v2 hardening. Apply only after 0140-0142 in the same approval-bound group.
-- owner-sensitive-ok: migration role owns ai_execution_guards, ai_execution_attempt_events and
-- ai_usage_events, all created by 0140 in this same group, so no pre-existing rows are touched.

ALTER TABLE ai_execution_guards
    ADD COLUMN project TEXT NOT NULL,
    ADD COLUMN workspace_id TEXT,
    ADD COLUMN provider TEXT NOT NULL,
    ADD COLUMN operation_version TEXT NOT NULL,
    ADD COLUMN canonical_input_digest CHAR(64) NOT NULL,
    ADD COLUMN target_time TIMESTAMPTZ,
    ADD COLUMN lease_generation BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT ai_execution_guards_canonical_input_digest_chk
        CHECK (canonical_input_digest ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT ai_execution_guards_lease_generation_chk
        CHECK (lease_generation > 0),
    ADD CONSTRAINT ai_execution_guards_max_lease_chk
        CHECK (lease_expires_at <= acquired_at + INTERVAL '15 minutes'),
    ADD CONSTRAINT ai_execution_guards_scope_text_chk
        CHECK (
            char_length(project) BETWEEN 1 AND 200
            AND (workspace_id IS NULL OR char_length(workspace_id) BETWEEN 1 AND 300)
            AND char_length(provider) BETWEEN 1 AND 100
            AND char_length(operation_version) BETWEEN 1 AND 200
        );

ALTER TABLE ai_execution_attempt_events
    ADD COLUMN lease_generation BIGINT NOT NULL DEFAULT 0,
    DROP CONSTRAINT ai_execution_attempt_events_kind_chk,
    ADD CONSTRAINT ai_execution_attempt_events_generation_chk CHECK (lease_generation > 0),
    ADD CONSTRAINT ai_execution_attempt_events_kind_chk
        CHECK (kind IN ('started', 'renewed', 'succeeded', 'failed', 'lease_expired'));

ALTER TABLE ai_usage_events
    ADD COLUMN workspace_id TEXT,
    ADD COLUMN operation_version TEXT NOT NULL,
    ADD COLUMN lease_generation BIGINT,
    ADD COLUMN provider_account_id TEXT,
    DROP CONSTRAINT ai_usage_events_execution_attempt_shape_chk,
    ADD CONSTRAINT ai_usage_events_execution_relation_shape_chk
        CHECK (
            (execution_key IS NULL AND attempt_id IS NULL AND lease_generation IS NULL)
            OR (execution_key IS NOT NULL AND attempt_id IS NOT NULL AND lease_generation IS NOT NULL AND lease_generation > 0)
        ),
    ADD CONSTRAINT ai_usage_events_v2_text_chk
        CHECK (
            (workspace_id IS NULL OR char_length(workspace_id) BETWEEN 1 AND 300)
            AND char_length(operation_version) BETWEEN 1 AND 200
            AND (provider_account_id IS NULL OR char_length(provider_account_id) BETWEEN 1 AND 300)
        );

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_provider_request
    ON ai_usage_events (provider, COALESCE(provider_account_id, ''), provider_request_id)
    WHERE event_kind = 'usage' AND provider_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_budget_tenant_time
    ON ai_usage_events (tenant_id, event_kind, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_budget_feature_time
    ON ai_usage_events (tenant_id, project, workspace_id, feature, event_kind, occurred_at);

CREATE OR REPLACE FUNCTION ai_usage_events_validate_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target ai_usage_events%ROWTYPE;
    guard ai_execution_guards%ROWTYPE;
BEGIN
    IF NEW.execution_key IS NOT NULL THEN
        SELECT * INTO guard FROM ai_execution_guards WHERE execution_key = NEW.execution_key;
        IF NOT FOUND THEN RAISE EXCEPTION 'ai_usage_guard_not_found'; END IF;
        IF guard.tenant_id <> NEW.tenant_id
           OR guard.project <> NEW.project
           OR guard.workspace_id IS DISTINCT FROM NEW.workspace_id
           OR guard.feature <> NEW.feature
           OR guard.provider <> NEW.provider
           OR guard.operation_version <> NEW.operation_version
           OR guard.model_id <> NEW.model_id THEN
            RAISE EXCEPTION 'ai_usage_guard_scope_mismatch';
        END IF;
        IF guard.holder_attempt_id <> NEW.attempt_id
           OR guard.lease_generation <> NEW.lease_generation THEN
            RAISE EXCEPTION 'ai_usage_guard_fencing_mismatch';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM ai_execution_attempt_events
             WHERE execution_key = NEW.execution_key
               AND attempt_id = NEW.attempt_id
               AND lease_generation = NEW.lease_generation
               AND kind = 'started'
        ) THEN RAISE EXCEPTION 'ai_usage_attempt_not_started'; END IF;
    END IF;

    IF NEW.retry_of_event_id IS NOT NULL THEN
        SELECT * INTO target FROM ai_usage_events WHERE event_id = NEW.retry_of_event_id;
        IF NOT FOUND OR target.event_kind <> 'usage' THEN RAISE EXCEPTION 'ai_retry_target_not_found'; END IF;
        IF target.tenant_id <> NEW.tenant_id
           OR target.project <> NEW.project
           OR target.workspace_id IS DISTINCT FROM NEW.workspace_id
           OR target.feature <> NEW.feature
           OR target.operation_version <> NEW.operation_version
           OR target.provider <> NEW.provider
           OR target.model_id <> NEW.model_id
           OR target.execution_key IS DISTINCT FROM NEW.execution_key THEN
            RAISE EXCEPTION 'ai_retry_target_scope_mismatch';
        END IF;
    END IF;

    IF NEW.adjustment_of_event_id IS NOT NULL THEN
        SELECT * INTO target FROM ai_usage_events WHERE event_id = NEW.adjustment_of_event_id;
        IF NOT FOUND OR target.event_kind <> 'usage' THEN RAISE EXCEPTION 'ai_adjustment_target_not_found'; END IF;
        IF target.tenant_id <> NEW.tenant_id
           OR target.project <> NEW.project
           OR target.workspace_id IS DISTINCT FROM NEW.workspace_id
           OR target.feature <> NEW.feature
           OR target.operation_version <> NEW.operation_version
           OR target.provider <> NEW.provider
           OR target.model_id <> NEW.model_id
           OR target.execution_key IS DISTINCT FROM NEW.execution_key THEN
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
