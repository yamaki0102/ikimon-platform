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

CREATE TABLE IF NOT EXISTS user_area_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_area_subscriptions_target
  ON user_area_subscriptions(user_id, target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_user_area_subscriptions_user_active
  ON user_area_subscriptions(user_id, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_area_subscription_stats (
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  observation_count INTEGER NOT NULL DEFAULT 0,
  needs_id_count INTEGER NOT NULL DEFAULT 0,
  refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, target_type, target_id)
);

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

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_recent
  ON alert_deliveries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_unread
  ON alert_deliveries(user_id, acknowledged_at);
