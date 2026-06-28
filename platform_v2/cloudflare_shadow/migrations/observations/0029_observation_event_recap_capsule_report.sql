CREATE TABLE IF NOT EXISTS observation_event_quests (
  quest_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  team_id TEXT,
  participant_id TEXT,
  status TEXT NOT NULL DEFAULT 'offered',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_event_quests_session_status
  ON observation_event_quests(session_id, status);

CREATE INDEX IF NOT EXISTS idx_observation_event_quests_team
  ON observation_event_quests(session_id, team_id, status);

CREATE TABLE IF NOT EXISTS observation_event_recap_views (
  view_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  viewer_user_id TEXT,
  viewer_guest_token TEXT,
  viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_event_recap_views_session
  ON observation_event_recap_views(session_id, viewed_at);

CREATE TABLE IF NOT EXISTS observation_impact_records (
  impact_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  impact_type TEXT NOT NULL,
  description TEXT NOT NULL,
  external_ref TEXT,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_impact_records_session
  ON observation_impact_records(session_id, recorded_at);

CREATE TABLE IF NOT EXISTS observation_event_capsules (
  capsule_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  source_counts_json TEXT NOT NULL DEFAULT '{}',
  source_clusters_json TEXT NOT NULL DEFAULT '{}',
  private_digest_json TEXT NOT NULL DEFAULT '{}',
  public_story_draft_json TEXT NOT NULL DEFAULT '{}',
  record_candidates_json TEXT NOT NULL DEFAULT '[]',
  privacy_risk_queue_json TEXT NOT NULL DEFAULT '[]',
  readiness_json TEXT NOT NULL DEFAULT '{}',
  source_hash TEXT NOT NULL DEFAULT '',
  model_metadata_json TEXT NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'draft',
  generated_by TEXT,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_event_capsules_status
  ON observation_event_capsules(review_status, updated_at);
