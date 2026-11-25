-- Additive 1-row-per-guest-pass owner mapping table for ZUKAN Guest Handoff.
-- Keeps guest observations decoupled from legacy event auto-claim.

CREATE TABLE IF NOT EXISTS guest_owner_claims (
  guest_owner_key TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL UNIQUE,
  claimed_by_user_id TEXT NOT NULL,
  handoff_code_id TEXT NOT NULL,
  claimed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_owner_claims_user
  ON guest_owner_claims (claimed_by_user_id, claimed_at);
