-- A Place Memory report is one moderation signal per signed-in user.
-- Collapse any historical duplicates before enforcing the invariant.
DELETE FROM place_memory_reports
 WHERE rowid NOT IN (
   SELECT MIN(rowid)
     FROM place_memory_reports
    GROUP BY entry_id, user_id
 );

CREATE UNIQUE INDEX IF NOT EXISTS idx_place_memory_reports_entry_user_unique
  ON place_memory_reports(entry_id, user_id);
