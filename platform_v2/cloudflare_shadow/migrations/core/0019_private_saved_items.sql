-- Private personal relationships, not a replacement public Listing or Record store.
CREATE TABLE IF NOT EXISTS user_saved_items (
  user_id TEXT NOT NULL,
  object_kind TEXT NOT NULL,
  object_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  display_title TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('saved', 'removed')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  last_command_id TEXT NOT NULL,
  last_command_digest TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, object_kind, object_id)
);
CREATE INDEX IF NOT EXISTS idx_user_saved_items_current
  ON user_saved_items(user_id, state, updated_at DESC, object_kind, object_id);
