CREATE TABLE IF NOT EXISTS observation_rally_courses (
  course_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '観察ラリー',
  status TEXT NOT NULL DEFAULT 'draft',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_courses_session
  ON observation_rally_courses (session_id);

CREATE TABLE IF NOT EXISTS observation_rally_stations (
  station_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  field_id TEXT,
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  radius_m INTEGER,
  polygon_json TEXT,
  route_geojson TEXT,
  is_private INTEGER NOT NULL DEFAULT 0,
  access_note TEXT NOT NULL DEFAULT '',
  danger_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_stations_course
  ON observation_rally_stations (course_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS observation_rally_missions (
  mission_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  station_id TEXT,
  replacement_for_mission_id TEXT,
  scope TEXT NOT NULL DEFAULT 'event',
  location_binding TEXT NOT NULL DEFAULT 'none',
  title TEXT NOT NULL,
  target TEXT NOT NULL,
  count_unit TEXT NOT NULL DEFAULT 'scene',
  goal_count REAL NOT NULL,
  counting_policy_json TEXT NOT NULL DEFAULT '{}',
  verification_policy TEXT NOT NULL DEFAULT 'auto',
  weather_sensitivity TEXT NOT NULL DEFAULT 'all_weather',
  fallback_group TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT,
  ends_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_missions_course_status
  ON observation_rally_missions (course_id, status, sort_order, created_at);

CREATE INDEX IF NOT EXISTS idx_obs_rally_missions_station
  ON observation_rally_missions (station_id, status);

CREATE TABLE IF NOT EXISTS observation_rally_submissions (
  submission_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  station_id TEXT,
  user_id TEXT,
  guest_token TEXT,
  team_id TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual_rally',
  source_ref TEXT,
  count_value REAL NOT NULL DEFAULT 1,
  public_lat REAL,
  public_lng REAL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_submissions_mission
  ON observation_rally_submissions (mission_id, review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_rally_submissions_session
  ON observation_rally_submissions (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_rally_progress (
  progress_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  progress_scope TEXT NOT NULL DEFAULT 'event',
  team_id TEXT,
  participant_key TEXT,
  station_id TEXT,
  actual_count REAL NOT NULL DEFAULT 0,
  goal_count REAL NOT NULL,
  percent REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (mission_id, progress_scope, team_id, participant_key, station_id)
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_progress_course
  ON observation_rally_progress (course_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS observation_rally_revisions (
  revision_id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  mission_id TEXT,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  before_payload_json TEXT NOT NULL DEFAULT '{}',
  after_payload_json TEXT NOT NULL DEFAULT '{}',
  actor_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_rally_revisions_course
  ON observation_rally_revisions (course_id, created_at DESC);
