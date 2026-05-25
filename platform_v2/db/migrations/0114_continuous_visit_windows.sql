-- Continuous visit windows:
-- Keep raw visits immutable. A "continuous visit" is a same-user, same-place
-- time window where each next record is within 3 hours of the previous record.

CREATE OR REPLACE VIEW visit_continuous_window_members AS
WITH ordered_visits AS (
    SELECT
        v.visit_id,
        v.user_id,
        v.place_id,
        v.observed_at,
        v.visit_mode,
        v.source_kind,
        LAG(v.observed_at) OVER (
            PARTITION BY v.user_id, v.place_id
            ORDER BY v.observed_at ASC, v.visit_id ASC
        ) AS previous_observed_at
    FROM visits v
    WHERE v.user_id IS NOT NULL
      AND v.place_id IS NOT NULL
),
windowed_visits AS (
    SELECT
        visit_id,
        user_id,
        place_id,
        observed_at,
        visit_mode,
        source_kind,
        previous_observed_at,
        (
            previous_observed_at IS NULL
            OR observed_at - previous_observed_at > INTERVAL '3 hours'
        ) AS is_window_start
    FROM ordered_visits
)
SELECT
    visit_id,
    user_id,
    place_id,
    observed_at,
    visit_mode,
    source_kind,
    previous_observed_at,
    is_window_start,
    SUM(CASE WHEN is_window_start THEN 1 ELSE 0 END) OVER (
        PARTITION BY user_id, place_id
        ORDER BY observed_at ASC, visit_id ASC
    ) AS visit_window_index
FROM windowed_visits;

CREATE OR REPLACE VIEW visit_continuous_windows AS
WITH aggregated_windows AS (
    SELECT
        user_id,
        place_id,
        visit_window_index,
        MIN(observed_at) AS started_at,
        MAX(observed_at) AS ended_at,
        COUNT(*)::integer AS record_count,
        ARRAY_AGG(visit_id ORDER BY observed_at ASC, visit_id ASC) AS visit_ids
    FROM visit_continuous_window_members
    GROUP BY user_id, place_id, visit_window_index
)
SELECT
    MD5(
        user_id || ':' ||
        place_id || ':' ||
        TO_CHAR(started_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS.US')
    ) AS visit_window_id,
    user_id,
    place_id,
    visit_window_index,
    started_at,
    ended_at,
    record_count,
    visit_ids
FROM aggregated_windows;
