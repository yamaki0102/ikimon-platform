import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleEventAlbumOrShareRoute } from "./zukanEventAlbumAndShare";
import { handleEventConfirmOrJoinedRoute } from "./zukanEventConfirmAndJoined";
import { handleEventDayAlbumTakeRoute } from "./zukanEventDayAlbumTake";
import { handleEventPreAndPcRoute } from "./zukanEventPreAndPc";
import { handleEventDetailsRoute, handleNearbyEventsPageRoute } from "./zukanEventsNearbyAndDetails";
import { eventTiming } from "./zukanEventUi";

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

function prodDb(t: test.TestContext, startedAt: string) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observation_event_sessions (
      session_id TEXT PRIMARY KEY, legacy_event_id TEXT, event_code TEXT UNIQUE, title TEXT NOT NULL DEFAULT '',
      organizer_user_id TEXT NOT NULL, corporation_id TEXT, plan TEXT NOT NULL DEFAULT 'community',
      primary_mode TEXT NOT NULL DEFAULT 'discovery', active_modes_json TEXT NOT NULL DEFAULT '[]',
      location_lat REAL, location_lng REAL, location_radius_m INTEGER NOT NULL DEFAULT 1000,
      started_at TEXT NOT NULL, ended_at TEXT, target_species_json TEXT NOT NULL DEFAULT '[]',
      config_json TEXT NOT NULL DEFAULT '{}', field_id TEXT, template_source_session_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE observation_event_participants (
      participant_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT, guest_token TEXT,
      display_name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'registered'
    );
  `);
  sqlite
    .prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, location_lat, location_lng, started_at) VALUES ('evt-1', 'みなと通り 朝市', 'org-1', 35.0, 139.0, ?)")
    .run(startedAt);
  sqlite.prepare("INSERT INTO observation_event_participants (participant_id, session_id, user_id) VALUES ('p1', 'evt-1', 'u1'), ('p2', 'evt-1', 'u2')").run();
  return sqliteObsDb(sqlite);
}

test("event pages render on the production table shape (no place_id column)", async (t) => {
  const db = prodDb(t, "2099-12-13T08:00:00+09:00");
  const pre = await (await handleEventPreAndPcRoute("evt-1", "ja", null, db)).text();
  assert.match(pre, /次回 12月13日（日）/);
  assert.match(pre, /参加予定 2人/);
  assert.match(pre, /href="\/ja\/events\/evt-1\/confirm"/);
  assert.match(pre, />参加する</);
  assert.match(pre, /8:00〜/);

  for (const view of ["day", "album", "take"] as const) {
    const res = await handleEventDayAlbumTakeRoute("evt-1", view, "ja", null, db);
    assert.equal(res.status, 200, view);
  }
  const day = await (await handleEventDayAlbumTakeRoute("evt-1", "day", "ja", null, db)).text();
  assert.match(day, /写真を加える/);
  assert.match(day, /今日のアルバム/);
  const album = await (await handleEventDayAlbumTakeRoute("evt-1", "album", "ja", null, db)).text();
  assert.match(album, /おつかれさまでした/);
  assert.match(album, /図鑑に載せる/);

  for (const view of ["confirm", "joined"] as const) {
    assert.equal((await handleEventConfirmOrJoinedRoute("evt-1", view, "ja", null, db)).status, 200, view);
  }
  const confirm = await (await handleEventConfirmOrJoinedRoute("evt-1", "confirm", "ja", { userId: "u1", displayName: "はまっこ" }, db)).text();
  assert.match(confirm, /フィールドネーム/);
  assert.match(confirm, /参加を確定する/);

  assert.equal((await handleEventDetailsRoute("evt-1", "ja", null, db)).status, 200);
  for (const view of ["gallery", "share"] as const) {
    assert.equal((await handleEventAlbumOrShareRoute("evt-1", view, "https://zukan.earth", "ja", null, db)).status, 200, view);
  }
  const share = await (await handleEventAlbumOrShareRoute("evt-1", "share", "https://zukan.earth", "ja", null, db)).text();
  assert.match(share, /リンクをコピーする/);
  assert.match(share, /メールで送る/);

  const list = await (await handleNearbyEventsPageRoute(new URL("https://zukan.earth/ja/events/nearby"), "ja", null, db)).text();
  assert.match(list, /みなと通り 朝市/);
  assert.match(list, /href="\/ja\/events\/evt-1\/preview"/);
});

test("event list shows an invitation when there are no events", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, title TEXT, location_lat REAL, location_lng REAL, started_at TEXT, ended_at TEXT);`);
  const html = await (await handleNearbyEventsPageRoute(new URL("https://zukan.earth/ja/events/nearby"), "ja", null, sqliteObsDb(sqlite))).text();
  assert.match(html, /みんなの記録を見る/);
});

test("eventTiming tells upcoming, today and past apart", () => {
  const now = new Date("2026-11-25T03:00:00Z");
  assert.equal(eventTiming({ startedAt: "2026-12-13T08:00:00+09:00", endedAt: null }, "ja", now).phase, "upcoming");
  assert.equal(eventTiming({ startedAt: "2026-11-25T10:00:00+09:00", endedAt: null }, "ja", now).phase, "today");
  assert.equal(eventTiming({ startedAt: "2026-06-25T13:01:05.5451902Z", endedAt: null }, "ja", now).phase, "past");
  assert.equal(eventTiming({ startedAt: "2026-12-13T08:00:00+09:00", endedAt: "2026-12-13T11:00:00+09:00" }, "ja", now).timeLabel, "8:00〜11:00");
});

test("event page reads place, host and summary from config_json", async (t) => {
  const db = prodDb(t, "2099-12-13T08:00:00+09:00");
  const patched = {
    prepare(query: string) {
      const stmt = db.prepare(query);
      const original = stmt.first.bind(stmt);
      if (!query.includes("FROM observation_event_sessions WHERE session_id")) return stmt;
      stmt.first = (async () => {
        const row = (await original()) as Record<string, unknown> | null;
        return row ? { ...row, config_json: JSON.stringify({ placeName: "みなと通り", organizerName: "みなと通り商店会", summary: "地元の野菜や花が並ぶ朝市です。" }) } : row;
      }) as never;
      return stmt;
    },
  } as unknown as Env["OBS_DB"];
  const html = await (await handleEventPreAndPcRoute("evt-1", "ja", null, patched)).text();
  assert.match(html, /みなと通り商店会/);
  assert.match(html, /地元の野菜や花が並ぶ朝市です。/);
});
