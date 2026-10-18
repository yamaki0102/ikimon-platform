CREATE TABLE IF NOT EXISTS zukan_public_participations (
  idempotency_key TEXT PRIMARY KEY,
  participation_kind TEXT NOT NULL CHECK (participation_kind IN ('event', 'site', 'record')),
  participation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  approver_id TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  withdrawn_at TEXT,
  payload_json TEXT NOT NULL,
  UNIQUE (participation_kind, participation_id)
);
CREATE INDEX IF NOT EXISTS idx_zukan_public_participations_public
  ON zukan_public_participations(withdrawn_at, approved_at, published_at);

CREATE TABLE IF NOT EXISTS zukan_public_participation_photos (
  idempotency_key TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  url TEXT NOT NULL,
  public_display INTEGER NOT NULL CHECK (public_display IN (0, 1)),
  rights_holder TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  PRIMARY KEY (idempotency_key, photo_id),
  FOREIGN KEY (idempotency_key) REFERENCES zukan_public_participations(idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_zukan_public_participation_photos_public
  ON zukan_public_participation_photos(idempotency_key, public_display);

CREATE TABLE IF NOT EXISTS zukan_public_participation_receipts (
  operation TEXT NOT NULL CHECK (operation IN ('publish', 'withdrawal')),
  idempotency_key TEXT NOT NULL,
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
  response_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (operation, idempotency_key)
);
