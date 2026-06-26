CREATE TABLE IF NOT EXISTS management_candidate_confirmations (
  confirmation_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  confirm_state TEXT NOT NULL CHECK (confirm_state IN ('suggested', 'confirmed', 'rejected')),
  actor_user_id TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(observation_id, candidate_index, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_management_candidate_confirmations_observation
  ON management_candidate_confirmations (observation_id, candidate_index);

CREATE INDEX IF NOT EXISTS idx_management_candidate_confirmations_actor
  ON management_candidate_confirmations (actor_user_id, updated_at);
