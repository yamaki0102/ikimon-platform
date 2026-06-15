CREATE TABLE IF NOT EXISTS draft_observations (
  draft_id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  observed_at TEXT,
  exact_lat REAL,
  exact_lng REAL,
  location_accuracy_m REAL,
  public_cell TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  processing_state TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finalized_at TEXT
);

CREATE TABLE IF NOT EXISTS observations (
  observation_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  taxon_label TEXT,
  note TEXT,
  exact_lat REAL,
  exact_lng REAL,
  location_accuracy_m REAL,
  public_cell TEXT NOT NULL,
  visibility TEXT NOT NULL,
  emergency_hidden INTEGER NOT NULL DEFAULT 0,
  processing_state TEXT NOT NULL DEFAULT 'accepted',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_ledger (
  asset_id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  observation_id TEXT,
  owner_user_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  sha256 TEXT,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  visibility TEXT NOT NULL DEFAULT 'private',
  processing_state TEXT NOT NULL DEFAULT 'awaiting_upload',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TEXT
);

CREATE TABLE IF NOT EXISTS outbox (
  outbox_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  target_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  dispatch_state TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dispatched_at TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS readmodel_public_observations (
  observation_id TEXT PRIMARY KEY,
  public_cell TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  taxon_label TEXT,
  asset_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_draft_owner ON draft_observations(owner_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assets_draft ON asset_ledger(draft_id);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(dispatch_state, created_at);
CREATE INDEX IF NOT EXISTS idx_public_cell ON readmodel_public_observations(public_cell, observed_at);
