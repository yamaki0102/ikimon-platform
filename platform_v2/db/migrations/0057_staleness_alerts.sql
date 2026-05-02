-- Biodiversity Freshness OS: staleness_alerts
--
-- Purpose:
--   Append-only log of freshness_registry entries that breached their
--   expected_freshness_days SLA or hit consecutive_failures >= 3.
--   Drives Slack notifications and the /admin/data-health red badges.

CREATE TABLE IF NOT EXISTS staleness_alerts (
    alert_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_key      TEXT         NOT NULL REFERENCES freshness_registry(registry_key) ON DELETE CASCADE,
    alert_kind        TEXT         NOT NULL,
    severity          TEXT         NOT NULL DEFAULT 'normal',
    detected_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    notified_at       TIMESTAMPTZ,
    resolved_at       TIMESTAMPTZ,
    notes             TEXT         NOT NULL DEFAULT '',
    metadata          JSONB        NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT staleness_alerts_kind_chk
        CHECK (alert_kind IN ('overdue', 'consecutive_failures', 'license_change', 'manual')),
    CONSTRAINT staleness_alerts_severity_chk
        CHECK (severity IN ('low', 'normal', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_staleness_alerts_active
    ON staleness_alerts (registry_key, detected_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staleness_alerts_severity_active
    ON staleness_alerts (severity, detected_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_staleness_alerts_unnotified
    ON staleness_alerts (detected_at DESC)
    WHERE notified_at IS NULL;
