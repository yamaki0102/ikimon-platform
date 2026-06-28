CREATE TABLE IF NOT EXISTS observation_specialist_reviews (
  review_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  lane TEXT NOT NULL CHECK (lane IN ('default', 'public-claim', 'expert-lane', 'review-queue')),
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'note')),
  proposed_name TEXT,
  proposed_rank TEXT,
  accepted_rank TEXT,
  notes TEXT,
  review_class TEXT NOT NULL CHECK (review_class IN ('specialist_review', 'authority_backed')),
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(occurrence_id, actor_user_id, lane)
);

CREATE INDEX IF NOT EXISTS idx_observation_specialist_reviews_occurrence
  ON observation_specialist_reviews(occurrence_id, decision, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_observation_specialist_reviews_actor
  ON observation_specialist_reviews(actor_user_id, updated_at DESC);
