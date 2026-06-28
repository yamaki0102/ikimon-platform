CREATE TABLE IF NOT EXISTS guide_unlocks (
  user_id TEXT NOT NULL,
  guide_spot_id TEXT NOT NULL,
  program_id TEXT,
  source_visit_id TEXT,
  source_occurrence_id TEXT,
  unlock_method TEXT NOT NULL DEFAULT 'nearby_record',
  visibility_status TEXT NOT NULL DEFAULT 'private',
  location_basis TEXT NOT NULL DEFAULT 'visit_location',
  capture_accuracy_m REAL,
  distance_band TEXT NOT NULL DEFAULT 'area',
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  first_unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_listened_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, guide_spot_id)
);

CREATE INDEX IF NOT EXISTS idx_guide_unlocks_program
  ON guide_unlocks (program_id, last_unlocked_at);

CREATE TABLE IF NOT EXISTS guide_interactions (
  interaction_id TEXT PRIMARY KEY,
  guide_record_id TEXT,
  hypothesis_id TEXT,
  user_id TEXT,
  session_id TEXT NOT NULL DEFAULT '',
  interaction_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_interactions_type
  ON guide_interactions (interaction_type, occurred_at);

CREATE TABLE IF NOT EXISTS guide_environment_mesh_cells (
  mesh_key TEXT PRIMARY KEY,
  center_lat REAL NOT NULL,
  center_lng REAL NOT NULL,
  guide_record_count INTEGER NOT NULL DEFAULT 0,
  contributor_hashes_json TEXT NOT NULL DEFAULT '[]',
  contributor_count INTEGER NOT NULL DEFAULT 0,
  vegetation_counts_json TEXT NOT NULL DEFAULT '{}',
  landform_counts_json TEXT NOT NULL DEFAULT '{}',
  structure_counts_json TEXT NOT NULL DEFAULT '{}',
  sound_counts_json TEXT NOT NULL DEFAULT '{}',
  sample_record_ids_json TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT,
  last_seen_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_environment_mesh_public
  ON guide_environment_mesh_cells (guide_record_count, contributor_count, last_seen_at);

CREATE TABLE IF NOT EXISTS regional_hypotheses (
  hypothesis_id TEXT PRIMARY KEY,
  mesh_key TEXT,
  place_id TEXT,
  claim_type TEXT NOT NULL,
  hypothesis_text TEXT NOT NULL,
  what_we_can_say TEXT NOT NULL,
  supporting_observation_ids_json TEXT NOT NULL DEFAULT '[]',
  supporting_guide_record_ids_json TEXT NOT NULL DEFAULT '[]',
  supporting_knowledge_card_ids_json TEXT NOT NULL DEFAULT '[]',
  supporting_claim_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0,
  bias_warnings_json TEXT NOT NULL DEFAULT '[]',
  missing_data_json TEXT NOT NULL DEFAULT '[]',
  next_sampling_protocol TEXT NOT NULL DEFAULT '',
  source_fingerprint TEXT NOT NULL UNIQUE,
  review_status TEXT NOT NULL DEFAULT 'auto',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regional_hypotheses_public
  ON regional_hypotheses (review_status, confidence, generated_at);

CREATE TABLE IF NOT EXISTS guide_environment_refresh_runs (
  run_id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  diagnosis_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  mesh_rebuild_needed INTEGER NOT NULL DEFAULT 0,
  rebuild_action TEXT NOT NULL DEFAULT '',
  guide_record_count INTEGER NOT NULL DEFAULT 0,
  aggregatable_guide_records INTEGER NOT NULL DEFAULT 0,
  public_mesh_cell_count INTEGER NOT NULL DEFAULT 0,
  suppressed_mesh_cell_count INTEGER NOT NULL DEFAULT 0,
  hypotheses_generated INTEGER NOT NULL DEFAULT 0,
  hypotheses_written INTEGER NOT NULL DEFAULT 0,
  eval_items_count INTEGER NOT NULL DEFAULT 0,
  prompt_improvements_written INTEGER NOT NULL DEFAULT 0,
  run_payload_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS guide_record_corrections (
  correction_id TEXT PRIMARY KEY,
  guide_record_id TEXT NOT NULL,
  user_id TEXT,
  correction_kind TEXT NOT NULL,
  original_payload_json TEXT NOT NULL DEFAULT '{}',
  corrected_payload_json TEXT NOT NULL DEFAULT '{}',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_record_corrections_record
  ON guide_record_corrections (guide_record_id, created_at);

CREATE TABLE IF NOT EXISTS guide_programs (
  program_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  owner_type TEXT NOT NULL DEFAULT 'community',
  participation_mode TEXT NOT NULL DEFAULT 'any_order',
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT,
  ends_at TEXT,
  public_summary TEXT,
  safety_policy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_programs_public
  ON guide_programs (status, owner_type, updated_at);

CREATE TABLE IF NOT EXISTS guide_program_spots (
  program_id TEXT NOT NULL,
  guide_spot_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  required_for_completion INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (program_id, guide_spot_id)
);

CREATE TABLE IF NOT EXISTS guide_program_audit (
  audit_id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  before_payload_json TEXT NOT NULL DEFAULT '{}',
  after_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guide_hypothesis_prompt_improvements (
  improvement_id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  improvement_type TEXT NOT NULL,
  label TEXT NOT NULL,
  claim_type TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  prompt_patch TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  support_count INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'auto',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guide_prompt_improvements_review
  ON guide_hypothesis_prompt_improvements (review_status, support_count, generated_at);

CREATE TABLE IF NOT EXISTS guide_hypothesis_prompt_improvement_queue (
  queue_id TEXT PRIMARY KEY,
  claim_type TEXT NOT NULL,
  trigger TEXT NOT NULL,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  threshold_count INTEGER NOT NULL DEFAULT 3,
  queue_status TEXT NOT NULL DEFAULT 'open',
  improvement_ids_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (claim_type, trigger)
);

CREATE INDEX IF NOT EXISTS idx_guide_prompt_queue_open
  ON guide_hypothesis_prompt_improvement_queue (queue_status, wrong_count, last_seen_at);
