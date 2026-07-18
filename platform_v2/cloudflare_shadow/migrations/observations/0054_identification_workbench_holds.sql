CREATE TABLE IF NOT EXISTS observation_identification_workbench_holds (
  hold_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  hold_reason TEXT NOT NULL DEFAULT '',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (occurrence_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_observation_identification_workbench_holds_actor
  ON observation_identification_workbench_holds (actor_user_id, updated_at);
