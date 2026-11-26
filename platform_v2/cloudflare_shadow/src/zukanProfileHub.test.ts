import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { loadProfileHubData, renderNotificationDetail, renderNotificationsList, renderProfileHub, renderProfileSettingsHub } from "./zukanProfileHub";

function sqliteDb(sqlite: DatabaseSync): Env["OBS_DB"] {
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

test("profile hub (I1) shows stats, record mosaic and the four menu rows in the shared shell", async (t) => {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => { obs.close(); core.close(); });
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, visibility TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE observation_event_participants (participant_id TEXT, session_id TEXT, user_id TEXT);
    CREATE TABLE user_account_settings (user_id TEXT, bio TEXT);
    INSERT INTO observations VALUES ('o1','u1','2026-11-15T01:00:00Z','カワセミ','private','東川の河川敷'),('o2','u1','2026-11-24T01:00:00Z','クスノキ','public',NULL),('x','u2','2026-11-24T01:00:00Z','他人','public',NULL);
    INSERT INTO asset_ledger VALUES ('a1','o1','scrubbed'),('a2','o2','scrubbed');
    INSERT INTO observation_event_participants VALUES ('p1','s1','u1'),('p2','s1','u1'),('p3','s2','u1');
    INSERT INTO user_account_settings VALUES ('u1','浜松の里山と川辺を記録しています。');
  `);
  core.exec(`
    CREATE TABLE user_saved_items (user_id TEXT, object_id TEXT, object_kind TEXT, state TEXT);
    CREATE TABLE alert_deliveries (delivery_id TEXT, user_id TEXT, acknowledged_at TEXT);
    CREATE TABLE user_profiles (user_id TEXT, profile_bio TEXT);
    INSERT INTO user_saved_items VALUES ('u1','p1','place','saved'),('u1','p2','place','saved'),('u1','e1','event','saved');
    INSERT INTO alert_deliveries VALUES ('d1','u1',NULL),('d2','u1','2026-11-24');
  `);
  const data = await loadProfileHubData({ OBS_DB: sqliteDb(obs), CORE_DB: sqliteDb(core) }, { userId: "u1", displayName: "はまっこ" });
  assert.deepEqual([data.recordCount, data.savedPlaceCount, data.joinedEventCount, data.unreadCount], [2, 2, 2, 1]);
  const html = renderProfileHub("ja", data);
  for (const text of ["はまっこ", "浜松の里山と川辺を記録しています。", "自分の記録", "保存した場所", "参加イベント", "すべて見る", "公開先", "保存した場所・イベント", "通知", "設定", "プロフィール・通知・公開範囲", "公開中", "自分だけ"]) assert.ok(html.includes(text), text);
  assert.match(html, /data-testid="profile-hub-mosaic"/);
  assert.match(html, /zt-bottom-nav/);
  assert.match(html, /href="\/ja\/profile\/notifications"/);
  assert.doesNotMatch(html, /他人/);
});

test("notifications list (I6) and detail (I7)", () => {
  const a = { deliveryId: "d1", occurrenceId: "o1", triggerKind: "record_feedback_ready", createdAt: "2026-11-24T09:20:00Z", acknowledgedAt: null, payload: { title: "「カワセミ」にコメントがつきました", body: "杭の上のカワセミ、私も見ました。" } };
  const list = renderNotificationsList("ja", "はまっこ", [a, { ...a, deliveryId: "d2", acknowledgedAt: "x", payload: {} }]);
  assert.match(list, /「カワセミ」にコメントがつきました/);
  assert.match(list, /11月24日 18:20/);
  assert.equal((list.match(/zt-nt-dot/g) ?? []).length, 2 - 1 + 1); // css rule + one unread dot
  const detail = renderNotificationDetail("ja", "はまっこ", a, { id: "o1", title: "カワセミ", observedAt: "2026-11-15T01:00:00Z", area: "東川の河川敷", assetId: "a1" });
  assert.match(detail, /杭の上のカワセミ/);
  assert.match(detail, /記録を見る/);
  assert.match(detail, /11月15日 ・ 東川の河川敷/);
  assert.match(renderNotificationsList("ja", "x", []), /まだ通知はありません/);
});

test("settings hub (I12) keeps logout, language and the acknowledged withdrawal form", () => {
  const html = renderProfileSettingsHub("ja", { displayName: "はまっこ", email: "hamakko@example.jp", recordCount: 38, flash: null });
  for (const text of ["ログアウト・退会", "hamakko@example.jp", "ログアウト", "退会", "自分の記録38件とアカウントが全部消えます", "退会する"]) assert.ok(html.includes(text), text);
  assert.match(html, /action="\/api\/v1\/account\/withdraw"/);
  assert.match(html, /data-withdrawal-ack/);
  assert.match(html, /action="\/api\/v1\/profile\/language"/);
});

test("profile hub recent records use legacy import names instead of raw 'unidentified'", async (t) => {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => { obs.close(); core.close(); });
  obs.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, visibility TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE observation_event_participants (participant_id TEXT, session_id TEXT, user_id TEXT);
    CREATE TABLE user_account_settings (user_id TEXT, bio TEXT);
    CREATE TABLE production_import_occurrences (occurrence_id TEXT PRIMARY KEY, visit_id TEXT, scientific_name TEXT, vernacular_name TEXT, taxon_rank TEXT, confidence_score REAL, quality_grade TEXT, created_at TEXT, updated_at TEXT);
    INSERT INTO observations VALUES ('o1','u1','2026-11-15T01:00:00Z','unidentified','public',NULL),('o2','u1','2026-11-14T01:00:00Z','unidentified','public',NULL);
    INSERT INTO production_import_occurrences VALUES ('occ:o1:0','o1',NULL,NULL,NULL,NULL,NULL,'2020-01-01',NULL),('occ:o1:1','o1','Parus minor','シジュウカラ','species',0.5,NULL,'2020-01-02',NULL);
  `);
  core.exec(`
    CREATE TABLE user_saved_items (user_id TEXT, object_id TEXT, object_kind TEXT, state TEXT);
    CREATE TABLE alert_deliveries (delivery_id TEXT, user_id TEXT, acknowledged_at TEXT);
    CREATE TABLE user_profiles (user_id TEXT, profile_bio TEXT);
  `);
  const data = await loadProfileHubData({ OBS_DB: sqliteDb(obs), CORE_DB: sqliteDb(core) }, { userId: "u1", displayName: "はまっこ" });
  const html = renderProfileHub("ja", data);
  assert.doesNotMatch(html, /unidentified/i);
  assert.match(html, /シジュウカラ/);
  assert.match(html, /名前なしの記録/);
});
