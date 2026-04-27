-- Biodiversity Freshness OS: ai_curator_runs
--
-- Purpose:
--   One row per CMA agent execution (invasive-law / redlist / paper-research /
--   satellite-update). Records inputs, proposed changes, PR link, cost, error.
--   This is the audit log for "what did the AI decide and based on what".
--
-- Design principles (see docs/spec/ikimon_biodiversity_freshness_os_spec.md §3.1):
--   * runs are append-only logs of agent activity
--   * proposed_changes JSONB is structured: [{table, op, row_summary, ...}]
--   * pr_url is set after GitHub Action creates the PR
--   * cost_jpy aggregates the run's LLM spend (sum of ai_cost_log rows for this run)

CREATE TABLE IF NOT EXISTS ai_curator_runs (
    run_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    curator_name       TEXT         NOT NULL,
    started_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    finished_at        TIMESTAMPTZ,
    status             TEXT         NOT NULL DEFAULT 'running',
    cma_session_id     TEXT,
    cma_agent_id       TEXT,
    input_snapshot_ids UUID[]       NOT NULL DEFAULT '{}',
    proposed_changes   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    pr_url             TEXT,
    pr_number          INTEGER,
    cost_jpy           NUMERIC(12,4) NOT NULL DEFAULT 0,
    cost_usd           NUMERIC(12,8) NOT NULL DEFAULT 0,
    dry_run            BOOLEAN      NOT NULL DEFAULT FALSE,
    error              TEXT,
    metadata           JSONB        NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT ai_curator_runs_curator_name_chk
        CHECK (curator_name IN (
            'invasive-law',
            'redlist',
            'paper-research',
            'satellite-update',
            'taxonomy-update'
        )),
    CONSTRAINT ai_curator_runs_status_chk
        CHECK (status IN ('running', 'success', 'partial', 'failed', 'cancelled')),
    CONSTRAINT ai_curator_runs_cost_chk
        CHECK (cost_jpy >= 0 AND cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ai_curator_runs_curator_time
    ON ai_curator_runs (curator_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_curator_runs_status
    ON ai_curator_runs (status, started_at DESC)
    WHERE status IN ('running', 'failed');

CREATE INDEX IF NOT EXISTS idx_ai_curator_runs_pr
    ON ai_curator_runs (pr_number)
    WHERE pr_number IS NOT NULL;

-- owner-sensitive-ok: deferred FK target (curator_run_id introduced in 0045 with
-- zero rows). table owner = ikimon-staging (same role that runs npm run migrate),
-- so the constraint addition succeeds under the app DB role. rollback path:
-- write a reverse migration that removes this named constraint.
ALTER TABLE source_snapshots
    ADD CONSTRAINT source_snapshots_curator_run_fk
    FOREIGN KEY (curator_run_id)
    REFERENCES ai_curator_runs(run_id)
    ON DELETE SET NULL;
