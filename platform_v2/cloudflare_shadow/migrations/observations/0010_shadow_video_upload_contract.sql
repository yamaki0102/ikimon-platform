CREATE TABLE IF NOT EXISTS video_upload_requests (
  stream_uid TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  observation_id TEXT,
  upload_status TEXT NOT NULL,
  max_duration_seconds INTEGER NOT NULL,
  filename TEXT,
  upload_protocol TEXT NOT NULL DEFAULT 'post',
  object_key TEXT,
  bytes INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  ready_to_stream INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TEXT,
  finalized_at TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_video_upload_actor ON video_upload_requests(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_video_upload_observation ON video_upload_requests(observation_id, created_at);
