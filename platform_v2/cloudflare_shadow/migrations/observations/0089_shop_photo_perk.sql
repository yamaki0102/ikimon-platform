-- Shop Photo Perk minimal prototype (expand-first, flag-gated SHOP_PHOTO_PERK_ENABLED).
-- Additive only: no DROP, DELETE, or unconditional UPDATE.

CREATE TABLE IF NOT EXISTS shop_perk_configs (
  place_id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  perk_text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_photo_perks (
  perk_post_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  observation_id TEXT,
  asset_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  guest_pass_id TEXT,
  has_perk_disclosure INTEGER NOT NULL DEFAULT 1,
  inspection_status TEXT NOT NULL DEFAULT 'pending',
  inspection_reason TEXT,
  face_privacy TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'published',
  taken_down_by_user_id TEXT,
  taken_down_at TEXT,
  checkout_session_id TEXT NOT NULL,
  perk_snapshot_text TEXT NOT NULL,
  ticket_status TEXT NOT NULL DEFAULT 'issued',
  redeemed_at TEXT,
  redeemed_by_actor TEXT,
  claimed_by_user_id TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_photo_perks_place_pub
  ON shop_photo_perks(place_id, moderation_status, inspection_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shop_photo_perks_checkout_once
  ON shop_photo_perks(place_id, checkout_session_id)
  WHERE inspection_status = 'passed';

CREATE TABLE IF NOT EXISTS shop_photo_perk_events (
  event_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  perk_post_id TEXT,
  event_type TEXT NOT NULL,
  actor_key TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_photo_perk_events_place
  ON shop_photo_perk_events(place_id, event_type, created_at DESC);
