CREATE TABLE IF NOT EXISTS nocosil_hp_sites (
  publication_id TEXT PRIMARY KEY,
  scope_digest TEXT NOT NULL,
  site_id TEXT NOT NULL,
  last_operation_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  edition_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('published', 'retracted')),
  html TEXT,
  css TEXT,
  updated_at TEXT NOT NULL
);
