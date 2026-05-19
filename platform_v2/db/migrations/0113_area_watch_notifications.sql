-- 0113: Area Watch notifications for followed fields / places.
--
-- `subscription_id` already points at taxon_alert_subscriptions, so area follows
-- get their own nullable reference. In-app Area Watch notifications are stored
-- as sent channel=none rows and surfaced by /api/v1/me/alerts.
-- owner-sensitive-ok: alert_deliveries is an existing production table; deploy
-- with the normal owner-role migration path. Rollback by deleting area_watch
-- rows, dropping uq_alert_deliveries_dedup_area_user / idx_alert_deliveries_area_subscription,
-- dropping area_subscription_id, then restoring the previous trigger_kind CHECK list.

ALTER TABLE alert_deliveries
    ADD COLUMN IF NOT EXISTS area_subscription_id UUID
    REFERENCES user_area_subscriptions(subscription_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_area_subscription
    ON alert_deliveries (area_subscription_id, created_at DESC)
    WHERE area_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_area_user
    ON alert_deliveries (occurrence_id, user_id, area_subscription_id, trigger_kind)
    WHERE user_id IS NOT NULL AND area_subscription_id IS NOT NULL;

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
        'area_watch'
    ));
