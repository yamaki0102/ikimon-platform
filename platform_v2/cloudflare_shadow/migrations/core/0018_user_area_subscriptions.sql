-- ZUKAN personal area-watch subscriptions and their derived count snapshots.

CREATE TABLE IF NOT EXISTS user_area_subscriptions (
  subscription_id TEXT PRIMARY KEY CHECK (length(trim(subscription_id)) > 0),
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
  target_type TEXT NOT NULL CHECK (target_type IN ('field', 'place', 'region')),
  target_id TEXT NOT NULL CHECK (length(trim(target_id)) > 0),
  label TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_area_subscriptions_user
  ON user_area_subscriptions(user_id, is_active, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_area_subscription_stats (
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
  target_type TEXT NOT NULL CHECK (target_type IN ('field', 'place', 'region')),
  target_id TEXT NOT NULL CHECK (length(trim(target_id)) > 0),
  observation_count INTEGER NOT NULL DEFAULT 0 CHECK (observation_count >= 0),
  needs_id_count INTEGER NOT NULL DEFAULT 0 CHECK (needs_id_count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, target_type, target_id)
);

-- No secondary stats timestamp index: older production-compatible tables use refreshed_at
-- while the Worker joins this table through its composite primary key only.
