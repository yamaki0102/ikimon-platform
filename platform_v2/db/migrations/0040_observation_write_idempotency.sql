CREATE TABLE IF NOT EXISTS observation_write_idempotency (
    client_submission_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    visit_id TEXT,
    occurrence_id TEXT,
    occurrence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    place_id TEXT,
    request_fingerprint TEXT NOT NULL,
    write_status TEXT NOT NULL DEFAULT 'in_progress',
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'observation_write_idempotency_status_chk'
  ) THEN
    ALTER TABLE observation_write_idempotency
      ADD CONSTRAINT observation_write_idempotency_status_chk
      CHECK (write_status IN ('in_progress', 'succeeded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_observation_write_idempotency_user_seen
    ON observation_write_idempotency (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_write_idempotency_visit
    ON observation_write_idempotency (visit_id)
    WHERE visit_id IS NOT NULL;
