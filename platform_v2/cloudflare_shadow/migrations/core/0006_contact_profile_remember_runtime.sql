CREATE TABLE IF NOT EXISTS contact_submissions (
  submission_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT,
  email TEXT,
  organization TEXT,
  message TEXT NOT NULL,
  source_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  user_id TEXT,
  notification_sent INTEGER NOT NULL DEFAULT 0,
  auto_reply_sent INTEGER NOT NULL DEFAULT 0,
  send_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON contact_submissions(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_ip_created
  ON contact_submissions(ip_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email_created
  ON contact_submissions(email, created_at);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_user_created
  ON contact_submissions(user_id, created_at);

CREATE TABLE IF NOT EXISTS contact_proof_nonces (
  nonce_hash TEXT PRIMARY KEY,
  issued_at_ms INTEGER NOT NULL,
  ip_hash TEXT,
  consumed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_contact_proof_nonces_consumed
  ON contact_proof_nonces(consumed_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  profile_bio TEXT NOT NULL DEFAULT '',
  expertise TEXT NOT NULL DEFAULT '',
  avatar_object_key TEXT,
  avatar_mime TEXT,
  avatar_bytes INTEGER,
  avatar_sha256 TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profile_write_audit (
  audit_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_profile_write_audit_user_created
  ON profile_write_audit(user_id, created_at);

CREATE TABLE IF NOT EXISTS remember_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_family TEXT NOT NULL DEFAULT 'v2',
  user_agent TEXT,
  ip_address TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_remember_tokens_user_id
  ON remember_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_remember_tokens_expires_at
  ON remember_tokens(expires_at);
