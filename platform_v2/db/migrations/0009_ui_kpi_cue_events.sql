ALTER TABLE ui_kpi_events
    DROP CONSTRAINT IF EXISTS ui_kpi_events_event_name_check;

ALTER TABLE ui_kpi_events
    ADD CONSTRAINT ui_kpi_events_event_name_check
    CHECK (
        event_name IN (
            'first_action',
            'task_completion',
            'cue_seen',
            'cue_opened',
            'cue_dismissed',
            'same_place_link_created'
        )
    );
