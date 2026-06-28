CREATE TABLE IF NOT EXISTS specialist_authorities (
  authority_id TEXT PRIMARY KEY,
  subject_user_id TEXT NOT NULL,
  granted_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  authority_kind TEXT NOT NULL DEFAULT 'taxon_identification' CHECK (authority_kind = 'taxon_identification'),
  scope_taxon_name TEXT NOT NULL,
  scope_taxon_rank TEXT,
  scope_taxon_key TEXT,
  scope_json TEXT NOT NULL DEFAULT '{}',
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  expires_at TEXT,
  reason TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_specialist_authorities_active_unique
  ON specialist_authorities (
    subject_user_id,
    authority_kind,
    lower(scope_taxon_name),
    coalesce(scope_taxon_rank, ''),
    coalesce(scope_taxon_key, '')
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_specialist_authorities_subject_status
  ON specialist_authorities (subject_user_id, status, granted_at DESC);

CREATE TABLE IF NOT EXISTS specialist_authority_evidence (
  evidence_id TEXT PRIMARY KEY,
  authority_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('field_event', 'webinar', 'literature', 'reference_owned', 'other')),
  title TEXT NOT NULL,
  issuer_name TEXT,
  url TEXT,
  notes TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (authority_id) REFERENCES specialist_authorities(authority_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_specialist_authority_evidence_authority
  ON specialist_authority_evidence (authority_id, created_at DESC);

CREATE TABLE IF NOT EXISTS specialist_authority_audit (
  audit_id TEXT PRIMARY KEY,
  authority_id TEXT,
  actor_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('grant', 'revoke', 'update')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_specialist_authority_audit_authority
  ON specialist_authority_audit (authority_id, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  subject_user_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('self_claim', 'ops_registered')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'granted', 'rejected', 'revoked')),
  scope_taxon_name TEXT NOT NULL,
  scope_taxon_rank TEXT,
  scope_taxon_key TEXT,
  recommended_by_user_id TEXT,
  granted_authority_id TEXT,
  resolution_note TEXT,
  resolved_by_user_id TEXT,
  resolved_at TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_authority_recommendations_pending_unique
  ON authority_recommendations (
    subject_user_id,
    lower(scope_taxon_name),
    coalesce(scope_taxon_rank, ''),
    coalesce(scope_taxon_key, '')
  )
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_authority_recommendations_subject_status
  ON authority_recommendations (subject_user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_recommendation_evidence (
  evidence_id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('field_event', 'webinar', 'literature', 'reference_owned', 'other')),
  title TEXT NOT NULL,
  issuer_name TEXT,
  url TEXT,
  notes TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recommendation_id) REFERENCES authority_recommendations(recommendation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_authority_recommendation_evidence_recommendation
  ON authority_recommendation_evidence (recommendation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS authority_recommendation_audit (
  audit_id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'grant', 'reject', 'revoke')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
