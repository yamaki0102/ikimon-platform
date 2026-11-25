import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleAccountSettingsDetailRoute } from "./zukanAccountSettingsDetail";
import { handleLinkedAndSavedRoute } from "./zukanLinkedAndSaved";
import { handleMyRecordsRoute } from "./zukanMyRecordsList";

function sqliteDb(sqlite: DatabaseSync): Env["OBS_DB"] {
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
        async run() {
          sqlite.prepare(query).run(...(values as never[]));
          return { meta: { changes: 1 } };
        },
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

const session = { userId: "u1", displayName: "はまっこ" };

test("my records lists the owner's records on the production table shape", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, visibility TEXT NOT NULL, public_area_label TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    INSERT INTO observations VALUES ('o1', 'u1', '2026-11-15T01:00:00Z', 'カワセミ', 'public', '東川の河川敷'), ('o2', 'u1', '2026-11-14T01:00:00Z', NULL, 'private', NULL), ('o3', 'u2', '2026-11-13T01:00:00Z', 'ほかの人', 'public', NULL);
    INSERT INTO asset_ledger VALUES ('a1', 'o1', 'scrubbed');
  `);
  const html = await (await handleMyRecordsRoute(new URL("https://x/ja/profile/records"), "ja", session, sqliteDb(sqlite))).text();
  assert.match(html, /2件あります/);
  assert.match(html, /カワセミ/);
  assert.match(html, /名前なしの記録/);
  assert.match(html, /href="\/ja\/observations\/o1"/);
  assert.match(html, /src="\/thumb\/400\/a1"/);
  assert.doesNotMatch(html, /\/records\/o/);
  assert.doesNotMatch(html, /ほかの人/);
});

test("saved items are read from the core database, not the observation database", async (t) => {
  const obs = new DatabaseSync(":memory:");
  const core = new DatabaseSync(":memory:");
  t.after(() => {
    obs.close();
    core.close();
  });
  core.exec(`
    CREATE TABLE user_saved_items (user_id TEXT, object_kind TEXT, object_id TEXT, canonical_path TEXT, display_title TEXT, state TEXT, saved_at TEXT, updated_at TEXT);
    INSERT INTO user_saved_items VALUES ('u1', 'place', 'p1', '/places/p1', '常磐公園', 'saved', '2026-11-20T01:00:00Z', '2026-11-20T01:00:00Z');
  `);
  const html = await (await handleLinkedAndSavedRoute(new URL("https://x/ja/profile/linked-saved?tab=saved"), "ja", session, sqliteDb(obs), sqliteDb(core))).text();
  assert.match(html, /常磐公園/);
  assert.match(html, /href="\/ja\/places\/p1"/);
});

test("settings tabs carry no screen ids and the forms are wired to the save API", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  for (const section of ["edit", "notifications", "account"] as const) {
    const html = await (await handleAccountSettingsDetailRoute(section, "ja", session, sqliteDb(sqlite))).text();
    assert.doesNotMatch(html, /\(I\d+\)/);
    if (section !== "account") assert.match(html, /\/api\/v1\/profile\/settings-detail/);
  }
  const edit = await (await handleAccountSettingsDetailRoute("edit", "ja", session, sqliteDb(sqlite))).text();
  assert.match(edit, /フィールドネーム/);
  assert.match(edit, /公開の範囲/);
});
