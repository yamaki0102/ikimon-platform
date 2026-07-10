-- Keep Cloudflare/D1 rally submissions retry-safe using the same identity as PostgreSQL.
-- The higher sequence number intentionally leaves room for the open production-QA
-- migration series 0062-0064.

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
