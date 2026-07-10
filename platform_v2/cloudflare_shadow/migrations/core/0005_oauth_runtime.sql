CREATE TABLE IF NOT EXISTS oauth_accounts (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  provider_email TEXT,
  display_name TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT 'Observer',
  rank_label TEXT,
  banned INTEGER NOT NULL DEFAULT 0,
  profile_json TEXT NOT NULL DEFAULT '{}',
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts(provider_email);
