-- Forward repair for databases that applied the image-only version of 0071.
-- Apply after 0071 in the registered D1 migration transaction; do not execute
-- individual statements or disable foreign keys. The runner owns the transaction.
-- Only the two known 0071 schemas (images, or images + videos) are accepted.
-- Unknown columns/constraints, dependent foreign keys, triggers/views, and indexes
-- require a separately reviewed migration instead of being discarded by this one.

CREATE TABLE observation_event_guest_media_video_0073 (
  submission_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  actor_user_id TEXT,
  asset_key TEXT NOT NULL UNIQUE,
  request_sha256 TEXT NOT NULL,
  media_sha256 TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm')),
  bytes INTEGER NOT NULL CHECK (bytes > 0 AND bytes <= 12582912),
  media_state TEXT NOT NULL DEFAULT 'uploading'
    CHECK (media_state IN ('uploading', 'saved', 'failed')),
  idempotency_key TEXT NOT NULL,
  private_storage_consent_at TEXT NOT NULL,
  creator_rights_attested_at TEXT NOT NULL,
  rights_review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (rights_review_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  rights_reviewed_by TEXT,
  rights_reviewed_at TEXT,
  rights_review_note TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility = 'private'),
  private_delete_pending INTEGER NOT NULL DEFAULT 0 CHECK (private_delete_pending IN (0, 1)),
  active_upload_count INTEGER NOT NULL DEFAULT 0 CHECK (active_upload_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (session_id, participant_id, idempotency_key)
);

CREATE TABLE observation_event_guest_media_video_0073_guard (
  known_schema INTEGER NOT NULL
    CONSTRAINT guest_media_0073_known_schema CHECK (known_schema = 1),
  no_inbound_foreign_keys INTEGER NOT NULL
    CONSTRAINT guest_media_0073_no_inbound_foreign_keys CHECK (no_inbound_foreign_keys = 1),
  no_dependent_triggers_or_views INTEGER NOT NULL
    CONSTRAINT guest_media_0073_no_dependent_triggers_or_views CHECK (no_dependent_triggers_or_views = 1),
  known_indexes INTEGER NOT NULL
    CONSTRAINT guest_media_0073_known_indexes CHECK (known_indexes = 1),
  complete_copy INTEGER NOT NULL DEFAULT 1
    CONSTRAINT guest_media_0073_complete_copy CHECK (complete_copy = 1)
);

-- Compare the complete schema body without removing whitespace from quoted
-- defaults or CHECK values. ALTER TABLE RENAME may quote the table identifier.
-- Refuse other DDL rather than silently weakening an unrecognized constraint.
INSERT INTO observation_event_guest_media_video_0073_guard (
  known_schema, no_inbound_foreign_keys, no_dependent_triggers_or_views, known_indexes
)
SELECT
  EXISTS (
    SELECT 1
    FROM sqlite_schema AS original
    JOIN sqlite_schema AS replacement
      ON replacement.type = 'table'
     AND replacement.name = 'observation_event_guest_media_video_0073'
    WHERE original.type = 'table'
      AND original.name = 'observation_event_guest_media'
      AND substr(original.sql, 1, instr(original.sql, '(') - 1) IN (
        'CREATE TABLE observation_event_guest_media ',
        'CREATE TABLE "observation_event_guest_media" '
      )
      AND substr(original.sql, instr(original.sql, '(')) IN (
        substr(replacement.sql, instr(replacement.sql, '(')),
        replace(
          substr(replacement.sql, instr(replacement.sql, '(')),
          ', ''video/mp4'', ''video/webm''', ''
        )
      )
  ),
  -- Deferring FK checks would still allow DROP TABLE to cascade-delete child
  -- rows. D1 rejects the table-valued foreign_key_list PRAGMA, so conservatively
  -- refuse any other table DDL containing this identifier (including quoted or
  -- mixed-case references). False positives require review; do not skip them.
  -- The three exclusions are the exact known original and the two tables just
  -- created above, whose complete definitions contain no foreign keys.
  NOT EXISTS (
    SELECT 1
    FROM sqlite_schema AS source_table
    WHERE source_table.type = 'table'
      AND lower(source_table.name) NOT IN (
        'observation_event_guest_media',
        'observation_event_guest_media_video_0073',
        'observation_event_guest_media_video_0073_guard'
      )
      AND instr(lower(source_table.sql), 'observation_event_guest_media') > 0
  ),
  NOT EXISTS (
    SELECT 1 FROM sqlite_schema
    WHERE type IN ('trigger', 'view')
      AND (
        lower(tbl_name) = 'observation_event_guest_media'
        OR instr(lower(sql), 'observation_event_guest_media') > 0
      )
  ),
  (
    (SELECT count(*) FROM sqlite_schema
      WHERE type = 'index' AND tbl_name = 'observation_event_guest_media') = 5
    AND (SELECT count(*) FROM sqlite_schema
      WHERE type = 'index' AND tbl_name = 'observation_event_guest_media'
        AND sql IS NULL
        AND name IN (
          'sqlite_autoindex_observation_event_guest_media_1',
          'sqlite_autoindex_observation_event_guest_media_2',
          'sqlite_autoindex_observation_event_guest_media_3'
        )) = 3
    AND EXISTS (
      SELECT 1 FROM sqlite_schema
      WHERE type = 'index' AND tbl_name = 'observation_event_guest_media'
        AND name = 'idx_obs_event_guest_media_participant'
        AND sql = 'CREATE INDEX idx_obs_event_guest_media_participant
  ON observation_event_guest_media (session_id, participant_id, created_at DESC)'
    )
    AND EXISTS (
      SELECT 1 FROM sqlite_schema
      WHERE type = 'index' AND tbl_name = 'observation_event_guest_media'
        AND name = 'idx_obs_event_guest_media_review'
        AND sql = 'CREATE INDEX idx_obs_event_guest_media_review
  ON observation_event_guest_media (session_id, rights_review_status, created_at DESC)'
    )
  );

-- Preserve every stored value, including the internal rowid. Never deduplicate,
-- rewrite consent/review/withdrawal state, or substitute newly evaluated defaults.
INSERT INTO observation_event_guest_media_video_0073 (
  rowid, submission_id, session_id, participant_id, actor_user_id, asset_key,
  request_sha256, media_sha256, mime, bytes, media_state, idempotency_key,
  private_storage_consent_at, creator_rights_attested_at, rights_review_status,
  rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility,
  private_delete_pending, active_upload_count, created_at, updated_at
)
SELECT
  rowid, submission_id, session_id, participant_id, actor_user_id, asset_key,
  request_sha256, media_sha256, mime, bytes, media_state, idempotency_key,
  private_storage_consent_at, creator_rights_attested_at, rights_review_status,
  rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility,
  private_delete_pending, active_upload_count, created_at, updated_at
FROM observation_event_guest_media;

UPDATE observation_event_guest_media_video_0073_guard
SET complete_copy = (
  (SELECT count(*) FROM observation_event_guest_media)
    = (SELECT count(*) FROM observation_event_guest_media_video_0073)
  AND NOT EXISTS (
    SELECT rowid, * FROM observation_event_guest_media
    EXCEPT
    SELECT rowid, * FROM observation_event_guest_media_video_0073
  )
);

DROP TABLE observation_event_guest_media;
ALTER TABLE observation_event_guest_media_video_0073 RENAME TO observation_event_guest_media;

CREATE INDEX idx_obs_event_guest_media_participant
  ON observation_event_guest_media (session_id, participant_id, created_at DESC);

CREATE INDEX idx_obs_event_guest_media_review
  ON observation_event_guest_media (session_id, rights_review_status, created_at DESC);

DROP TABLE observation_event_guest_media_video_0073_guard;
