CREATE TABLE IF NOT EXISTS observation_identification_disputes (
  dispute_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  proposed_name TEXT,
  proposed_rank TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_identification_disputes_occurrence
  ON observation_identification_disputes (occurrence_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_observation_identification_disputes_actor
  ON observation_identification_disputes (actor_user_id, created_at);
