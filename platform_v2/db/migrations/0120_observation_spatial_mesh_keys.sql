CREATE OR REPLACE FUNCTION ikimon_jis_mesh_1km(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    lat_minutes DOUBLE PRECISION;
    lng_degrees INTEGER;
    lng_minutes_within_degree DOUBLE PRECISION;
    first_lat INTEGER;
    first_lng INTEGER;
    second_lat INTEGER;
    second_lng INTEGER;
    third_lat INTEGER;
    third_lng INTEGER;
    lat_after_first DOUBLE PRECISION;
    lat_after_second DOUBLE PRECISION;
    lng_after_second DOUBLE PRECISION;
BEGIN
    IF lat IS NULL OR lng IS NULL
       OR lat < 0 OR lat >= (200.0 / 3.0)
       OR lng < 100 OR lng >= 180 THEN
        RETURN NULL;
    END IF;

    lat_minutes := lat * 60.0;
    lng_degrees := floor(lng)::INTEGER;
    lng_minutes_within_degree := (lng - lng_degrees) * 60.0;

    first_lat := floor(lat_minutes / 40.0)::INTEGER;
    first_lng := lng_degrees - 100;
    lat_after_first := lat_minutes - first_lat * 40.0;

    second_lat := floor(lat_after_first / 5.0)::INTEGER;
    second_lng := floor(lng_minutes_within_degree / 7.5)::INTEGER;
    lat_after_second := lat_after_first - second_lat * 5.0;
    lng_after_second := lng_minutes_within_degree - second_lng * 7.5;

    third_lat := floor(lat_after_second / 0.5)::INTEGER;
    third_lng := floor(lng_after_second / 0.75)::INTEGER;

    RETURN lpad(first_lat::TEXT, 2, '0')
        || lpad(first_lng::TEXT, 2, '0')
        || second_lat::TEXT
        || second_lng::TEXT
        || third_lat::TEXT
        || third_lng::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION ikimon_jis_mesh_250m(lat DOUBLE PRECISION, lng DOUBLE PRECISION)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    mesh_1km TEXT;
    lat_minutes DOUBLE PRECISION;
    lng_degrees INTEGER;
    lng_minutes_within_degree DOUBLE PRECISION;
    first_lat INTEGER;
    second_lat INTEGER;
    second_lng INTEGER;
    third_lat INTEGER;
    third_lng INTEGER;
    half_lat INTEGER;
    half_lng INTEGER;
    quarter_lat INTEGER;
    quarter_lng INTEGER;
    lat_after_first DOUBLE PRECISION;
    lat_after_second DOUBLE PRECISION;
    lng_after_second DOUBLE PRECISION;
    lat_after_third DOUBLE PRECISION;
    lng_after_third DOUBLE PRECISION;
    lat_after_half DOUBLE PRECISION;
    lng_after_half DOUBLE PRECISION;
BEGIN
    mesh_1km := ikimon_jis_mesh_1km(lat, lng);
    IF mesh_1km IS NULL THEN
        RETURN NULL;
    END IF;

    lat_minutes := lat * 60.0;
    lng_degrees := floor(lng)::INTEGER;
    lng_minutes_within_degree := (lng - lng_degrees) * 60.0;

    first_lat := floor(lat_minutes / 40.0)::INTEGER;
    lat_after_first := lat_minutes - first_lat * 40.0;
    second_lat := floor(lat_after_first / 5.0)::INTEGER;
    second_lng := floor(lng_minutes_within_degree / 7.5)::INTEGER;
    lat_after_second := lat_after_first - second_lat * 5.0;
    lng_after_second := lng_minutes_within_degree - second_lng * 7.5;
    third_lat := floor(lat_after_second / 0.5)::INTEGER;
    third_lng := floor(lng_after_second / 0.75)::INTEGER;
    lat_after_third := lat_after_second - third_lat * 0.5;
    lng_after_third := lng_after_second - third_lng * 0.75;

    half_lat := least(1, greatest(0, floor(lat_after_third / 0.25)::INTEGER));
    half_lng := least(1, greatest(0, floor(lng_after_third / 0.375)::INTEGER));
    lat_after_half := lat_after_third - half_lat * 0.25;
    lng_after_half := lng_after_third - half_lng * 0.375;

    quarter_lat := least(1, greatest(0, floor(lat_after_half / 0.125)::INTEGER));
    quarter_lng := least(1, greatest(0, floor(lng_after_half / 0.1875)::INTEGER));

    RETURN mesh_1km
        || ((half_lat * 2 + half_lng + 1)::TEXT)
        || ((quarter_lat * 2 + quarter_lng + 1)::TEXT);
END;
$$;

-- owner-sensitive-ok: adds nullable derived mesh columns and indexes to existing canonical observation tables; deploy through the normal owner-capable migration runner, rollback by dropping the two visit columns, two indexes, and mesh helper functions after application code rollback.
-- destructive-ok: backfills only nullable derived mesh columns from existing point/center coordinates; no source coordinate, user, photo, or observation fact rows are deleted or overwritten.
ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS jis_mesh_1km TEXT,
    ADD COLUMN IF NOT EXISTS jis_mesh_250m TEXT;

COMMENT ON COLUMN visits.jis_mesh_1km IS
    'JIS X 0410 third-area mesh code, about 1km, derived from private point coordinates at write/backfill time.';

COMMENT ON COLUMN visits.jis_mesh_250m IS
    'JIS X 0410 quarter-area divided mesh code, about 250m, used for privacy-aware analysis and external data joins.';

UPDATE visits
   SET jis_mesh_1km = ikimon_jis_mesh_1km(point_latitude, point_longitude),
       jis_mesh_250m = ikimon_jis_mesh_250m(point_latitude, point_longitude)
 WHERE point_latitude IS NOT NULL
   AND point_longitude IS NOT NULL
   AND (jis_mesh_1km IS NULL OR jis_mesh_250m IS NULL);

UPDATE places
   SET mesh3 = coalesce(mesh3, ikimon_jis_mesh_1km(center_latitude, center_longitude)),
       mesh4 = coalesce(mesh4, ikimon_jis_mesh_250m(center_latitude, center_longitude))
 WHERE center_latitude IS NOT NULL
   AND center_longitude IS NOT NULL
   AND (mesh3 IS NULL OR mesh4 IS NULL);

CREATE INDEX IF NOT EXISTS idx_visits_jis_mesh_1km_observed
    ON visits (jis_mesh_1km, observed_at DESC)
    WHERE jis_mesh_1km IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_visits_jis_mesh_250m_observed
    ON visits (jis_mesh_250m, observed_at DESC)
    WHERE jis_mesh_250m IS NOT NULL;
