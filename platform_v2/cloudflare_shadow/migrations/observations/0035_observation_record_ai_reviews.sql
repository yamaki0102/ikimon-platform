CREATE TABLE IF NOT EXISTS observation_ai_review_targets (
  occurrence_id TEXT PRIMARY KEY,
  ai_assessment_status TEXT NOT NULL DEFAULT 'ai_judgement',
  scientific_name TEXT,
  vernacular_name TEXT,
  taxon_rank TEXT,
  ai_run_id TEXT,
  candidate_id TEXT,
  candidate_scientific_name TEXT,
  candidate_vernacular_name TEXT,
  candidate_taxon_rank TEXT,
  ai_recommended_taxon_name TEXT,
  ai_recommended_rank TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS observation_record_ai_reviews (
  review_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  ai_run_id TEXT,
  candidate_id TEXT,
  actor_user_id TEXT NOT NULL,
  review_state TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (occurrence_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_observation_record_ai_reviews_occurrence
  ON observation_record_ai_reviews (occurrence_id, review_state, updated_at);

CREATE INDEX IF NOT EXISTS idx_observation_record_ai_reviews_actor
  ON observation_record_ai_reviews (actor_user_id, updated_at);
