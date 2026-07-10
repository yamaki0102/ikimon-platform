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

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
