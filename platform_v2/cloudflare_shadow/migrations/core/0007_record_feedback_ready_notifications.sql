CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_record_feedback_ready_user
  ON alert_deliveries(occurrence_id, user_id, trigger_kind)
  WHERE user_id IS NOT NULL
    AND trigger_kind = 'record_feedback_ready';
