-- 0124: Record feedback ready in-app notifications.
--
-- Keeps the "record -> later feedback" loop visible through the existing
-- notification panel without routing these owner-only notices to email.
-- owner-sensitive-ok: alert_deliveries is an existing production table; deploy
-- with the normal owner-role migration path. Rollback by deleting
-- record_feedback_ready rows, dropping uq_alert_deliveries_record_feedback_ready_user,
-- then restoring the previous trigger_kind CHECK list.

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_record_feedback_ready_user
    ON alert_deliveries (occurrence_id, user_id, trigger_kind)
    WHERE user_id IS NOT NULL
      AND trigger_kind = 'record_feedback_ready';

ALTER TABLE alert_deliveries
    DROP CONSTRAINT IF EXISTS alert_deliveries_trigger_chk;

ALTER TABLE alert_deliveries
    ADD CONSTRAINT alert_deliveries_trigger_chk
    CHECK (trigger_kind IN (
        'invasive',
        'rare',
        'novelty',
        'taxon_match',
        'municipality_invasive',
        'subject_proposal',
        'area_watch',
        'place_memory_like',
        'place_memory_admin',
        'record_feedback_ready'
    ));
