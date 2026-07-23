-- Universal Place Atlas D1 projection. Expand-first and default-off.

CREATE TABLE IF NOT EXISTS places (
  place_id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  canonical_name_normalized TEXT NOT NULL,
  locality_label TEXT,
  place_kind TEXT NOT NULL DEFAULT 'other_named_area',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  public_profile_status TEXT NOT NULL DEFAULT 'draft',
  official_status TEXT NOT NULL DEFAULT 'unofficial',
  public_summary TEXT,
  country_code TEXT NOT NULL DEFAULT 'JP',
  prefecture TEXT,
  municipality TEXT,
  public_cell TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  superseded_by_place_id TEXT,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_name
  ON places(canonical_name_normalized);

CREATE INDEX IF NOT EXISTS idx_places_kind_profile
  ON places(place_kind, public_profile_status, superseded_by_place_id);

CREATE TABLE IF NOT EXISTS place_aliases (
  alias_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  language_code TEXT,
  alias_kind TEXT NOT NULL DEFAULT 'alternate',
  source_type TEXT NOT NULL,
  source_reference_id TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(place_id, alias_normalized, alias_kind)
);

CREATE INDEX IF NOT EXISTS idx_place_aliases_search
  ON place_aliases(alias_normalized, place_id);

CREATE TABLE IF NOT EXISTS place_source_references (
  source_reference_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  source_confidence REAL NOT NULL DEFAULT 0.5,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  precedence_rank INTEGER NOT NULL DEFAULT 100,
  observed_at TEXT,
  last_checked_at TEXT,
  valid_from TEXT,
  valid_to TEXT,
  superseded_by_source_reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_place_source_references_place
  ON place_source_references(place_id, precedence_rank, source_confidence);

CREATE TABLE IF NOT EXISTS place_boundaries (
  boundary_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  boundary_kind TEXT NOT NULL DEFAULT 'primary',
  geometry_kind TEXT NOT NULL,
  boundary_geojson TEXT NOT NULL,
  source_reference_id TEXT,
  source_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  precision_kind TEXT NOT NULL DEFAULT 'exact',
  valid_from TEXT,
  valid_to TEXT,
  boundary_version INTEGER NOT NULL DEFAULT 1,
  superseded_by_boundary_id TEXT,
  validation_state TEXT NOT NULL DEFAULT 'unverified',
  validation_details_json TEXT NOT NULL DEFAULT '{}',
  is_primary INTEGER NOT NULL DEFAULT 0,
  bbox_west REAL,
  bbox_south REAL,
  bbox_east REAL,
  bbox_north REAL,
  area_ha REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_place_boundaries_bbox
  ON place_boundaries(bbox_west, bbox_east, bbox_south, bbox_north);

CREATE INDEX IF NOT EXISTS idx_place_boundaries_place
  ON place_boundaries(place_id, is_primary, valid_to, superseded_by_boundary_id);

CREATE TABLE IF NOT EXISTS place_relationships (
  relationship_id TEXT PRIMARY KEY,
  subject_place_id TEXT NOT NULL,
  object_place_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  source_reference_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(subject_place_id <> object_place_id),
  UNIQUE(subject_place_id, object_place_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_place_relationships_object
  ON place_relationships(object_place_id, relationship_type);

CREATE TABLE IF NOT EXISTS record_place_memberships (
  membership_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  membership_type TEXT NOT NULL,
  membership_state TEXT NOT NULL DEFAULT 'candidate',
  derivation_source TEXT NOT NULL,
  derivation_details_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 0.5,
  internal_precision TEXT NOT NULL DEFAULT 'exact_point',
  public_precision TEXT NOT NULL DEFAULT 'place',
  is_primary INTEGER NOT NULL DEFAULT 0,
  reviewed_state TEXT NOT NULL DEFAULT 'unreviewed',
  calculation_version TEXT NOT NULL,
  removed_at TEXT,
  corrected_by_membership_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_id, place_id, calculation_version)
);

CREATE INDEX IF NOT EXISTS idx_record_place_memberships_place
  ON record_place_memberships(place_id, membership_state, is_primary, removed_at);

CREATE INDEX IF NOT EXISTS idx_record_place_memberships_record
  ON record_place_memberships(record_id, membership_state, removed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_record_place_memberships_primary
  ON record_place_memberships(record_id, calculation_version)
  WHERE is_primary = 1 AND membership_state = 'confirmed' AND removed_at IS NULL;

CREATE TABLE IF NOT EXISTS record_theme_assertions (
  theme_assertion_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  assertion_source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  assertion_status TEXT NOT NULL DEFAULT 'provisional',
  rule_version TEXT,
  model_name TEXT,
  prompt_version TEXT,
  input_provenance_json TEXT NOT NULL DEFAULT '{}',
  supersedes_assertion_id TEXT,
  corrected_at TEXT,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_id, theme, assertion_source, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_record_theme_assertions_record
  ON record_theme_assertions(record_id, assertion_status, theme);

CREATE TABLE IF NOT EXISTS place_policies (
  place_policy_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  place_visibility TEXT NOT NULL DEFAULT 'public',
  recording_policy TEXT NOT NULL DEFAULT 'unknown',
  photography_rule_status TEXT NOT NULL DEFAULT 'unknown',
  public_location_mode TEXT NOT NULL DEFAULT 'place',
  contribution_cta_mode TEXT NOT NULL DEFAULT 'check_rules',
  official_rule_url TEXT,
  verification_source_reference_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  last_checked_at TEXT,
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_place_policies_place
  ON place_policies(place_id, valid_to);

CREATE TABLE IF NOT EXISTS place_facilities (
  place_facility_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  facility_kind TEXT NOT NULL,
  label TEXT,
  availability_status TEXT NOT NULL DEFAULT 'reported',
  source_reference_id TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  last_checked_at TEXT,
  valid_from TEXT,
  valid_to TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(place_id, facility_kind, source_reference_id)
);

CREATE TABLE IF NOT EXISTS place_content_items (
  place_content_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  content_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  content_status TEXT NOT NULL DEFAULT 'draft',
  source_reference_id TEXT,
  user_memory_entry_id TEXT,
  starts_at TEXT,
  ends_at TEXT,
  last_checked_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_place_content_items_public
  ON place_content_items(place_id, content_status, content_kind, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS place_correction_proposals (
  proposal_id TEXT PRIMARY KEY,
  place_id TEXT,
  proposer_user_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL,
  proposed_payload_json TEXT NOT NULL,
  proposal_status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by_user_id TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_place_correction_proposals_queue
  ON place_correction_proposals(proposal_status, created_at);

CREATE TABLE IF NOT EXISTS place_merge_audit (
  merge_audit_id TEXT PRIMARY KEY,
  surviving_place_id TEXT NOT NULL,
  merged_place_id TEXT NOT NULL,
  decision_source_reference_id TEXT,
  decision_reason TEXT NOT NULL,
  decided_by_user_id TEXT,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rollback_payload_json TEXT NOT NULL DEFAULT '{}',
  CHECK(surviving_place_id <> merged_place_id)
);

CREATE TABLE IF NOT EXISTS place_atlas_rollout_state (
  rollout_key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  enabled_place_kinds_json TEXT NOT NULL DEFAULT '[]',
  calculation_version TEXT NOT NULL DEFAULT 'place_membership/v1',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

INSERT OR IGNORE INTO place_atlas_rollout_state (
  rollout_key,
  enabled,
  enabled_place_kinds_json,
  calculation_version
) VALUES (
  'universal_place_atlas_v2',
  0,
  '[]',
  'place_membership/v1'
);

ALTER TABLE place_memory_entries
  ADD COLUMN public_place_opt_in INTEGER NOT NULL DEFAULT 0;

ALTER TABLE place_memory_entries
  ADD COLUMN public_place_moderation_status TEXT NOT NULL DEFAULT 'not_submitted';

ALTER TABLE place_memory_entries
  ADD COLUMN public_attribution_mode TEXT NOT NULL DEFAULT 'anonymous';

ALTER TABLE place_memory_entries
  ADD COLUMN public_place_reviewed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_place_memory_public_place
  ON place_memory_entries(cell_id, public_place_opt_in, public_place_moderation_status, updated_at);
