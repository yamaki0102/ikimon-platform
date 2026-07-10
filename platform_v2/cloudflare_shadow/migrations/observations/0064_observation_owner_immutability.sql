-- Ownership is immutable after creation. Application prechecks improve errors,
-- while these triggers close concurrent-update races at the D1 boundary.
-- `IS NOT` is deliberate: unlike `<>`, it also treats NULL/non-NULL transitions
-- as changes if a future compatibility migration relaxes the current NOT NULL columns.
CREATE TRIGGER IF NOT EXISTS trg_observations_owner_immutable
BEFORE UPDATE OF owner_user_id ON observations
FOR EACH ROW
WHEN OLD.owner_user_id IS NOT NEW.owner_user_id
BEGIN
  SELECT RAISE(ABORT, 'observation_owner_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_place_memory_owner_immutable
BEFORE UPDATE OF user_id ON place_memory_entries
FOR EACH ROW
WHEN OLD.user_id IS NOT NEW.user_id
BEGIN
  SELECT RAISE(ABORT, 'place_memory_owner_immutable');
END;
