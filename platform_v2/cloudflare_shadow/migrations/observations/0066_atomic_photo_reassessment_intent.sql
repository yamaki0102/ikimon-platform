DROP TRIGGER IF EXISTS trg_asset_photo_reassessment_insert;
DROP TRIGGER IF EXISTS trg_asset_photo_reassessment_update;

CREATE TRIGGER trg_asset_photo_reassessment_insert
AFTER INSERT ON asset_ledger
WHEN NEW.observation_id IS NOT NULL
  AND NEW.processing_state = 'uploaded'
  AND lower(NEW.mime) LIKE 'image/%'
BEGIN
  INSERT INTO observation_reassessment_requests (
    request_id,
    observation_id,
    request_kind,
    actor_user_id,
    request_state,
    source_payload_json,
    created_at,
    updated_at
  ) VALUES (
    'reassess:' || NEW.observation_id || ':standard:' || NEW.owner_user_id,
    NEW.observation_id,
    'standard',
    NEW.owner_user_id,
    'pending',
    json_object(
      'source', 'asset_ledger_photo_trigger',
      'assetId', NEW.asset_id,
      'transactionalIntent', 1
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(observation_id, request_kind, actor_user_id) DO UPDATE SET
    request_state = 'pending',
    source_payload_json = excluded.source_payload_json,
    updated_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER trg_asset_photo_reassessment_update
AFTER UPDATE OF observation_id, owner_user_id, mime, processing_state, object_key, sha256 ON asset_ledger
WHEN NEW.observation_id IS NOT NULL
  AND NEW.processing_state = 'uploaded'
  AND lower(NEW.mime) LIKE 'image/%'
BEGIN
  INSERT INTO observation_reassessment_requests (
    request_id,
    observation_id,
    request_kind,
    actor_user_id,
    request_state,
    source_payload_json,
    created_at,
    updated_at
  ) VALUES (
    'reassess:' || NEW.observation_id || ':standard:' || NEW.owner_user_id,
    NEW.observation_id,
    'standard',
    NEW.owner_user_id,
    'pending',
    json_object(
      'source', 'asset_ledger_photo_trigger',
      'assetId', NEW.asset_id,
      'transactionalIntent', 1
    ),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
  ON CONFLICT(observation_id, request_kind, actor_user_id) DO UPDATE SET
    request_state = 'pending',
    source_payload_json = excluded.source_payload_json,
    updated_at = CURRENT_TIMESTAMP;
END;
