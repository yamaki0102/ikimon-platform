CREATE TABLE IF NOT EXISTS stamp_rallies (
  rally_id TEXT PRIMARY KEY,
  scope_digest TEXT NOT NULL,
  source_rally_id TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT,
  ends_at TEXT,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  prize_mode TEXT NOT NULL DEFAULT 'none' CHECK (prize_mode IN ('none', 'offline')),
  prize_instructions TEXT,
  expected_participants INTEGER,
  logo_url TEXT,
  theme_primary TEXT,
  theme_background TEXT,
  last_operation_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (scope_digest, source_rally_id)
);

CREATE TABLE IF NOT EXISTS stamp_rally_spots (
  spot_id TEXT PRIMARY KEY,
  rally_id TEXT NOT NULL,
  spot_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  spot_kind TEXT NOT NULL DEFAULT 'qr' CHECK (spot_kind IN ('qr', 'area')),
  area_center_lat REAL,
  area_center_lng REAL,
  radius_m INTEGER,
  state TEXT NOT NULL CHECK (state IN ('active', 'removed')),
  created_at TEXT NOT NULL,
  UNIQUE (rally_id, spot_key)
);

CREATE TABLE IF NOT EXISTS stamp_rally_devices (
  rally_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (rally_id, device_id)
);

CREATE TABLE IF NOT EXISTS stamp_rally_stamps (
  rally_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  stamped_at TEXT NOT NULL,
  area_result TEXT CHECK (area_result IS NULL OR area_result IN ('inside', 'inside_low_accuracy')),
  accuracy_m INTEGER,
  PRIMARY KEY (rally_id, spot_id, device_id)
);

CREATE INDEX IF NOT EXISTS stamp_rally_stamps_device ON stamp_rally_stamps (rally_id, device_id);

CREATE TABLE IF NOT EXISTS stamp_account_links (
  rally_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  notify_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (notify_opt_in IN (0, 1)),
  revoked_at TEXT,
  PRIMARY KEY (rally_id, device_id)
);

CREATE INDEX IF NOT EXISTS stamp_account_links_user ON stamp_account_links (user_id, rally_id);
