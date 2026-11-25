CREATE TABLE IF NOT EXISTS record_ai_notes (
  note_id TEXT PRIMARY KEY CHECK (length(note_id) = 36),
  record_runtime TEXT NOT NULL DEFAULT 'cloudflare_d1' CHECK (record_runtime IN ('postgresql', 'cloudflare_d1', 'import')),
  record_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot IN (1, 2, 3)),
  rule_version TEXT NOT NULL,
  generation_id TEXT NOT NULL,
  text_ja TEXT NOT NULL CHECK (length(text_ja) BETWEEN 1 AND 200),
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json) AND length(evidence_json) <= 4096),
  invite_kind TEXT,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'stale')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (record_runtime, record_id, slot),
  CHECK ((slot = 3) = (invite_kind IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_record_ai_notes_owner_invite ON record_ai_notes (owner_user_id, slot, status, created_at);
