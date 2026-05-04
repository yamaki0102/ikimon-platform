-- User-defined observation field identity backfill
--
-- Existing user-defined fields predate the non-destructive entity history
-- model. Give them stable entity_key values so later "range update" actions
-- can close the old row and create a successor instead of rewriting history.
--
-- Also tighten the current-entity unique index to ignore blank keys. Migration
-- 0080 defaulted entity_key to '', and blank keys are not identities.
-- owner-sensitive-ok: adds missing legacy observation_fields timestamp columns
-- before the backfill reads them; rollback is dropping only these columns if
-- they were absent before deploy.
-- destructive-ok: data backfill only; rollback by restoring observation_fields
-- entity_key/valid_from from the pre-deploy database snapshot.

ALTER TABLE observation_fields
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP INDEX IF EXISTS idx_obs_fields_entity_current;

CREATE OR REPLACE FUNCTION obs_user_field_normalized_name(input_name TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT NULLIF(
        regexp_replace(
            lower(COALESCE(input_name, '')),
            '[[:space:]　、，,./／・･()（）「」『』\[\]【】<>＜＞''"`_-]+',
            '',
            'g'
        ),
        ''
    )
$$;

CREATE OR REPLACE FUNCTION obs_geohash6(input_lat DOUBLE PRECISION, input_lng DOUBLE PRECISION)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    base32 CONSTANT TEXT := '0123456789bcdefghjkmnpqrstuvwxyz';
    min_lat DOUBLE PRECISION := -90;
    max_lat DOUBLE PRECISION := 90;
    min_lng DOUBLE PRECISION := -180;
    max_lng DOUBLE PRECISION := 180;
    mid DOUBLE PRECISION;
    is_lng BOOLEAN := TRUE;
    bit INTEGER := 4;
    char_idx INTEGER := 0;
    output TEXT := '';
BEGIN
    IF input_lat IS NULL OR input_lng IS NULL
       OR input_lat < -90 OR input_lat > 90
       OR input_lng < -180 OR input_lng > 180 THEN
        RETURN 'unknown';
    END IF;

    WHILE length(output) < 6 LOOP
        IF is_lng THEN
            mid := (min_lng + max_lng) / 2;
            IF input_lng >= mid THEN
                char_idx := (char_idx << 1) | 1;
                min_lng := mid;
            ELSE
                char_idx := char_idx << 1;
                max_lng := mid;
            END IF;
        ELSE
            mid := (min_lat + max_lat) / 2;
            IF input_lat >= mid THEN
                char_idx := (char_idx << 1) | 1;
                min_lat := mid;
            ELSE
                char_idx := char_idx << 1;
                max_lat := mid;
            END IF;
        END IF;

        is_lng := NOT is_lng;
        IF bit = 0 THEN
            output := output || substr(base32, char_idx + 1, 1);
            char_idx := 0;
            bit := 4;
        ELSE
            bit := bit - 1;
        END IF;
    END LOOP;

    RETURN output;
END
$$;

WITH candidates AS (
    SELECT
        field_id,
        'user_defined:' || owner_user_id::text || ':' ||
            COALESCE(obs_user_field_normalized_name(name), 'unnamed') || ':' ||
            obs_geohash6(lat, lng) AS base_key
      FROM observation_fields
     WHERE source = 'user_defined'
       AND owner_user_id IS NOT NULL
       AND (entity_key IS NULL OR entity_key = '')
),
numbered AS (
    SELECT
        field_id,
        base_key,
        row_number() OVER (
            PARTITION BY base_key, (valid_to IS NULL)
            ORDER BY field_id ASC
        ) AS duplicate_no
      FROM candidates
)
UPDATE observation_fields f
   SET entity_key = CASE
           WHEN n.duplicate_no = 1 THEN n.base_key
           ELSE n.base_key || ':variant-' || n.duplicate_no::text
       END,
       valid_from = COALESCE(f.valid_from, current_date)
  FROM numbered n
 WHERE f.field_id = n.field_id;

WITH duplicate_current AS (
    SELECT
        field_id,
        entity_key,
        row_number() OVER (
            PARTITION BY entity_key
            ORDER BY field_id ASC
        ) AS duplicate_no
      FROM observation_fields
     WHERE valid_to IS NULL
       AND entity_key IS NOT NULL
       AND entity_key <> ''
),
renamed AS (
    SELECT field_id, entity_key, duplicate_no
      FROM duplicate_current
     WHERE duplicate_no > 1
)
UPDATE observation_fields f
   SET entity_key = r.entity_key || ':variant-' || r.duplicate_no::text
  FROM renamed r
 WHERE f.field_id = r.field_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_obs_fields_entity_current
    ON observation_fields (entity_key)
    WHERE valid_to IS NULL
      AND entity_key IS NOT NULL
      AND entity_key <> '';
