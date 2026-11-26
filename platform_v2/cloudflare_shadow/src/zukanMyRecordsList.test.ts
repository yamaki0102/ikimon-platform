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
      taxon_label TEXT,
      observed_at TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'private'
    );
  `);
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, ?, 'public')").run("obs-u1-pub", "user-1", "カワセミ", "2026-06-01T09:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, ?, 'private')").run("obs-u1-priv", "user-1", "アオサギ", "2026-06-02T09:00:00Z");
  sqlite.prepare("INSERT INTO observations (observation_id, owner_user_id, taxon_label, observed_at, visibility) VALUES (?, ?, ?, ?, 'private')").run("obs-u2-priv", "user-2", "他人の秘密", "2026-06-03T09:00:00Z");
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

function seedLegacy(t: test.TestContext, count: number) {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observations (observation_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, taxon_label TEXT, observed_at TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private');
    CREATE TABLE production_import_occurrences (occurrence_id TEXT PRIMARY KEY, visit_id TEXT, scientific_name TEXT, vernacular_name TEXT, taxon_rank TEXT, confidence_score REAL, quality_grade TEXT, created_at TEXT, updated_at TEXT);
  `);
  const insert = sqlite.prepare("INSERT INTO observations VALUES (?, 'user-1', 'unidentified', ?, ?)");
  for (let i = 0; i < count; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 3600_000).toISOString();
    insert.run(`legacy-${String(i).padStart(4, "0")}`, day, i % 2 ? "public" : "private");
  }
  sqlite.exec(`
    INSERT INTO production_import_occurrences VALUES
      ('occ:legacy-0000:0','legacy-0000',NULL,NULL,NULL,NULL,NULL,'2020-01-01',NULL),
      ('occ:legacy-0000:1','legacy-0000','Parus minor','シジュウカラ','species',0.5,'research','2020-01-02',NULL);
  `);
  return sqlite;
}

test("legacy records show import names, never raw 'unidentified', and all rows are reachable by cursor", async (t) => {
  const sqlite = seedLegacy(t, 250);
  const db = sqliteObsDb(sqlite);
  const session = { userId: "user-1", displayName: "ユイ" };
  const seen = new Set<string>();
  let before: string | null = null;
  let pages = 0;
  let lastHtml = "";
  for (;;) {
    const url = new URL(`https://ikimon.life/ja/profile/records${before ? `?before=${encodeURIComponent(before)}` : ""}`);
    const html = await (await handleMyRecordsRoute(url, "ja", session, db)).text();
    pages += 1;
    lastHtml = html;
    assert.doesNotMatch(html, /unidentified/i);
    assert.match(html, /250件あります/);
    for (const m of html.matchAll(/href="\/ja\/observations\/(legacy-\d+)"/g)) seen.add(m[1]!);
    const next = html.match(/data-my-records-older="1"[^>]*href="([^"]+)"/);
    if (!next) break;
    assert.match(html, /もっと古い記録/);
    before = decodeURIComponent(new URL(next[1]!.replace(/&amp;/g, "&"), "https://ikimon.life").searchParams.get("before")!);
    assert.ok(pages < 10);
  }
  assert.equal(pages, 3);
  assert.equal(seen.size, 250);
  assert.doesNotMatch(lastHtml, /もっと古い記録/);
  const first = await (await handleMyRecordsRoute(new URL("https://ikimon.life/ja/profile/records"), "ja", session, db)).text();
  assert.equal((first.match(/class="zt-sp-row"/g) ?? []).length, 100);
  assert.match(first, /rel="next"/);
  const oldest = await (await handleMyRecordsRoute(new URL(`https://ikimon.life/ja/profile/records?before=${encodeURIComponent("2026-01-01T02:00:00.000Z|legacy-0002")}`), "ja", session, db)).text();
  assert.match(oldest, /シジュウカラ/);
  assert.doesNotMatch(oldest, /もっと古い記録/);
  assert.match(first, /名前なしの記録/);
});

test("visibility filter and cursor combine and the API returns nextCursor", async (t) => {
  const sqlite = seedLegacy(t, 130);
  const db = sqliteObsDb(sqlite);
  const res = await handleMyRecordsApi(new URL("https://ikimon.life/api/v1/profile/my-records?visibility=public"), { userId: "user-1" }, db);
  const body = (await res.json()) as { records: Array<{ visibility: string; taxonDisplayName: string }>; nextCursor: string | null };
  assert.equal(body.records.length, 65);
  assert.equal(body.nextCursor, null);
  assert.ok(body.records.every((r) => r.visibility === "public" && r.taxonDisplayName !== "unidentified"));
  const all = await (await handleMyRecordsApi(new URL("https://ikimon.life/api/v1/profile/my-records"), { userId: "user-1" }, db)).json() as { records: unknown[]; nextCursor: string | null };
  assert.equal(all.records.length, 100);
  assert.ok(all.nextCursor);
});
