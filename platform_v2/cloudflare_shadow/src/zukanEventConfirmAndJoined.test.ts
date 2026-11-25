import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  handleConfirmEventParticipation,
  handleEventConfirmOrJoinedRoute,
} from "./zukanEventConfirmAndJoined";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
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
      started_at TEXT NOT NULL
    );
    CREATE TABLE observation_event_participants (
      participant_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT,
      display_name TEXT,
      status TEXT NOT NULL DEFAULT 'checked_in',
      UNIQUE(session_id, user_id)
    );
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, started_at) VALUES (?, ?, ?, ?)").run(
    "evt-1",
    "里山の昆虫観察会",
    "org-1",
    "2026-12-03T10:00:00Z"
  );
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("F7 confirm and F8 joined render in zukanShell with field-name privacy notice", async (t) => {
  const { db } = setupDb(t);

  const f7 = await handleEventConfirmOrJoinedRoute("evt-1", "confirm", "ja", { userId: "u-1", displayName: "カワセミ太郎", banned: false }, db);
  assert.equal(f7.status, 200);
  const f7Html = await f7.text();
  assert.match(f7Html, /class="zt-shell"/);
  assert.match(f7Html, /data-event-view="f7"/);
  assert.match(f7Html, /主催者に伝わるのはフィールドネームまで/);
  assert.match(f7Html, /カワセミ太郎/);

  const f8 = await handleEventConfirmOrJoinedRoute("evt-1", "joined", "ja", { userId: "u-1", displayName: "カワセミ太郎", banned: false }, db);
  assert.equal(f8.status, 200);
  const f8Html = await f8.text();
  assert.match(f8Html, /data-event-view="f8"/);
  assert.match(f8Html, /href="\/ja\/events\/evt-1\/day"/);
});

test("POST /api/v1/events/:id/confirm enforces 401 and ignores client userId/status", async (t) => {
  const { sqlite, db } = setupDb(t);

  const unauth = await handleConfirmEventParticipation("evt-1", new Request("https://ikimon.life/", { method: "POST" }), null, db);
  assert.equal(unauth.status, 401);

  const okRes = await handleConfirmEventParticipation(
    "evt-1",
    new Request("https://ikimon.life/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "spoof-user", status: "organizer", displayName: "無視される名前" }),
    }),
    { userId: "u-1", displayName: "カワセミ太郎", banned: false },
    db
  );
  assert.equal(okRes.status, 200);
  const jsonBody = await okRes.json() as { ok: boolean; fieldName: string; status: string };
  assert.equal(jsonBody.ok, true);
  assert.equal(jsonBody.fieldName, "カワセミ太郎");
  assert.equal(jsonBody.status, "checked_in");

  const row = sqlite.prepare("SELECT user_id, display_name, status FROM observation_event_participants WHERE session_id = 'evt-1'").get() as {
    user_id: string;
    display_name: string;
    status: string;
  };
  assert.equal(row.user_id, "u-1");
  assert.equal(row.display_name, "カワセミ太郎");
  assert.equal(row.status, "checked_in");
});
