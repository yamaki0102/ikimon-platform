-- 0105: subject proposal notifications
--
-- owner-sensitive-ok: alert_deliveries is an existing production table; deploy with the normal owner-role migration path. Rollback by draining subject_proposal rows, then restoring the previous trigger_kind CHECK list.

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
        'subject_proposal'
    ));
