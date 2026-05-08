-- owner-sensitive-ok: adds non-destructive verification metadata for observation_fields and a claim ledger for future automated owner/staff checks.
-- destructive-ok: data backfill only; rollback by ignoring verification_* columns and field_verification_* tables.

ALTER TABLE observation_fields
  ADD COLUMN IF NOT EXISTS verification_level TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_label TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'observation_fields_verification_level_chk'
  ) THEN
    ALTER TABLE observation_fields
      ADD CONSTRAINT observation_fields_verification_level_chk
      CHECK (verification_level IN ('unverified', 'registry_matched', 'page_verified', 'owner_verified', 'staff_verified'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'observation_fields_verification_method_chk'
  ) THEN
    ALTER TABLE observation_fields
      ADD CONSTRAINT observation_fields_verification_method_chk
      CHECK (verification_method IN (
        '',
        'registry_import',
        'public_registry',
        'official_page_match',
        'owner_domain_email',
        'owner_domain_dns',
        'well_known_file',
        'authority_email',
        'staff_email',
        'manual_review',
        'ai_match'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS field_verification_issuers (
  issuer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_key TEXT NOT NULL UNIQUE,
  issuer_kind TEXT NOT NULL CHECK (issuer_kind IN (
    'education_board',
    'school_corporation',
    'company',
    'municipality',
    'university',
    'government_agency',
    'site_owner',
    'other'
  )),
  name TEXT NOT NULL,
  website_url TEXT NOT NULL DEFAULT '',
  verified_domain TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'revoked')),
  verified_at TIMESTAMPTZ,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_verification_claims (
  claim_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES observation_fields(field_id) ON DELETE CASCADE,
  issuer_id UUID REFERENCES field_verification_issuers(issuer_id) ON DELETE SET NULL,
  verification_level TEXT NOT NULL CHECK (verification_level IN (
    'registry_matched',
    'page_verified',
    'owner_verified',
    'staff_verified'
  )),
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'registry_import',
    'public_registry',
    'official_page_match',
    'owner_domain_email',
    'owner_domain_dns',
    'well_known_file',
    'authority_email',
    'staff_email',
    'manual_review',
    'ai_match'
  )),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'needs_review', 'rejected', 'expired', 'revoked')),
  evidence_url TEXT NOT NULL DEFAULT '',
  evidence_domain TEXT NOT NULL DEFAULT '',
  claimant_email TEXT NOT NULL DEFAULT '',
  ai_match_score NUMERIC(4,3),
  label TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_verification_claims_field
  ON field_verification_claims (field_id, status, verification_level);

CREATE INDEX IF NOT EXISTS idx_field_verification_claims_issuer
  ON field_verification_claims (issuer_id, status);

CREATE INDEX IF NOT EXISTS idx_field_verification_claims_method
  ON field_verification_claims (verification_method, status);

UPDATE observation_fields
   SET verification_level = 'registry_matched',
       verification_method = 'public_registry',
       verification_label = '学校台帳と一致',
       verification_updated_at = NOW(),
       source_confidence = GREATEST(source_confidence, 0.650)
 WHERE verification_level = 'unverified'
   AND (source = 'school' OR admin_level = 'school')
   AND (
     entity_key LIKE 'mext_school:%'
     OR entity_key LIKE 'ksj_p29:%'
     OR certification_id LIKE 'mext-school:%'
   );

UPDATE observation_fields
   SET verification_level = 'registry_matched',
       verification_method = 'public_registry',
       verification_label = '認定情報と一致',
       verification_updated_at = NOW(),
       source_confidence = GREATEST(source_confidence, 0.950)
 WHERE verification_level = 'unverified'
   AND source IN ('nature_symbiosis_site', 'protected_area', 'oecm')
   AND (certification_id <> '' OR certification_url <> '');
