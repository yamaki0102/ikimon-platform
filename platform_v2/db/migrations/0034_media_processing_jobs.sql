CREATE TABLE IF NOT EXISTS media_processing_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_kind TEXT NOT NULL,
    media_uid TEXT NOT NULL,
    observation_id TEXT NOT NULL,
    occurrence_id TEXT,
    job_type TEXT NOT NULL,
    job_status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_processing_jobs_unique_pending
    ON media_processing_jobs (media_kind, media_uid, observation_id, job_type)
    WHERE job_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_media_processing_jobs_status
    ON media_processing_jobs (job_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_media_processing_jobs_observation
    ON media_processing_jobs (observation_id)
    WHERE observation_id IS NOT NULL;

INSERT INTO media_processing_jobs (
    media_kind, media_uid, observation_id, occurrence_id, job_type, job_status,
    attempts, last_error, source_payload, created_at, updated_at, finished_at
)
SELECT
    'video',
    stream_uid,
    observation_id,
    NULL,
    job_type,
    job_status,
    attempts,
    last_error,
    source_payload || jsonb_build_object('migrated_from', 'video_processing_jobs'),
    created_at,
    updated_at,
    finished_at
FROM video_processing_jobs
WHERE observation_id IS NOT NULL
ON CONFLICT DO NOTHING;
