CREATE TABLE IF NOT EXISTS record_observations (
    observation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    origin TEXT NOT NULL,
    assertion_status TEXT NOT NULL DEFAULT 'provisional',
    verification_status TEXT NOT NULL DEFAULT 'unreviewed',
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    data_use_scope TEXT NOT NULL DEFAULT 'personal_only',
    accepted_identification_id UUID,
    subject_type TEXT NOT NULL,
    individual_certainty TEXT NOT NULL DEFAULT 'unknown',
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observations_origin_chk
        CHECK (origin IN ('owner', 'ai', 'community', 'import', 'system')),
    CONSTRAINT record_observations_assertion_status_chk
        CHECK (assertion_status IN ('provisional', 'human_asserted')),
    CONSTRAINT record_observations_verification_status_chk
        CHECK (verification_status IN ('unreviewed', 'owner_confirmed', 'community_review', 'disputed', 'verified')),
    CONSTRAINT record_observations_lifecycle_status_chk
        CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
    CONSTRAINT record_observations_data_use_scope_chk
        CHECK (data_use_scope IN ('personal_only', 'community_observation', 'research_export')),
    CONSTRAINT record_observations_subject_type_chk
        CHECK (subject_type IN ('organism', 'group', 'trace', 'sound', 'unknown_subject')),
    CONSTRAINT record_observations_individual_certainty_chk
        CHECK (individual_certainty IN ('individual', 'group', 'unknown'))
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
    visibility TEXT NOT NULL,
    external_proposals_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    policy_version TEXT NOT NULL DEFAULT 'record_observation_policy/v1',
    updated_by_user_id TEXT,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observation_policies_visibility_chk
        CHECK (visibility IN ('public', 'limited', 'private'))
);

