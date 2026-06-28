CREATE TABLE IF NOT EXISTS user_observation_fields (
  field_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user_defined',
  name TEXT NOT NULL,
  name_kana TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  prefecture TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  public_cell TEXT NOT NULL,
  public_lat REAL NOT NULL,
  public_lng REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 1000,
  area_ha REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_observation_fields_owner
  ON user_observation_fields(owner_user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_user_observation_fields_public_cell
  ON user_observation_fields(public_cell);

CREATE INDEX IF NOT EXISTS idx_user_observation_fields_public_lat_lng
  ON user_observation_fields(public_lat, public_lng);
