CREATE TABLE IF NOT EXISTS observation_event_sessions (
  session_id TEXT PRIMARY KEY,
  legacy_event_id TEXT,
  event_code TEXT UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  organizer_user_id TEXT NOT NULL,
  corporation_id TEXT,
  plan TEXT NOT NULL DEFAULT 'community',
  primary_mode TEXT NOT NULL DEFAULT 'discovery',
  active_modes_json TEXT NOT NULL DEFAULT '["discovery"]',
  location_lat REAL,
  location_lng REAL,
  location_radius_m INTEGER NOT NULL DEFAULT 1000,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  target_species_json TEXT NOT NULL DEFAULT '[]',
  config_json TEXT NOT NULL DEFAULT '{}',
  field_id TEXT,
  template_source_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_event_sessions_organizer
  ON observation_event_sessions (organizer_user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_sessions_active
  ON observation_event_sessions (started_at, ended_at);

CREATE TABLE IF NOT EXISTS observation_event_teams (
  team_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4f9d69',
  lead_user_id TEXT,
  target_taxa_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_event_teams_session
  ON observation_event_teams (session_id);

CREATE TABLE IF NOT EXISTS observation_event_participants (
  participant_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  guest_token TEXT,
  display_name TEXT NOT NULL DEFAULT '',
  team_id TEXT,
  role TEXT NOT NULL DEFAULT 'participant',
  declared_job TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  checked_in_at TEXT,
  share_location INTEGER NOT NULL DEFAULT 0,
  is_minor INTEGER NOT NULL DEFAULT 0,
  location_share_until TEXT,
  location_share_consent_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_event_participants_user_unique
  ON observation_event_participants (session_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_event_participants_guest_unique
  ON observation_event_participants (session_id, guest_token);

CREATE INDEX IF NOT EXISTS idx_obs_event_participants_team
  ON observation_event_participants (team_id);

CREATE TABLE IF NOT EXISTS observation_event_live_events (
  live_event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'all',
  actor_user_id TEXT,
  actor_guest_token TEXT,
  team_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_event_live_session_time
  ON observation_event_live_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_live_team
  ON observation_event_live_events (team_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_event_absences (
  absence_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT,
  guest_token TEXT,
  team_id TEXT,
  searched_taxon TEXT NOT NULL,
  searched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  effort_seconds INTEGER NOT NULL DEFAULT 0,
  public_lat REAL NOT NULL,
  public_lng REAL NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'searched',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_obs_event_absences_session
  ON observation_event_absences (session_id, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_absences_taxon
  ON observation_event_absences (searched_taxon);

CREATE TABLE IF NOT EXISTS observation_event_mesh_cells (
  mesh_cell_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  mesh_key TEXT NOT NULL,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  visit_seconds INTEGER NOT NULL DEFAULT 0,
  observation_count INTEGER NOT NULL DEFAULT 0,
  absence_count INTEGER NOT NULL DEFAULT 0,
  last_visited_at TEXT,
  visited_team_ids_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, mesh_key)
);

CREATE INDEX IF NOT EXISTS idx_obs_event_mesh_session_visit
  ON observation_event_mesh_cells (session_id, visit_seconds DESC);
