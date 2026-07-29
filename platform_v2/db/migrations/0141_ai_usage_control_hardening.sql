-- AI usage control hardening.
-- Apply only as part of the same approval-bound telemetry migration group as 0140.

ALTER TABLE ai_usage_events
    ADD CONSTRAINT ai_usage_events_raw_usage_object_chk
    CHECK (jsonb_typeof(raw_usage) = 'object'),
    ADD CONSTRAINT ai_usage_events_execution_attempt_shape_chk
    CHECK (
        (execution_key IS NULL AND attempt_id IS NULL)
        OR (execution_key IS NOT NULL AND attempt_id IS NOT NULL)
    ),
    ADD CONSTRAINT ai_usage_events_execution_guard_fk
    FOREIGN KEY (execution_key) REFERENCES ai_execution_guards(execution_key);

CREATE OR REPLACE FUNCTION ai_usage_events_validate_lineage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target ai_usage_events%ROWTYPE;
BEGIN
    IF NEW.execution_key IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM ai_execution_attempt_events
         WHERE execution_key = NEW.execution_key
           AND attempt_id = NEW.attempt_id
           AND kind = 'started'
    ) THEN
        RAISE EXCEPTION 'ai_usage_attempt_not_started';
    END IF;

    IF NEW.retry_of_event_id IS NOT NULL THEN
        SELECT * INTO target FROM ai_usage_events WHERE event_id = NEW.retry_of_event_id;
        IF NOT FOUND OR target.event_kind <> 'usage' THEN
            RAISE EXCEPTION 'ai_retry_target_not_found';
        END IF;
        IF target.tenant_id <> NEW.tenant_id
           OR target.project <> NEW.project
           OR target.feature <> NEW.feature
           OR target.execution_key IS DISTINCT FROM NEW.execution_key THEN
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
           OR target.execution_key IS DISTINCT FROM NEW.execution_key THEN
            RAISE EXCEPTION 'ai_adjustment_target_scope_mismatch';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER TABLE ai_usage_budget_overrides
    ADD COLUMN revoked_by TEXT,
    ADD COLUMN revoke_reason TEXT;

ALTER TABLE ai_usage_budget_overrides
    ADD CONSTRAINT ai_usage_budget_overrides_max_ttl_chk
    CHECK (valid_until <= valid_from + INTERVAL '24 hours'),
    ADD CONSTRAINT ai_usage_budget_overrides_revocation_shape_chk
    CHECK (
        (
            revoked_at IS NULL
            AND revoked_by IS NULL
            AND revoke_reason IS NULL
        )
        OR (
            revoked_at IS NOT NULL
            AND char_length(revoked_by) BETWEEN 1 AND 300
            AND char_length(revoke_reason) BETWEEN 1 AND 2000
        )
    );

CREATE OR REPLACE FUNCTION ai_usage_budget_override_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ai_usage_budget_overrides is audit-bearing and cannot be deleted';
    END IF;
    IF OLD.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'ai_usage_budget_override_revocation_is_final';
    END IF;
    IF NEW.override_id IS DISTINCT FROM OLD.override_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.feature IS DISTINCT FROM OLD.feature
       OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
       OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.revoked_at IS NULL
       OR NEW.revoked_by IS NULL
       OR NEW.revoke_reason IS NULL THEN
        RAISE EXCEPTION 'ai_usage_budget_override_only_allows_one_revocation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_usage_budget_overrides_guard ON ai_usage_budget_overrides;
CREATE TRIGGER trg_ai_usage_budget_overrides_guard
BEFORE UPDATE OR DELETE ON ai_usage_budget_overrides
FOR EACH ROW EXECUTE FUNCTION ai_usage_budget_override_guard();
