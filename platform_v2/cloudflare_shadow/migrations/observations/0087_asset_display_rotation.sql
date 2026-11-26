CREATE TABLE IF NOT EXISTS asset_display_rotation (asset_id TEXT PRIMARY KEY, rotation INTEGER NOT NULL DEFAULT 0 CHECK (rotation IN (0,90,180,270)), updated_at TEXT NOT NULL);
