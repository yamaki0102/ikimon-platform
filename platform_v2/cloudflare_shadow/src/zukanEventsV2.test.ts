import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleEventsV2Detail, handleEventsV2List, parseEventsV2Schedule } from "./zukanEventsV2";
import { PROTOTYPE_FLAGS } from "./flags/index.generated";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

const day = (offsetDays: number, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d);
  return `${ymd}T${String(hour).padStart(2, "0")}:00:00+09:00`;
};

function fixture(t: test.TestContext) {
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
    CREATE TABLE observation_event_participants (participant_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT, display_name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'registered', checked_in_at TEXT);
    CREATE TABLE observation_event_live_events (live_event_id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, scope TEXT NOT NULL DEFAULT 'all', actor_user_id TEXT, actor_guest_token TEXT, team_id TEXT, payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, visibility TEXT, emergency_hidden INTEGER DEFAULT 0);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, processing_state TEXT, uploaded_at TEXT, mime TEXT, public_derivative_key TEXT);
    INSERT INTO places VALUES ('pl1', 'みなと通り');
  `);
  const ev = sqlite.prepare("INSERT INTO observation_event_sessions (session_id, event_code, title, organizer_user_id, location_lat, location_lng, started_at, ended_at, config_json, field_id) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const cfg = JSON.stringify({ meetingPoint: "北口 7:50", bring: "買い物袋・飲み物", nearestStation: "浜松駅", parking: "公園の駐車場（無料）", cautions: "足元に注意", capacity: 15, eventKind: "観察会", schedule: ["8:00 集合", { time: "8:30", title: "朝市を歩く" }] });
  ev.run("up2", "c-up2", "二つ目の朝市", "org", 35.0, 139.0, day(10), day(10, 11), cfg, "pl1");
  ev.run("up1", "c-up1", "一つ目のクリーン作戦", "org", 35.1, 139.1, day(3), day(3, 11), "{}", null);
  ev.run("td", "c-td", "本日の観察会", "org", 35.0, 139.0, day(0, 0), day(0, 23), cfg, "pl1");
  ev.run("pa", "c-pa", "先月の朝市", "org", 35.0, 139.0, day(-20), day(-20, 11), cfg, "pl1");
  ev.run("qa", "qa-1", "テスト観察会", "org", 35.0, 139.0, day(4), day(4, 11), "{}", null);
  const part = sqlite.prepare("INSERT INTO observation_event_participants (participant_id, session_id, user_id) VALUES (?,?,?)");
  part.run("p1", "up2", "u1"); part.run("p2", "up2", "u2"); part.run("p3", "td", "u1"); part.run("p4", "pa", "u1"); part.run("p5", "pa", "u2");
  const live = sqlite.prepare("INSERT INTO observation_event_live_events (live_event_id, session_id, type, actor_user_id, payload_json) VALUES (?,?, 'observation_added', ?, ?)");
  live.run("l1", "td", "u1", JSON.stringify({ observation_id: "o1", taxon_name: "アオサギ", observed_at: day(0, 9) }));
  live.run("l2", "td", "u2", JSON.stringify({ observation_id: "o2", taxon_name: "カワセミ", observed_at: day(0, 9), visibility: "private" }));
  live.run("l3", "td", "u2", JSON.stringify({ observation_id: "o3", taxon_name: "ツバメ", observed_at: day(0, 9) }));
  live.run("l4", "pa", "u1", JSON.stringify({ observation_id: "o4", taxon_name: "アオサギ", observed_at: day(-20, 9), visibility: "public" }));
  live.run("l5", "pa", "u2", JSON.stringify({ observation_id: "o5", taxon_name: "ツバメ", observed_at: day(-20, 9), visibility: "public" }));
  live.run("l6", "pa", "u2", JSON.stringify({ observation_id: "o6", taxon_name: "シラサギ", observed_at: day(-20, 9), visibility: "public", red_list_rank: "VU" }));
  const obs = sqlite.prepare("INSERT INTO observations VALUES (?,?,?,0)");
  obs.run("o1", "u1", "public"); obs.run("o4", "u1", "public"); obs.run("o5", "u2", "public");
  const asset = sqlite.prepare("INSERT INTO asset_ledger VALUES (?,?, 'uploaded', '2026-01-01', 'image/jpeg', ?)");
  asset.run("a1", "o1", "derivatives/o1.jpg"); asset.run("a4", "o4", "derivatives/o4.jpg"); asset.run("a5", "o5", "derivatives/o4.jpg");
  return sqliteObsDb(sqlite);
}

test("flag EVENTS_V2_ENABLED is registered", () => {
  assert.ok(PROTOTYPE_FLAGS.find((x) => x.flag === "EVENTS_V2_ENABLED"));
});

test("schedule parser accepts strings and objects", () => {
  assert.deepEqual(parseEventsV2Schedule({ schedule: ["8:00 集合", { time: "9:00", title: "歩く" }, "解散"] }), [
    { time: "8:00", title: "集合" }, { time: "9:00", title: "歩く" }, { time: "", title: "解散" },
  ]);
});

test("list: date order, place, participants, distance, QA hidden", async (t) => {
  const db = fixture(t);
  const html = await (await handleEventsV2List(new URL("https://x.test/ja/community/events?lat=35.0&lng=139.0"), "ja", null, db)).text();
  assert.ok(!html.includes("テスト観察会"));
  const order = ["本日の観察会", "一つ目のクリーン作戦", "二つ目の朝市"].map((n) => html.indexOf(n));
  assert.ok(order.every((i) => i > 0) && order[0]! < order[1]! && order[1]! < order[2]!);
  assert.match(html, /みなと通り/);
  assert.match(html, /2人が参加します（定員15人）/);
  assert.match(html, /約\d+(\.\d)?km/);
  assert.match(html, /data-events-recent/);
  assert.match(html, /<h3 class="zev-day">/);
  assert.match(html, /参加はまだいません。最初の一人として参加できます/);
  assert.match(html, /data-events-search/);
  const found = await (await handleEventsV2List(new URL("https://x.test/ja/community/events?q=%E6%9C%9D%E5%B8%82"), "ja", null, db)).text();
  assert.match(found, /二つ目の朝市/);
  assert.ok(!found.includes("一つ目のクリーン作戦"));
  assert.match(html, /先月の朝市/);
});

test("detail upcoming: meeting point, bring, flow, join button", async (t) => {
  const db = fixture(t);
  const html = await (await handleEventsV2Detail("up2", "ja", { userId: "u9" }, db)).text();
  assert.match(html, /集合場所/);
  assert.match(html, /北口 7:50/);
  assert.match(html, /買い物袋・飲み物/);
  assert.match(html, /最寄り駅/);
  assert.match(html, /浜松駅/);
  assert.match(html, /公園の駐車場/);
  assert.match(html, /足元に注意/);
  assert.match(html, /当日の流れ/);
  assert.match(html, /朝市を歩く/);
  assert.match(html, /data-event-cta="join"[^>]*>参加する/);
  assert.match(html, /\/ja\/events\/up2\/confirm/);
  const bare = await (await handleEventsV2Detail("up1", "ja", { userId: "u9" }, db)).text();
  assert.equal((bare.match(/まだ決まっていません。決まりしだい、このページで知らせます/g) ?? []).length, 5);
  const joined = await (await handleEventsV2Detail("up2", "ja", { userId: "u1" }, db)).text();
  assert.match(joined, /参加予定です/);
  assert.ok(!joined.includes('data-event-cta="join"'));
  const guest = await (await handleEventsV2Detail("up2", "ja", null, db)).text();
  assert.match(guest, /\/ja\/login\?redirect=/);
});

test("detail day-of: permitted records only, no duplicate photos", async (t) => {
  const db = fixture(t);
  const html = await (await handleEventsV2Detail("td", "ja", { userId: "u1" }, db)).text();
  assert.match(html, /data-event-day/);
  assert.match(html, /アオサギ/);
  assert.match(html, /ツバメ/);
  assert.ok(!html.includes("カワセミ"));
  assert.match(html, /記録 2件・2種/);
  assert.match(html, /data-event-meet/);
  assert.match(html, /data-event-checkin="open"/);
  assert.match(html, /data-event-cta="checkin"[^>]*>チェックインする/);
  assert.match(html, /\/api\/v1\/observation-events\/td\/checkin/);
  assert.equal((html.match(/derivatives\/o1\.jpg/g) ?? []).length, 1);
  const outsider = await (await handleEventsV2Detail("td", "ja", { userId: "u9" }, db)).text();
  assert.ok(!outsider.includes("アオサギ"));
  assert.match(outsider, /data-event-cta="join"/);
});

test("detail after: summary counts, place link, rare hidden from outsiders, photo once", async (t) => {
  const db = fixture(t);
  const html = await (await handleEventsV2Detail("pa", "ja", { userId: "u9" }, db)).text();
  assert.match(html, /data-event-after/);
  assert.match(html, /公開された記録 2件 ・ 見つかった生きもの 2種/);
  assert.ok(!html.includes("シラサギ"));
  assert.match(html, /\/ja\/places\/pl1/);
  assert.equal((html.match(/derivatives\/o4\.jpg/g) ?? []).length, 1);
  const member = await (await handleEventsV2Detail("pa", "ja", { userId: "u2" }, db)).text();
  assert.match(member, /シラサギ/);
  assert.match(member, /図鑑に載せる/);
  assert.equal((await handleEventsV2Detail("nope", "ja", null, db)).status, 404);
});
