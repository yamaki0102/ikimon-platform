-- Kubiaka private records are Cloudflare-native and intentionally isolated from
-- the generic public-media/read-model pipeline. Every routing and delivery flag
-- is server-owned and denied by default.
CREATE TABLE IF NOT EXISTS kubiaka_private_records (
  visit_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  experience_key TEXT NOT NULL CHECK (experience_key = 'kubiaka-watch'),
  protocol_profile TEXT NOT NULL,
  privacy_state TEXT NOT NULL DEFAULT 'private' CHECK (privacy_state = 'private'),
  public_aggregation_allowed INTEGER NOT NULL DEFAULT 0 CHECK (public_aggregation_allowed = 0),
  research_use_allowed INTEGER NOT NULL DEFAULT 0 CHECK (research_use_allowed = 0),
  enterprise_use_allowed INTEGER NOT NULL DEFAULT 0 CHECK (enterprise_use_allowed = 0),
  external_export_allowed INTEGER NOT NULL DEFAULT 0 CHECK (external_export_allowed = 0),
  external_routing_allowed INTEGER NOT NULL DEFAULT 0 CHECK (external_routing_allowed = 0),
  automatic_recipient_delivery_allowed INTEGER NOT NULL DEFAULT 0 CHECK (automatic_recipient_delivery_allowed = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kubiaka_private_records_owner_updated
  ON kubiaka_private_records (owner_user_id, updated_at DESC, visit_id DESC);

CREATE TABLE IF NOT EXISTS kubiaka_private_record_media (
  media_id TEXT PRIMARY KEY,
  visit_id TEXT NOT NULL REFERENCES kubiaka_private_records(visit_id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL UNIQUE REFERENCES asset_ledger(asset_id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL,
  photo_index INTEGER NOT NULL CHECK (photo_index BETWEEN 1 AND 6),
  object_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (visit_id, photo_index)
);

CREATE INDEX IF NOT EXISTS idx_kubiaka_private_record_media_visit
  ON kubiaka_private_record_media (visit_id, photo_index);
