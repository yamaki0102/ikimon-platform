-- Sprint 7: per-attempt telemetry on ai_curator_runs
--
-- Purpose:
--   Record receiver POST outcome + DeepSeek hybrid usage so /admin/data-health
--   can answer "did Sonnet use DeepSeek for the bulk text step?" at a glance.
--   This is the table-side complement to the v6 prompt contract that requires
--   curators to print `deepseek_call_count: N` and `deepseek_skip_reason: ...`
--   in their final stop message.
--
-- Columns added:
--   * attempt_no              — 1-based, increments on retries within a run_id
--   * receiver_response_status— HTTP status returned by the receiver POST
--   * receiver_response_body  — first 600 chars of receiver response (audit)
--   * wet_run_marker          — TRUE when run was launched manually for QA
--   * deepseek_call_count     — set by receiver from the curator's report
--   * deepseek_skip_reason    — same source; expected `none` when key provided
--
-- These columns are nullable + default to safe sentinels so existing rows
-- (currently 0 in production) need no backfill.

-- owner-sensitive-ok: ALTER TABLE ai_curator_runs adds nullable/defaulted
-- telemetry columns only. rollback path: remove these added columns and
-- idx_ai_curator_runs_wet_run after confirming no dashboard dependency.
ALTER TABLE ai_curator_runs
    ADD COLUMN IF NOT EXISTS attempt_no               INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS receiver_response_status INTEGER,
    ADD COLUMN IF NOT EXISTS receiver_response_body   TEXT,
    ADD COLUMN IF NOT EXISTS wet_run_marker           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deepseek_call_count      INTEGER,
    ADD COLUMN IF NOT EXISTS deepseek_skip_reason     TEXT;

-- Index on (curator_name, started_at) already exists from 0047. Add a partial
-- index on the new wet_run_marker so the dashboard can split scheduled runs
-- from QA wet-runs cheaply.
CREATE INDEX IF NOT EXISTS idx_ai_curator_runs_wet_run
    ON ai_curator_runs (curator_name, started_at DESC)
    WHERE wet_run_marker = TRUE;

-- Constraint: deepseek_skip_reason values the curator may emit.
-- Allow NULL (older rows / never reported) and the canonical v6 reasons.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ai_curator_runs_deepseek_skip_reason_chk'
           AND conrelid = 'ai_curator_runs'::regclass
    ) THEN
        ALTER TABLE ai_curator_runs
            ADD CONSTRAINT ai_curator_runs_deepseek_skip_reason_chk
            CHECK (deepseek_skip_reason IS NULL OR deepseek_skip_reason IN (
                'none',
                'key_empty',
                'api_5xx_after_3_retries',
                'all_chunks_under_1k_chars',
                'no_papers_above_threshold'
            ));
    END IF;
END $$;
