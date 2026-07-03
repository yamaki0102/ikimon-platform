CREATE TABLE IF NOT EXISTS field_public_profile_readmodel (
  field_id TEXT PRIMARY KEY,
  profile_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (profile_status IN ('draft', 'published', 'suppressed', 'archived')),
  profile_json TEXT NOT NULL DEFAULT '{}',
  public_brief_json TEXT NOT NULL DEFAULT '{}',
  evidence_contract_json TEXT NOT NULL DEFAULT '{}',
  aggregation_gate_json TEXT NOT NULL DEFAULT '{}',
  source_records_json TEXT NOT NULL DEFAULT '[]',
  observation_count INTEGER,
  observer_count INTEGER,
  time_span_days INTEGER,
  source_record_count INTEGER,
  sensitive_source_record_count INTEGER,
  display_suppression_reason TEXT,
  generation_run_id TEXT,
  profile_policy_version TEXT NOT NULL DEFAULT 'cloudflare-site-intelligence-p0-v1',
  aggregation_ruleset_version TEXT NOT NULL DEFAULT 'site_intelligence_aggregation_gate_v2',
  evidence_contract_version TEXT NOT NULL DEFAULT 'public_evidence_contract_v1',
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_field_public_profile_readmodel_status_updated
  ON field_public_profile_readmodel (profile_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_field_public_profile_readmodel_generation_run
  ON field_public_profile_readmodel (generation_run_id);
