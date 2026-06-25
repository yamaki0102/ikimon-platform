CREATE TABLE IF NOT EXISTS observation_reactions (
  reaction_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (occurrence_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_observation_reactions_occurrence
  ON observation_reactions (occurrence_id);

CREATE INDEX IF NOT EXISTS idx_observation_reactions_user
  ON observation_reactions (user_id);
