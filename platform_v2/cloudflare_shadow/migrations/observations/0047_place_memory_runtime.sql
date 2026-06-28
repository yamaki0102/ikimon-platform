CREATE TABLE IF NOT EXISTS place_memory_entries (
  entry_id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL UNIQUE,
  occurrence_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  cell_id TEXT NOT NULL,
  cell_grid_m INTEGER NOT NULL DEFAULT 1000,
  memory_tags_json TEXT NOT NULL DEFAULT '[]',
  tags_public INTEGER NOT NULL DEFAULT 1,
  echo_note TEXT NOT NULL DEFAULT '',
  private_note TEXT NOT NULL DEFAULT '',
  photo_echo_enabled INTEGER NOT NULL DEFAULT 0,
  photo_echo_visibility TEXT NOT NULL DEFAULT 'hidden_by_user',
  moderation_status TEXT NOT NULL DEFAULT 'visible',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_place_memory_entries_cell
  ON place_memory_entries(cell_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_place_memory_entries_user
  ON place_memory_entries(user_id, updated_at);

CREATE TABLE IF NOT EXISTS place_memory_user_preferences (
  user_id TEXT PRIMARY KEY,
  default_photo_echo_enabled INTEGER NOT NULL DEFAULT 0,
  default_tags_public INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS place_memory_likes (
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS place_memory_hidden_entries (
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'self',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS place_memory_reports (
  report_id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  reason_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_place_memory_reports_entry
  ON place_memory_reports(entry_id, created_at);
