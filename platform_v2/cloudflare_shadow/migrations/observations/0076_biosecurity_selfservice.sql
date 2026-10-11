-- Additive context/consent over the shared draft_observations, observations and asset_ledger.
-- Does not publish, migrate historical private data, grant a role, or enqueue analysis.
CREATE TABLE IF NOT EXISTS biosecurity_guest_sessions (
  owner_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_biosecurity_guest_expiry ON biosecurity_guest_sessions(expires_at);

CREATE TABLE IF NOT EXISTS biosecurity_usage (
  scope TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  bytes INTEGER NOT NULL DEFAULT 0 CHECK(bytes >= 0)
);

CREATE TABLE IF NOT EXISTS biosecurity_record_contexts (
  record_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE,
  owner_hash TEXT NOT NULL REFERENCES biosecurity_guest_sessions(owner_hash),
  profile_id TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  municipality_code TEXT,
  spot_label TEXT,
  signal TEXT NOT NULL,
  is_minor INTEGER NOT NULL CHECK(is_minor IN (0,1)),
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  reserved_bytes INTEGER NOT NULL CHECK(reserved_bytes >= 0),
  selected_count INTEGER NOT NULL CHECK(selected_count BETWEEN 1 AND 6),
  persistence TEXT NOT NULL CHECK(persistence IN ('uploading','saved','deleting','deleted')),
  lease_token TEXT,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(owner_hash, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_biosecurity_owner ON biosecurity_record_contexts(owner_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_biosecurity_expiry ON biosecurity_record_contexts(persistence, expires_at);

CREATE TABLE IF NOT EXISTS biosecurity_shares (
  share_id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES biosecurity_record_contexts(record_id),
  municipality_code TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose = 'invasive_response'),
  fields_json TEXT NOT NULL CHECK(json_valid(fields_json)),
  guardian_consent INTEGER NOT NULL CHECK(guardian_consent IN (0,1)),
  owner_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available','acknowledged','withdrawn')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  withdrawn_at TEXT,
  UNIQUE(owner_hash, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_biosecurity_share_recipient ON biosecurity_shares(municipality_code, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_biosecurity_share_record ON biosecurity_shares(record_id, status);

CREATE TABLE IF NOT EXISTS biosecurity_share_events (
  event_id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES biosecurity_shares(share_id),
  event_type TEXT NOT NULL CHECK(event_type IN ('consented','acknowledged','withdrawn','expired')),
  actor_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(share_id, version)
);
