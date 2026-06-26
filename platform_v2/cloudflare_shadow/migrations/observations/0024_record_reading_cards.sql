CREATE TABLE IF NOT EXISTS record_reading_cards (
  card_id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL,
  axis TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'owner_only',
  generation_condition_json TEXT NOT NULL DEFAULT '{}',
  quality_gate_json TEXT NOT NULL DEFAULT '{}',
  model_version TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(visit_id, axis)
);

CREATE INDEX IF NOT EXISTS idx_record_reading_cards_visit
  ON record_reading_cards (visit_id, visibility);

CREATE INDEX IF NOT EXISTS idx_record_reading_cards_creator
  ON record_reading_cards (created_by_user_id, updated_at);
