CREATE TABLE IF NOT EXISTS observation_event_guest_media (
  submission_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  actor_user_id TEXT,
  asset_key TEXT NOT NULL UNIQUE,
  request_sha256 TEXT NOT NULL,
  media_sha256 TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 12582912),
  media_state TEXT NOT NULL DEFAULT 'uploading'
    CHECK (media_state IN ('uploading', 'saved', 'failed')),
  idempotency_key TEXT NOT NULL,
  private_storage_consent_at TEXT NOT NULL,
  creator_rights_attested_at TEXT NOT NULL,
  rights_review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rights_review_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  rights_reviewed_by TEXT,
  rights_reviewed_at TEXT,
  rights_review_note TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, participant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_obs_event_guest_media_participant
  ON observation_event_guest_media (session_id, participant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_obs_event_guest_media_review
  ON observation_event_guest_media (session_id, rights_review_status, created_at DESC);
