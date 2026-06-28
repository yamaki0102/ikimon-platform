CREATE TABLE IF NOT EXISTS guide_record_promotion_requests (
  request_id TEXT PRIMARY KEY,
  guide_record_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  request_state TEXT NOT NULL DEFAULT 'pending' CHECK (request_state IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guide_record_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_record_promotion_requests_pending
  ON guide_record_promotion_requests (request_state, updated_at);
