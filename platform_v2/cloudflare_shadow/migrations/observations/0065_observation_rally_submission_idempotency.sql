-- A saved observation may be retried by the Worker post-save side-effect pipeline.
-- Keep one rally submission per mission, source observation and participant.
-- Existing retry duplicates are collapsed deterministically before the invariant is added.

DELETE FROM observation_rally_submissions
WHERE source_ref IS NOT NULL
  AND TRIM(source_ref) <> ''
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM observation_rally_submissions
    WHERE source_ref IS NOT NULL
      AND TRIM(source_ref) <> ''
    GROUP BY
      mission_id,
      source_type,
      source_ref,
      IFNULL(user_id, ''),
      IFNULL(guest_token, '')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_rally_submission_source_once
  ON observation_rally_submissions (
    mission_id,
    source_type,
    source_ref,
    IFNULL(user_id, ''),
    IFNULL(guest_token, '')
  )
  WHERE source_ref IS NOT NULL
    AND TRIM(source_ref) <> '';
