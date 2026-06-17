ALTER TABLE draft_observations ADD COLUMN partition_month TEXT;
ALTER TABLE observations ADD COLUMN partition_month TEXT;
ALTER TABLE asset_ledger ADD COLUMN partition_month TEXT;
ALTER TABLE outbox ADD COLUMN partition_month TEXT;
ALTER TABLE readmodel_public_observations ADD COLUMN partition_month TEXT;

UPDATE draft_observations
SET partition_month = substr(observed_at, 1, 7)
WHERE partition_month IS NULL AND observed_at IS NOT NULL;

UPDATE observations
SET partition_month = substr(observed_at, 1, 7)
WHERE partition_month IS NULL AND observed_at IS NOT NULL;

UPDATE asset_ledger
SET partition_month = substr(
  COALESCE(
    (SELECT observed_at FROM observations WHERE observations.observation_id = asset_ledger.observation_id),
    (SELECT observed_at FROM draft_observations WHERE draft_observations.draft_id = asset_ledger.draft_id),
    created_at
  ),
  1,
  7
)
WHERE partition_month IS NULL;

UPDATE outbox
SET partition_month = substr(
  COALESCE(
    (SELECT observed_at FROM observations WHERE observations.observation_id = outbox.target_id),
    created_at
  ),
  1,
  7
)
WHERE partition_month IS NULL;

UPDATE readmodel_public_observations
SET partition_month = substr(observed_at, 1, 7)
WHERE partition_month IS NULL AND observed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_draft_partition_month ON draft_observations(partition_month, created_at);
CREATE INDEX IF NOT EXISTS idx_observations_partition_month ON observations(partition_month, observed_at);
CREATE INDEX IF NOT EXISTS idx_assets_partition_month ON asset_ledger(partition_month, observation_id);
CREATE INDEX IF NOT EXISTS idx_outbox_partition_month ON outbox(partition_month, dispatch_state, created_at);
CREATE INDEX IF NOT EXISTS idx_public_partition_month ON readmodel_public_observations(partition_month, public_cell, observed_at);
