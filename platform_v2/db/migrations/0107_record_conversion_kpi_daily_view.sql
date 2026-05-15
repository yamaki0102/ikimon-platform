CREATE OR REPLACE VIEW record_conversion_kpi_daily AS
WITH record_clicks AS (
    SELECT
        date_trunc('day', created_at)::date AS day,
        count(*)::integer AS record_cta_clicks
    FROM observation_ui_kpi_events
    WHERE event_name = 'primary_cta_click'
      AND (
        metadata->>'funnel' = 'landing_record'
        OR route_key LIKE '%/record%'
        OR action_key IN (
            'landing:topA:primary:record',
            'landing:story:revisit_record',
            'records:story:first_record',
            'records:story:revisit'
        )
      )
    GROUP BY 1
),
record_funnel AS (
    SELECT
        date_trunc('day', created_at)::date AS day,
        (count(DISTINCT COALESCE(metadata->>'recordSessionId', event_id::text))
            FILTER (WHERE event_name = 'funnel_step' AND action_key = 'record_open'))::integer AS record_open_sessions,
        (count(DISTINCT COALESCE(metadata->>'recordSessionId', event_id::text))
            FILTER (WHERE event_name = 'funnel_step' AND action_key = 'record_open' AND metadata->>'firstRecordCandidate' = 'true'))::integer AS first_record_open_sessions,
        (count(DISTINCT COALESCE(metadata->>'recordSessionId', event_id::text))
            FILTER (WHERE event_name = 'funnel_step' AND action_key = 'submit_attempt'))::integer AS submit_attempt_sessions
    FROM record_ui_kpi_events
    WHERE route_key = '/record'
    GROUP BY 1
),
record_completions AS (
    SELECT
        date_trunc('day', created_at)::date AS day,
        (count(DISTINCT COALESCE(metadata->>'recordSessionId', event_id::text))
            FILTER (WHERE event_name = 'task_completion' AND action_key = 'record_saved'))::integer AS record_saved_sessions,
        (count(DISTINCT COALESCE(metadata->>'recordSessionId', event_id::text))
            FILTER (WHERE event_name = 'task_completion' AND action_key = 'record_saved' AND metadata->>'firstRecordCandidate' = 'true'))::integer AS first_record_saved_sessions
    FROM ui_kpi_events
    WHERE route_key = '/record'
    GROUP BY 1
),
days AS (
    SELECT day FROM record_clicks
    UNION
    SELECT day FROM record_funnel
    UNION
    SELECT day FROM record_completions
)
SELECT
    days.day,
    COALESCE(record_clicks.record_cta_clicks, 0) AS record_cta_clicks,
    COALESCE(record_funnel.record_open_sessions, 0) AS record_open_sessions,
    COALESCE(record_funnel.first_record_open_sessions, 0) AS first_record_open_sessions,
    COALESCE(record_funnel.submit_attempt_sessions, 0) AS submit_attempt_sessions,
    COALESCE(record_completions.record_saved_sessions, 0) AS record_saved_sessions,
    COALESCE(record_completions.first_record_saved_sessions, 0) AS first_record_saved_sessions,
    ROUND(
        COALESCE(record_funnel.record_open_sessions, 0)::numeric
        / NULLIF(record_clicks.record_cta_clicks, 0),
        4
    ) AS record_click_to_open_rate,
    ROUND(
        COALESCE(record_completions.record_saved_sessions, 0)::numeric
        / NULLIF(record_funnel.record_open_sessions, 0),
        4
    ) AS record_open_to_saved_rate,
    ROUND(
        COALESCE(record_completions.first_record_saved_sessions, 0)::numeric
        / NULLIF(record_funnel.first_record_open_sessions, 0),
        4
    ) AS first_record_completion_rate
FROM days
LEFT JOIN record_clicks ON record_clicks.day = days.day
LEFT JOIN record_funnel ON record_funnel.day = days.day
LEFT JOIN record_completions ON record_completions.day = days.day
ORDER BY days.day DESC;
