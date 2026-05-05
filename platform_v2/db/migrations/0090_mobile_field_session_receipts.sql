CREATE TABLE IF NOT EXISTS mobile_field_scene_receipts (
  receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  install_id TEXT NOT NULL,
  client_scene_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  guide_record_id UUID,
  movement_mode TEXT NOT NULL DEFAULT 'walk',
  scene_digest TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (install_id, client_scene_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_field_scene_receipts_session
  ON mobile_field_scene_receipts (session_id, created_at DESC);
