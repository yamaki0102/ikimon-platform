-- owner-sensitive-ok: evidence_assets is owned outside the app deploy role in production.
-- Do not create indexes on it from the normal migration runner. Apply this
-- performance index through a DBA/owner-role maintenance path instead.
DO $$
BEGIN
  RAISE NOTICE 'skip idx_evidence_assets_visit_role_created: evidence_assets owner role required';
END $$;
