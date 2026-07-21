-- Observation-first expand migration.
-- This migration is additive: existing readers and writers remain authoritative.
-- IDs are application-generated so PostgreSQL and D1 use the same identity contract.

CREATE TABLE IF NOT EXISTS record_observations (
    observation_id UUID PRIMARY KEY,
    record_runtime TEXT NOT NULL,
    record_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    source_key TEXT NOT NULL,
    origin TEXT NOT NULL,
    assertion_status TEXT NOT NULL DEFAULT 'provisional',
    verification_status TEXT NOT NULL DEFAULT 'unreviewed',
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    data_use_scope TEXT NOT NULL DEFAULT 'personal_only',
    data_use_consent_key TEXT,
    accepted_identification_id UUID,
    subject_type TEXT NOT NULL,
    individual_certainty TEXT NOT NULL DEFAULT 'unknown',
    captive_context TEXT NOT NULL DEFAULT 'unknown',
    count_mode TEXT NOT NULL DEFAULT 'unknown',
    count_value INTEGER,
    count_min INTEGER,
    count_max INTEGER,
    display_order INTEGER NOT NULL DEFAULT 0,
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by_actor_kind TEXT,
    reviewed_by_actor_id TEXT,
    reviewed_at TIMESTAMPTZ,
    excluded_reason TEXT,
    superseded_by_observation_id UUID REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    row_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observations_source_uniq UNIQUE (record_runtime, record_id, source_key),
    CONSTRAINT record_observations_runtime_chk CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
    CONSTRAINT record_observations_origin_chk CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
    CONSTRAINT record_observations_assertion_status_chk CHECK (assertion_status IN ('provisional', 'human_asserted')),
    CONSTRAINT record_observations_verification_status_chk CHECK (verification_status IN ('unreviewed', 'owner_confirmed', 'community_review', 'disputed', 'verified')),
    CONSTRAINT record_observations_lifecycle_status_chk CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
    CONSTRAINT record_observations_data_use_scope_chk CHECK (data_use_scope IN ('personal_only', 'community_observation', 'research_export')),
    CONSTRAINT record_observations_subject_type_chk CHECK (subject_type IN ('organism', 'group', 'trace', 'sound', 'unknown_subject')),
    CONSTRAINT record_observations_individual_certainty_chk CHECK (individual_certainty IN ('individual', 'group', 'unknown')),
    CONSTRAINT record_observations_captive_context_chk CHECK (captive_context IN ('wild', 'captive', 'cultivated', 'pet', 'unknown')),
    CONSTRAINT record_observations_count_mode_chk CHECK (count_mode IN ('exact', 'estimate', 'range', 'unknown')),
    CONSTRAINT record_observations_counts_chk CHECK (
        (count_value IS NULL OR count_value >= 0) AND
        (count_min IS NULL OR count_min >= 0) AND
        (count_max IS NULL OR count_max >= 0) AND
        (count_min IS NULL OR count_max IS NULL OR count_min <= count_max) AND
        (count_mode <> 'exact' OR (count_value IS NOT NULL AND count_min IS NULL AND count_max IS NULL)) AND
        (count_mode <> 'range' OR (count_value IS NULL AND count_min IS NOT NULL AND count_max IS NOT NULL))
    ),
    CONSTRAINT record_observations_review_actor_chk CHECK (
        reviewed_by_actor_kind IS NULL OR reviewed_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')
    ),
    CONSTRAINT record_observations_human_promotion_chk CHECK (
        NOT (
            assertion_status = 'human_asserted' OR
            verification_status IN ('owner_confirmed', 'community_review', 'verified') OR
            data_use_scope <> 'personal_only' OR
            accepted_identification_id IS NOT NULL
        ) OR (
            reviewed_by_actor_kind IN ('owner', 'community_member', 'curator') AND
            reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL
        )
    ),
    CONSTRAINT record_observations_data_use_consent_chk CHECK (data_use_scope = 'personal_only' OR data_use_consent_key IS NOT NULL),
    CONSTRAINT record_observations_lifecycle_reason_chk CHECK (
        (lifecycle_status = 'active' AND excluded_reason IS NULL AND superseded_by_observation_id IS NULL) OR
        (lifecycle_status = 'excluded' AND excluded_reason IS NOT NULL AND superseded_by_observation_id IS NULL) OR
        (lifecycle_status = 'superseded' AND superseded_by_observation_id IS NOT NULL)
    ),
    CONSTRAINT record_observations_no_self_supersede_chk CHECK (superseded_by_observation_id IS NULL OR superseded_by_observation_id <> observation_id),
    CONSTRAINT record_observations_json_bounds_chk CHECK (
        octet_length(context_json::text) <= 65536 AND octet_length(provenance_json::text) <= 65536
    ),
    CONSTRAINT record_observations_row_version_chk CHECK (row_version > 0),
    CONSTRAINT record_observations_display_order_chk CHECK (display_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_record_observations_record ON record_observations (record_runtime, record_id, lifecycle_status, display_order);
CREATE INDEX IF NOT EXISTS idx_record_observations_owner ON record_observations (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observations_unaccepted ON record_observations (verification_status, created_at) WHERE accepted_identification_id IS NULL AND lifecycle_status = 'active';

CREATE TABLE IF NOT EXISTS record_observation_policies (
    record_runtime TEXT NOT NULL,
    record_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    visibility TEXT NOT NULL,
    accepts_identification_proposals BOOLEAN NOT NULL DEFAULT TRUE,
    default_source TEXT NOT NULL DEFAULT 'visibility_default',
    updated_by_actor_id TEXT,
    row_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (record_runtime, record_id),
    CONSTRAINT record_observation_policies_runtime_chk CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
    CONSTRAINT record_observation_policies_visibility_chk CHECK (visibility IN ('public', 'limited', 'private')),
    CONSTRAINT record_observation_policies_source_chk CHECK (default_source IN ('visibility_default', 'owner_override', 'import')),
    CONSTRAINT record_observation_policies_update_actor_chk CHECK (default_source = 'visibility_default' OR updated_by_actor_id IS NOT NULL),
    CONSTRAINT record_observation_policies_row_version_chk CHECK (row_version > 0)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_policies_owner ON record_observation_policies (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS record_observation_source_map (
    mapping_id UUID PRIMARY KEY,
    source_runtime TEXT NOT NULL,
    source_entity_kind TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    mapping_rule_version TEXT NOT NULL,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    mapping_kind TEXT NOT NULL,
    mapping_confidence NUMERIC(6,5),
    ambiguity_state TEXT NOT NULL DEFAULT 'clear',
    source_snapshot_hash TEXT,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observation_source_map_uniq UNIQUE (source_runtime, source_entity_kind, source_entity_id, mapping_rule_version),
    CONSTRAINT record_observation_source_runtime_chk CHECK (source_runtime IN ('postgresql', 'cloudflare_d1', 'legacy_import', 'machine')),
    CONSTRAINT record_observation_source_kind_chk CHECK (source_entity_kind IN ('visit', 'native_observation', 'occurrence', 'ai_review_target', 'identification', 'audio_detection', 'other')),
    CONSTRAINT record_observation_source_mapping_kind_chk CHECK (mapping_kind IN ('primary', 'subject', 'candidate', 'compatibility_placeholder', 'merged', 'split_source')),
    CONSTRAINT record_observation_source_ambiguity_chk CHECK (ambiguity_state IN ('clear', 'needs_review', 'quarantined')),
    CONSTRAINT record_observation_source_confidence_chk CHECK (mapping_confidence IS NULL OR (mapping_confidence >= 0 AND mapping_confidence <= 1)),
    CONSTRAINT record_observation_source_json_bounds_chk CHECK (octet_length(provenance_json::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_source_lookup ON record_observation_source_map (source_runtime, source_entity_kind, source_entity_id);
CREATE INDEX IF NOT EXISTS idx_record_observation_source_quarantine ON record_observation_source_map (ambiguity_state, created_at) WHERE ambiguity_state <> 'clear';

CREATE TABLE IF NOT EXISTS record_observation_media (
    link_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    media_source_runtime TEXT NOT NULL,
    media_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'primary_evidence',
    locator_kind TEXT NOT NULL DEFAULT 'full',
    locator_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    origin TEXT NOT NULL DEFAULT 'owner',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source_key TEXT NOT NULL,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observation_media_source_uniq UNIQUE (observation_id, source_key),
    CONSTRAINT record_observation_media_role_chk CHECK (role IN ('primary_evidence', 'supporting_evidence', 'context', 'audio_evidence', 'trace_evidence', 'excluded')),
    CONSTRAINT record_observation_media_locator_chk CHECK (locator_kind IN ('full', 'rect', 'polygon', 'frame_time', 'time_range', 'other')),
    CONSTRAINT record_observation_media_origin_chk CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
    CONSTRAINT record_observation_media_json_bounds_chk CHECK (octet_length(locator_json::text) <= 16384 AND octet_length(provenance_json::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_media_media ON record_observation_media (media_source_runtime, media_id, active);

CREATE TABLE IF NOT EXISTS observation_ai_suggestions (
    suggestion_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    ai_run_id TEXT,
    candidate_key TEXT NOT NULL,
    source_key TEXT NOT NULL,
    proposed_name TEXT,
    proposed_scientific_name TEXT,
    proposed_rank TEXT,
    taxon_ref TEXT,
    confidence_score NUMERIC(6,5),
    rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    input_digest TEXT NOT NULL,
    input_provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    suggestion_status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_ai_suggestions_source_uniq UNIQUE (observation_id, source_key),
    CONSTRAINT observation_ai_suggestions_status_chk CHECK (suggestion_status IN ('active', 'rejected_by_owner', 'superseded', 'hidden')),
    CONSTRAINT observation_ai_suggestions_confidence_chk CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CONSTRAINT observation_ai_suggestions_json_bounds_chk CHECK (octet_length(rationale_json::text) <= 65536 AND octet_length(input_provenance_json::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_observation_ai_suggestions_observation ON observation_ai_suggestions (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_identification_claims (
    identification_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    actor_id TEXT,
    actor_kind TEXT NOT NULL,
    claim_status TEXT NOT NULL DEFAULT 'candidate',
    proposed_name TEXT NOT NULL,
    proposed_scientific_name TEXT,
    proposed_rank TEXT,
    accepted_name TEXT,
    accepted_rank TEXT,
    taxon_ref TEXT,
    confidence_score NUMERIC(6,5),
    stance TEXT NOT NULL DEFAULT 'support',
    source_key TEXT NOT NULL,
    source_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    decision_reason TEXT,
    decided_by_actor_kind TEXT,
    decided_by_actor_id TEXT,
    decided_at TIMESTAMPTZ,
    supersedes_identification_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_identification_claims_obs_id_uniq UNIQUE (observation_id, identification_id),
    CONSTRAINT observation_identification_claims_source_uniq UNIQUE (observation_id, source_key),
    CONSTRAINT observation_identification_claims_actor_chk CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'import')),
    CONSTRAINT observation_identification_claims_actor_required_chk CHECK (actor_kind = 'import' OR actor_id IS NOT NULL),
    CONSTRAINT observation_identification_claims_status_chk CHECK (claim_status IN ('candidate', 'accepted', 'rejected', 'withdrawn', 'superseded')),
    CONSTRAINT observation_identification_claims_stance_chk CHECK (stance IN ('support', 'alternative', 'not_organism', 'needs_more_evidence', 'context_only')),
    CONSTRAINT observation_identification_claims_decider_chk CHECK (decided_by_actor_kind IS NULL OR decided_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')),
    CONSTRAINT observation_identification_claims_decision_chk CHECK (
        claim_status <> 'accepted' OR (
            decided_by_actor_kind IN ('owner', 'community_member', 'curator') AND decided_by_actor_id IS NOT NULL AND decided_at IS NOT NULL
        )
    ),
    CONSTRAINT observation_identification_claims_confidence_chk CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CONSTRAINT observation_identification_claims_json_bounds_chk CHECK (octet_length(source_payload_json::text) <= 65536 AND octet_length(evidence_json::text) <= 65536),
    CONSTRAINT observation_identification_claims_supersedes_fk FOREIGN KEY (observation_id, supersedes_identification_id) REFERENCES observation_identification_claims(observation_id, identification_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_observation ON observation_identification_claims (observation_id, claim_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_observation_identification_claims_actor ON observation_identification_claims (observation_id, actor_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_observation_identification_claims_accepted ON observation_identification_claims (observation_id) WHERE claim_status = 'accepted';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_observations_accepted_claim_fk') THEN
        ALTER TABLE record_observations
            ADD CONSTRAINT record_observations_accepted_claim_fk
            FOREIGN KEY (observation_id, accepted_identification_id)
            REFERENCES observation_identification_claims(observation_id, identification_id)
            ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS observation_lifecycle_events (
    event_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    event_kind TEXT NOT NULL,
    actor_kind TEXT NOT NULL,
    actor_id TEXT,
    reason_code TEXT,
    before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    related_observation_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_lifecycle_events_obs_id_uniq UNIQUE (observation_id, event_id),
    CONSTRAINT observation_lifecycle_events_source_uniq UNIQUE (observation_id, source_key),
    CONSTRAINT observation_lifecycle_events_kind_chk CHECK (event_kind IN ('created', 'human_asserted', 'verification_changed', 'data_use_scope_changed', 'disputed', 'excluded', 'restored', 'split', 'merged', 'media_linked', 'media_unlinked', 'identification_changed', 'projection_changed')),
    CONSTRAINT observation_lifecycle_events_actor_chk CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'system', 'import')),
    CONSTRAINT observation_lifecycle_events_actor_required_chk CHECK (actor_kind IN ('system', 'import') OR actor_id IS NOT NULL),
    CONSTRAINT observation_lifecycle_events_json_bounds_chk CHECK (octet_length(before_json::text) <= 16384 AND octet_length(after_json::text) <= 16384 AND octet_length(related_observation_ids_json::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_observation_lifecycle_events_observation ON observation_lifecycle_events (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_projection_versions (
    projection_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    projection_version INTEGER NOT NULL,
    projection_state TEXT NOT NULL DEFAULT 'candidate',
    accepted_identification_id UUID,
    basis_of_record TEXT NOT NULL,
    occurrence_status TEXT NOT NULL,
    individual_count INTEGER,
    rights_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    privacy_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    quality_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    projection_rule_version TEXT NOT NULL,
    source_digest TEXT NOT NULL,
    consent_event_id UUID,
    human_provenance_actor_kind TEXT,
    human_provenance_actor_id TEXT,
    research_use_state TEXT NOT NULL DEFAULT 'not_evaluated',
    research_blockers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    supersedes_projection_id UUID REFERENCES occurrence_projection_versions(projection_id) ON DELETE RESTRICT,
    CONSTRAINT occurrence_projection_versions_obs_version_uniq UNIQUE (observation_id, projection_version),
    CONSTRAINT occurrence_projection_versions_obs_id_uniq UNIQUE (observation_id, projection_id),
    CONSTRAINT occurrence_projection_versions_state_chk CHECK (projection_state IN ('candidate', 'active', 'inactive', 'rejected', 'revoked')),
    CONSTRAINT occurrence_projection_versions_research_chk CHECK (research_use_state IN ('not_evaluated', 'blocked', 'eligible', 'revoked')),
    CONSTRAINT occurrence_projection_versions_count_chk CHECK (individual_count IS NULL OR individual_count >= 0),
    CONSTRAINT occurrence_projection_versions_human_gate_chk CHECK (
        projection_state <> 'active' OR (
            accepted_identification_id IS NOT NULL AND
            human_provenance_actor_kind IN ('owner', 'community_member', 'curator') AND human_provenance_actor_id IS NOT NULL AND
            activated_at IS NOT NULL
        )
    ),
    CONSTRAINT occurrence_projection_versions_decision_gate_chk CHECK (
        projection_state <> 'active' OR (
            COALESCE(rights_decision_json ->> 'decision' = 'allow', FALSE) AND rights_decision_json ->> 'rule_version' IS NOT NULL AND
            COALESCE(privacy_decision_json ->> 'decision' IN ('generalized', 'hidden', 'not_applicable'), FALSE) AND privacy_decision_json ->> 'rule_version' IS NOT NULL AND
            COALESCE(quality_decision_json ->> 'decision' = 'eligible', FALSE) AND quality_decision_json ->> 'rule_version' IS NOT NULL
        )
    ),
    CONSTRAINT occurrence_projection_versions_research_gate_chk CHECK (research_use_state <> 'eligible' OR (projection_state = 'active' AND consent_event_id IS NOT NULL)),
    CONSTRAINT occurrence_projection_versions_json_bounds_chk CHECK (
        octet_length(rights_decision_json::text) <= 65536 AND octet_length(privacy_decision_json::text) <= 65536 AND
        octet_length(quality_decision_json::text) <= 65536 AND octet_length(research_blockers_json::text) <= 16384
    ),
    CONSTRAINT occurrence_projection_versions_claim_fk FOREIGN KEY (observation_id, accepted_identification_id) REFERENCES observation_identification_claims(observation_id, identification_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT occurrence_projection_versions_consent_fk FOREIGN KEY (observation_id, consent_event_id) REFERENCES observation_lifecycle_events(observation_id, event_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_occurrence_projection_versions_observation ON occurrence_projection_versions (observation_id, generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrence_projection_versions_active ON occurrence_projection_versions (observation_id) WHERE projection_state = 'active';

CREATE TABLE IF NOT EXISTS environment_assessments (
    assessment_id UUID PRIMARY KEY,
    record_runtime TEXT,
    record_id TEXT,
    observation_id UUID REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    media_source_runtime TEXT,
    media_id TEXT,
    place_id TEXT,
    source_kind TEXT NOT NULL,
    assessment_state TEXT NOT NULL DEFAULT 'provisional',
    assessment_kind TEXT NOT NULL,
    value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(6,5),
    model_provider TEXT,
    model_name TEXT,
    model_version TEXT,
    prompt_version TEXT,
    rule_version TEXT,
    source_key TEXT NOT NULL,
    input_provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_by_actor_kind TEXT,
    reviewed_by_actor_id TEXT,
    reviewed_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT environment_assessments_source_uniq UNIQUE (source_kind, source_key),
    CONSTRAINT environment_assessments_source_kind_chk CHECK (source_kind IN ('ai', 'human', 'external', 'sensor', 'import', 'derived_rule')),
    CONSTRAINT environment_assessments_state_chk CHECK (assessment_state IN ('provisional', 'confirmed', 'rejected', 'superseded')),
    CONSTRAINT environment_assessments_subject_chk CHECK (record_id IS NOT NULL OR observation_id IS NOT NULL OR media_id IS NOT NULL OR place_id IS NOT NULL),
    CONSTRAINT environment_assessments_record_runtime_chk CHECK (record_runtime IS NULL OR record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
    CONSTRAINT environment_assessments_record_pair_chk CHECK ((record_runtime IS NULL) = (record_id IS NULL)),
    CONSTRAINT environment_assessments_review_actor_chk CHECK (reviewed_by_actor_kind IS NULL OR reviewed_by_actor_kind IN ('owner', 'community_member', 'curator', 'import')),
    CONSTRAINT environment_assessments_human_gate_chk CHECK (assessment_state <> 'confirmed' OR (reviewed_by_actor_kind IN ('owner', 'community_member', 'curator') AND reviewed_by_actor_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    CONSTRAINT environment_assessments_ai_initial_chk CHECK (source_kind <> 'ai' OR assessment_state <> 'confirmed' OR reviewed_by_actor_id IS NOT NULL),
    CONSTRAINT environment_assessments_confidence_chk CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CONSTRAINT environment_assessments_json_bounds_chk CHECK (octet_length(value_json::text) <= 65536 AND octet_length(input_provenance_json::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessments_record ON environment_assessments (record_runtime, record_id, assessment_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_place ON environment_assessments (place_id, assessment_kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_observation ON environment_assessments (observation_id, assessment_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS environment_assessment_media (
    link_id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES environment_assessments(assessment_id) ON DELETE RESTRICT,
    media_source_runtime TEXT NOT NULL,
    media_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'input',
    locator_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_key TEXT NOT NULL,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT environment_assessment_media_source_uniq UNIQUE (assessment_id, source_key),
    CONSTRAINT environment_assessment_media_role_chk CHECK (role IN ('input', 'evidence', 'context')),
    CONSTRAINT environment_assessment_media_json_bounds_chk CHECK (octet_length(locator_json::text) <= 16384 AND octet_length(provenance_json::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessment_media_media ON environment_assessment_media (media_source_runtime, media_id);

CREATE TABLE IF NOT EXISTS record_observation_consistency_ledger (
    ledger_id UUID PRIMARY KEY,
    operation_key TEXT NOT NULL UNIQUE,
    record_runtime TEXT NOT NULL,
    record_id TEXT NOT NULL,
    observation_id UUID REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    operation_kind TEXT NOT NULL,
    legacy_write_refs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_write_refs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_digest TEXT NOT NULL,
    target_digest TEXT,
    consistency_state TEXT NOT NULL DEFAULT 'pending',
    reason_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT record_observation_consistency_runtime_chk CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
    CONSTRAINT record_observation_consistency_operation_chk CHECK (operation_kind IN ('record_save', 'ai_analysis', 'human_edit', 'identification', 'media_reassign', 'backfill', 'projection')),
    CONSTRAINT record_observation_consistency_state_chk CHECK (consistency_state IN ('pending', 'matched', 'mismatched', 'retryable', 'quarantined')),
    CONSTRAINT record_observation_consistency_attempt_chk CHECK (attempt_count >= 0 AND attempt_count <= 100),
    CONSTRAINT record_observation_consistency_resolution_chk CHECK ((consistency_state = 'matched' AND resolved_at IS NOT NULL AND target_digest IS NOT NULL) OR (consistency_state <> 'matched' AND resolved_at IS NULL)),
    CONSTRAINT record_observation_consistency_json_bounds_chk CHECK (octet_length(legacy_write_refs_json::text) <= 16384 AND octet_length(target_write_refs_json::text) <= 16384 AND octet_length(reason_codes_json::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_record ON record_observation_consistency_ledger (record_runtime, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_unresolved ON record_observation_consistency_ledger (consistency_state, created_at) WHERE consistency_state <> 'matched';

CREATE TABLE IF NOT EXISTS identification_queue_entries (
    queue_entry_id UUID PRIMARY KEY,
    observation_id UUID NOT NULL UNIQUE REFERENCES record_observations(observation_id) ON DELETE RESTRICT,
    queue_state TEXT NOT NULL DEFAULT 'queued',
    score NUMERIC(12,5) NOT NULL DEFAULT 0,
    reason_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    score_components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_taxon_hint TEXT,
    target_region_hint TEXT,
    evidence_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    consensus_summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    scoring_rule_version TEXT NOT NULL,
    source_digest TEXT NOT NULL,
    assigned_actor_id TEXT,
    eligible_after TIMESTAMPTZ,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    row_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identification_queue_entries_state_chk CHECK (queue_state IN ('queued', 'claimed', 'resolved', 'suppressed')),
    CONSTRAINT identification_queue_entries_row_version_chk CHECK (row_version > 0),
    CONSTRAINT identification_queue_entries_json_bounds_chk CHECK (octet_length(reason_codes_json::text) <= 16384 AND octet_length(score_components_json::text) <= 16384 AND octet_length(evidence_summary_json::text) <= 16384 AND octet_length(consensus_summary_json::text) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_identification_queue_priority ON identification_queue_entries (queue_state, score DESC, calculated_at);

-- These guards affect only the new expand tables. They do not observe or mutate legacy writers.
CREATE OR REPLACE FUNCTION enforce_record_observation_accepted_claim()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.accepted_identification_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM observation_identification_claims claim
        WHERE claim.observation_id = NEW.observation_id
          AND claim.identification_id = NEW.accepted_identification_id
          AND claim.claim_status = 'accepted'
          AND claim.decided_by_actor_kind IN ('owner', 'community_member', 'curator')
          AND claim.decided_by_actor_id IS NOT NULL
          AND claim.decided_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'accepted identification must be an accepted human claim for the same observation' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION enforce_occurrence_projection_gate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.projection_state = 'active' AND NOT EXISTS (
        SELECT 1
        FROM record_observations observation
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
          AND claim.decided_by_actor_id IS NOT NULL
          AND claim.decided_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'active projection requires an active human-asserted observation and its accepted human claim' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION protect_active_occurrence_projection()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM occurrence_projection_versions projection
        WHERE projection.observation_id = NEW.observation_id
          AND projection.projection_state = 'active'
    ) AND (
        NEW.assertion_status <> 'human_asserted' OR
        NEW.lifecycle_status <> 'active' OR
        NEW.verification_status IN ('unreviewed', 'disputed') OR
        NEW.accepted_identification_id IS NULL
    ) THEN
        RAISE EXCEPTION 'deactivate the occurrence projection before making its observation ineligible' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION protect_referenced_accepted_claim()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.claim_status = 'accepted' AND NEW.claim_status <> 'accepted' AND (
        EXISTS (SELECT 1 FROM record_observations observation WHERE observation.accepted_identification_id = OLD.identification_id) OR
        EXISTS (SELECT 1 FROM occurrence_projection_versions projection WHERE projection.accepted_identification_id = OLD.identification_id AND projection.projection_state = 'active')
    ) THEN
        RAISE EXCEPTION 'clear accepted pointers and deactivate projections before changing accepted claim status' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_observations_accepted_claim_guard') THEN
        CREATE TRIGGER trg_record_observations_accepted_claim_guard BEFORE INSERT OR UPDATE OF accepted_identification_id ON record_observations FOR EACH ROW EXECUTE FUNCTION enforce_record_observation_accepted_claim();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_occurrence_projection_active_guard') THEN
        CREATE TRIGGER trg_occurrence_projection_active_guard BEFORE INSERT OR UPDATE ON occurrence_projection_versions FOR EACH ROW EXECUTE FUNCTION enforce_occurrence_projection_gate();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_record_observations_active_projection_guard') THEN
        CREATE TRIGGER trg_record_observations_active_projection_guard BEFORE UPDATE OF assertion_status, lifecycle_status, verification_status, accepted_identification_id ON record_observations FOR EACH ROW EXECUTE FUNCTION protect_active_occurrence_projection();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_identification_accepted_claim_guard') THEN
        CREATE TRIGGER trg_identification_accepted_claim_guard BEFORE UPDATE OF claim_status ON observation_identification_claims FOR EACH ROW EXECUTE FUNCTION protect_referenced_accepted_claim();
    END IF;
END $$;
