import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleLinkedAndSavedApi, handleLinkedAndSavedRoute } from "./zukanLinkedAndSaved";

function sqliteObsDb(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
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
    CREATE TABLE user_saved_items (
      save_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE observation_links (
      link_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO observation_links (link_id, user_id, target_type, target_id, target_title, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("l-1", "user-1", "place_zukan", "p-1", "佐鳴湖図鑑", "2026-06-01T10:00:00Z");
  sqlite.prepare("INSERT INTO observation_links (link_id, user_id, target_type, target_id, target_title, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("l-other", "user-2", "place_zukan", "p-2", "他人の連携", "2026-06-01T10:00:00Z");
  sqlite.prepare("INSERT INTO user_saved_items (save_id, user_id, item_type, item_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)").run("s-1", "user-1", "place", "p-1", "保存した佐鳴湖", "2026-06-02T10:00:00Z");
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/profile/linked-and-saved enforces 401 and scopes to user_id", async (t) => {
  const db = setupDb(t);
  const unauth = await handleLinkedAndSavedApi(null, db);
  assert.equal(unauth.status, 401);

  const okRes = await handleLinkedAndSavedApi({ userId: "user-1", displayName: "ユイ" }, db);
  assert.equal(okRes.status, 200);
  const body = await okRes.json() as {
    ok: boolean;
    linked: Array<{ linkId: string }>;
    saved: Array<{ saveId: string }>;
  };
  assert.equal(body.ok, true);
  assert.deepEqual(body.linked.map((l) => l.linkId), ["l-1"]);
  assert.deepEqual(body.saved.map((s) => s.saveId), ["s-1"]);
});

test("I4-I5 linked and saved page renders tabs and items in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleLinkedAndSavedRoute(
    new URL("https://ikimon.life/ja/profile/linked-saved?tab=linked"),
    "ja",
    { userId: "user-1", displayName: "ユイ" },
    db
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-profile-view="i4-i5"/);
  assert.match(html, /佐鳴湖図鑑/);
  assert.doesNotMatch(html, /他人の連携/);
});
