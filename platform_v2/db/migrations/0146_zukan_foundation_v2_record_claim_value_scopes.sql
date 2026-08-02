-- ZUKAN Foundation v2: tenant/workspace scope for Claim values linked to generic Records.
-- Additive only. Existing Claim revisions are unchanged. The scope is required only
-- when a ClaimRevision is connected to a generic Record through zukan_claim_record_links.

CREATE TABLE IF NOT EXISTS zukan_claim_value_scopes (
    value_artifact_id UUID PRIMARY KEY REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
    tenant_id TEXT NOT NULL,
    workspace_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (length(trim(tenant_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_claim_value_scopes_tenant
    ON zukan_claim_value_scopes (tenant_id, workspace_id, value_artifact_id);

CREATE OR REPLACE FUNCTION zukan_validate_claim_record_value_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    record_tenant TEXT;
    record_workspace TEXT;
    claim_tenant TEXT;
    claim_workspace TEXT;
    claim_value_artifact_id UUID;
    value_tenant TEXT;
    value_workspace TEXT;
    value_status TEXT;
BEGIN
    SELECT tenant_id, workspace_id
      INTO record_tenant, record_workspace
      FROM zukan_records
     WHERE record_id = NEW.record_id
     FOR KEY SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_claim_record_parent_missing'
          USING ERRCODE = '23503';
    END IF;

    SELECT claim.tenant_id,
           claim.workspace_id,
           revision.value_artifact_id
      INTO claim_tenant, claim_workspace, claim_value_artifact_id
      FROM zukan_claim_revisions AS revision
      JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
     WHERE revision.claim_revision_id = NEW.claim_revision_id
     FOR KEY SHARE OF revision, claim;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'zukan_claim_record_revision_missing'
          USING ERRCODE = '23503';
    END IF;

    IF claim_tenant IS DISTINCT FROM record_tenant
       OR claim_workspace IS DISTINCT FROM record_workspace THEN
        RAISE EXCEPTION 'zukan_claim_record_scope_mismatch'
          USING ERRCODE = '23514';
    END IF;

    IF claim_value_artifact_id IS NOT NULL THEN
        SELECT scope.tenant_id,
               scope.workspace_id,
               artifact.availability_status
          INTO value_tenant, value_workspace, value_status
          FROM zukan_claim_value_scopes AS scope
          JOIN zukan_value_artifacts AS artifact
            ON artifact.artifact_id = scope.value_artifact_id
         WHERE scope.value_artifact_id = claim_value_artifact_id
         FOR KEY SHARE OF scope, artifact;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'zukan_claim_value_scope_not_found'
              USING ERRCODE = '23503';
        END IF;
        IF value_status <> 'available' THEN
            RAISE EXCEPTION 'zukan_claim_value_artifact_not_available'
              USING ERRCODE = '23514';
        END IF;
        IF value_tenant IS DISTINCT FROM record_tenant
           OR value_workspace IS DISTINCT FROM record_workspace THEN
            RAISE EXCEPTION 'zukan_claim_value_scope_mismatch'
              USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zukan_claim_record_links_value_scope
  ON zukan_claim_record_links;
CREATE TRIGGER trg_zukan_claim_record_links_value_scope
BEFORE INSERT ON zukan_claim_record_links
FOR EACH ROW
EXECUTE FUNCTION zukan_validate_claim_record_value_scope();

DROP TRIGGER IF EXISTS trg_zukan_claim_value_scopes_no_update
  ON zukan_claim_value_scopes;
CREATE TRIGGER trg_zukan_claim_value_scopes_no_update
BEFORE UPDATE OR DELETE ON zukan_claim_value_scopes
FOR EACH ROW
EXECUTE FUNCTION zukan_reject_row_mutation();
