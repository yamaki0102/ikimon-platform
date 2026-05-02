-- Normalize records created by the web form while it was sending
-- prefecture: "Shizuoka" for every observation. Keep exact coordinates;
-- only repair administrative labels that can be inferred from stored points.
--
-- Also quarantine coordinates at 0,0. That value is a missing-location
-- sentinel, not an observation point; the true original location cannot be
-- recovered from public output alone.

UPDATE visits
   SET public_visibility = 'hidden',
       quality_review_status = 'archived',
       quality_gate_reasons = CASE
         WHEN coalesce(quality_gate_reasons, '[]'::jsonb) ? 'production_smoke_record'
         THEN coalesce(quality_gate_reasons, '[]'::jsonb)
         ELSE coalesce(quality_gate_reasons, '[]'::jsonb) || '["production_smoke_record"]'::jsonb
       END,
       source_payload = jsonb_set(
         coalesce(source_payload, '{}'::jsonb),
         '{production_location_repair}',
         '{"action":"hidden_archived","reason":"production_smoke_record","version":"0075"}'::jsonb,
         true
       ),
       updated_at = now()
 WHERE visit_id LIKE 'prod-media-smoke-%'
    OR coalesce(source_payload->>'source', '') = 'prod_media_smoke';

INSERT INTO observation_quality_reviews (
  review_kind,
  review_status,
  visit_id,
  reason_code,
  reason_detail,
  public_visibility,
  quality_signals,
  source_payload,
  import_version
)
SELECT
  'production_cleanup',
  'archived',
  v.visit_id,
  'production_smoke_record',
  'Production media smoke record is not a real biodiversity observation and must not appear in public maps or research exports.',
  'hidden',
  jsonb_build_object('visit_id', v.visit_id),
  jsonb_build_object('source', 'migration_0075_normalize_shizuoka_locality_labels'),
  '0075'
FROM visits v
WHERE v.visit_id LIKE 'prod-media-smoke-%'
   OR coalesce(v.source_payload->>'source', '') = 'prod_media_smoke'
ON CONFLICT DO NOTHING;

UPDATE visits
   SET observed_prefecture = '静岡県',
       observed_municipality = '浜松市',
       updated_at = now()
 WHERE point_latitude BETWEEN 34.55 AND 35.32
   AND point_longitude BETWEEN 137.45 AND 138.08
   AND (
     observed_prefecture IS NULL
     OR observed_prefecture = ''
     OR lower(observed_prefecture) IN ('shizuoka', 'shizuoka prefecture')
     OR observed_prefecture = '静岡'
     OR observed_municipality IS NULL
     OR observed_municipality = ''
     OR lower(observed_municipality) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
   );

UPDATE places
   SET prefecture = '静岡県',
       municipality = '浜松市',
       canonical_name = CASE
         WHEN canonical_name IS NULL
           OR canonical_name = ''
           OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka', 'v2 place')
           OR canonical_name = '静岡'
         THEN '浜松市'
         ELSE canonical_name
       END,
       locality_label = CASE
         WHEN locality_label IS NULL
           OR locality_label = ''
           OR lower(locality_label) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
           OR locality_label = '静岡'
         THEN NULL
         ELSE locality_label
       END,
       updated_at = now()
 WHERE center_latitude BETWEEN 34.55 AND 35.32
   AND center_longitude BETWEEN 137.45 AND 138.08
   AND (
     prefecture IS NULL
     OR prefecture = ''
     OR lower(prefecture) IN ('shizuoka', 'shizuoka prefecture')
     OR prefecture = '静岡'
     OR municipality IS NULL
     OR municipality = ''
     OR lower(municipality) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
     OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka', 'v2 place')
   );

UPDATE visits
   SET observed_prefecture = '静岡県',
       observed_municipality = '静岡市',
       updated_at = now()
 WHERE point_latitude BETWEEN 34.82 AND 35.36
   AND point_longitude BETWEEN 138.15 AND 138.72
   AND (
     observed_prefecture IS NULL
     OR observed_prefecture = ''
     OR lower(observed_prefecture) IN ('shizuoka', 'shizuoka prefecture')
     OR observed_prefecture = '静岡'
     OR observed_municipality IS NULL
     OR observed_municipality = ''
     OR lower(observed_municipality) IN ('shizuoka', 'shizuoka prefecture')
   );

