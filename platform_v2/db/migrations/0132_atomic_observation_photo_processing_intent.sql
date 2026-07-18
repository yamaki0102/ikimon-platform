CREATE OR REPLACE FUNCTION enqueue_observation_photo_processing_intent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.asset_role = 'observation_photo'
     AND NEW.visit_id IS NOT NULL
     AND NEW.occurrence_id IS NOT NULL THEN
    INSERT INTO media_processing_jobs (
      media_kind,
      media_uid,
      observation_id,
      occurrence_id,
      job_type,
      job_status,
      source_payload,
      created_at,
      updated_at
    ) VALUES (
      'photo',
      NEW.occurrence_id,
      NEW.visit_id,
      NEW.occurrence_id,
      'photo_ready_reassess',
      'pending',
      jsonb_build_object(
        'source', 'observation_photo_asset_trigger',
        'asset_id', NEW.asset_id::text,
        'legacy_asset_key', NEW.legacy_asset_key,
        'transactional_intent', true
      ),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_observation_photo_processing_intent ON evidence_assets;
DROP TRIGGER IF EXISTS trg_observation_photo_processing_intent_insert ON evidence_assets;
DROP TRIGGER IF EXISTS trg_observation_photo_processing_intent_update ON evidence_assets;

CREATE TRIGGER trg_observation_photo_processing_intent_insert
AFTER INSERT ON evidence_assets
FOR EACH ROW
WHEN (NEW.asset_role = 'observation_photo')
EXECUTE FUNCTION enqueue_observation_photo_processing_intent();

CREATE TRIGGER trg_observation_photo_processing_intent_update
AFTER UPDATE OF blob_id, occurrence_id, visit_id, legacy_relative_path, source_payload
ON evidence_assets
FOR EACH ROW
WHEN (NEW.asset_role = 'observation_photo')
EXECUTE FUNCTION enqueue_observation_photo_processing_intent();
