CREATE TABLE IF NOT EXISTS taxon_alert_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scientific_name TEXT,
  taxon_rank TEXT,
  match_field TEXT NOT NULL DEFAULT 'scientific_name',
  geo_filter_json TEXT NOT NULL DEFAULT '{}',
  trigger_invasive_only INTEGER NOT NULL DEFAULT 0,
  trigger_rare_only INTEGER NOT NULL DEFAULT 0,
  channel TEXT NOT NULL DEFAULT 'email',
  is_active INTEGER NOT NULL DEFAULT 1,
  label TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_taxon_alert_subscriptions_user
  ON taxon_alert_subscriptions(user_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_taxon_alert_subscriptions_match_name
  ON taxon_alert_subscriptions(match_field, scientific_name, is_active);

CREATE TABLE IF NOT EXISTS alert_recipients (
  recipient_id TEXT PRIMARY KEY,
  recipient_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  webhook_url TEXT,
  prefecture TEXT,
  municipality TEXT,
  interest_taxon_json TEXT NOT NULL DEFAULT '[]',
  interest_invasive INTEGER NOT NULL DEFAULT 0,
  interest_rare INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 50,
  source_url TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_municipality
  ON alert_recipients(prefecture, municipality, is_active, recipient_type);

CREATE INDEX IF NOT EXISTS idx_alert_recipients_type
  ON alert_recipients(recipient_type, is_active);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  delivery_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL,
  user_id TEXT,
  recipient_id TEXT,
  subscription_id TEXT,
  area_subscription_id TEXT,
  trigger_kind TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivered_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  acknowledged_at TEXT,
  acknowledged_note TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_occurrence
  ON alert_deliveries(occurrence_id);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_recent
  ON alert_deliveries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_unread
  ON alert_deliveries(user_id, acknowledged_at);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_pending
  ON alert_deliveries(delivery_status, created_at, delivery_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_recipient
  ON alert_deliveries(occurrence_id, recipient_id, trigger_kind)
  WHERE recipient_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_user
  ON alert_deliveries(occurrence_id, user_id, subscription_id, trigger_kind)
  WHERE user_id IS NOT NULL AND subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_alert_deliveries_dedup_area_user
  ON alert_deliveries(occurrence_id, user_id, area_subscription_id, trigger_kind)
  WHERE user_id IS NOT NULL AND area_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id TEXT PRIMARY KEY,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  digest_hour_local INTEGER NOT NULL DEFAULT 8,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL DEFAULT 'ja',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS invasive_reporting_events (
  event_id TEXT PRIMARY KEY,
  occurrence_id TEXT,
  visit_id TEXT,
  rule_id TEXT,
  contact_id TEXT,
  recipient_id TEXT,
  delivery_id TEXT,
  event_status TEXT NOT NULL,
  trigger_source TEXT NOT NULL DEFAULT 'ai_reassess',
  invasive_status TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_events_occurrence
  ON invasive_reporting_events(occurrence_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invasive_reporting_events_delivery
  ON invasive_reporting_events(delivery_id);
