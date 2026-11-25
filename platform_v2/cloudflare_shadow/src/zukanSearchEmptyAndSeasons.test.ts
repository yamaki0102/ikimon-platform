import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSearchSeasonsApi, handleSearchSeasonsRoute } from "./zukanSearchEmptyAndSeasons";

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
      taxon_label TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'public'
    );
  `);
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, 'public')").run("obs-spring", "ヤマザクラ", "2026-04-05T10:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, 'public')").run("obs-winter", "ツグミ", "2026-01-15T10:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, 'private')").run("obs-priv", "非公開の春", "2026-04-10T10:00:00Z");
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/search/seasons returns public observations for requested season", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchSeasonsApi(new URL("https://ikimon.life/api/v1/search/seasons?season=spring"), db);
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; season: string; records: Array<{ observationId: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.season, "spring");
  assert.deepEqual(body.records.map((r) => r.observationId), ["obs-spring"]);
});

test("H7-H8 page renders H7 empty guidance when empty and H8 season tabs in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchSeasonsRoute(
    new URL("https://ikimon.life/ja/search/seasons?season=autumn&q=存在しない生きもの"),
    "ja",
    null,
    db
  );
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-search-view="h7-h8"/);
  assert.match(html, /data-search-empty-guide="1"/);
  assert.match(html, /春/);
  assert.match(html, /秋/);
});

test("H7 shows 未同定 instead of the raw English 'unidentified' label", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE observations (observation_id TEXT PRIMARY KEY, taxon_label TEXT NOT NULL, observed_at TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'public');");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, 'public')").run("obs-u", "unidentified", "2026-04-05T10:00:00Z");
  const res = await handleSearchSeasonsRoute(new URL("https://ikimon.life/ja/search/seasons?season=spring"), "ja", null, sqliteObsDb(sqlite));
  const html = await res.text();
  assert.match(html, /未同定/);
  assert.doesNotMatch(html, />unidentified</i);
});

test("search rows without a photo show a pin mark instead of an empty tile", async () => {
  const { renderSearchRow } = await import("./zukanSearchUi");
  assert.match(renderSearchRow({ href: "/ja/places/p1", title: "常磐公園" }), /data-zs-nothumb/);
  assert.doesNotMatch(renderSearchRow({ href: "/ja/places/p1", title: "常磐公園", thumbUrl: "/thumb/400/a1" }), /data-zs-nothumb/);
});
