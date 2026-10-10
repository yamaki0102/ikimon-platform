-- Add versioned Ryuyo participation-notice evidence. Existing participants stay
-- NULL until they see the notice and complete a new participation check-in.
ALTER TABLE observation_event_participants
  ADD COLUMN discovery_gemini_notice_version TEXT;

ALTER TABLE observation_event_participants
  ADD COLUMN discovery_gemini_notice_at TEXT;
