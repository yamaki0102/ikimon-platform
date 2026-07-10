import assert from "node:assert/strict";
import test from "node:test";
import { observationEventChannelName } from "./observationEventLive.js";

test("observation event LISTEN channel accepts canonical UUIDs only", () => {
  assert.equal(
    observationEventChannelName("123e4567-e89b-12d3-a456-426614174000"),
    "obs_evt_123e4567e89b12d3a456426614174000",
  );
  assert.throws(
    () => observationEventChannelName("123e4567-e89b-12d3-a456-426614174000; notify pwned"),
    /invalid_observation_event_session_id/,
  );
  assert.throws(
    () => observationEventChannelName("not-a-uuid"),
    /invalid_observation_event_session_id/,
  );
});
