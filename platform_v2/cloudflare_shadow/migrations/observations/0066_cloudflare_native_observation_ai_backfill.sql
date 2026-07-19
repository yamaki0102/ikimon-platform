-- Queue existing native records that have image evidence but no confirmed name or AI target.
-- The scheduled Worker consumer drains these durable requests in bounded batches.
INSERT INTO observation_reassessment_requests (
  request_id,
  observation_id,
  request_kind,
  actor_user_id,
  request_state,
  source_payload_json,
  created_at,
  updated_at
)
SELECT
  'reassess:' || o.observation_id || ':standard:' || o.owner_user_id,
  o.observation_id,
  'standard',
  o.owner_user_id,
  'pending',
  '{"source":"cloudflare_native_ai_backfill_0066","reason":"image_without_confirmed_taxon"}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM observations o
WHERE COALESCE(TRIM(o.taxon_label), '') = ''
  AND EXISTS (
    SELECT 1
    FROM asset_ledger a
    WHERE a.observation_id = o.observation_id
      AND a.processing_state = 'uploaded'
      AND a.mime LIKE 'image/%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM observation_ai_review_targets art
    WHERE art.occurrence_id = 'occ:' || o.observation_id || ':0'
  )
ON CONFLICT(observation_id, request_kind, actor_user_id) DO NOTHING;
