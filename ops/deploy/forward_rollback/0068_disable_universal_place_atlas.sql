-- Forward-only operational rollback for Universal Place Atlas.
-- This does not remove schema or source/audit evidence.

UPDATE place_atlas_rollout_state
SET
  enabled = 0,
  enabled_place_kinds_json = '[]',
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'forward_rollback'
WHERE rollout_key = 'universal_place_atlas_v2';
