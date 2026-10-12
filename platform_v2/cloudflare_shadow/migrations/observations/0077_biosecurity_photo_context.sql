-- Nullable capture-time provenance over shared private drafts. No invented observed_at.
-- Environment decisions are opt-in, bounded, per-record and never public projections.
ALTER TABLE biosecurity_record_contexts ADD COLUMN capture_details_json TEXT CHECK(capture_details_json IS NULL OR json_valid(capture_details_json));
ALTER TABLE biosecurity_record_contexts ADD COLUMN private_note TEXT;
ALTER TABLE biosecurity_record_contexts ADD COLUMN environment_json TEXT CHECK(environment_json IS NULL OR json_valid(environment_json));
ALTER TABLE biosecurity_record_contexts ADD COLUMN environment_version INTEGER NOT NULL DEFAULT 0 CHECK(environment_version >= 0);
-- Snapshot only the explicitly selected environmental fields at the consent boundary.
ALTER TABLE biosecurity_shares ADD COLUMN environment_json TEXT CHECK(environment_json IS NULL OR json_valid(environment_json));

CREATE TABLE IF NOT EXISTS biosecurity_photo_hint_attempts (
  record_id TEXT PRIMARY KEY REFERENCES biosecurity_record_contexts(record_id),
  attempt_key TEXT NOT NULL UNIQUE,
  asset_id TEXT NOT NULL,
  asset_sha256 TEXT NOT NULL,
  model TEXT NOT NULL,
  question_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('reserved','ready','unavailable')),
  reserved_tokens INTEGER NOT NULL CHECK(reserved_tokens > 0),
  input_tokens INTEGER CHECK(input_tokens IS NULL OR input_tokens >= 0),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
