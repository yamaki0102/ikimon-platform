CREATE TABLE IF NOT EXISTS field_managers (
  manager_id TEXT PRIMARY KEY,
  field_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'steward', 'viewer_exact')),
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT,
  expires_at TEXT,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(field_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_field_managers_field_active
  ON field_managers(field_id, user_id, role, expires_at);

CREATE INDEX IF NOT EXISTS idx_field_managers_user_active
  ON field_managers(user_id, field_id, role, expires_at);
