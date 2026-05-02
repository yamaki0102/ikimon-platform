-- Sprint 7 v2.2: Gemini/DeepSeek Node dispatcher telemetry.
--
-- Purpose:
--   Replace v6 "Sonnet used DeepSeek?" telemetry with provider-neutral model
--   accounting for the Node-owned curator dispatcher. The old deepseek_* fields
--   stay for compatibility with any receiver wet-runs that still send v6 data.

-- owner-sensitive-ok: ALTER TABLE ai_curator_runs adds nullable telemetry
-- columns and CHECK constraints only. rollback path: remove constraints named
-- below, then remove the added columns after dashboard/receiver rollback.
ALTER TABLE ai_curator_runs
    ADD COLUMN IF NOT EXISTS curator_model_provider       TEXT,
    ADD COLUMN IF NOT EXISTS curator_model_name           TEXT,
    ADD COLUMN IF NOT EXISTS curator_model_call_count     INTEGER,
    ADD COLUMN IF NOT EXISTS gemini_call_count            INTEGER,
    ADD COLUMN IF NOT EXISTS gemini_skip_reason           TEXT,
    ADD COLUMN IF NOT EXISTS chunk_count                  INTEGER,
    ADD COLUMN IF NOT EXISTS rows_proposed                INTEGER,
    ADD COLUMN IF NOT EXISTS rows_dropped_validation      INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ai_curator_runs_model_provider_chk'
           AND conrelid = 'ai_curator_runs'::regclass
    ) THEN
        ALTER TABLE ai_curator_runs
            ADD CONSTRAINT ai_curator_runs_model_provider_chk
            CHECK (curator_model_provider IS NULL OR curator_model_provider IN (
                'gemini',
                'deepseek',
                'none'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ai_curator_runs_model_counts_chk'
           AND conrelid = 'ai_curator_runs'::regclass
    ) THEN
        ALTER TABLE ai_curator_runs
            ADD CONSTRAINT ai_curator_runs_model_counts_chk
            CHECK (
                (curator_model_call_count IS NULL OR curator_model_call_count >= 0) AND
                (gemini_call_count IS NULL OR gemini_call_count >= 0) AND
                (chunk_count IS NULL OR chunk_count >= 0) AND
                (rows_proposed IS NULL OR rows_proposed >= 0) AND
                (rows_dropped_validation IS NULL OR rows_dropped_validation >= 0)
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'ai_curator_runs_gemini_skip_reason_chk'
           AND conrelid = 'ai_curator_runs'::regclass
    ) THEN
        ALTER TABLE ai_curator_runs
            ADD CONSTRAINT ai_curator_runs_gemini_skip_reason_chk
            CHECK (gemini_skip_reason IS NULL OR gemini_skip_reason IN (
                'none',
                'not_migrated',
                'budget_cap',
                'source_unchanged',
                'source_fetch_failed',
                'all_chunks_under_1k_chars',
                'no_papers_above_threshold',
                'api_5xx_after_3_retries',
                'schema_validation_failed_all_chunks',
                'receiver_not_configured',
                'model_bakeoff_required'
            ));
    END IF;
END $$;
