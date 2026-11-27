-- Pre-generated & reviewed species reader layers (こども / おや / せんせい).
-- Additive only: no DROP, DELETE, or unconditional UPDATE.

CREATE TABLE IF NOT EXISTS species_reader_layers (
  species_key TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  scientific_name TEXT,
  taxon_group TEXT NOT NULL DEFAULT 'generic',
  invasive_category TEXT,
  child_text TEXT NOT NULL,
  parent_text TEXT NOT NULL,
  teacher_text TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending_review',
  validation_flags_json TEXT NOT NULL DEFAULT '[]',
  model_name TEXT,
  prompt_tokens INTEGER,
  output_tokens INTEGER,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_species_reader_layers_status
  ON species_reader_layers(review_status, canonical_name);
