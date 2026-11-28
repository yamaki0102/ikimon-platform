CREATE TABLE IF NOT EXISTS place_category_assignments (
  place_id TEXT PRIMARY KEY,
  primary_category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL,
  rule_id TEXT,
  confidence REAL,
  decided_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS place_category_tags (
  place_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (place_id, tag)
);
CREATE TABLE IF NOT EXISTS place_peak_months (
  place_id TEXT NOT NULL,
  month INTEGER NOT NULL,
  source TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (place_id, month)
);
CREATE INDEX IF NOT EXISTS idx_place_category_assignments_category ON place_category_assignments (primary_category, status);
CREATE INDEX IF NOT EXISTS idx_place_category_tags_tag ON place_category_tags (tag);
