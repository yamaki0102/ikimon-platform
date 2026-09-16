-- Private intent only. Never a like, subscription, reservation or activity attestation.
CREATE TABLE IF NOT EXISTS user_saved_references (
  user_id TEXT NOT NULL,
  target_key TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  target_path TEXT NOT NULL,
  is_saved INTEGER NOT NULL CHECK (is_saved IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision > 0),
  last_mutation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, target_key)
);
CREATE INDEX IF NOT EXISTS idx_user_saved_references_list
  ON user_saved_references (user_id, is_saved, updated_at DESC, target_key);
