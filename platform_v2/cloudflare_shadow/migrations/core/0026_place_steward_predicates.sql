-- Register place stewardship, activity organization, and contact predicates.
-- Additive only: no ownership predicates or owner columns.

INSERT INTO zukan_predicate_definitions (
  predicate_uri,
  predicate_version,
  status,
  value_type,
  value_schema_json,
  cardinality,
  polarity_mode,
  temporal_profile,
  authority_profile_json,
  external_mappings_json
)
SELECT
  v.predicate_uri,
  v.predicate_version,
  v.status,
  v.value_type,
  v.value_schema_json,
  v.cardinality,
  v.polarity_mode,
  v.temporal_profile,
  v.authority_profile_json,
  v.external_mappings_json
FROM (
  SELECT
    'place.steward' AS predicate_uri,
    1 AS predicate_version,
    'active' AS status,
    'json' AS value_type,
    '{"type":"object","properties":{"label":{"type":"string"},"role":{"type":"string"},"url":{"type":"string"}},"required":["label"]}' AS value_schema_json,
    'many' AS cardinality,
    'positive_or_negative' AS polarity_mode,
    'valid_time' AS temporal_profile,
    '{}' AS authority_profile_json,
    '[]' AS external_mappings_json
  UNION ALL
  SELECT
    'place.activity_org',
    1,
    'active',
    'json',
    '{"type":"object","properties":{"label":{"type":"string"},"url":{"type":"string"}},"required":["label"]}',
    'many',
    'positive_or_negative',
    'valid_time',
    '{}',
    '[]'
  UNION ALL
  SELECT
    'place.contact',
    1,
    'active',
    'json',
    '{"type":"object","properties":{"label":{"type":"string"},"channel":{"type":"string"},"value":{"type":"string"},"url":{"type":"string"}},"required":["label"]}',
    'many',
    'positive_or_negative',
    'valid_time',
    '{}',
    '[]'
) AS v
WHERE NOT EXISTS (
  SELECT 1
    FROM zukan_predicate_definitions AS existing
   WHERE existing.predicate_uri = v.predicate_uri
     AND existing.predicate_version = v.predicate_version
);

CREATE TRIGGER IF NOT EXISTS trg_zukan_claim_revisions_place_valid_from_required
BEFORE INSERT ON zukan_claim_revisions
WHEN NEW.predicate_uri IN ('place.steward', 'place.activity_org', 'place.contact')
 AND (NEW.valid_from IS NULL OR julianday(NEW.valid_from) IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'place_claim_valid_from_required');
END;
