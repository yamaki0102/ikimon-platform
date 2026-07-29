-- Separate stable canonical input identity from one logical invocation and add
-- a database-owned accounting timestamp.
-- Apply only after 0140-0143 in the same approval-bound migration group.

ALTER TABLE ai_execution_guards
    ADD COLUMN invocation_id TEXT NOT NULL,
    ADD CONSTRAINT ai_execution_guards_invocation_id_chk
        CHECK (char_length(invocation_id) BETWEEN 1 AND 300);

CREATE INDEX IF NOT EXISTS idx_ai_execution_guards_invocation
    ON ai_execution_guards (tenant_id, project, invocation_id);

ALTER TABLE ai_usage_events
    ADD COLUMN recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();

CREATE INDEX IF NOT EXISTS idx_ai_usage_budget_recorded_tenant
    ON ai_usage_events (tenant_id, event_kind, recorded_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_budget_recorded_feature
    ON ai_usage_events (tenant_id, project, workspace_id, feature, event_kind, recorded_at);
