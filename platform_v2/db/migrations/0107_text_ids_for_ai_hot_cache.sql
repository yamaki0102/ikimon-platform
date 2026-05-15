-- user_output_cache / ai_cost_log receive current-runtime legacy ids such as
-- record-1778818427350 and occ:record-1778818427350:0. They are identifiers,
-- but they are not UUIDs.
-- owner-sensitive-ok: widens nullable hot-cache/cost reference columns from
-- UUID to TEXT so reassess writes stop rejecting production legacy visit ids.
-- Rollback is only safe after verifying every non-null value is UUID-castable.

ALTER TABLE user_output_cache
    ALTER COLUMN visit_id TYPE TEXT USING visit_id::text,
    ALTER COLUMN occurrence_id TYPE TEXT USING occurrence_id::text;

ALTER TABLE ai_cost_log
    ALTER COLUMN visit_id TYPE TEXT USING visit_id::text,
    ALTER COLUMN occurrence_id TYPE TEXT USING occurrence_id::text;
