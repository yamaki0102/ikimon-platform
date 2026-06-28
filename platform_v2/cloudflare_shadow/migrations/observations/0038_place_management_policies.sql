CREATE TABLE IF NOT EXISTS place_management_policies (
  place_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  management_goal TEXT NOT NULL DEFAULT 'balanced',
  weed_tolerance TEXT NOT NULL DEFAULT 'medium',
  invasive_response TEXT NOT NULL DEFAULT 'ask_first',
  mowing_frequency TEXT NOT NULL DEFAULT 'as_needed',
  notes TEXT,
  policy_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (place_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_place_management_policies_user
  ON place_management_policies (user_id, updated_at DESC);
