CREATE TABLE IF NOT EXISTS civic_observation_contexts (
  context_id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL UNIQUE,
  occurrence_id TEXT,
  context_kind TEXT NOT NULL DEFAULT 'ordinary',
  activity_label TEXT,
  activity_intent TEXT,
  participant_role TEXT,
  audience_scope TEXT NOT NULL DEFAULT 'private',
  public_precision TEXT NOT NULL DEFAULT 'municipality',
  risk_lane TEXT NOT NULL DEFAULT 'normal',
  report_consent TEXT NOT NULL DEFAULT 'none',
  revisit_of_visit_id TEXT,
  field_id TEXT,
  route_id TEXT,
  plot_id TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_visit
  ON civic_observation_contexts (visit_id);

CREATE INDEX IF NOT EXISTS idx_civic_observation_contexts_risk
  ON civic_observation_contexts (risk_lane, updated_at);
