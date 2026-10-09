CREATE TABLE IF NOT EXISTS journey_session_nonces (
  nonce_hash TEXT PRIMARY KEY,
  minted_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journey_session_nonces_minted_at
  ON journey_session_nonces(minted_at);

-- Provider email-linking must never bind the dedicated QA principal, even if
-- a provider were to return the reserved .invalid address. Ordinary users are unchanged.
CREATE TRIGGER IF NOT EXISTS journey_synthetic_oauth_insert
BEFORE INSERT ON oauth_accounts
WHEN NEW.user_id = 'user_journey_synthetic'
  OR lower(NEW.provider_email) = 'journey-synthetic@zukan.invalid'
BEGIN
  SELECT RAISE(ABORT, 'journey_synthetic_oauth_forbidden');
END;
CREATE TRIGGER IF NOT EXISTS journey_synthetic_oauth_update
BEFORE UPDATE ON oauth_accounts
WHEN NEW.user_id = 'user_journey_synthetic'
  OR OLD.user_id = 'user_journey_synthetic'
  OR lower(NEW.provider_email) = 'journey-synthetic@zukan.invalid'
BEGIN
  SELECT RAISE(ABORT, 'journey_synthetic_oauth_forbidden');
END;
