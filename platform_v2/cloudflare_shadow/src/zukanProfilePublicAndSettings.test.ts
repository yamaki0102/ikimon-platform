import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import {
  handleProfilePublicSettingsRoute,
  handlePublicUserProfileRoute,
  handleUpdateProfileVisibility,
} from "./zukanProfilePublicAndSettings";

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
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      taxon_label TEXT,
      public_cell TEXT NOT NULL,
      visibility TEXT NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_label, public_cell, visibility) VALUES (?, ?, ?, ?, 'public')").run(
    "obs-pub-1",
    "u-1",
    "カワセミ",
    "cell-a"
  );
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_label, public_cell, visibility) VALUES (?, ?, ?, ?, 'private')").run(
    "obs-priv-1",
    "u-1",
    "非公開記録",
    "cell-b"
  );
  return { sqlite, db: sqliteObsDb(sqlite) };
}

test("profile visibility defaults to private (P2), toggles via 401-guarded POST, and P1 shows only 3 public counts", async (t) => {
  const { db } = setupDb(t);

  // Default is private (P2)
  const p2Res = await handlePublicUserProfileRoute("u-1", "ja", null, db);
  assert.equal(p2Res.status, 200);
  const p2Html = await p2Res.text();
  assert.match(p2Html, /data-profile-view="p2"/);
  assert.match(p2Html, /非公開/);
  assert.doesNotMatch(p2Html, /公開中の記録/);

  // Unauthenticated settings/update -> 401
  const unauthPost = await handleUpdateProfileVisibility(
    new Request("https://ikimon.life/api/v1/profile/visibility", { method: "POST", body: JSON.stringify({ isPublic: true }) }),
    null,
    db
  );
  assert.equal(unauthPost.status, 401);

  // Settings page (I10/PUB)
  const settingsRes = await handleProfilePublicSettingsRoute("ja", { userId: "u-1", displayName: "タロウ", banned: false }, db);
  assert.equal(settingsRes.status, 200);
  assert.match(await settingsRes.text(), /data-profile-view="i10-pub"/);

  // Enable public profile (client userId ignored)
  const okPost = await handleUpdateProfileVisibility(
    new Request("https://ikimon.life/api/v1/profile/visibility", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "other-user", isPublic: true }),
    }),
    { userId: "u-1", displayName: "タロウ", banned: false },
    db
  );
  assert.equal(okPost.status, 200);

  // Now P1 renders only the 3 public counts (1 public record, 1 species, 1 place; private record excluded)
  const p1Res = await handlePublicUserProfileRoute("u-1", "ja", null, db);
  assert.equal(p1Res.status, 200);
  const p1Html = await p1Res.text();
  assert.match(p1Html, /data-profile-view="p1"/);
  assert.match(p1Html, /公開中の記録/);
  assert.match(p1Html, /図鑑に掲載/);
  assert.match(p1Html, /記録した場所/);
  assert.match(p1Html, /data-stat-public-records="1"/);
  assert.match(p1Html, /data-stat-zukan-species="1"/);
  assert.match(p1Html, /data-stat-places="1"/);
});
