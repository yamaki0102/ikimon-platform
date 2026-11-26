CREATE TABLE IF NOT EXISTS gbif_consent_events (
  consent_id TEXT PRIMARY KEY CHECK (length(consent_id) = 36),
  record_runtime TEXT NOT NULL DEFAULT 'cloudflare_d1' CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('data', 'media')),
  asset_id TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL CHECK (decision IN ('on', 'off')),
  license_uri TEXT NOT NULL,
  attribution_alias TEXT,
  notice_version TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  supersedes_id TEXT REFERENCES gbif_consent_events(consent_id) ON DELETE RESTRICT,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (record_runtime, record_id, request_id),
  CHECK (
    (scope = 'data' AND asset_id = '' AND license_uri = 'https://creativecommons.org/licenses/by/4.0/')
    OR (scope = 'media' AND asset_id <> '' AND license_uri = 'https://creativecommons.org/licenses/by-nc/4.0/')
  ),
  CHECK (decision = 'off' OR scope = 'media' OR (attribution_alias IS NOT NULL AND length(attribution_alias) BETWEEN 1 AND 40))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gbif_consent_root ON gbif_consent_events (record_runtime, record_id, scope, asset_id) WHERE supersedes_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gbif_consent_successor ON gbif_consent_events (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gbif_consent_record ON gbif_consent_events (record_runtime, record_id, scope, decided_at);

CREATE TABLE IF NOT EXISTS gbif_taxon_matches (
  match_id TEXT PRIMARY KEY CHECK (length(match_id) = 36),
  name_key TEXT NOT NULL CHECK (name_key <> ''),
  submitted_name TEXT NOT NULL,
  submitted_rank TEXT NOT NULL DEFAULT '',
  checklist_key TEXT NOT NULL DEFAULT 'gbif-backbone',
  match_version INTEGER NOT NULL CHECK (match_version >= 1),
  usage_key TEXT,
  accepted_key TEXT,
  accepted_name TEXT,
  accepted_rank TEXT,
  kingdom TEXT,
  phylum TEXT,
  class_name TEXT,
  order_name TEXT,
  family TEXT,
  genus TEXT,
  species TEXT,
  match_type TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'hold')),
  hold_reason TEXT,
  response_digest TEXT NOT NULL,
  matched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name_key, submitted_rank, checklist_key, match_version)
);

CREATE INDEX IF NOT EXISTS idx_gbif_taxon_matches_lookup ON gbif_taxon_matches (name_key, submitted_rank, checklist_key, match_version DESC);

CREATE TABLE IF NOT EXISTS gbif_occurrence_ids (
  occurrence_id TEXT PRIMARY KEY CHECK (occurrence_id = 'urn:uuid:' || observation_id),
  observation_id TEXT NOT NULL UNIQUE CHECK (length(observation_id) = 36),
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TEXT,
  successor_ref TEXT
);

CREATE TRIGGER IF NOT EXISTS trg_gbif_occurrence_ids_no_delete BEFORE DELETE ON gbif_occurrence_ids
BEGIN
  SELECT RAISE(ABORT, 'gbif_occurrence_id_is_permanent');
END;

CREATE TRIGGER IF NOT EXISTS trg_gbif_occurrence_ids_identity_fixed BEFORE UPDATE OF occurrence_id, observation_id ON gbif_occurrence_ids
BEGIN
  SELECT RAISE(ABORT, 'gbif_occurrence_id_is_permanent');
END;

CREATE TABLE IF NOT EXISTS gbif_editions (
  edition_id TEXT PRIMARY KEY CHECK (length(edition_id) = 36),
  rule_version TEXT NOT NULL,
  sensitive_list_version TEXT NOT NULL,
  built_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  occurrence_count INTEGER NOT NULL CHECK (occurrence_count >= 0),
  media_count INTEGER NOT NULL CHECK (media_count >= 0),
  withdrawn_count INTEGER NOT NULL DEFAULT 0 CHECK (withdrawn_count >= 0),
  archive_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'built', 'superseded'))
);

CREATE TABLE IF NOT EXISTS gbif_edition_members (
  edition_id TEXT NOT NULL REFERENCES gbif_editions(edition_id) ON DELETE RESTRICT,
  occurrence_id TEXT NOT NULL REFERENCES gbif_occurrence_ids(occurrence_id) ON DELETE RESTRICT,
  row_digest TEXT NOT NULL,
  media_count INTEGER NOT NULL DEFAULT 0 CHECK (media_count >= 0),
  PRIMARY KEY (edition_id, occurrence_id)
);

CREATE INDEX IF NOT EXISTS idx_gbif_edition_members_occurrence ON gbif_edition_members (occurrence_id, edition_id);

CREATE TABLE IF NOT EXISTS gbif_sensitive_list_versions (
  list_version TEXT PRIMARY KEY,
  source_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gbif_sensitive_list_active ON gbif_sensitive_list_versions (status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS gbif_sensitive_taxa (
  list_version TEXT NOT NULL REFERENCES gbif_sensitive_list_versions(list_version) ON DELETE RESTRICT,
  name_key TEXT NOT NULL CHECK (name_key <> ''),
  tier TEXT NOT NULL CHECK (tier IN ('coarse', 'withhold')),
  PRIMARY KEY (list_version, name_key)
);
