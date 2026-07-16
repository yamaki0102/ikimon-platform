import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";
import {
  isObservationEventCheckinOpen,
  promoteObservationEventGuestIdentity,
} from "./observationEventParticipantAccess.js";

test("check-in closes at the scheduled event end", () => {
  const now = Date.parse("2026-07-19T04:00:00.000Z");
  assert.equal(isObservationEventCheckinOpen({ endedAt: null }, now), true);
  assert.equal(isObservationEventCheckinOpen({ endedAt: "2026-07-19T04:00:00.001Z" }, now), true);
  assert.equal(isObservationEventCheckinOpen({ endedAt: "2026-07-19T04:00:00.000Z" }, now), false);
  assert.equal(isObservationEventCheckinOpen({ endedAt: "2026-07-19T03:59:59.999Z" }, now), false);
  assert.equal(isObservationEventCheckinOpen({ endedAt: "invalid" }, now), false);
});

test("guest promotion atomically migrates attribution and merges an existing account participant", async () => {
  const statements: string[] = [];
  let released = false;
  const client = {
    async query(sql: string) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      statements.push(normalized);
      if (normalized.startsWith("SELECT participant_id, user_id")) {
        return { rows: [{ participant_id: "guest-participant", user_id: null }] };
      }
      if (normalized.startsWith("SELECT participant_id") && normalized.includes("user_id = $2")) {
        return { rows: [{ participant_id: "account-participant" }] };
      }
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pick<Pool, "connect">;

  const result = await promoteObservationEventGuestIdentity({
    sessionId: "event-1",
    userId: "user-1",
    guestCredentialDigest: "guest-digest",
  }, pool);

  assert.deepEqual(result, {
    participantId: "account-participant",
    promoted: true,
    mergedIntoExistingParticipant: true,
  });
  assert.equal(statements[0], "BEGIN");
  assert.equal(statements.at(-1), "COMMIT");
  assert.equal(released, true);
  for (const table of [
    "observation_event_live_events",
    "observation_event_absences",
    "observation_rally_submissions",
    "observation_event_recap_views",
  ]) {
    assert.equal(statements.some((sql) => sql.includes(table)), true, table);
  }
  assert.equal(
    statements.some((sql) => sql.startsWith("DELETE FROM observation_event_participants")),
    true,
  );
  assert.equal(statements.includes("ROLLBACK"), false);
});
