CREATE TABLE IF NOT EXISTS observation_identifications (
  identification_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  proposed_rank TEXT,
  stance TEXT NOT NULL DEFAULT 'support',
  notes TEXT,
  source_key TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_observation_identifications_occurrence
  ON observation_identifications (occurrence_id, is_current, updated_at);

CREATE INDEX IF NOT EXISTS idx_observation_identifications_actor
  ON observation_identifications (actor_user_id, updated_at);
