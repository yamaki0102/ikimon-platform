CREATE INDEX IF NOT EXISTS idx_observations_owner_observed ON observations (owner_user_id, observed_at DESC, observation_id DESC);