CREATE INDEX IF NOT EXISTS idx_record_observation_policies_owner
    ON record_observation_policies (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS record_observation_source_map (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    source_system TEXT NOT NULL,
    source_entity_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_version TEXT,
    mapping_kind TEXT NOT NULL,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observation_source_map_kind_chk
        CHECK (mapping_kind IN ('created_from', 'derived_from', 'dual_write', 'backfill')),
    CONSTRAINT record_observation_source_map_uniq
        UNIQUE (observation_id, source_system, source_entity_type, source_id, mapping_kind)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_source_lookup
    ON record_observation_source_map (source_system, source_entity_type, source_id);

CREATE TABLE IF NOT EXISTS record_observation_media (
    link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_role TEXT NOT NULL DEFAULT 'evidence',
    locator_key TEXT NOT NULL DEFAULT 'full',
    subject_locator JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_kind TEXT NOT NULL DEFAULT 'owner',
    confidence_score NUMERIC(6,5),
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT record_observation_media_role_chk
        CHECK (media_role IN ('evidence', 'context', 'audio', 'video_frame')),
    CONSTRAINT record_observation_media_source_chk
        CHECK (source_kind IN ('owner', 'ai', 'community', 'import', 'system')),
    CONSTRAINT record_observation_media_lifecycle_chk
        CHECK (lifecycle_status IN ('active', 'excluded', 'superseded')),
    CONSTRAINT record_observation_media_uniq
        UNIQUE (observation_id, media_id, locator_key)
);

CREATE INDEX IF NOT EXISTS idx_record_observation_media_media
    ON record_observation_media (media_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS observation_ai_suggestions (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    ai_run_id TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    candidate_key TEXT NOT NULL,
    proposed_name TEXT,
    proposed_scientific_name TEXT,
    proposed_rank TEXT,
    taxon_key TEXT,
    confidence_score NUMERIC(6,5),
    rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL DEFAULT '',
    prompt_version TEXT NOT NULL DEFAULT '',
    rule_version TEXT NOT NULL DEFAULT '',
    input_fingerprint TEXT NOT NULL,
    input_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    suggestion_status TEXT NOT NULL DEFAULT 'proposed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_ai_suggestions_status_chk
        CHECK (suggestion_status IN ('proposed', 'adopted', 'rejected', 'superseded'))
);

CREATE INDEX IF NOT EXISTS idx_observation_ai_suggestions_observation
    ON observation_ai_suggestions (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS observation_identification_claims (
    identification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    actor_user_id TEXT,
    actor_kind TEXT NOT NULL,
    proposed_name TEXT NOT NULL,
    proposed_scientific_name TEXT,
    proposed_rank TEXT,
    taxon_key TEXT,
    stance TEXT NOT NULL DEFAULT 'support',
    claim_status TEXT NOT NULL DEFAULT 'candidate',
    confidence_score NUMERIC(6,5),
    rationale_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_key TEXT NOT NULL UNIQUE,
    supersedes_identification_id UUID,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_identification_claims_actor_chk
        CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'import')),
    CONSTRAINT observation_identification_claims_stance_chk
        CHECK (stance IN ('support', 'disagree')),
    CONSTRAINT observation_identification_claims_status_chk
        CHECK (claim_status IN ('candidate', 'accepted', 'rejected', 'withdrawn')),
    CONSTRAINT observation_identification_claims_actor_required_chk
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
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    actor_kind TEXT NOT NULL,
    actor_user_id TEXT,
    event_type TEXT NOT NULL,
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    next_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason_code TEXT,
    provenance_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT observation_lifecycle_events_actor_chk
        CHECK (actor_kind IN ('owner', 'community_member', 'curator', 'system', 'import'))
);

CREATE INDEX IF NOT EXISTS idx_observation_lifecycle_events_observation
    ON observation_lifecycle_events (observation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS occurrence_projection_versions (
    projection_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    occurrence_id TEXT,
    projection_status TEXT NOT NULL DEFAULT 'pending',
    projection_version TEXT NOT NULL,
    source_fingerprint TEXT NOT NULL,
    accepted_identification_id UUID,
    privacy_rule_version TEXT NOT NULL,
    quality_rule_version TEXT NOT NULL,
    eligibility_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    projected_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    blocked_reason TEXT,
    projected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT occurrence_projection_versions_status_chk
        CHECK (projection_status IN ('pending', 'active', 'blocked', 'superseded', 'revoked')),
    CONSTRAINT occurrence_projection_versions_source_uniq
        UNIQUE (observation_id, source_fingerprint, projection_version)
);

CREATE INDEX IF NOT EXISTS idx_occurrence_projection_versions_observation
    ON occurrence_projection_versions (observation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_occurrence_projection_versions_active
    ON occurrence_projection_versions (observation_id)
    WHERE projection_status = 'active';

CREATE TABLE IF NOT EXISTS environment_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id TEXT,
    observation_id UUID REFERENCES record_observations(observation_id) ON DELETE SET NULL,
    media_id TEXT,
    place_id TEXT,
    source_kind TEXT NOT NULL,
    assessment_status TEXT NOT NULL DEFAULT 'provisional',
    category TEXT NOT NULL,
    value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(6,5),
    model_name TEXT NOT NULL DEFAULT '',
    model_version TEXT NOT NULL DEFAULT '',
    prompt_version TEXT NOT NULL DEFAULT '',
    rule_version TEXT NOT NULL DEFAULT '',
    input_fingerprint TEXT NOT NULL,
    input_provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT environment_assessments_source_kind_chk
        CHECK (source_kind IN ('ai', 'external', 'sensor', 'human')),
    CONSTRAINT environment_assessments_status_chk
        CHECK (assessment_status IN ('provisional', 'confirmed', 'rejected', 'superseded')),
    CONSTRAINT environment_assessments_subject_chk
        CHECK (record_id IS NOT NULL OR observation_id IS NOT NULL OR media_id IS NOT NULL OR place_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_environment_assessments_record
    ON environment_assessments (record_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_place
    ON environment_assessments (place_id, category, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_assessments_observation
    ON environment_assessments (observation_id, category, created_at DESC);

CREATE TABLE IF NOT EXISTS environment_assessment_media (
    assessment_id UUID NOT NULL REFERENCES environment_assessments(assessment_id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    relation_role TEXT NOT NULL DEFAULT 'input',
    subject_locator JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (assessment_id, media_id, relation_role),
    CONSTRAINT environment_assessment_media_role_chk
        CHECK (relation_role IN ('input', 'evidence', 'context'))
);

CREATE INDEX IF NOT EXISTS idx_environment_assessment_media_media
    ON environment_assessment_media (media_id);

CREATE TABLE IF NOT EXISTS record_observation_consistency_ledger (
    ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_key TEXT NOT NULL UNIQUE,
    record_id TEXT NOT NULL,
    observation_id UUID REFERENCES record_observations(observation_id) ON DELETE SET NULL,
    operation_key TEXT NOT NULL,
    old_write_status TEXT NOT NULL,
    new_write_status TEXT NOT NULL,
    source_ref TEXT,
    target_ref TEXT,
    source_checksum TEXT,
    target_checksum TEXT,
    difference_code TEXT,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT record_observation_consistency_old_status_chk
        CHECK (old_write_status IN ('pending', 'succeeded', 'failed', 'skipped')),
    CONSTRAINT record_observation_consistency_new_status_chk
        CHECK (new_write_status IN ('pending', 'succeeded', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_record
    ON record_observation_consistency_ledger (record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_record_observation_consistency_unresolved
    ON record_observation_consistency_ledger (difference_code, created_at)
    WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS identification_queue_entries (
    queue_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL UNIQUE REFERENCES record_observations(observation_id) ON DELETE CASCADE,
    queue_status TEXT NOT NULL DEFAULT 'queued',
    priority_score NUMERIC(12,5) NOT NULL DEFAULT 0,
    priority_components JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_taxon_group TEXT,
    specialist_match_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    assigned_user_id TEXT,
    eligible_after TIMESTAMPTZ,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT identification_queue_entries_status_chk
        CHECK (queue_status IN ('queued', 'claimed', 'resolved', 'suppressed'))
);

CREATE INDEX IF NOT EXISTS idx_identification_queue_priority
    ON identification_queue_entries (queue_status, priority_score DESC, calculated_at);