UPDATE places
   SET prefecture = '静岡県',
       municipality = '静岡市',
       canonical_name = CASE
         WHEN canonical_name IS NULL
           OR canonical_name = ''
           OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'v2 place')
           OR canonical_name = '静岡'
         THEN '静岡市'
         ELSE canonical_name
       END,
       locality_label = CASE
         WHEN locality_label IS NULL
           OR locality_label = ''
           OR lower(locality_label) IN ('shizuoka', 'shizuoka prefecture')
           OR locality_label = '静岡'
         THEN NULL
         ELSE locality_label
       END,
       updated_at = now()
 WHERE center_latitude BETWEEN 34.82 AND 35.36
   AND center_longitude BETWEEN 138.15 AND 138.72
   AND (
     prefecture IS NULL
     OR prefecture = ''
     OR lower(prefecture) IN ('shizuoka', 'shizuoka prefecture')
     OR prefecture = '静岡'
     OR municipality IS NULL
     OR municipality = ''
     OR lower(municipality) IN ('shizuoka', 'shizuoka prefecture')
     OR lower(canonical_name) IN ('shizuoka', 'shizuoka prefecture', 'v2 place')
   );

UPDATE visits
   SET observed_prefecture = '静岡県',
       updated_at = now()
 WHERE lower(observed_prefecture) IN ('shizuoka', 'shizuoka prefecture')
    OR observed_prefecture = '静岡';

UPDATE places
   SET prefecture = '静岡県',
       updated_at = now()
 WHERE lower(prefecture) IN ('shizuoka', 'shizuoka prefecture')
    OR prefecture = '静岡';

INSERT INTO observation_quality_reviews (
  review_kind,
  review_status,
  visit_id,
  reason_code,
  reason_detail,
  public_visibility,
  quality_signals,
  source_payload,
  import_version
)
SELECT
  'location_repair',
  'needs_review',
  v.visit_id,
  'location_suspect_zero_zero',
  'Observation coordinates were stored as 0,0. The original location is not recoverable from stored public fields, so this record is held for manual review.',
  'review',
  jsonb_build_object(
    'point_latitude', v.point_latitude,
    'point_longitude', v.point_longitude,
    'place_id', v.place_id
  ),
  jsonb_build_object('source', 'migration_0075_normalize_shizuoka_locality_labels'),
  '0075'
FROM visits v
WHERE v.point_latitude = 0
  AND v.point_longitude = 0
ON CONFLICT DO NOTHING;

WITH zero_visit_places AS (
  SELECT DISTINCT place_id
    FROM visits
   WHERE point_latitude = 0
     AND point_longitude = 0
     AND place_id IS NOT NULL
),
valid_place_points AS (
  SELECT DISTINCT place_id
    FROM visits
   WHERE place_id IS NOT NULL
     AND point_latitude IS NOT NULL
     AND point_longitude IS NOT NULL
     AND NOT (point_latitude = 0 AND point_longitude = 0)
)
UPDATE places p
   SET center_latitude = NULL,
       center_longitude = NULL,
       locality_label = CASE
         WHEN lower(coalesce(locality_label, '')) IN ('shizuoka', 'shizuoka prefecture', 'hamamatsu', 'hamamatsu city', 'hamamatsu-shi', 'hamamatsu / shizuoka')
           OR locality_label = '静岡'
         THEN NULL
         ELSE locality_label
       END,
       updated_at = now()
 WHERE p.place_id IN (SELECT place_id FROM zero_visit_places)
   AND p.place_id NOT IN (SELECT place_id FROM valid_place_points)
   AND p.center_latitude = 0
   AND p.center_longitude = 0;

UPDATE visits
   SET point_latitude = NULL,
       point_longitude = NULL,
       public_visibility = 'review',
       quality_review_status = 'needs_review',
       quality_gate_reasons = CASE
         WHEN coalesce(quality_gate_reasons, '[]'::jsonb) ? 'location_suspect_zero_zero'
         THEN coalesce(quality_gate_reasons, '[]'::jsonb)
         ELSE coalesce(quality_gate_reasons, '[]'::jsonb) || '["location_suspect_zero_zero"]'::jsonb
       END,
       source_payload = jsonb_set(
         coalesce(source_payload, '{}'::jsonb),
         '{production_location_repair}',
         '{"action":"quarantined_zero_zero","reason":"location_suspect_zero_zero","version":"0075"}'::jsonb,
         true
       ),
       updated_at = now()
 WHERE point_latitude = 0
   AND point_longitude = 0;
