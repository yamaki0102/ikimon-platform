CREATE TABLE IF NOT EXISTS record_observations (
  observation_id TEXT PRIMARY KEY CHECK (observation_id GLOB '????????-????-????-????-????????????'),
  record_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
  assertion_status TEXT NOT NULL DEFAULT 'provisional' CHECK (assertion_status IN ('provisional', 'human_asserted')),
  verification_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (verification_status IN ('unreviewed', 'owner_confirmed', 'community_review', 'disputed', 'verified')),
  lifecycle_status TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
  data_use_scope TEXT NOT NULL DEFAULT 'personal_only' CHECK (data_use_scope IN ('personal_only', 'community_observation', 'research_export')),
  accepted_identification_id TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('organism', 'group', 'trace', 'sound', 'unknown_subject')),
  individual_certainty TEXT NOT NULL DEFAULT 'unknown' CHECK (individual_certainty IN ('individual', 'group', 'unknown')),
  context_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_record_observations_record
  ON record_observations (record_id, lifecycle_status, created_at);
CREATE INDEX IF NOT EXISTS idx_record_observations_owner
  ON record_observations (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observations_unaccepted
  ON record_observations (verification_status, created_at)
  WHERE accepted_identification_id IS NULL AND lifecycle_status = 'active';

CREATE TABLE IF NOT EXISTS record_observation_policies (
  record_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'limited', 'private')),
  external_proposals_enabled INTEGER NOT NULL DEFAULT 1 CHECK (external_proposals_enabled IN (0, 1)),
  policy_version TEXT NOT NULL DEFAULT 'record_observation_policy/v1',
  updated_by_user_id TEXT,
  change_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_record_observation_policies_owner
  ON record_observation_policies (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS record_observation_source_map (
  mapping_id TEXT PRIMARY KEY CHECK (mapping_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version TEXT,
  mapping_kind TEXT NOT NULL CHECK (mapping_kind IN ('created_from', 'derived_from', 'dual_write', 'backfill')),
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, source_system, source_entity_type, source_id, mapping_kind)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_source_lookup
  ON record_observation_source_map (source_system, source_entity_type, source_id);

CREATE TABLE IF NOT EXISTS record_observation_media (
  link_id TEXT PRIMARY KEY CHECK (link_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  media_role TEXT NOT NULL DEFAULT 'evidence' CHECK (media_role IN ('evidence', 'context', 'audio', 'video_frame')),
  locator_key TEXT NOT NULL DEFAULT 'full',
  subject_locator TEXT NOT NULL DEFAULT '{}',
  source_kind TEXT NOT NULL DEFAULT 'owner' CHECK (source_kind IN ('owner', 'ai', 'community', 'import', 'system')),
  confidence_score REAL,
  lifecycle_status TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, media_id, locator_key)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_media_media
  ON record_observation_media (media_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS observation_ai_suggestions (
  suggestion_id TEXT PRIMARY KEY CHECK (suggestion_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  ai_run_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  candidate_key TEXT NOT NULL,
  proposed_name TEXT,
  proposed_scientific_name TEXT,
  proposed_rank TEXT,
  taxon_key TEXT,
  confidence_score REAL,
  rationale_json TEXT NOT NULL DEFAULT '{}',
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  rule_version TEXT NOT NULL DEFAULT '',
  input_fingerprint TEXT NOT NULL,
  input_provenance TEXT NOT NULL DEFAULT '{}',
  suggestion_status TEXT NOT NULL DEFAULT 'proposed' CHECK (suggestion_status IN ('proposed', 'adopted', 'rejected', 'superseded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_ai_suggestions_observation
  ON observation_ai_suggestions (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_identification_claims (
  identification_id TEXT PRIMARY KEY CHECK (identification_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  actor_user_id TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'import')),
  proposed_name TEXT NOT NULL,
  proposed_scientific_name TEXT,
  proposed_rank TEXT,
  taxon_key TEXT,
  stance TEXT NOT NULL DEFAULT 'support' CHECK (stance IN ('support', 'disagree')),
  claim_status TEXT NOT NULL DEFAULT 'candidate' CHECK (claim_status IN ('candidate', 'accepted', 'rejected', 'withdrawn')),
  confidence_score REAL,
  rationale_json TEXT NOT NULL DEFAULT '{}',
  source_key TEXT NOT NULL UNIQUE,
  supersedes_identification_id TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (actor_kind = 'import' OR actor_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_observation
  ON observation_identification_claims (observation_id, claim_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_actor
  ON observation_identification_claims (observation_id, actor_user_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_identification_claims_accepted
  ON observation_identification_claims (observation_id)
  WHERE claim_status = 'accepted';

CREATE TABLE IF NOT EXISTS observation_lifecycle_events (
  event_id TEXT PRIMARY KEY CHECK (event_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'system', 'import')),
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  previous_state TEXT NOT NULL DEFAULT '{}',
  next_state TEXT NOT NULL DEFAULT '{}',
  reason_code TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_observation_lifecycle_events_observation
  ON observation_lifecycle_events (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_projection_versions (
  projection_version_id TEXT PRIMARY KEY CHECK (projection_version_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  occurrence_id TEXT,
  projection_status TEXT NOT NULL DEFAULT 'pending' CHECK (projection_status IN ('pending', 'active', 'blocked', 'superseded', 'revoked')),
  projection_version TEXT NOT NULL,
  source_fingerprint TEXT NOT NULL,
  accepted_identification_id TEXT,
  privacy_rule_version TEXT NOT NULL,
  quality_rule_version TEXT NOT NULL,
  eligibility_json TEXT NOT NULL DEFAULT '{}',
  projected_payload TEXT NOT NULL DEFAULT '{}',
  blocked_reason TEXT,
  projected_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, source_fingerprint, projection_version)
);

CREATE INDEX IF NOT EXISTS idx_occurrence_projection_versions_observation
  ON occurrence_projection_versions (observation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrence_projection_versions_active
  ON occurrence_projection_versions (observation_id)
  WHERE projection_status = 'active';

CREATE TABLE IF NOT EXISTS environment_assessments (
  assessment_id TEXT PRIMARY KEY CHECK (assessment_id GLOB '????????-????-????-????-????????????'),
  record_id TEXT,
  observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE SET NULL,
  media_id TEXT,
  place_id TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('ai', 'external', 'sensor', 'human')),
  assessment_status TEXT NOT NULL DEFAULT 'provisional' CHECK (assessment_status IN ('provisional', 'confirmed', 'rejected', 'superseded')),
  category TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}',
  confidence_score REAL,
  model_name TEXT NOT NULL DEFAULT '',
  model_version TEXT NOT NULL DEFAULT '',
  prompt_version TEXT NOT NULL DEFAULT '',
  rule_version TEXT NOT NULL DEFAULT '',
  input_fingerprint TEXT NOT NULL,
  input_provenance TEXT NOT NULL DEFAULT '{}',
  observed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (record_id IS NOT NULL OR observation_id IS NOT NULL OR media_id IS NOT NULL OR place_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessments_record
  ON environment_assessments (record_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_place
  ON environment_assessments (place_id, category, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_observation
  ON environment_assessments (observation_id, category, created_at DESC);

CREATE TABLE IF NOT EXISTS environment_assessment_media (
  assessment_id TEXT NOT NULL REFERENCES environment_assessments(assessment_id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  relation_role TEXT NOT NULL DEFAULT 'input' CHECK (relation_role IN ('input', 'evidence', 'context')),
  subject_locator TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (assessment_id, media_id, relation_role)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessment_media_media
  ON environment_assessment_media (media_id);

CREATE TABLE IF NOT EXISTS record_observation_consistency_ledger (
  ledger_id TEXT PRIMARY KEY CHECK (ledger_id GLOB '????????-????-????-????-????????????'),
  ledger_key TEXT NOT NULL UNIQUE,
  record_id TEXT NOT NULL,
  observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE SET NULL,
  operation_key TEXT NOT NULL,
  old_write_status TEXT NOT NULL CHECK (old_write_status IN ('pending', 'succeeded', 'failed', 'skipped')),
  new_write_status TEXT NOT NULL CHECK (new_write_status IN ('pending', 'succeeded', 'failed', 'skipped')),
  source_ref TEXT,
  target_ref TEXT,
  source_checksum TEXT,
  target_checksum TEXT,
  difference_code TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_record
  ON record_observation_consistency_ledger (record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_unresolved
  ON record_observation_consistency_ledger (difference_code, created_at)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS identification_queue_entries (
  queue_entry_id TEXT PRIMARY KEY CHECK (queue_entry_id GLOB '????????-????-????-????-????????????'),
  observation_id TEXT NOT NULL UNIQUE REFERENCES record_observations(observation_id) ON DELETE CASCADE,
  queue_status TEXT NOT NULL DEFAULT 'queued' CHECK (queue_status IN ('queued', 'claimed', 'resolved', 'suppressed')),
  priority_score REAL NOT NULL DEFAULT 0,
  priority_components TEXT NOT NULL DEFAULT '{}',
  target_taxon_group TEXT,
  specialist_match_json TEXT NOT NULL DEFAULT '{}',
  assigned_user_id TEXT,
  eligible_after TEXT,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_identification_queue_priority
  ON identification_queue_entries (queue_status, priority_score DESC, calculated_at);
