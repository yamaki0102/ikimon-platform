CREATE TABLE IF NOT EXISTS observation_reassessment_requests (
  request_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('standard', 'video')),
  actor_user_id TEXT NOT NULL,
  request_state TEXT NOT NULL DEFAULT 'pending' CHECK (request_state IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(observation_id, request_kind, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_observation_reassessment_requests_observation
  ON observation_reassessment_requests (observation_id, request_kind, updated_at);

CREATE INDEX IF NOT EXISTS idx_observation_reassessment_requests_pending
  ON observation_reassessment_requests (request_state, updated_at);
