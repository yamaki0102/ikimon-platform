CREATE TABLE IF NOT EXISTS candidate_action_requests (
  request_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  action_kind TEXT NOT NULL CHECK (action_kind IN ('propose', 'adopt')),
  actor_user_id TEXT NOT NULL,
  request_state TEXT NOT NULL DEFAULT 'pending' CHECK (request_state IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(observation_id, candidate_id, action_kind, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_action_requests_observation
  ON candidate_action_requests (observation_id, candidate_id, action_kind, updated_at);

CREATE INDEX IF NOT EXISTS idx_candidate_action_requests_pending
  ON candidate_action_requests (request_state, updated_at);
