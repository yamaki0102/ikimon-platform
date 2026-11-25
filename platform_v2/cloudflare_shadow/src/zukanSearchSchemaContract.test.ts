import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSearchSeasonsRoute } from "./zukanSearchEmptyAndSeasons";
import { handleSearchExploreRoute } from "./zukanSearchPromptAndSuggest";
import { handleSearchResultsApi, handleSearchResultsRoute } from "./zukanSearchResults";

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

function prodDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY, draft_id TEXT, owner_user_id TEXT NOT NULL, observed_at TEXT NOT NULL, taxon_label TEXT, note TEXT,
      exact_lat REAL, exact_lng REAL, location_accuracy_m REAL, public_cell TEXT, visibility TEXT NOT NULL, emergency_hidden INTEGER NOT NULL DEFAULT 0,
      processing_state TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, partition_month TEXT, organism_origin TEXT, public_area_label TEXT
    );
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, locality_label TEXT, public_profile_status TEXT NOT NULL, superseded_by_place_id TEXT);
    CREATE TABLE record_place_memberships (record_id TEXT, place_id TEXT, membership_state TEXT, public_precision TEXT, removed_at TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, title TEXT NOT NULL, started_at TEXT NOT NULL);
  `);
  const obs = sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, observed_at, taxon_label, visibility, public_area_label) VALUES (?, 'u', ?, ?, ?, ?)");
  obs.run("o1", "2026-11-15T01:00:00Z", "カワセミ", "public", "東川の河川敷");
  obs.run("o2", "2026-11-14T01:00:00Z", null, "public", null);
  obs.run("o3", "2026-11-13T01:00:00Z", "カワセミ秘密", "private", null);
  sqlite.prepare("INSERT INTO asset_ledger VALUES ('a1', 'o1', 'scrubbed')").run();
  sqlite.prepare("INSERT INTO places VALUES ('p1', '東川の河川敷', '浜松市中央区', 'published', NULL)").run();
  sqlite.prepare("INSERT INTO record_place_memberships VALUES ('o1', 'p1', 'confirmed', 'place', NULL)").run();
  return sqliteObsDb(sqlite);
}

test("search finds public records on the production table shape and links them to real routes", async (t) => {
  const db = prodDb(t);
  const api = (await (await handleSearchResultsApi(new URL("https://x/api/v1/search/results?q=カワセミ&type=records"), db)).json()) as { records: Array<{ observationId: string; assetId: string | null }> };
  assert.deepEqual(api.records.map((r) => r.observationId), ["o1"]);
  assert.equal(api.records[0]!.assetId, "a1");

  const html = await (await handleSearchResultsRoute(new URL("https://x/ja/search/results?q=カワセミ"), "ja", null, db)).text();
  assert.match(html, /href="\/ja\/observations\/o1"/);
  assert.match(html, /src="\/thumb\/400\/a1"/);
  assert.match(html, /<mark>カワセミ<\/mark>/);
  assert.doesNotMatch(html, /\/records\//);
  assert.doesNotMatch(html, /カワセミ秘密/);

  const blank = await (await handleSearchResultsRoute(new URL("https://x/ja/search/results?q="), "ja", null, db)).text();
  assert.match(blank, /名前なしの記録/);
  assert.match(blank, /記録 1件/);
  assert.match(blank, /浜松市中央区/);
});

test("search explore and seasons render rows on the production table shape", async (t) => {
  const db = prodDb(t);
  const explore = await (await handleSearchExploreRoute(new URL("https://x/ja/search/explore"), "ja", null, db)).text();
  assert.match(explore, /よく見られている場所/);
  assert.match(explore, /東川の河川敷/);
  assert.match(explore, /時期で探す/);
  const seasons = await (await handleSearchSeasonsRoute(new URL("https://x/ja/search/seasons?season=autumn"), "ja", null, db)).text();
  assert.match(seasons, /href="\/ja\/observations\/o1"/);
  assert.match(seasons, /名前なしの記録/);
});

test("search empty state invites a different word", async (t) => {
  const db = prodDb(t);
  const html = await (await handleSearchResultsRoute(new URL("https://x/ja/search/results?q=恐竜"), "ja", null, db)).text();
  assert.match(html, /「恐竜」は見つかりませんでした/);
  assert.match(html, /言葉を変えると/);
  assert.match(html, /時期で探す/);
});
