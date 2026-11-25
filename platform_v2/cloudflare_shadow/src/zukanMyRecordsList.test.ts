import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleMyRecordsApi, handleMyRecordsRoute } from "./zukanMyRecordsList";

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
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      taxon_display_name TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private'
    );
  `);
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_display_name, observed_at, visibility) VALUES (?, ?, ?, ?, 'public')").run("obs-u1-pub", "user-1", "カワセミ", "2026-06-01T09:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_display_name, observed_at, visibility) VALUES (?, ?, ?, ?, 'private')").run("obs-u1-priv", "user-1", "アオサギ", "2026-06-02T09:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_display_name, observed_at, visibility) VALUES (?, ?, ?, ?, 'private')").run("obs-u2-priv", "user-2", "他人の秘密", "2026-06-03T09:00:00Z");
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/profile/my-records enforces 401 without session and scopes to owner_user_id", async (t) => {
  const db = setupDb(t);

  const unauth = await handleMyRecordsApi(new URL("https://ikimon.life/api/v1/profile/my-records"), null, db);
  assert.equal(unauth.status, 401);

  const own = await handleMyRecordsApi(
    new URL("https://ikimon.life/api/v1/profile/my-records"),
    { userId: "user-1", displayName: "ユイ" },
    db
  );
  assert.equal(own.status, 200);
  const body = await own.json() as { ok: boolean; records: Array<{ observationId: string }> };
  assert.equal(body.ok, true);
  assert.deepEqual(body.records.map((r) => r.observationId), ["obs-u1-priv", "obs-u1-pub"]);
});

test("I2-I3 my records page renders PC 2-column layout and own records list in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleMyRecordsRoute(
    new URL("https://ikimon.life/ja/profile/records"),
    "ja",
    { userId: "user-1", displayName: "ユイ" },
    db
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-profile-view="i2-i3"/);
  assert.match(html, /カワセミ/);
  assert.match(html, /アオサギ/);
  assert.doesNotMatch(html, /他人の秘密/);
});
