import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
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
    CREATE TABLE places (
      place_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
    CREATE TABLE observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      taxon_display_name TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
  `);
  sqlite.prepare("INSERT INTO places (place_id, name, visibility) VALUES (?, ?, 'public')").run("p-1", "佐鳴湖カワセミ観察地");
  sqlite.prepare("INSERT INTO places (place_id, name, visibility) VALUES (?, ?, 'private')").run("p-priv", "非公開カワセミ場所");
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, started_at) VALUES (?, ?, ?)").run("ev-1", "初夏カワセミ観察会", "2026-06-01T09:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_display_name, observed_at, visibility) VALUES (?, ?, ?, 'public')").run("obs-1", "カワセミ", "2026-06-02T08:30:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_display_name, observed_at, visibility) VALUES (?, ?, ?, 'private')").run("obs-priv", "カワセミ（非公開）", "2026-06-02T08:40:00Z");
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/search/results filters by type and excludes private places/records", async (t) => {
  const db = setupDb(t);

  const allRes = await handleSearchResultsApi(new URL("https://ikimon.life/api/v1/search/results?q=カワセミ&type=all"), db);
  assert.equal(allRes.status, 200);
  const allBody = await allRes.json() as {
    ok: boolean;
    type: string;
    places: Array<{ placeId: string }>;
    events: Array<{ sessionId: string }>;
    records: Array<{ observationId: string }>;
  };
  assert.equal(allBody.ok, true);
  assert.equal(allBody.type, "all");
  assert.deepEqual(allBody.places.map((p) => p.placeId), ["p-1"]);
  assert.deepEqual(allBody.events.map((e) => e.sessionId), ["ev-1"]);
  assert.deepEqual(allBody.records.map((r) => r.observationId), ["obs-1"]);

  const placesRes = await handleSearchResultsApi(new URL("https://ikimon.life/api/v1/search/results?q=カワセミ&type=places"), db);
  const placesBody = await placesRes.json() as typeof allBody;
  assert.equal(placesBody.places.length, 1);
  assert.equal(placesBody.events.length, 0);
  assert.equal(placesBody.records.length, 0);
});

test("H3-H6 search results page renders type tabs, wrapped metadata, and results in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchResultsRoute(new URL("https://ikimon.life/ja/search/results?q=カワセミ&type=all"), "ja", null, db);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-search-view="h3-h6"/);
  assert.match(html, /zt-search-meta/);
  assert.match(html, /佐鳴湖カワセミ観察地/);
  assert.match(html, /初夏カワセミ観察会/);
  assert.match(html, /カワセミ/);
});
