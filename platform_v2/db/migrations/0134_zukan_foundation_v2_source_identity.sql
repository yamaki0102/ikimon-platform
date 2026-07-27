-- ZUKAN Foundation v2: source preservation and reversible identity resolution.
-- Additive only. No existing rows or tables are changed.
-- Rollback: disable Foundation v2 readers/writers by feature flag. Do not drop these
-- audit-bearing tables after data has been written.

CREATE TABLE IF NOT EXISTS zukan_subject_identities (
    subject_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    workspace_id TEXT,
    subject_kind TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(tenant_id)) > 0),
    CHECK (length(trim(subject_kind)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_subject_identities_tenant
    ON zukan_subject_identities (tenant_id, workspace_id, subject_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS zukan_source_works (
    source_work_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    work_kind TEXT NOT NULL,
    publisher_subject_id UUID REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(tenant_id)) > 0),
    CHECK (length(trim(title)) > 0),
    CHECK (length(trim(work_kind)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_source_works_publisher
    ON zukan_source_works (publisher_subject_id, created_at DESC)
    WHERE publisher_subject_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS zukan_source_editions (
    source_edition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_work_id UUID NOT NULL REFERENCES zukan_source_works(source_work_id) ON DELETE RESTRICT,
    edition_label TEXT NOT NULL,
    language_tag TEXT,
    issued_at TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    lifecycle_status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (lifecycle_status IN ('active', 'superseded', 'retired')),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from),
    CHECK (length(trim(edition_label)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_source_editions_work
    ON zukan_source_editions (source_work_id, issued_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS zukan_content_objects (
    content_object_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_edition_id UUID REFERENCES zukan_source_editions(source_edition_id) ON DELETE SET NULL,
    parent_content_object_id UUID REFERENCES zukan_content_objects(content_object_id) ON DELETE SET NULL,
    object_kind TEXT NOT NULL,
    derivation_kind TEXT,
    mime_type TEXT,
    byte_length BIGINT,
    content_sha256 TEXT,
    storage_locator TEXT,
    availability_status TEXT NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (object_kind IN ('source_object', 'ocr', 'thumbnail', 'translation', 'embedding', 'index', 'value_artifact', 'other')),
    CHECK (availability_status IN ('available', 'suppressed', 'redacted', 'erased', 'missing')),
    CHECK (byte_length IS NULL OR byte_length >= 0),
    CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_zukan_content_objects_edition
    ON zukan_content_objects (source_edition_id, object_kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zukan_content_objects_parent
    ON zukan_content_objects (parent_content_object_id, created_at DESC)
    WHERE parent_content_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_zukan_content_objects_digest
    ON zukan_content_objects (content_sha256)
    WHERE content_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS zukan_source_fragments (
    source_fragment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_object_id UUID NOT NULL REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
    fragment_kind TEXT NOT NULL,
    selector JSONB NOT NULL DEFAULT '{}'::jsonb,
    fragment_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (fragment_hash IS NULL OR fragment_hash ~ '^[0-9a-f]{64}$'),
    CHECK (length(trim(fragment_kind)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_source_fragments_object
    ON zukan_source_fragments (content_object_id, fragment_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS zukan_extraction_runs (
    extraction_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_content_object_id UUID NOT NULL REFERENCES zukan_content_objects(content_object_id) ON DELETE RESTRICT,
    extractor_kind TEXT NOT NULL,
    extractor_version TEXT NOT NULL,
    model_name TEXT,
    prompt_version TEXT,
    code_version TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    output_hash TEXT,
    run_status TEXT NOT NULL DEFAULT 'running',
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CHECK (run_status IN ('running', 'succeeded', 'partial', 'failed')),
    CHECK (input_hash ~ '^[0-9a-f]{64}$'),
    CHECK (output_hash IS NULL OR output_hash ~ '^[0-9a-f]{64}$'),
    CHECK (jsonb_typeof(warnings) = 'array'),
    CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_zukan_extraction_runs_input
    ON zukan_extraction_runs (input_content_object_id, started_at DESC);

CREATE TABLE IF NOT EXISTS zukan_public_identifiers (
    public_identifier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier_uri TEXT NOT NULL UNIQUE,
    target_kind TEXT NOT NULL,
    target_id UUID NOT NULL,
    sensitivity_status TEXT NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CHECK (target_kind IN ('subject_identity', 'source_work', 'source_edition', 'content_object', 'publication_edition', 'dataset')),
    CHECK (sensitivity_status IN ('normal', 'restricted', 'existence_sensitive')),
    CHECK (identifier_uri ~ '^https://')
);

CREATE INDEX IF NOT EXISTS idx_zukan_public_identifiers_target
    ON zukan_public_identifiers (target_kind, target_id);

CREATE TABLE IF NOT EXISTS zukan_identity_resolution_sets (
    resolution_set_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolution_status TEXT NOT NULL DEFAULT 'active',
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    reason JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (resolution_status IN ('active', 'superseded', 'retired')),
    CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE IF NOT EXISTS zukan_identity_membership_assertions (
    membership_assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resolution_set_id UUID NOT NULL REFERENCES zukan_identity_resolution_sets(resolution_set_id) ON DELETE RESTRICT,
    subject_id UUID NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
    membership_state TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    confidence NUMERIC(5,4),
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (membership_state IN ('exact', 'candidate', 'rejected')),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CHECK (valid_to IS NULL OR valid_to > valid_from),
    UNIQUE (resolution_set_id, subject_id, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_zukan_identity_memberships_subject
    ON zukan_identity_membership_assertions (subject_id, valid_from DESC, valid_to);
CREATE INDEX IF NOT EXISTS idx_zukan_identity_memberships_set
    ON zukan_identity_membership_assertions (resolution_set_id, membership_state, valid_from DESC);

CREATE TABLE IF NOT EXISTS zukan_canonical_identity_assertions (
    canonical_assertion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_identifier_id UUID NOT NULL REFERENCES zukan_public_identifiers(public_identifier_id) ON DELETE RESTRICT,
    assertion_mode TEXT NOT NULL,
    resolution_set_id UUID REFERENCES zukan_identity_resolution_sets(resolution_set_id) ON DELETE RESTRICT,
    successor_public_identifier_id UUID REFERENCES zukan_public_identifiers(public_identifier_id) ON DELETE RESTRICT,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    reason JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (assertion_mode IN ('resolved', 'ambiguous', 'redirect')),
    CHECK (valid_to IS NULL OR valid_to > valid_from),
    CHECK (
        (assertion_mode IN ('resolved', 'ambiguous') AND resolution_set_id IS NOT NULL AND successor_public_identifier_id IS NULL)
        OR (assertion_mode = 'redirect' AND resolution_set_id IS NULL AND successor_public_identifier_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_zukan_canonical_assertions_lookup
    ON zukan_canonical_identity_assertions (public_identifier_id, valid_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zukan_canonical_assertions_one_current
    ON zukan_canonical_identity_assertions (public_identifier_id)
    WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS zukan_canonical_identity_candidates (
    canonical_assertion_id UUID NOT NULL REFERENCES zukan_canonical_identity_assertions(canonical_assertion_id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
    ordinal INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (canonical_assertion_id, subject_id),
    CHECK (ordinal >= 0)
);
