-- ZUKAN Foundation v2: first-class generic Record persistence.
-- Additive only. No existing rows or runtime routes are changed.
-- Record rows and links are append-only. Privacy erasure remains on the linked
-- ValueArtifact and future status-event projections; no direct Record mutation is allowed.

CREATE TABLE IF NOT EXISTS zukan_record_payload_scopes (
    payload_artifact_id UUID PRIMARY KEY REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(tenant_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_payload_scopes_tenant
    ON zukan_record_payload_scopes (tenant_id, workspace_id, payload_artifact_id);

CREATE TABLE IF NOT EXISTS zukan_records (
    record_id UUID PRIMARY KEY,
    recorded_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT,
    record_kind TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    occurred_at TIMESTAMPTZ,
    actor_subject_id UUID REFERENCES zukan_subject_identities(subject_id) ON DELETE SET NULL,
    payload_artifact_id UUID NOT NULL REFERENCES zukan_record_payload_scopes(payload_artifact_id) ON DELETE RESTRICT,
    provenance_status TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(tenant_id)) > 0),
    CHECK (record_kind IN (
        'source_record',
        'field_observation',
        'activity_record',
        'event_record',
        'testimony',
        'case_outcome'
    )),
    CHECK (provenance_status IN ('known', 'partial', 'unknown')),
    CHECK (visibility IN ('private', 'workspace', 'restricted', 'public_candidate', 'public'))
);

CREATE INDEX IF NOT EXISTS idx_zukan_records_scope_time
    ON zukan_records (tenant_id, workspace_id, recorded_sequence, recorded_at);
