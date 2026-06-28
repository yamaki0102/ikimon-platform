CREATE TABLE IF NOT EXISTS stewardship_actions (
  action_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  action_kind TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  linked_visit_id TEXT,
  description TEXT,
  species_status TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_place_time
  ON stewardship_actions (place_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_actor
  ON stewardship_actions (actor_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_stewardship_actions_linked_visit
  ON stewardship_actions (linked_visit_id);
