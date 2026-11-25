import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  handleEventDetailsRoute,
  handleNearbyEventsApi,
  handleNearbyEventsPageRoute,
} from "./zukanEventsNearbyAndDetails";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: sqlite.prepare(query).all(...(values as never[])) as T[] };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organizer_user_id TEXT NOT NULL,
      location_lat REAL,
      location_lng REAL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, location_lat, location_lng, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "evt-near",
    "佐鳴湖の観察会",
    "org-1",
    34.71,
    137.72,
    "2026-12-01T09:00:00Z",
    "2026-12-01T12:00:00Z"
  );
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, location_lat, location_lng, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "evt-far",
    "東京の観察会",
    "org-2",
    35.68,
    139.76,
    "2026-12-02T09:00:00Z",
    null
  );
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/events/nearby returns events sorted by distance", async (t) => {
  const db = setupDb(t);
  const res = await handleNearbyEventsApi(new URL("https://ikimon.life/api/v1/events/nearby?lat=34.71&lng=137.72"), db);
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; events: Array<{ sessionId: string; title: string; distanceKm: number | null }> };
  assert.equal(body.ok, true);
  assert.equal(body.events[0]?.sessionId, "evt-near");
  assert.equal(body.events[1]?.sessionId, "evt-far");
  assert.ok((body.events[0]?.distanceKm ?? 999) < (body.events[1]?.distanceKm ?? 0));
});

test("F5 nearby page and F6 event details page render in zukanShell", async (t) => {
  const db = setupDb(t);

  const f5 = await handleNearbyEventsPageRoute(new URL("https://ikimon.life/ja/events/nearby?lat=34.71&lng=137.72"), "ja", null, db);
  assert.equal(f5.status, 200);
  const f5Html = await f5.text();
  assert.match(f5Html, /class="zt-shell"/);
  assert.match(f5Html, /data-event-view="f5"/);
  assert.match(f5Html, /佐鳴湖の観察会/);

  const f6Missing = await handleEventDetailsRoute("missing", "ja", null, db);
  assert.equal(f6Missing.status, 404);

  const f6 = await handleEventDetailsRoute("evt-near", "ja", null, db);
  assert.equal(f6.status, 200);
  const f6Html = await f6.text();
  assert.match(f6Html, /data-event-view="f6"/);
  assert.match(f6Html, /佐鳴湖の観察会/);
  assert.match(f6Html, /href="\/ja\/events\/evt-near\/confirm"/);
});
