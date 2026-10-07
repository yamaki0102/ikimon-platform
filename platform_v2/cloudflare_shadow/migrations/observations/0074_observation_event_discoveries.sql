-- Additive event-scoped publication metadata over the existing participant and
-- private guest-media records. No source media, identity or event is copied.
CREATE TABLE IF NOT EXISTS observation_event_discoveries (
  entry_id TEXT PRIMARY KEY,
  journal_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES observation_event_sessions(session_id),
  participant_id TEXT NOT NULL REFERENCES observation_event_participants(participant_id),
  submission_id TEXT UNIQUE REFERENCES observation_event_guest_media(submission_id) ON DELETE CASCADE,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('photo', 'paper')),
  caption TEXT CHECK (caption IS NULL OR length(caption) <= 280),
  spot_label TEXT CHECK (spot_label IS NULL OR length(spot_label) <= 80),
  is_minor INTEGER NOT NULL CHECK (is_minor IN (0, 1)),
  gallery_consent_at TEXT,
  guardian_gallery_consent_at TEXT,
  idempotency_key TEXT NOT NULL,
  source_request_sha256 TEXT NOT NULL,
  source_media_sha256 TEXT,
  privacy_status TEXT NOT NULL DEFAULT 'pending' CHECK (privacy_status IN ('pending', 'verified', 'rejected')),
  privacy_method TEXT,
  privacy_verified_at TEXT,
  derivative_key TEXT,
  derivative_sha256 TEXT,
  derivative_verified_at TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT CHECK (review_note IS NULL OR length(review_note) <= 500),
  reviewed_display_name TEXT CHECK (reviewed_display_name IS NULL OR length(reviewed_display_name) <= 32),
  selection_label TEXT CHECK (selection_label IS NULL OR length(selection_label) <= 40),
  selection_comment TEXT CHECK (selection_comment IS NULL OR length(selection_comment) <= 280),
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, participant_id, idempotency_key),
  CHECK ((entry_kind = 'photo' AND submission_id IS NOT NULL AND source_media_sha256 IS NOT NULL)
      OR (entry_kind = 'paper' AND submission_id IS NULL AND source_media_sha256 IS NULL)),
  CHECK (gallery_consent_at IS NULL OR is_minor = 0 OR guardian_gallery_consent_at IS NOT NULL),
  CHECK (privacy_status <> 'verified' OR (privacy_method IS NOT NULL AND privacy_verified_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_obs_event_discoveries_journal
  ON observation_event_discoveries (session_id, journal_id, entry_id);

CREATE INDEX IF NOT EXISTS idx_obs_event_discoveries_participant
  ON observation_event_discoveries (session_id, participant_id, entry_id);

CREATE INDEX IF NOT EXISTS idx_obs_event_discoveries_review
  ON observation_event_discoveries (session_id, review_status, entry_id);
