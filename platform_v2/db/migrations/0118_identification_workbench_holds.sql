CREATE TABLE IF NOT EXISTS identification_workbench_holds (
    hold_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id  UUID        NOT NULL REFERENCES occurrences(occurrence_id) ON DELETE CASCADE,
    actor_user_id  TEXT        NOT NULL,
    hold_reason    TEXT        NOT NULL DEFAULT '',
    source_payload JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT identification_workbench_holds_user_occurrence_uniq
        UNIQUE (occurrence_id, actor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_identification_workbench_holds_user_updated
    ON identification_workbench_holds (actor_user_id, updated_at DESC);
