import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleSearchExploreRoute, handleSearchSuggestApi } from "./zukanSearchPromptAndSuggest";

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
      canonical_name TEXT NOT NULL,
      public_profile_status TEXT NOT NULL DEFAULT 'published',
      superseded_by_place_id TEXT
    );
    CREATE TABLE observations (
      observation_id TEXT PRIMARY KEY,
      taxon_label TEXT,
      visibility TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, 'published')").run("p-1", "佐鳴湖公園");
  sqlite.prepare("INSERT INTO places (place_id, canonical_name, public_profile_status) VALUES (?, ?, 'draft')").run("p-priv", "佐鳴湖の秘密");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, visibility) VALUES (?, ?, 'public')").run("o-1", "カワセミ");
  sqlite.prepare("INSERT INTO observations (observation_id, taxon_label, visibility) VALUES (?, ?, 'private')").run("o-priv", "カワセミ秘密");
  return sqliteObsDb(sqlite);
}

test("GET /api/v1/search/suggest returns only public species/places matching query", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchSuggestApi(new URL("https://ikimon.life/api/v1/search/suggest?q=カワセミ"), db);
  assert.equal(res.status, 200);
  const body = await res.json() as { ok: boolean; suggestions: Array<{ label: string; kind: string }> };
  assert.equal(body.ok, true);
  assert.equal(body.suggestions.length, 1);
  assert.equal(body.suggestions[0]?.label, "カワセミ");
});

test("H1-H2 search explore page renders mic input, recent species, and suggestions in zukanShell", async (t) => {
  const db = setupDb(t);
  const res = await handleSearchExploreRoute(new URL("https://ikimon.life/ja/search/explore?q=佐鳴"), "ja", null, db);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-search-view="h1-h2"/);
  assert.match(html, /data-search-mic-btn="1"/);
  assert.match(html, /id="zukan-search-suggestions"/);
  assert.match(html, /<mark>佐鳴<\/mark>湖公園/);
});

test("test-data taxon names never appear as suggestion chips, real names do", async () => {
  const { isTestTaxonLabel } = await import("./zukanSearchPromptAndSuggest");
  for (const bad of ["fallback-free smoke plant", "native public cutover plant", "production synthetic plant", "unidentified", "PR973 prod rally"]) {
    assert.equal(isTestTaxonLabel(bad), true, bad);
  }
  for (const ok of ["モウソウチク", "カワセミ", "Kingfisher"]) {
    assert.equal(isTestTaxonLabel(ok), false, ok);
  }
});
