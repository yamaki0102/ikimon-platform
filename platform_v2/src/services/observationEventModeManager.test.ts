import assert from "node:assert/strict";
import test from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  createSession,
  ObservationEventActivationConflictError,
  type CreateSessionInput,
  type ObservationEventSessionQuery,
} from "./observationEventModeManager.js";

const BASE_INPUT: CreateSessionInput = {
  eventCode: "ACT123",
  title: "地域の記録会",
  organizerUserId: "organizer-a",
  primaryMode: "discovery",
  activeModes: ["discovery"],
  locationLat: 34.7101,
  locationLng: 137.7261,
  locationRadiusM: 300,
  startedAt: "2026-09-02T01:00:00.000Z",
  endedAt: "2026-09-02T02:00:00.000Z",
  targetSpecies: ["未同定"],
  config: { audience: "event_participants" },
  fieldId: "field-a",
};

function rawRow(values: unknown[], sessionId: string): Record<string, unknown> {
  return {
    session_id: sessionId,
    legacy_event_id: values[0] as string | null,
    event_code: values[1] as string,
    title: values[2] as string,
    organizer_user_id: values[3] as string,
    corporation_id: values[4] as string | null,
    plan: values[5] as string,
    primary_mode: values[6] as string,
    active_modes: values[7] as string[],
    location_lat: values[8] as number | null,
    location_lng: values[9] as number | null,
    location_radius_m: values[10] as number,
    started_at: values[11] as string,
    ended_at: values[12] as string | null,
    target_species: values[13] as string[],
    config: JSON.parse(values[14] as string) as Record<string, unknown>,
    field_id: values[15] as string | null,
    template_source_session_id: values[16] as string | null,
    created_at: "2026-09-01T05:00:00.000Z",
    updated_at: "2026-09-01T05:00:00.000Z",
  };
}

function atomicActivationStore(): {
  query: ObservationEventSessionQuery;
  insertions: () => number;
  statements: () => string[];
} {
  const activations = new Map<string, { values: unknown[]; row: Record<string, unknown> }>();
  const sql: string[] = [];
  let inserted = 0;
  const query: ObservationEventSessionQuery = async (statement, values) => {
    sql.push(statement);
    await Promise.resolve();
    const eventCode = String(values[1]);
    const existing = activations.get(eventCode);
    if (existing) {
      return { rows: isDeepStrictEqual(existing.values, values) ? [existing.row] : [] };
    }
    inserted += 1;
    const row = rawRow(values, `session-${inserted}`);
    activations.set(eventCode, { values: structuredClone(values), row });
    return { rows: [row] };
  };
  return {
    query,
    insertions: () => inserted,
    statements: () => sql,
  };
}

test("activation requires a non-blank invite code before touching storage", async () => {
  let queried = false;
  await assert.rejects(
    createSession(
      { ...BASE_INPUT, eventCode: "   " },
      async () => {
        queried = true;
        return { rows: [] };
      },
    ),
    /event_code activation key required/,
  );
  assert.equal(queried, false);
});

test("activation uses the existing event_code uniqueness as one atomic semantic upsert", async () => {
  const store = atomicActivationStore();
  const created = await createSession(BASE_INPUT, store.query);

  assert.equal(created.eventCode, "ACT123");
  assert.equal(created.plan, "community");
  assert.equal(created.organizerUserId, "organizer-a");
  const statement = store.statements()[0] ?? "";
  assert.match(statement, /ON CONFLICT \(event_code\) DO UPDATE/);
  for (const column of [
    "organizer_user_id",
    "legacy_event_id",
    "title",
    "corporation_id",
    "plan",
    "primary_mode",
    "active_modes",
    "location_lat",
    "location_lng",
    "location_radius_m",
    "started_at",
    "ended_at",
    "target_species",
    "config",
    "field_id",
    "template_source_session_id",
  ]) {
    assert.match(statement, new RegExp(`activated\\.${column} IS NOT DISTINCT FROM EXCLUDED\\.${column}`), column);
  }
});

test("identical retries and concurrent activation converge to one session", async () => {
  const store = atomicActivationStore();
  const [first, second, third] = await Promise.all([
    createSession(BASE_INPUT, store.query),
    createSession({ ...BASE_INPUT }, store.query),
    createSession({ ...BASE_INPUT, config: { audience: "event_participants" } }, store.query),
  ]);

  assert.equal(store.insertions(), 1);
  assert.equal(first.sessionId, second.sessionId);
  assert.equal(second.sessionId, third.sessionId);
  assert.equal(first.eventCode, "ACT123");
});

test("the same activation key rejects changed payload and organizer collisions", async () => {
  const store = atomicActivationStore();
  const original = await createSession(BASE_INPUT, store.query);

  await assert.rejects(
    createSession({ ...BASE_INPUT, title: "変更された記録会" }, store.query),
    ObservationEventActivationConflictError,
  );
  await assert.rejects(
    createSession({ ...BASE_INPUT, organizerUserId: "organizer-b" }, store.query),
    ObservationEventActivationConflictError,
  );
  const replay = await createSession(BASE_INPUT, store.query);
  assert.equal(replay.sessionId, original.sessionId);
  assert.equal(store.insertions(), 1);
});
