import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSaveAccountSettingsDetail } from "./zukanAccountSettingsDetail";
import { handleProfileAvatarGet, handleProfileAvatarUpload } from "./zukanProfileAvatar";
import { loadProfileHubData, renderProfileHub } from "./zukanProfileHub";
import { renderZukanChrome } from "./zukanShellChrome";

function d1(sqlite: DatabaseSync) {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) { values = args; return stmt; },
        async first<T>() { return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null; },
        async all<T>() { return { results: sqlite.prepare(query).all(...(values as never[])) as T[] }; },
        async run() { sqlite.prepare(query).run(...(values as never[])); return { success: true }; },
      };
      return stmt;
    },
    async batch(stmts: Array<{ run(): Promise<unknown> }>) { for (const s of stmts) await s.run(); return []; },
  } as unknown as Env["CORE_DB"];
}

function setup(t: test.TestContext) {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => { obs.close(); core.close(); });
  obs.exec(`
    CREATE TABLE user_account_settings (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', notify_comments INTEGER NOT NULL DEFAULT 1, notify_events INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT, observed_at TEXT, taxon_label TEXT, visibility TEXT, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE observation_event_participants (participant_id TEXT, session_id TEXT, user_id TEXT);
  `);
  core.exec(`
    CREATE TABLE auth_users (user_id TEXT PRIMARY KEY, display_name TEXT, updated_at TEXT);
    CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT, display_name TEXT);
    CREATE TABLE user_profiles (user_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, profile_bio TEXT NOT NULL DEFAULT '', expertise TEXT NOT NULL DEFAULT '', avatar_object_key TEXT, avatar_mime TEXT, avatar_bytes INTEGER, avatar_sha256 TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE user_saved_items (user_id TEXT, object_id TEXT, object_kind TEXT, state TEXT);
    CREATE TABLE alert_deliveries (delivery_id TEXT, user_id TEXT, acknowledged_at TEXT);
    INSERT INTO auth_users VALUES ('u1','YAMAKI',NULL);
    INSERT INTO auth_sessions VALUES ('h1','u1','YAMAKI'),('h2','u1','YAMAKI'),('h3','u2','他人');
  `);
  return { obs, core, obsDb: d1(obs) as unknown as Env["OBS_DB"], coreDb: d1(core) };
}

const post = (body: unknown) => new Request("https://x/api/v1/profile/settings-detail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

test("saving the field name updates the core name every page reads and all sessions", async (t) => {
  const { core, obsDb, coreDb } = setup(t);
  const res = await handleSaveAccountSettingsDetail(post({ section: "profile", displayName: "はまっこ", bio: "b" }), { userId: "u1", displayName: "YAMAKI" }, obsDb, coreDb);
  assert.equal(res.status, 200);
  assert.equal((core.prepare("SELECT display_name FROM auth_users WHERE user_id='u1'").get() as { display_name: string }).display_name, "はまっこ");
  assert.deepEqual(core.prepare("SELECT display_name FROM auth_sessions ORDER BY token_hash").all().map((r) => (r as { display_name: string }).display_name), ["はまっこ", "はまっこ", "他人"]);
});

test("notifications save leaves the core name alone", async (t) => {
  const { core, obsDb, coreDb } = setup(t);
  await handleSaveAccountSettingsDetail(post({ section: "notifications", notifyComments: false }), { userId: "u1", displayName: "YAMAKI" }, obsDb, coreDb);
  assert.equal((core.prepare("SELECT display_name FROM auth_users WHERE user_id='u1'").get() as { display_name: string }).display_name, "YAMAKI");
});

test("profile header shows the saved field name even when the session copy is stale", async (t) => {
  const { obs, obsDb, coreDb } = setup(t);
  obs.exec("INSERT INTO user_account_settings VALUES ('u1','はまっこ','',1,1,'2026-11-28')");
  const data = await loadProfileHubData({ OBS_DB: obsDb, CORE_DB: coreDb }, { userId: "u1", displayName: "YAMAKI" });
  assert.equal(data.displayName, "はまっこ");
  const html = renderProfileHub("ja", data);
  assert.ok(html.includes("はまっこ"));
  assert.ok(!html.includes("YAMAKI"));
  assert.ok(/class="zt-avatar"[^>]*>は</.test(html));
});

test("avatar upload stores columns, get serves image with etag and 404 without avatar", async (t) => {
  const { coreDb } = setup(t);
  const session = { userId: "u1", displayName: "はまっこ" };
  const bucket = { async get(key: string) { return key === "k1" ? { body: new Uint8Array([1, 2, 3]) } : null; } } as unknown as Pick<R2Bucket, "get">;
  const miss = await handleProfileAvatarGet(new Request("https://x/api/v1/profile/avatar/me"), session, coreDb, bucket);
  assert.equal(miss.status, 404);
  const anon = await handleProfileAvatarUpload(new Request("https://x", { method: "POST", body: "{}" }), null, coreDb, async () => null);
  assert.equal(anon.status, 401);
  const bad = await handleProfileAvatarUpload(new Request("https://x", { method: "POST", body: "{}" }), session, coreDb, async () => null);
  assert.equal(bad.status, 400);
  const ok = await handleProfileAvatarUpload(new Request("https://x", { method: "POST", body: JSON.stringify({ avatar: {} }) }), session, coreDb, async () => ({ objectKey: "k1", mime: "image/png", bytes: 3, sha256: "abc" }));
  assert.equal(ok.status, 200);
  const got = await handleProfileAvatarGet(new Request("https://x/api/v1/profile/avatar/me"), session, coreDb, bucket);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get("content-type"), "image/png");
  assert.equal(got.headers.get("etag"), '"abc"');
  const cached = await handleProfileAvatarGet(new Request("https://x", { headers: { "if-none-match": '"abc"' } }), session, coreDb, bucket);
  assert.equal(cached.status, 304);
  const other = await handleProfileAvatarGet(new Request("https://x"), { userId: "u2" }, coreDb, bucket);
  assert.equal(other.status, 404);
});

test("shell loads the avatar image for members with the initial as fallback", () => {
  const member = renderZukanChrome({ lang: "ja", activeNav: "profile", authenticated: true, displayName: "はまっこ" });
  assert.ok(member.bottomNavHtml.includes("/api/v1/profile/avatar/me"));
  assert.ok(member.topbarHtml.includes(">は</a>"));
  const guest = renderZukanChrome({ lang: "ja", activeNav: "library", authenticated: false });
  assert.ok(!guest.bottomNavHtml.includes("/api/v1/profile/avatar/me"));
});
