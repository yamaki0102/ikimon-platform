-- Observation-first expand migration for D1.
-- Existing record tables and readers remain authoritative. D1 enforces foreign keys for
-- every query and migration. Insert observations with a null accepted pointer first;
-- insert the accepted claim and set the pointer in one D1 batch when a human accepts it.

CREATE TABLE IF NOT EXISTS record_observations (
  observation_id TEXT PRIMARY KEY CHECK (length(observation_id) = 36 AND substr(observation_id,9,1) = '-' AND substr(observation_id,14,1) = '-' AND substr(observation_id,19,1) = '-' AND substr(observation_id,24,1) = '-' AND lower(replace(observation_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  record_runtime TEXT NOT NULL CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
  assertion_status TEXT NOT NULL DEFAULT 'provisional' CHECK (assertion_status IN ('provisional', 'human_asserted')),
  verification_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (verification_status IN ('unreviewed', 'owner_confirmed', 'community_review', 'disputed', 'verified')),
  lifecycle_status TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
  data_use_scope TEXT NOT NULL DEFAULT 'personal_only' CHECK (data_use_scope IN ('personal_only', 'community_observation', 'research_export')),
  data_use_consent_key TEXT,
  accepted_identification_id TEXT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('organism', 'group', 'trace', 'sound', 'unknown_subject')),
  individual_certainty TEXT NOT NULL DEFAULT 'unknown' CHECK (individual_certainty IN ('individual', 'group', 'unknown')),
  captive_context TEXT NOT NULL DEFAULT 'unknown' CHECK (captive_context IN ('wild', 'captive', 'cultivated', 'pet', 'unknown')),
  count_mode TEXT NOT NULL DEFAULT 'unknown' CHECK (count_mode IN ('exact', 'estimate', 'range', 'unknown')),
  count_value INTEGER,
  count_min INTEGER,
  count_max INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json) AND length(context_json) <= 65536),
  provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json) AND length(provenance_json) <= 65536),
  reviewed_by_actor_kind TEXT CHECK (reviewed_by_actor_kind IS NULL OR reviewed_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')),
  reviewed_by_actor_id TEXT,
  reviewed_at TEXT,
  excluded_reason TEXT,
  superseded_by_observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (record_runtime, record_id, source_key),
  CHECK ((count_value IS NULL OR count_value >= 0) AND (count_min IS NULL OR count_min >= 0) AND (count_max IS NULL OR count_max >= 0) AND (count_min IS NULL OR count_max IS NULL OR count_min <= count_max)),
  CHECK (count_mode <> 'exact' OR (count_value IS NOT NULL AND count_min IS NULL AND count_max IS NULL)),
  CHECK (count_mode <> 'range' OR (count_value IS NULL AND count_min IS NOT NULL AND count_max IS NOT NULL)),
  CHECK (NOT (assertion_status = 'human_asserted' OR verification_status IN ('owner_confirmed', 'community_review', 'verified') OR data_use_scope <> 'personal_only' OR accepted_identification_id IS NOT NULL) OR (reviewed_by_actor_kind IN ('owner', 'community_member', 'curator') AND reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (data_use_scope = 'personal_only' OR data_use_consent_key IS NOT NULL),
  CHECK ((lifecycle_status = 'active' AND excluded_reason IS NULL AND superseded_by_observation_id IS NULL) OR (lifecycle_status = 'excluded' AND excluded_reason IS NOT NULL AND superseded_by_observation_id IS NULL) OR (lifecycle_status = 'superseded' AND superseded_by_observation_id IS NOT NULL)),
  CHECK (superseded_by_observation_id IS NULL OR superseded_by_observation_id <> observation_id),
  FOREIGN KEY (observation_id, accepted_identification_id) REFERENCES observation_identification_claims(observation_id, identification_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_record_observations_record ON record_observations (record_runtime, record_id, lifecycle_status, display_order);
CREATE INDEX IF NOT EXISTS idx_record_observations_owner ON record_observations (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observations_unaccepted ON record_observations (verification_status, created_at) WHERE accepted_identification_id IS NULL AND lifecycle_status = 'active';

CREATE TABLE IF NOT EXISTS record_observation_policies (
  record_runtime TEXT NOT NULL CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'limited', 'private')),
  accepts_identification_proposals INTEGER NOT NULL DEFAULT 1 CHECK (accepts_identification_proposals IN (0, 1)),
  default_source TEXT NOT NULL DEFAULT 'visibility_default' CHECK (default_source IN ('visibility_default', 'owner_override', 'import')),
  updated_by_actor_id TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_runtime, record_id),
  CHECK (default_source = 'visibility_default' OR updated_by_actor_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_policies_owner ON record_observation_policies (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS record_observation_source_map (
  mapping_id TEXT PRIMARY KEY CHECK (length(mapping_id) = 36 AND substr(mapping_id,9,1) = '-' AND substr(mapping_id,14,1) = '-' AND substr(mapping_id,19,1) = '-' AND substr(mapping_id,24,1) = '-' AND lower(replace(mapping_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  source_runtime TEXT NOT NULL CHECK (source_runtime IN ('postgresql', 'cloudflare_d1', 'legacy_import', 'machine')),
  source_entity_kind TEXT NOT NULL CHECK (source_entity_kind IN ('visit', 'native_observation', 'occurrence', 'ai_review_target', 'identification', 'audio_detection', 'other')),
  source_entity_id TEXT NOT NULL,
  mapping_rule_version TEXT NOT NULL,
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  mapping_kind TEXT NOT NULL CHECK (mapping_kind IN ('primary', 'subject', 'candidate', 'compatibility_placeholder', 'merged', 'split_source')),
  mapping_confidence REAL CHECK (mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 1)),
  ambiguity_state TEXT NOT NULL DEFAULT 'clear' CHECK (ambiguity_state IN ('clear', 'needs_review', 'quarantined')),
  source_snapshot_hash TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json) AND length(provenance_json) <= 65536),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_runtime, source_entity_kind, source_entity_id, mapping_rule_version)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_source_lookup ON record_observation_source_map (source_runtime, source_entity_kind, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_record_observation_source_quarantine ON record_observation_source_map (ambiguity_state, created_at) WHERE ambiguity_state <> 'clear';

CREATE TABLE IF NOT EXISTS record_observation_media (
  link_id TEXT PRIMARY KEY CHECK (length(link_id) = 36 AND substr(link_id,9,1) = '-' AND substr(link_id,14,1) = '-' AND substr(link_id,19,1) = '-' AND substr(link_id,24,1) = '-' AND lower(replace(link_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  media_source_runtime TEXT NOT NULL,
  media_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary_evidence' CHECK (role IN ('primary_evidence', 'supporting_evidence', 'context', 'audio_evidence', 'trace_evidence', 'excluded')),
  locator_kind TEXT NOT NULL DEFAULT 'full' CHECK (locator_kind IN ('full', 'rect', 'polygon', 'frame_time', 'time_range', 'other')),
  locator_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(locator_json) AND length(locator_json) <= 16384),
  origin TEXT NOT NULL DEFAULT 'owner' CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  source_key TEXT NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json) AND length(provenance_json) <= 65536),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_media_media ON record_observation_media (media_source_runtime, media_id, active);

CREATE TABLE IF NOT EXISTS observation_ai_suggestions (
  suggestion_id TEXT PRIMARY KEY CHECK (length(suggestion_id) = 36 AND substr(suggestion_id,9,1) = '-' AND substr(suggestion_id,14,1) = '-' AND substr(suggestion_id,19,1) = '-' AND substr(suggestion_id,24,1) = '-' AND lower(replace(suggestion_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  ai_run_id TEXT,
  candidate_key TEXT NOT NULL,
  source_key TEXT NOT NULL,
  proposed_name TEXT,
  proposed_scientific_name TEXT,
  proposed_rank TEXT,
  taxon_ref TEXT,
  confidence_score REAL CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  rationale_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rationale_json) AND length(rationale_json) <= 65536),
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  input_provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_provenance_json) AND length(input_provenance_json) <= 65536),
  suggestion_status TEXT NOT NULL DEFAULT 'active' CHECK (suggestion_status IN ('active', 'rejected_by_owner', 'superseded', 'hidden')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_observation_ai_suggestions_observation ON observation_ai_suggestions (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_identification_claims (
  identification_id TEXT PRIMARY KEY CHECK (length(identification_id) = 36 AND substr(identification_id,9,1) = '-' AND substr(identification_id,14,1) = '-' AND substr(identification_id,19,1) = '-' AND substr(identification_id,24,1) = '-' AND lower(replace(identification_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  actor_id TEXT,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'import')),
  claim_status TEXT NOT NULL DEFAULT 'candidate' CHECK (claim_status IN ('candidate', 'accepted', 'rejected', 'withdrawn', 'superseded')),
  proposed_name TEXT NOT NULL,
  proposed_scientific_name TEXT,
  proposed_rank TEXT,
  accepted_name TEXT,
  accepted_rank TEXT,
  taxon_ref TEXT,
  confidence_score REAL CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  stance TEXT NOT NULL DEFAULT 'support' CHECK (stance IN ('support', 'alternative', 'not_organism', 'needs_more_evidence', 'context_only')),
  source_key TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(source_payload_json) AND length(source_payload_json) <= 65536),
  evidence_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_json) AND length(evidence_json) <= 65536),
  decision_reason TEXT,
  decided_by_actor_kind TEXT CHECK (decided_by_actor_kind IS NULL OR decided_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')),
  decided_by_actor_id TEXT,
  decided_at TEXT,
  supersedes_identification_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, identification_id),
  UNIQUE (observation_id, source_key),
  CHECK (actor_kind = 'import' OR actor_id IS NOT NULL),
  CHECK (claim_status <> 'accepted' OR (decided_by_actor_kind IN ('owner', 'community_member', 'curator') AND decided_by_actor_id IS NOT NULL AND decided_at IS NOT NULL)),
  FOREIGN KEY (observation_id, supersedes_identification_id) REFERENCES observation_identification_claims(observation_id, identification_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_observation ON observation_identification_claims (observation_id, claim_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_actor ON observation_identification_claims (observation_id, actor_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_identification_claims_accepted ON observation_identification_claims (observation_id) WHERE claim_status = 'accepted';

CREATE TABLE IF NOT EXISTS observation_lifecycle_events (
  event_id TEXT PRIMARY KEY CHECK (length(event_id) = 36 AND substr(event_id,9,1) = '-' AND substr(event_id,14,1) = '-' AND substr(event_id,19,1) = '-' AND substr(event_id,24,1) = '-' AND lower(replace(event_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('created', 'human_asserted', 'verification_changed', 'data_use_scope_changed', 'disputed', 'excluded', 'restored', 'split', 'merged', 'media_linked', 'media_unlinked', 'identification_changed', 'projection_changed')),
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'system', 'import')),
  actor_id TEXT,
  reason_code TEXT,
  before_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(before_json) AND length(before_json) <= 16384),
  after_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(after_json) AND length(after_json) <= 16384),
  related_observation_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(related_observation_ids_json) AND length(related_observation_ids_json) <= 16384),
  source_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (observation_id, event_id),
  UNIQUE (observation_id, source_key),
  CHECK (actor_kind IN ('system', 'import') OR actor_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_observation_lifecycle_events_observation ON observation_lifecycle_events (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_projection_versions (
  projection_id TEXT PRIMARY KEY CHECK (length(projection_id) = 36 AND substr(projection_id,9,1) = '-' AND substr(projection_id,14,1) = '-' AND substr(projection_id,19,1) = '-' AND substr(projection_id,24,1) = '-' AND lower(replace(projection_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  projection_version INTEGER NOT NULL,
  projection_state TEXT NOT NULL DEFAULT 'candidate' CHECK (projection_state IN ('candidate', 'active', 'inactive', 'rejected', 'revoked')),
  accepted_identification_id TEXT,
  basis_of_record TEXT NOT NULL,
  occurrence_status TEXT NOT NULL,
  individual_count INTEGER CHECK (individual_count IS NULL OR individual_count >= 0),
  rights_decision_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(rights_decision_json) AND length(rights_decision_json) <= 65536),
  privacy_decision_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(privacy_decision_json) AND length(privacy_decision_json) <= 65536),
  quality_decision_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(quality_decision_json) AND length(quality_decision_json) <= 65536),
  projection_rule_version TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  consent_event_id TEXT,
  human_provenance_actor_kind TEXT,
  human_provenance_actor_id TEXT,
  research_use_state TEXT NOT NULL DEFAULT 'not_evaluated' CHECK (research_use_state IN ('not_evaluated', 'blocked', 'eligible', 'revoked')),
  research_blockers_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(research_blockers_json) AND length(research_blockers_json) <= 16384),
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activated_at TEXT,
  deactivated_at TEXT,
  supersedes_projection_id TEXT REFERENCES occurrence_projection_versions(projection_id) ON DELETE RESTRICT,
  UNIQUE (observation_id, projection_version),
  UNIQUE (observation_id, projection_id),
  CHECK (projection_state <> 'active' OR (accepted_identification_id IS NOT NULL AND human_provenance_actor_kind IN ('owner', 'community_member', 'curator') AND human_provenance_actor_id IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK (projection_state <> 'active' OR (COALESCE(json_extract(rights_decision_json, '$.decision') = 'allow', 0) AND json_extract(rights_decision_json, '$.rule_version') IS NOT NULL AND COALESCE(json_extract(privacy_decision_json, '$.decision') IN ('generalized', 'hidden', 'not_applicable'), 0) AND json_extract(privacy_decision_json, '$.rule_version') IS NOT NULL AND COALESCE(json_extract(quality_decision_json, '$.decision') = 'eligible', 0) AND json_extract(quality_decision_json, '$.rule_version') IS NOT NULL)),
  CHECK (research_use_state <> 'eligible' OR (projection_state = 'active' AND consent_event_id IS NOT NULL)),
  FOREIGN KEY (observation_id, accepted_identification_id) REFERENCES observation_identification_claims(observation_id, identification_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (observation_id, consent_event_id) REFERENCES observation_lifecycle_events(observation_id, event_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_occurrence_projection_versions_observation ON occurrence_projection_versions (observation_id, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrence_projection_versions_active ON occurrence_projection_versions (observation_id) WHERE projection_state = 'active';

CREATE TABLE IF NOT EXISTS environment_assessments (
  assessment_id TEXT PRIMARY KEY CHECK (length(assessment_id) = 36 AND substr(assessment_id,9,1) = '-' AND substr(assessment_id,14,1) = '-' AND substr(assessment_id,19,1) = '-' AND substr(assessment_id,24,1) = '-' AND lower(replace(assessment_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  record_runtime TEXT CHECK (record_runtime IS NULL OR record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT,
  observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  media_source_runtime TEXT,
  media_id TEXT,
  place_id TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('ai', 'human', 'external', 'sensor', 'import', 'derived_rule')),
  assessment_state TEXT NOT NULL DEFAULT 'provisional' CHECK (assessment_state IN ('provisional', 'confirmed', 'rejected', 'superseded')),
  assessment_kind TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(value_json) AND length(value_json) <= 65536),
  confidence_score REAL CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  model_provider TEXT,
  model_name TEXT,
  model_version TEXT,
  prompt_version TEXT,
  rule_version TEXT,
  source_key TEXT NOT NULL,
  input_provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_provenance_json) AND length(input_provenance_json) <= 65536),
  reviewed_by_actor_kind TEXT CHECK (reviewed_by_actor_kind IS NULL OR reviewed_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')),
  reviewed_by_actor_id TEXT,
  reviewed_at TEXT,
  observed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_kind, source_key),
  CHECK (record_id IS NOT NULL OR observation_id IS NOT NULL OR media_id IS NOT NULL OR place_id IS NOT NULL),
  CHECK ((record_runtime IS NULL) = (record_id IS NULL)),
  CHECK (assessment_state <> 'confirmed' OR (reviewed_by_actor_kind IN ('owner', 'community_member', 'curator') AND reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_environment_assessments_record ON environment_assessments (record_runtime, record_id, assessment_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_place ON environment_assessments (place_id, assessment_kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_observation ON environment_assessments (observation_id, assessment_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS environment_assessment_media (
  link_id TEXT PRIMARY KEY CHECK (length(link_id) = 36 AND substr(link_id,9,1) = '-' AND substr(link_id,14,1) = '-' AND substr(link_id,19,1) = '-' AND substr(link_id,24,1) = '-' AND lower(replace(link_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  assessment_id TEXT NOT NULL REFERENCES environment_assessments(assessment_id) ON DELETE RESTRICT,
  media_source_runtime TEXT NOT NULL,
  media_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'input' CHECK (role IN ('input', 'evidence', 'context')),
  locator_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(locator_json) AND length(locator_json) <= 16384),
  source_key TEXT NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(provenance_json) AND length(provenance_json) <= 65536),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assessment_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessment_media_media ON environment_assessment_media (media_source_runtime, media_id);

CREATE TABLE IF NOT EXISTS record_observation_consistency_ledger (
  ledger_id TEXT PRIMARY KEY CHECK (length(ledger_id) = 36 AND substr(ledger_id,9,1) = '-' AND substr(ledger_id,14,1) = '-' AND substr(ledger_id,19,1) = '-' AND substr(ledger_id,24,1) = '-' AND lower(replace(ledger_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  operation_key TEXT NOT NULL UNIQUE,
  record_runtime TEXT NOT NULL CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  observation_id TEXT REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  operation_kind TEXT NOT NULL CHECK (operation_kind IN ('record_save', 'ai_analysis', 'human_edit', 'identification', 'media_reassign', 'backfill', 'projection')),
  legacy_write_refs_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(legacy_write_refs_json) AND length(legacy_write_refs_json) <= 16384),
  target_write_refs_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(target_write_refs_json) AND length(target_write_refs_json) <= 16384),
  source_digest TEXT NOT NULL,
  target_digest TEXT,
  consistency_state TEXT NOT NULL DEFAULT 'pending' CHECK (consistency_state IN ('pending', 'matched', 'mismatched', 'retryable', 'quarantined')),
  reason_codes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reason_codes_json) AND length(reason_codes_json) <= 16384),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0 AND attempt_count <= 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  CHECK ((consistency_state = 'matched' AND resolved_at IS NOT NULL AND target_digest IS NOT NULL) OR (consistency_state <> 'matched' AND resolved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_record ON record_observation_consistency_ledger (record_runtime, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_unresolved ON record_observation_consistency_ledger (consistency_state, created_at) WHERE consistency_state <> 'matched';

CREATE TABLE IF NOT EXISTS identification_queue_entries (
  queue_entry_id TEXT PRIMARY KEY CHECK (length(queue_entry_id) = 36 AND substr(queue_entry_id,9,1) = '-' AND substr(queue_entry_id,14,1) = '-' AND substr(queue_entry_id,19,1) = '-' AND substr(queue_entry_id,24,1) = '-' AND lower(replace(queue_entry_id,'-','')) NOT GLOB '*[^0-9a-f]*'),
  observation_id TEXT NOT NULL UNIQUE REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
  queue_state TEXT NOT NULL DEFAULT 'queued' CHECK (queue_state IN ('queued', 'claimed', 'resolved', 'suppressed')),
  score REAL NOT NULL DEFAULT 0,
  reason_codes_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(reason_codes_json) AND length(reason_codes_json) <= 16384),
  score_components_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(score_components_json) AND length(score_components_json) <= 16384),
  target_taxon_hint TEXT,
  target_region_hint TEXT,
  evidence_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(evidence_summary_json) AND length(evidence_summary_json) <= 16384),
  consensus_summary_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(consensus_summary_json) AND length(consensus_summary_json) <= 16384),
  scoring_rule_version TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  assigned_actor_id TEXT,
  eligible_after TEXT,
  calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_identification_queue_priority ON identification_queue_entries (queue_state, score DESC, calculated_at);

-- Validation triggers guard only the new expand tables and do not change legacy writes.
CREATE TRIGGER IF NOT EXISTS trg_record_observations_accepted_claim_guard_insert
BEFORE INSERT ON record_observations
WHEN NEW.accepted_identification_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM observation_identification_claims claim
  WHERE claim.observation_id = NEW.observation_id
    AND claim.identification_id = NEW.accepted_identification_id
    AND claim.claim_status = 'accepted'
    AND claim.decided_by_actor_kind IN ('owner', 'community_member', 'curator')
    AND claim.decided_by_actor_id IS NOT NULL AND claim.decided_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'accepted identification must be an accepted human claim for the same observation');
END;

CREATE TRIGGER IF NOT EXISTS trg_record_observations_accepted_claim_guard_update
BEFORE UPDATE OF accepted_identification_id ON record_observations
WHEN NEW.accepted_identification_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM observation_identification_claims claim
  WHERE claim.observation_id = NEW.observation_id
    AND claim.identification_id = NEW.accepted_identification_id
    AND claim.claim_status = 'accepted'
    AND claim.decided_by_actor_kind IN ('owner', 'community_member', 'curator')
    AND claim.decided_by_actor_id IS NOT NULL AND claim.decided_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'accepted identification must be an accepted human claim for the same observation');
END;

CREATE TRIGGER IF NOT EXISTS trg_occurrence_projection_active_guard_insert
BEFORE INSERT ON occurrence_projection_versions
WHEN NEW.projection_state = 'active' AND NOT EXISTS (
  SELECT 1 FROM record_observations observation
  JOIN observation_identification_claims claim
    ON claim.observation_id = observation.observation_id
   AND claim.identification_id = NEW.accepted_identification_id
  WHERE observation.observation_id = NEW.observation_id
    AND observation.assertion_status = 'human_asserted'
    AND observation.lifecycle_status = 'active'
    AND observation.verification_status NOT IN ('unreviewed', 'disputed')
    AND observation.accepted_identification_id = NEW.accepted_identification_id
    AND claim.claim_status = 'accepted'
    AND claim.decided_by_actor_kind IN ('owner', 'community_member', 'curator')
    AND claim.decided_by_actor_id IS NOT NULL AND claim.decided_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'active projection requires an active human-asserted observation and its accepted human claim');
END;

CREATE TRIGGER IF NOT EXISTS trg_occurrence_projection_active_guard_update
BEFORE UPDATE ON occurrence_projection_versions
WHEN NEW.projection_state = 'active' AND NOT EXISTS (
  SELECT 1 FROM record_observations observation
  JOIN observation_identification_claims claim
    ON claim.observation_id = observation.observation_id
   AND claim.identification_id = NEW.accepted_identification_id
  WHERE observation.observation_id = NEW.observation_id
    AND observation.assertion_status = 'human_asserted'
    AND observation.lifecycle_status = 'active'
    AND observation.verification_status NOT IN ('unreviewed', 'disputed')
    AND observation.accepted_identification_id = NEW.accepted_identification_id
    AND claim.claim_status = 'accepted'
    AND claim.decided_by_actor_kind IN ('owner', 'community_member', 'curator')
    AND claim.decided_by_actor_id IS NOT NULL AND claim.decided_at IS NOT NULL
)
BEGIN
  SELECT RAISE(ABORT, 'active projection requires an active human-asserted observation and its accepted human claim');
END;

CREATE TRIGGER IF NOT EXISTS trg_record_observations_active_projection_guard
BEFORE UPDATE OF assertion_status, lifecycle_status, verification_status, accepted_identification_id ON record_observations
WHEN EXISTS (SELECT 1 FROM occurrence_projection_versions projection WHERE projection.observation_id = NEW.observation_id AND projection.projection_state = 'active')
 AND (NEW.assertion_status <> 'human_asserted' OR NEW.lifecycle_status <> 'active' OR NEW.verification_status IN ('unreviewed', 'disputed') OR NEW.accepted_identification_id IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'deactivate the occurrence projection before making its observation ineligible');
END;

CREATE TRIGGER IF NOT EXISTS trg_identification_accepted_claim_guard
BEFORE UPDATE OF claim_status ON observation_identification_claims
WHEN OLD.claim_status = 'accepted' AND NEW.claim_status <> 'accepted' AND (
  EXISTS (SELECT 1 FROM record_observations observation WHERE observation.accepted_identification_id = OLD.identification_id) OR
  EXISTS (SELECT 1 FROM occurrence_projection_versions projection WHERE projection.accepted_identification_id = OLD.identification_id AND projection.projection_state = 'active')
)
BEGIN
  SELECT RAISE(ABORT, 'clear accepted pointers and deactivate projections before changing accepted claim status');
END;
