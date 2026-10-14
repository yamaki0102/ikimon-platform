-- Phase 1: public people are keyed by an immutable opaque public ID, not by
-- legal names, NOCOSIL workspace IDs, account IDs, or public slugs.
-- One small row per publication and bounded editions; no per-person Worker/DB.
-- Public JSON editions are immutable objects under ASSET_BUCKET person-publications/v1/.
-- D1 stores only compact current-pointer and revision metadata for multi-million profiles.
CREATE TABLE IF NOT EXISTS zukan_person_publications (
  public_id TEXT PRIMARY KEY CHECK(length(public_id) = 32),
  issuer_public_ref TEXT NOT NULL,
  current_revision INTEGER NOT NULL CHECK(current_revision > 0),
  edition_id TEXT NOT NULL,
  digest TEXT NOT NULL CHECK(length(digest) = 64),
  publication_state TEXT NOT NULL CHECK(publication_state IN ('published', 'withdrawn')),
  content_key TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS zukan_person_publication_editions (
  public_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK(revision > 0),
  issuer_public_ref TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  digest TEXT NOT NULL,
  publication_state TEXT NOT NULL CHECK(publication_state IN ('published', 'withdrawn')),
  content_key TEXT,
  published_at TEXT NOT NULL,
  PRIMARY KEY (public_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_zukan_person_published
  ON zukan_person_publications (publication_state, updated_at DESC, public_id);
