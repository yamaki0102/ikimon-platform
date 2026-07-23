-- Universal Place Atlas expand migration.
-- Additive only: v1 readers continue to use the existing columns.
-- owner-sensitive-ok: reviewed additive expansion of existing Place identity and boundary tables; no owner data is rewritten.

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS canonical_name_normalized TEXT,
  ADD COLUMN IF NOT EXISTS place_kind TEXT NOT NULL DEFAULT 'other_named_area',
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS public_profile_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS official_status TEXT NOT NULL DEFAULT 'unofficial',
  ADD COLUMN IF NOT EXISTS public_summary TEXT,
  ADD COLUMN IF NOT EXISTS superseded_by_place_id TEXT REFERENCES places(place_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_places_canonical_name_normalized
  ON places (canonical_name_normalized);

CREATE INDEX IF NOT EXISTS idx_places_kind_profile_status
  ON places (place_kind, public_profile_status)
  WHERE superseded_by_place_id IS NULL;

CREATE TABLE IF NOT EXISTS place_aliases (
  alias_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  language_code TEXT,
  alias_kind TEXT NOT NULL DEFAULT 'alternate',
  source_type TEXT NOT NULL,
  source_reference_id UUID,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, alias_normalized, alias_kind)
);

CREATE INDEX IF NOT EXISTS idx_place_aliases_search
  ON place_aliases (alias_normalized);

CREATE TABLE IF NOT EXISTS place_source_references (
  source_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  precedence_rank INTEGER NOT NULL DEFAULT 100,
  observed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  superseded_by_source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_place_source_references_place
  ON place_source_references (place_id, precedence_rank, source_confidence DESC);

ALTER TABLE place_aliases
  ADD CONSTRAINT fk_place_aliases_source_reference
  FOREIGN KEY (source_reference_id)
  REFERENCES place_source_references(source_reference_id)
  ON DELETE SET NULL;

ALTER TABLE place_boundaries
  ADD COLUMN IF NOT EXISTS source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geometry_kind TEXT NOT NULL DEFAULT 'Polygon',
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS precision_kind TEXT NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boundary_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by_boundary_id UUID REFERENCES place_boundaries(boundary_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validation_state TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS validation_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_boundaries_one_current_primary
  ON place_boundaries (place_id)
  WHERE is_primary = TRUE AND valid_to IS NULL AND superseded_by_boundary_id IS NULL;

CREATE TABLE IF NOT EXISTS place_relationships (
  relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  object_place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(subject_place_id <> object_place_id),
  UNIQUE(subject_place_id, object_place_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_place_relationships_object
  ON place_relationships (object_place_id, relationship_type);

CREATE TABLE IF NOT EXISTS record_place_memberships (
  membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT NOT NULL,
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  membership_type TEXT NOT NULL,
  membership_state TEXT NOT NULL DEFAULT 'candidate',
  derivation_source TEXT NOT NULL,
  derivation_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  internal_precision TEXT NOT NULL DEFAULT 'exact_point',
  public_precision TEXT NOT NULL DEFAULT 'place',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_state TEXT NOT NULL DEFAULT 'unreviewed',
  calculation_version TEXT NOT NULL,
  removed_at TIMESTAMPTZ,
  corrected_by_membership_id UUID REFERENCES record_place_memberships(membership_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(record_id, place_id, calculation_version)
);

CREATE INDEX IF NOT EXISTS idx_record_place_memberships_place
  ON record_place_memberships (place_id, membership_state, is_primary)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_record_place_memberships_record
  ON record_place_memberships (record_id, membership_state)
  WHERE removed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_record_place_memberships_one_primary
  ON record_place_memberships (record_id, calculation_version)
  WHERE is_primary = TRUE AND membership_state = 'confirmed' AND removed_at IS NULL;

CREATE TABLE IF NOT EXISTS record_theme_assertions (
  theme_assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  assertion_source TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  assertion_status TEXT NOT NULL DEFAULT 'provisional',
  rule_version TEXT,
  model_name TEXT,
  prompt_version TEXT,
  input_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  supersedes_assertion_id UUID REFERENCES record_theme_assertions(theme_assertion_id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(record_id, theme, assertion_source, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_record_theme_assertions_record
  ON record_theme_assertions (record_id, assertion_status, theme);

CREATE TABLE IF NOT EXISTS place_policies (
  place_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  place_visibility TEXT NOT NULL DEFAULT 'public',
  recording_policy TEXT NOT NULL DEFAULT 'unknown',
  photography_rule_status TEXT NOT NULL DEFAULT 'unknown',
  public_location_mode TEXT NOT NULL DEFAULT 'place',
  contribution_cta_mode TEXT NOT NULL DEFAULT 'check_rules',
  official_rule_url TEXT,
  verification_source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  last_checked_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_policies_one_current
  ON place_policies (place_id)
  WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS place_facilities (
  place_facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  facility_kind TEXT NOT NULL,
  label TEXT,
  availability_status TEXT NOT NULL DEFAULT 'reported',
  source_reference_id UUID NOT NULL REFERENCES place_source_references(source_reference_id) ON DELETE RESTRICT,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  last_checked_at TIMESTAMPTZ,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(place_id, facility_kind, source_reference_id)
);

CREATE TABLE IF NOT EXISTS place_content_items (
  place_content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE CASCADE,
  content_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  content_status TEXT NOT NULL DEFAULT 'draft',
  source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  user_memory_entry_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_content_items_public
  ON place_content_items (place_id, content_kind, starts_at, ends_at)
  WHERE content_status = 'published';

CREATE TABLE IF NOT EXISTS place_correction_proposals (
  proposal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id TEXT REFERENCES places(place_id) ON DELETE SET NULL,
  proposer_user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  proposal_type TEXT NOT NULL,
  proposed_payload JSONB NOT NULL,
  proposal_status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_correction_proposals_queue
  ON place_correction_proposals (proposal_status, created_at);

CREATE TABLE IF NOT EXISTS place_merge_audit (
  merge_audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surviving_place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE RESTRICT,
  merged_place_id TEXT NOT NULL REFERENCES places(place_id) ON DELETE RESTRICT,
  decision_source_reference_id UUID REFERENCES place_source_references(source_reference_id) ON DELETE SET NULL,
  decision_reason TEXT NOT NULL,
  decided_by_user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rollback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  CHECK(surviving_place_id <> merged_place_id)
);

CREATE TABLE IF NOT EXISTS place_atlas_rollout_state (
  rollout_key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  enabled_place_kinds JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculation_version TEXT NOT NULL DEFAULT 'place_membership/v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO place_atlas_rollout_state (
  rollout_key,
  enabled,
  enabled_place_kinds,
  calculation_version
) VALUES (
  'universal_place_atlas_v2',
  FALSE,
  '[]'::jsonb,
  'place_membership/v1'
) ON CONFLICT (rollout_key) DO NOTHING;

ALTER TABLE place_memory_entries
  ADD COLUMN IF NOT EXISTS public_place_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS public_place_moderation_status TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS public_attribution_mode TEXT NOT NULL DEFAULT 'anonymous',
  ADD COLUMN IF NOT EXISTS public_place_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_place_memory_public_place
  ON place_memory_entries (cell_id, public_place_moderation_status, updated_at)
  WHERE public_place_opt_in = TRUE
    AND deleted_at IS NULL;
