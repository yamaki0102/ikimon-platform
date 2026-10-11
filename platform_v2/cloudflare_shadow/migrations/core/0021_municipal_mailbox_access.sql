-- Scoped mailbox proof uses existing auth_sessions. It is not a municipality-admin role.
CREATE TABLE IF NOT EXISTS municipal_inboxes (
  municipality_code TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS municipal_mailbox_memberships (
  membership_id TEXT PRIMARY KEY,
  municipality_code TEXT NOT NULL REFERENCES municipal_inboxes(municipality_code),
  holder_id TEXT NOT NULL,
  email TEXT NOT NULL,
  verified_domain TEXT NOT NULL,
  directory_version TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(municipality_code, email)
);
CREATE INDEX IF NOT EXISTS idx_municipal_membership_holder ON municipal_mailbox_memberships(holder_id, expires_at);
CREATE TABLE IF NOT EXISTS municipal_email_challenges (
  challenge_id TEXT PRIMARY KEY,
  municipality_code TEXT NOT NULL,
  email TEXT NOT NULL,
  browser_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  send_state TEXT NOT NULL CHECK(send_state IN ('reserved','sent','unknown')),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  consumed_nonce TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_municipal_challenge_email ON municipal_email_challenges(email, created_at);
CREATE INDEX IF NOT EXISTS idx_municipal_challenge_expiry ON municipal_email_challenges(expires_at);
CREATE TABLE IF NOT EXISTS municipal_email_usage (
  scope TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0)
);
-- Short-lived evidence from the municipality's catalogued official site; never an applicant URL.
CREATE TABLE IF NOT EXISTS municipal_domain_evidence (
  municipality_code TEXT NOT NULL,
  domain TEXT NOT NULL,
  directory_version TEXT NOT NULL,
  source_url TEXT,
  verified INTEGER NOT NULL CHECK(verified IN (0,1)),
  verified_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  PRIMARY KEY(municipality_code, domain)
);
CREATE INDEX IF NOT EXISTS idx_municipal_domain_expiry ON municipal_domain_evidence(expires_at);
