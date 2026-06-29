CREATE TABLE IF NOT EXISTS auth_rate_limits (
    rate_limit_key_hash TEXT PRIMARY KEY,
    key_scope TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    reset_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_scope_reset
    ON auth_rate_limits (key_scope, reset_at);

CREATE TABLE IF NOT EXISTS app_oauth_exchange_codes (
    code_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    session_token_ciphertext TEXT NOT NULL,
    session_token_iv TEXT NOT NULL,
    session_token_auth_tag TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_oauth_exchange_codes_expires
    ON app_oauth_exchange_codes (expires_at);
