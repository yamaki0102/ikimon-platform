-- Service-to-service receipts for NOCOSIL saved revisions. Additive only; append-only history per relationship revision.
CREATE TABLE IF NOT EXISTS nocosil_revision_receipts (
  receipt_id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source = 'nocosil'),
  link_generation TEXT NOT NULL,
  source_account_ref TEXT NOT NULL,
  relationship_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  action TEXT NOT NULL CHECK (action IN ('saved', 'removed')),
  source_state TEXT NOT NULL CHECK (source_state IN ('current', 'withdrawn', 'unavailable')),
  object_kind TEXT NOT NULL,
  object_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL,
  display_title TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_digest TEXT NOT NULL CHECK (length(payload_digest) = 64),
  received_at TEXT NOT NULL,
  UNIQUE (source, source_account_ref, relationship_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_nocosil_revision_receipts_object
  ON nocosil_revision_receipts(object_kind, object_id);