CREATE INDEX IF NOT EXISTS idx_zukan_records_kind_time
    ON zukan_records (record_kind, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_zukan_records_payload
    ON zukan_records (payload_artifact_id);

CREATE TABLE IF NOT EXISTS zukan_record_subject_links (
    record_id UUID NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
    subject_id UUID NOT NULL REFERENCES zukan_subject_identities(subject_id) ON DELETE RESTRICT,
    subject_role TEXT NOT NULL,
    ordinal INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (record_id, subject_id, subject_role),
    UNIQUE (record_id, subject_role, ordinal),
    CHECK (subject_role IN ('place', 'entity', 'actor', 'about', 'other')),
    CHECK (ordinal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_subject_links_subject
    ON zukan_record_subject_links (subject_id, subject_role, record_id);

CREATE TABLE IF NOT EXISTS zukan_record_source_links (
    record_id UUID NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
    source_edition_id UUID NOT NULL REFERENCES zukan_source_editions(source_edition_id) ON DELETE RESTRICT,
    link_role TEXT NOT NULL,
    source_selector JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (record_id, source_edition_id, link_role),
    CHECK (link_role IN ('provenance', 'evidence', 'derived_from')),
    CHECK (jsonb_typeof(source_selector) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_zukan_record_source_links_edition
    ON zukan_record_source_links (source_edition_id, link_role, record_id);

CREATE TABLE IF NOT EXISTS zukan_claim_record_links (
    claim_revision_id UUID NOT NULL REFERENCES zukan_claim_revisions(claim_revision_id) ON DELETE RESTRICT,
    record_id UUID NOT NULL REFERENCES zukan_records(record_id) ON DELETE RESTRICT,
    link_role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (claim_revision_id, record_id, link_role),
    CHECK (link_role IN ('asserted_from', 'reviewed_from', 'superseded_by', 'case_result'))
);

CREATE INDEX IF NOT EXISTS idx_zukan_claim_record_links_record
    ON zukan_claim_record_links (record_id, link_role, claim_revision_id);

CREATE OR REPLACE FUNCTION zukan_validate_record_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    payload_status TEXT;
    payload_tenant TEXT;
    payload_workspace TEXT;
    actor_tenant TEXT;
    actor_workspace TEXT;
BEGIN
    SELECT artifact.availability_status, scope.tenant_id, scope.workspace_id
      INTO payload_status, payload_tenant, payload_workspace
      FROM zukan_record_payload_scopes scope
      JOIN zukan_value_artifacts artifact
        ON artifact.artifact_id = scope.payload_artifact_id
     WHERE scope.payload_artifact_id = NEW.payload_artifact_id
     FOR KEY SHARE OF scope, artifact;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_record_payload_scope_not_found' USING ERRCODE = '23503';
    END IF;
    IF payload_status <> 'available' THEN
        RAISE EXCEPTION 'zukan_record_payload_artifact_not_available' USING ERRCODE = '23514';
    END IF;
    IF payload_tenant IS DISTINCT FROM NEW.tenant_id
       OR payload_workspace IS DISTINCT FROM NEW.workspace_id THEN
        RAISE EXCEPTION 'zukan_record_payload_scope_mismatch' USING ERRCODE = '23514';
    END IF;

    IF NEW.actor_subject_id IS NOT NULL THEN
        SELECT tenant_id, workspace_id
          INTO actor_tenant, actor_workspace
          FROM zukan_subject_identities
         WHERE subject_id = NEW.actor_subject_id
         FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'zukan_record_actor_not_found' USING ERRCODE = '23503';
        END IF;
        IF actor_tenant IS DISTINCT FROM NEW.tenant_id
           OR actor_workspace IS DISTINCT FROM NEW.workspace_id THEN
            RAISE EXCEPTION 'zukan_record_actor_scope_mismatch' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_records_validate_insert ON zukan_records;
CREATE TRIGGER trg_zukan_records_validate_insert
BEFORE INSERT ON zukan_records
FOR EACH ROW EXECUTE FUNCTION zukan_validate_record_insert();

CREATE OR REPLACE FUNCTION zukan_validate_record_subject_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    record_tenant TEXT;
    record_workspace TEXT;
    subject_tenant TEXT;
    subject_workspace TEXT;
BEGIN
    SELECT tenant_id, workspace_id
      INTO record_tenant, record_workspace
      FROM zukan_records
     WHERE record_id = NEW.record_id
     FOR KEY SHARE;
    SELECT tenant_id, workspace_id
      INTO subject_tenant, subject_workspace
      FROM zukan_subject_identities
     WHERE subject_id = NEW.subject_id
     FOR KEY SHARE;
    IF record_tenant IS DISTINCT FROM subject_tenant
       OR record_workspace IS DISTINCT FROM subject_workspace THEN
        RAISE EXCEPTION 'zukan_record_subject_scope_mismatch' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_record_subject_links_validate ON zukan_record_subject_links;
CREATE TRIGGER trg_zukan_record_subject_links_validate
BEFORE INSERT ON zukan_record_subject_links
FOR EACH ROW EXECUTE FUNCTION zukan_validate_record_subject_link();

CREATE OR REPLACE FUNCTION zukan_validate_record_source_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    record_tenant TEXT;
    source_tenant TEXT;
BEGIN
    SELECT tenant_id
      INTO record_tenant
      FROM zukan_records
     WHERE record_id = NEW.record_id
     FOR KEY SHARE;
    SELECT w.tenant_id
      INTO source_tenant
      FROM zukan_source_editions e
      JOIN zukan_source_works w ON w.source_work_id = e.source_work_id
     WHERE e.source_edition_id = NEW.source_edition_id
     FOR KEY SHARE OF e, w;
    IF record_tenant IS DISTINCT FROM source_tenant THEN
        RAISE EXCEPTION 'zukan_record_source_scope_mismatch' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_record_source_links_validate ON zukan_record_source_links;
CREATE TRIGGER trg_zukan_record_source_links_validate
BEFORE INSERT ON zukan_record_source_links
FOR EACH ROW EXECUTE FUNCTION zukan_validate_record_source_link();

CREATE OR REPLACE FUNCTION zukan_validate_claim_record_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    record_tenant TEXT;
    record_workspace TEXT;
    claim_tenant TEXT;
    claim_workspace TEXT;
BEGIN
    SELECT tenant_id, workspace_id
      INTO record_tenant, record_workspace
      FROM zukan_records
     WHERE record_id = NEW.record_id
     FOR KEY SHARE;
    SELECT c.tenant_id, c.workspace_id
      INTO claim_tenant, claim_workspace
      FROM zukan_claim_revisions r
      JOIN zukan_claims c ON c.claim_id = r.claim_id
     WHERE r.claim_revision_id = NEW.claim_revision_id
     FOR KEY SHARE OF r, c;
    IF record_tenant IS DISTINCT FROM claim_tenant
       OR record_workspace IS DISTINCT FROM claim_workspace THEN
        RAISE EXCEPTION 'zukan_claim_record_scope_mismatch' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_claim_record_links_validate ON zukan_claim_record_links;
CREATE TRIGGER trg_zukan_claim_record_links_validate
BEFORE INSERT ON zukan_claim_record_links
FOR EACH ROW EXECUTE FUNCTION zukan_validate_claim_record_link();

DROP TRIGGER IF EXISTS trg_zukan_record_payload_scopes_no_update ON zukan_record_payload_scopes;
CREATE TRIGGER trg_zukan_record_payload_scopes_no_update
BEFORE UPDATE OR DELETE ON zukan_record_payload_scopes
FOR EACH ROW EXECUTE FUNCTION zukan_reject_row_mutation();

DROP TRIGGER IF EXISTS trg_zukan_records_no_update ON zukan_records;
CREATE TRIGGER trg_zukan_records_no_update
BEFORE UPDATE OR DELETE ON zukan_records
FOR EACH ROW EXECUTE FUNCTION zukan_reject_row_mutation();

DROP TRIGGER IF EXISTS trg_zukan_record_subject_links_no_update ON zukan_record_subject_links;
CREATE TRIGGER trg_zukan_record_subject_links_no_update
BEFORE UPDATE OR DELETE ON zukan_record_subject_links
FOR EACH ROW EXECUTE FUNCTION zukan_reject_row_mutation();

DROP TRIGGER IF EXISTS trg_zukan_record_source_links_no_update ON zukan_record_source_links;
CREATE TRIGGER trg_zukan_record_source_links_no_update
BEFORE UPDATE OR DELETE ON zukan_record_source_links
FOR EACH ROW EXECUTE FUNCTION zukan_reject_row_mutation();

DROP TRIGGER IF EXISTS trg_zukan_claim_record_links_no_update ON zukan_claim_record_links;
CREATE TRIGGER trg_zukan_claim_record_links_no_update
BEFORE UPDATE OR DELETE ON zukan_claim_record_links
FOR EACH ROW EXECUTE FUNCTION zukan_reject_row_mutation();
