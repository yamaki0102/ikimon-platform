-- Additive-only 6 tables for ZUKAN Guest Posting (Pass, Destinations, Quotas, Reservations, Handoff, Audit)

CREATE TABLE IF NOT EXISTS guest_passes (
  pass_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  revoked_reason TEXT,
  last_used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_passes_status_expires ON guest_passes (status, expires_at);

CREATE TABLE IF NOT EXISTS guest_pass_destinations (
  id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL,
  destination_kind TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(pass_id, destination_kind, destination_id)
);

CREATE TABLE IF NOT EXISTS guest_destination_quotas (
  destination_key TEXT PRIMARY KEY,
  qr_stopped INTEGER NOT NULL DEFAULT 0,
  max_count INTEGER NOT NULL DEFAULT 50,
  reserved_count INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_slot_reservations (
  reservation_id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL,
  destination_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_handoff_codes (
  code_id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  claimed_by_user_id TEXT,
  claimed_at INTEGER,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guest_pass_audit_events (
  event_id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
