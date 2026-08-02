-- ZUKAN Foundation v2: tenant/workspace scope for Claim values linked to generic Records.
-- Existing Claim revisions remain unchanged. Scope is required only for a new
-- zukan_claim_record_links edge.

CREATE TABLE IF NOT EXISTS zukan_claim_value_scopes (
  value_artifact_id TEXT PRIMARY KEY REFERENCES zukan_value_artifacts(artifact_id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL,
  workspace_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(tenant_id)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_zukan_claim_value_scopes_tenant
  ON zukan_claim_value_scopes(tenant_id, workspace_id, value_artifact_id);

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_record_links_value_scope
BEFORE INSERT ON zukan_claim_record_links
WHEN NOT EXISTS (
  SELECT 1
    FROM zukan_records AS record
    JOIN zukan_claim_revisions AS revision
      ON revision.claim_revision_id = NEW.claim_revision_id
    JOIN zukan_claims AS claim ON claim.claim_id = revision.claim_id
   WHERE record.record_id = NEW.record_id
     AND claim.tenant_id = record.tenant_id
     AND claim.workspace_id IS record.workspace_id
     AND (
       revision.value_artifact_id IS NULL
       OR EXISTS (
         SELECT 1
           FROM zukan_claim_value_scopes AS scope
           JOIN zukan_value_artifacts AS artifact
             ON artifact.artifact_id = scope.value_artifact_id
          WHERE scope.value_artifact_id = revision.value_artifact_id
            AND scope.tenant_id = record.tenant_id
            AND scope.workspace_id IS record.workspace_id
            AND artifact.availability_status = 'available'
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_value_scope_mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_value_scopes_no_update
BEFORE UPDATE ON zukan_claim_value_scopes
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_value_scopes_immutable');
END;
CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_value_scopes_no_delete
BEFORE DELETE ON zukan_claim_value_scopes
BEGIN
  SELECT RAISE(ABORT, 'zukan_claim_value_scopes_immutable');
END;
