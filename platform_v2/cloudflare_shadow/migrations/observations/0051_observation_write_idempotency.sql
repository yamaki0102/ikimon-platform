CREATE TABLE IF NOT EXISTS observation_write_idempotency (
  client_submission_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  visit_id TEXT,
  occurrence_id TEXT,
  occurrence_ids TEXT NOT NULL DEFAULT '[]',
  place_id TEXT,
  request_fingerprint TEXT NOT NULL,
  write_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (write_status IN ('in_progress', 'succeeded')),
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  source_payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_write_idempotency_user_seen
  ON observation_write_idempotency (user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_write_idempotency_visit
  ON observation_write_idempotency (visit_id)
  WHERE visit_id IS NOT NULL;
