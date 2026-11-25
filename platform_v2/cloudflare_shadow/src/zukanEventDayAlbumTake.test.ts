import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  handleEventDayAlbumTakeRoute,
  handleSaveEventToPlace,
} from "./zukanEventDayAlbumTake";

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
      place_id TEXT,
      started_at TEXT NOT NULL
    );
    CREATE TABLE observation_event_participants (
      participant_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'checked_in'
    );
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
    CREATE TABLE zukan_event_place_saves (
      save_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      place_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, place_id, user_id)
    );
  `);
  sqlite.prepare("INSERT INTO places (place_id, name, visibility) VALUES (?, ?, 'public')").run("place-sanaru", "佐鳴湖公園");
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, place_id, started_at) VALUES (?, ?, ?, ?, ?)").run(
    "evt-1",
    "秋の野鳥観察会",
    "org-1",
    "place-sanaru",
    "2026-11-25T09:00:00Z"
  );
  sqlite.prepare("INSERT INTO observation_event_participants (participant_id, session_id, user_id, status) VALUES (?, ?, ?, 'checked_in')").run(
    "part-1",
    "evt-1",
    "user-1"
  );
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("F3/F4/TAKE routes render in zukanShell with primary place CTA and save-to-place button", async (t) => {
  const { db } = setupDb(t);

  const dayRes = await handleEventDayAlbumTakeRoute("evt-1", "day", "ja", { userId: "user-1", banned: false }, db);
  assert.equal(dayRes.status, 200);
  const dayHtml = await dayRes.text();
  assert.match(dayHtml, /class="zt-shell"/);
  assert.match(dayHtml, /data-event-view="f3"/);
  assert.match(dayHtml, /秋の野鳥観察会/);

  const albumRes = await handleEventDayAlbumTakeRoute("evt-1", "album", "ja", { userId: "user-1", banned: false }, db);
  assert.equal(albumRes.status, 200);
  assert.match(await albumRes.text(), /data-event-view="f4"/);

  const takeRes = await handleEventDayAlbumTakeRoute("evt-1", "take", "ja", { userId: "user-1", banned: false }, db);
  assert.equal(takeRes.status, 200);
  const takeHtml = await takeRes.text();
  assert.match(takeHtml, /data-event-view="take"/);
  assert.match(takeHtml, /この場所の記録を見る/);
  assert.match(takeHtml, /href="\/ja\/places\/place-sanaru"/);
  assert.match(takeHtml, /data-save-to-place-btn="1"/);
});

test("POST /api/v1/events/:id/save-to-place enforces 401/403 and saves server-side place link", async (t) => {
  const { sqlite, db } = setupDb(t);

  const unauth = await handleSaveEventToPlace("evt-1", new Request("https://ikimon.life/", { method: "POST" }), null, db);
  assert.equal(unauth.status, 401);

  const nonParticipant = await handleSaveEventToPlace(
    "evt-1",
    new Request("https://ikimon.life/", { method: "POST" }),
    { userId: "outsider", banned: false },
    db
  );
  assert.equal(nonParticipant.status, 403);

  const okRes = await handleSaveEventToPlace(
    "evt-1",
    new Request("https://ikimon.life/", { method: "POST" }),
    { userId: "user-1", banned: false },
    db
  );
  assert.equal(okRes.status, 200);
  const body = await okRes.json() as { ok: boolean; placeId: string };
  assert.equal(body.ok, true);
  assert.equal(body.placeId, "place-sanaru");

  const row = sqlite.prepare("SELECT user_id, place_id FROM zukan_event_place_saves WHERE event_id = 'evt-1'").get() as {
    user_id: string;
    place_id: string;
  };
  assert.equal(row.user_id, "user-1");
  assert.equal(row.place_id, "place-sanaru");
});
