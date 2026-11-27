import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSearchExploreV2Route, handleSearchResultsV2Route, handleSearchSuggestV2Api, parseSearchV2Query, querySearchV2Results } from "./zukanSearchV2";

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

const NOW = Date.parse("2026-11-27T03:00:00Z");

function setupDb(t: test.TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, public_profile_status TEXT NOT NULL DEFAULT 'draft', superseded_by_place_id TEXT, locality_label TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, title TEXT NOT NULL, started_at TEXT NOT NULL);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, taxon_label TEXT, observed_at TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, public_area_label TEXT, owner_user_id TEXT, created_at TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE record_place_memberships (record_id TEXT, place_id TEXT, membership_state TEXT, public_precision TEXT, removed_at TEXT);
  `);
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, 'published')").run("p-1", "みなと川の土手");
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, 'draft')").run("p-priv", "非公開の川");
  sqlite.prepare("INSERT INTO observation_event_sessions VALUES (?, ?, ?)").run("ev-1", "みなと川クリーン作戦", "2025-10-12T00:00:00Z");
  sqlite.prepare("INSERT INTO observation_event_sessions VALUES (?, ?, ?)").run("ev-2", "春の朝市", "2026-04-12T00:00:00Z");
  const ins = sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, visibility, public_area_label, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ins.run("o-1", "カワセミ", "2025-10-20T01:00:00Z", "public", "東川の河川敷", "u1", "2025-10-20");
  ins.run("o-2", "アオサギ", "2026-04-02T01:00:00Z", "public", "東川の河川敷", "u1", "2026-04-02");
  ins.run("o-3", "カワセミ", "2026-05-02T01:00:00Z", "private", "秘密の川", "u2", "2026-05-02");
  sqlite.prepare("INSERT INTO asset_ledger VALUES ('a-1','o-1','scrubbed')").run();
  return sqliteObsDb(sqlite);
}

test("parseSearchV2Query splits season words from text", () => {
  const p = parseSearchV2Query("川 去年の秋", NOW);
  assert.deepEqual(p.textTokens, ["川"]);
  assert.deepEqual(p.seasonLabels, ["去年の秋"]);
});

test("season word alone filters events and records, excludes private and out-of-season", async (t) => {
  const db = setupDb(t);
  const r = await querySearchV2Results("去年の秋", "all", db, NOW);
  assert.deepEqual(r.records.map((x) => x.observationId), ["o-1"]);
  assert.deepEqual(r.events.map((x) => x.sessionId), ["ev-1"]);
  assert.equal(r.places.length, 0);
  const spring = await querySearchV2Results("春", "all", db, NOW);
  assert.deepEqual(spring.records.map((x) => x.observationId), ["o-2"]);
  assert.deepEqual(spring.events.map((x) => x.sessionId), ["ev-2"]);
});

test("text search groups places/events/records and never leaks private rows", async (t) => {
  const db = setupDb(t);
  const r = await querySearchV2Results("川", "all", db, NOW);
  assert.deepEqual(r.places.map((x) => x.placeId), ["p-1"]);
  assert.deepEqual(r.events.map((x) => x.sessionId), ["ev-1"]);
  assert.deepEqual(r.records.map((x) => x.observationId).sort(), ["o-1", "o-2"]);
});

test("results page: grouped sections, season note, no duplicate thumbs, empty state first step", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchResultsV2Route(new URL("https://zukan.earth/ja/search/results?q=%E5%B7%9D"), "ja", null, db);
  const html = await res.text();
  assert.match(html, /data-search-v2="results"/);
  for (const g of ["places", "events", "records"]) assert.match(html, new RegExp(`data-search-v2-group="${g}"`));
  assert.match(html, /<mark>川<\/mark>/);
  const thumbs = html.match(/\/thumb\/400\/[^"]+/g) ?? [];
  assert.equal(new Set(thumbs).size, thumbs.length);

  const season = await (await handleSearchResultsV2Route(new URL("https://zukan.earth/ja/search/results?q=%E5%8E%BB%E5%B9%B4%E3%81%AE%E7%A7%8B"), "ja", null, db)).text();
  assert.match(season, /data-search-v2="season-note"/);

  const empty = await (await handleSearchResultsV2Route(new URL("https://zukan.earth/ja/search/results?q=%E6%81%90%E7%AB%9C"), "ja", null, db)).text();
  assert.match(empty, /「恐竜」は見つかりませんでした/);
  assert.match(empty, /data-search-v2="first-step"/);
  assert.match(empty, /href="\/ja\/search\/seasons"/);
});

test("suggest api returns species, places, events; escapes LIKE wildcards", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchSuggestV2Api(new URL("https://zukan.earth/api/v1/search/suggest-v2?q=%E5%B7%9D"), db);
  const body = (await res.json()) as { suggestions: Array<{ kind: string }> };
  assert.deepEqual([...new Set(body.suggestions.map((s) => s.kind))].sort(), ["event", "place"]);
  const kawa = (await (await handleSearchSuggestV2Api(new URL("https://zukan.earth/api/v1/search/suggest-v2?q=%E3%82%AB%E3%83%AF"), db)).json()) as { suggestions: Array<{ kind: string; label: string }> };
  assert.deepEqual(kawa.suggestions.filter((s) => s.kind === "species").map((s) => s.label), ["カワセミ"]);
  const wild = (await (await handleSearchSuggestV2Api(new URL("https://zukan.earth/api/v1/search/suggest-v2?q=%25"), db)).json()) as { suggestions: unknown[] };
  assert.equal(wild.suggestions.length, 0);
});

test("explore page: recent species of the user, season words, live container; with q shows server suggestions", async (t) => {
  const db = setupDb(t);
  const idle = await (await handleSearchExploreV2Route(new URL("https://zukan.earth/ja/search/explore"), "ja", { userId: "u1", displayName: "a" }, db)).text();
  assert.match(idle, /data-search-v2="recent-species"/);
  assert.match(idle, /アオサギ/);
  assert.match(idle, /data-search-v2="season-words"/);
  assert.match(idle, /zs2-recent/);
  assert.match(idle, /id="zs2-live"[^>]*hidden/);
  const typed = await (await handleSearchExploreV2Route(new URL("https://zukan.earth/ja/search/explore?q=%E5%B7%9D"), "ja", null, db)).text();
  assert.match(typed, /みなと<mark>川<\/mark>の土手/);
  assert.match(typed, /「川」で探す/);
  assert.match(typed, /id="zs2-idle"[^>]*hidden/);
});

test("SEARCH_V2_ENABLED is default off in staging and production", async () => {
  const { PROTOTYPE_FLAGS } = await import("./flags/index.generated");
  const f = PROTOTYPE_FLAGS.find((x) => x.flag === "SEARCH_V2_ENABLED");
  assert.ok(f);
  assert.equal((f as { stagingEnabled?: boolean }).stagingEnabled, false);
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  assert.match(src, /searchV2On\(env, session\)\) return handleSearchExploreV2Route/);
  assert.match(src, /searchV2On\(env, session\)\) return handleSearchResultsV2Route/);
});

test("results collapse unidentified records, cap list, no library nav highlight; explore hides zero-record places", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE places (place_id TEXT PRIMARY KEY, canonical_name TEXT NOT NULL, public_profile_status TEXT NOT NULL DEFAULT 'draft', superseded_by_place_id TEXT, locality_label TEXT);
    CREATE TABLE observation_event_sessions (session_id TEXT PRIMARY KEY, title TEXT NOT NULL, started_at TEXT NOT NULL);
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, taxon_label TEXT, observed_at TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public', emergency_hidden INTEGER DEFAULT 0, public_area_label TEXT, owner_user_id TEXT, created_at TEXT);
    CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, observation_id TEXT, exif_scrub_state TEXT);
    CREATE TABLE record_place_memberships (record_id TEXT, place_id TEXT, membership_state TEXT, public_precision TEXT, removed_at TEXT);
  `);
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES ('p-0','あい公園','published')").run();
  const ins = sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, public_area_label) VALUES (?, ?, ?, ?)");
  for (let i = 0; i < 12; i++) ins.run(`u-${i}`, "未同定", "2026-06-02T01:00:00Z", "掛川");
  for (let i = 0; i < 12; i++) ins.run(`n-${i}`, `カワ${i}`, "2026-06-03T01:00:00Z", "掛川");
  const db = sqliteObsDb(sqlite);
  const html = await (await handleSearchResultsV2Route(new URL("https://zukan.earth/ja/search/results?q=%E6%8E%9B%E5%B7%9D"), "ja", null, db)).text();
  assert.match(html, /名前が未確定の記録 12件/);
  assert.equal((html.match(/\/ja\/observations\//g) ?? []).length, 9);
  assert.match(html, /もっと見る/);
  assert.match(html, /\/ja\/records\?view=public&amp;q=/);
  assert.doesNotMatch(html, /zt-nav-item[^>]*is-active/);
  const explore = await (await handleSearchExploreV2Route(new URL("https://zukan.earth/ja/search/explore"), "ja", null, db)).text();
  assert.doesNotMatch(explore, /よく見られている場所/);
  assert.doesNotMatch(explore, /あい公園/);
});
