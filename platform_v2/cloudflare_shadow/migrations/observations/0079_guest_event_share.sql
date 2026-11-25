-- Additive table for guest observation event-members sharing, Gemini consent, and organizer removal.

CREATE TABLE IF NOT EXISTS guest_event_observation_shares (
  observation_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  share_scope TEXT NOT NULL DEFAULT 'private' CHECK (share_scope IN ('private', 'event_members')),
  gemini_consent_at TEXT,
  removed_by_organizer_at TEXT,
  removed_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_event_shares_event
  ON guest_event_observation_shares (event_id, share_scope, removed_by_organizer_at);
