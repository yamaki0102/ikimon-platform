CREATE TABLE IF NOT EXISTS auth_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  role_name TEXT NOT NULL DEFAULT 'Observer',
  rank_label TEXT,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  last_login_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email
  ON auth_users(email);

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

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email
  ON oauth_accounts(provider_email);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
  ON oauth_accounts(user_id);
