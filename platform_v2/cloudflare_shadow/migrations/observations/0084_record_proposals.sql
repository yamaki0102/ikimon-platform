CREATE INDEX IF NOT EXISTS idx_reading_revisions_actor ON record_reading_revisions (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reading_revisions_reverts ON record_reading_revisions (reverts_revision_id) WHERE reverts_revision_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS record_reading_revision_voids (
  revision_id TEXT PRIMARY KEY REFERENCES record_reading_revisions(revision_id) ON DELETE RESTRICT,
  item_id TEXT NOT NULL REFERENCES record_reading_items(item_id) ON DELETE RESTRICT,
  actor_id TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('account_voided', 'operator')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reading_voids_item ON record_reading_revision_voids (item_id);
CREATE INDEX IF NOT EXISTS idx_reading_voids_actor ON record_reading_revision_voids (actor_id);

CREATE TABLE IF NOT EXISTS record_proposer_standing (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('suspended', 'released')),
  reason TEXT NOT NULL CHECK (reason IN ('reverted_often', 'account_voided', 'operator')),
  suspended_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  released_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
