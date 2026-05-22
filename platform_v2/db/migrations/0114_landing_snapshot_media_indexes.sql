-- Speed up landing snapshots that repeatedly test media availability by visit.
-- The original schema indexed evidence_assets.occurrence_id but not visit_id,
-- so public top feed generation had to scan media rows for each recent visit.
-- owner-sensitive-ok: deploy through the production migration runner; rollback is DROP INDEX IF EXISTS for these two non-unique indexes.

CREATE INDEX IF NOT EXISTS idx_evidence_assets_visit_role_created_at
    ON evidence_assets (visit_id, asset_role, created_at)
    WHERE visit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_assets_occurrence_role_created_at
    ON evidence_assets (occurrence_id, asset_role, created_at)
    WHERE occurrence_id IS NOT NULL;
