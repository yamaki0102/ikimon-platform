import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSearchExploreV2Route } from "./zukanSearchV2";
import { handleSearchSeasonsV2Route } from "./zukanSearchSeasonsV2";

function wrap(sqlite: DatabaseSync): Env["OBS_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          values = a;
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

function setup(t: test.TestContext) {
  const s = new DatabaseSync(":memory:");
  t.after(() => s.close());
  s.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT, public_profile_status TEXT, superseded_by_place_id TEXT, locality_label TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT, title TEXT, started_at TEXT, ended_at TEXT, field_id TEXT, event_code TEXT);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, taxon_label TEXT, observed_at TEXT, visibility TEXT, emergency_hidden INTEGER DEFAULT 0, public_area_label TEXT, owner_user_id TEXT, created_at TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE record_place_memberships (record_id TEXT, place_id TEXT, membership_state TEXT, public_precision TEXT, removed_at TEXT);
  `);
  s.exec(`INSERT INTO places VALUES ('p1','みなと川の土手','published',NULL,'浜松市'),('p2','東川の河川敷','published',NULL,NULL),('p3','非公開','draft',NULL,NULL)`);
  const o = s.prepare("INSERT INTO observations VALUES (?,?,?,?,0,NULL,'u','x')");
  const m = s.prepare("INSERT INTO record_place_memberships VALUES (?,?,'confirmed','place',NULL)");
  const add = (id: string, at: string, vis: string, place: string) => {
    o.run(id, "カワセミ", at, vis);
    m.run(id, place);
  };
  add("a", "2026-11-15T01:00:00Z", "public", "p1");
  add("b", "2026-11-16T01:00:00Z", "public", "p1");
  add("c", "2026-11-17T01:00:00Z", "public", "p2");
  add("d", "2025-10-05T01:00:00Z", "public", "p2");
  add("e", "2026-11-18T01:00:00Z", "private", "p1");
  add("f", "2026-11-18T01:00:00Z", "public", "p3");
  s.exec("INSERT INTO asset_ledger VALUES ('t1','a','scrubbed'),('t1','b','scrubbed'),('t2','c','scrubbed')");
  s.exec("INSERT INTO observation_event_sessions VALUES ('s1','みなと通り 朝市','2026-11-16',NULL,'p1','E1'),('s2','別の場所の祭り','2026-11-17',NULL,'p1','E2')");
  return wrap(s);
}

const NOW = Date.parse("2026-11-27T03:00:00Z");
const html = async (u: string, db: Env["OBS_DB"]) => (await handleSearchSeasonsV2Route(new URL(u), "ja", null, db, NOW)).text();

test("default is latest month grouped by public places with counts", async (t) => {
  const h = await html("https://x/ja/search/seasons", setup(t));
  assert.match(h, /2026年11月/);
  assert.match(h, /みなと川の土手/);
  assert.match(h, /記録 2件/);
  assert.match(h, /東川の河川敷/);
  assert.doesNotMatch(h, /非公開/);
  assert.match(h, /場所 2件・記録 3件/);
  assert.equal((h.match(/\/thumb\/400\/t1/g) ?? []).length, 1);
});

test("photo strips: grouped by day/event, max 3 per group, no duplicates, public only, capped", async (t) => {
  const db = setup(t);
  const h = await html("https://x/ja/search/seasons", db);
  assert.match(h, /data-search-v2-group="photos"/);
  assert.match(h, /11月16日（月） ・ みなと通り 朝市/);
  assert.match(h, /11月17日（火）<\/h3>/);
  assert.doesNotMatch(h, /別の場所の祭り/);
  assert.match(h, /\/thumb\/400\/t2/);
  assert.match(h, /href="\/ja\/observations\/b"/);
  assert.doesNotMatch(h, /observations\/e"/);
  assert.equal((h.match(/\/thumb\/400\/t1/g) ?? []).length, 1);
});

test("season word and ym filter", async (t) => {
  const db = setup(t);
  const a = await html("https://x/ja/search/seasons?q=" + encodeURIComponent("去年の秋"), db);
  assert.match(a, /東川の河川敷/);
  assert.doesNotMatch(a, /みなと川の土手/);
  const b = await html("https://x/ja/search/seasons?ym=2025-10", db);
  assert.match(b, /記録 1件/);
  const c = await html("https://x/ja/search/seasons?ym=2024-01", db);
  assert.match(c, /この時期の記録はまだありません/);
});

test("explore season chips lead to seasons screen", async (t) => {
  const h = await (await handleSearchExploreV2Route(new URL("https://x/ja/search/explore"), "ja", null, setup(t))).text();
  assert.match(h, /\/ja\/search\/seasons\?q=%E5%8E%BB%E5%B9%B4%E3%81%AE%E7%A7%8B/);
});
