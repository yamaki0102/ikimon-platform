-- A saved observation may be retried by the application side-effect pipeline.
-- Keep one rally submission per mission, source observation and participant.
-- Existing duplicate rows are collapsed deterministically before the invariant is added.
-- destructive-ok: remove only duplicate retry rows while retaining the earliest semantic submission; duplicates cannot be meaningfully restored.
-- owner-sensitive-ok: the deployment migration role owns this table; rollback drops idx_obs_rally_submission_source_once without changing retained rows.

WITH ranked AS (
  SELECT
    submission_id,
    ROW_NUMBER() OVER (
      PARTITION BY
        mission_id,
        source_type,
        source_ref,
        COALESCE(user_id, ''),
        COALESCE(guest_token, '')
      ORDER BY created_at, submission_id
    ) AS duplicate_rank
  FROM observation_rally_submissions
  WHERE source_ref IS NOT NULL
    AND BTRIM(source_ref) <> ''
)
DELETE FROM observation_rally_submissions AS submission
USING ranked
WHERE submission.submission_id = ranked.submission_id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_rally_submission_source_once
  ON observation_rally_submissions (
    mission_id,
    source_type,
    source_ref,
    COALESCE(user_id, ''),
    COALESCE(guest_token, '')
  )
  WHERE source_ref IS NOT NULL
    AND BTRIM(source_ref) <> '';
