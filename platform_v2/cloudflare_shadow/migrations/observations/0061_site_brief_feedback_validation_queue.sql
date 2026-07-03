CREATE TABLE IF NOT EXISTS site_brief_feedback_validations (
  feedback_id TEXT PRIMARY KEY REFERENCES site_brief_feedback_events(feedback_id),
  artifact_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  validation_status TEXT NOT NULL DEFAULT 'open'
    CHECK (validation_status IN ('open', 'validated', 'deferred', 'dismissed')),
  sales_decision_note TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT 'none'
    CHECK (next_action IN ('none', 'follow_up', 'prepare_pitch', 'revise_brief', 'suppress_brief', 'ask_correction', 'mark_learned')),
  validated_by_user_id TEXT,
  validated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_brief_feedback_validations_status
  ON site_brief_feedback_validations(validation_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_site_brief_feedback_validations_place
  ON site_brief_feedback_validations(place_id, validation_status, updated_at);
