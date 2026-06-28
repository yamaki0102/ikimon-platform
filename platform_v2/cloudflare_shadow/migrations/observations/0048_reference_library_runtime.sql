CREATE TABLE IF NOT EXISTS reference_sources (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author_text TEXT NOT NULL DEFAULT '',
  publisher TEXT NOT NULL DEFAULT '',
  publication_year INTEGER,
  isbn TEXT NOT NULL DEFAULT '',
  doi TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  source_kind TEXT NOT NULL DEFAULT 'unknown',
  catalog_status TEXT NOT NULL DEFAULT 'active',
  taxon_labels_json TEXT NOT NULL DEFAULT '[]',
  commerce_links_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reference_sources_catalog_status
  ON reference_sources(catalog_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_reference_sources_isbn
  ON reference_sources(isbn)
  WHERE isbn <> '';

CREATE TABLE IF NOT EXISTS reference_access_proofs (
  proof_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_id TEXT NOT NULL REFERENCES reference_sources(source_id) ON DELETE CASCADE,
  batch_id TEXT,
  proof_kind TEXT NOT NULL DEFAULT 'manual',
  verification_status TEXT NOT NULL DEFAULT 'needs_review',
  private_use_only INTEGER NOT NULL DEFAULT 1,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, source_id, proof_kind)
);

CREATE INDEX IF NOT EXISTS idx_reference_access_proofs_user
  ON reference_access_proofs(user_id, verification_status, updated_at);

CREATE TABLE IF NOT EXISTS reference_capture_batches (
  batch_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reference_capture_items (
  item_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES reference_capture_batches(batch_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES reference_sources(source_id) ON DELETE CASCADE,
  filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  proof_kind TEXT NOT NULL DEFAULT 'manual',
  classification_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reference_identification_selections (
  selection_id TEXT PRIMARY KEY,
  occurrence_id TEXT,
  identification_id TEXT,
  source_id TEXT NOT NULL REFERENCES reference_sources(source_id) ON DELETE CASCADE,
  locator TEXT NOT NULL DEFAULT '',
  reference_role TEXT NOT NULL DEFAULT 'primary_basis',
  selected_by_user_id TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(identification_id, source_id, locator)
);

CREATE INDEX IF NOT EXISTS idx_reference_identification_selections_user
  ON reference_identification_selections(selected_by_user_id, source_id, created_at);

CREATE TABLE IF NOT EXISTS reference_corrections (
  correction_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES reference_sources(source_id) ON DELETE CASCADE,
  locator TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  corrected_name TEXT NOT NULL DEFAULT '',
  original_taxon_name TEXT NOT NULL DEFAULT '',
  corrected_taxon_name TEXT NOT NULL DEFAULT '',
  correction_kind TEXT NOT NULL DEFAULT 'misidentification',
  official_source_url TEXT NOT NULL DEFAULT '',
  official_reference TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_by_user_id TEXT,
  applies_from TEXT,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reference_corrections_source
  ON reference_corrections(source_id, verification_status, created_at);

CREATE TABLE IF NOT EXISTS reference_duplicate_merges (
  merge_id TEXT PRIMARY KEY,
  canonical_source_id TEXT NOT NULL,
  duplicate_source_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  source_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(duplicate_source_id)
);
