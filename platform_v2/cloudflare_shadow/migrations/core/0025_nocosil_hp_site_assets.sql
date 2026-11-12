CREATE TABLE IF NOT EXISTS nocosil_hp_site_assets (
  publication_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type = 'image/webp'),
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 1500000),
  alt TEXT NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (publication_id, sha256)
);
