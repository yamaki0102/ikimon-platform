CREATE TABLE IF NOT EXISTS video_processing_jobs (
    job_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_uid      TEXT        NOT NULL,
    observation_id  TEXT,
    job_type        TEXT        NOT NULL,
    job_status      TEXT        NOT NULL DEFAULT 'pending',
    attempts        INTEGER     NOT NULL DEFAULT 0,
    last_error      TEXT,
    source_payload  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_video_processing_jobs_unique_pending
    ON video_processing_jobs (stream_uid, job_type)
    WHERE job_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_status
    ON video_processing_jobs (job_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_video_processing_jobs_observation
    ON video_processing_jobs (observation_id)
    WHERE observation_id IS NOT NULL;
