import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleEventAlbumOrShareRoute } from "./zukanEventAlbumAndShare";

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
      };
      return stmt as unknown as ReturnType<Env["OBS_DB"]["prepare"]>;
    },
  } as unknown as Env["OBS_DB"];
}

test("F9 album gallery and F10 share sheet render in zukanShell", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      started_at TEXT NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, started_at) VALUES (?, ?, ?)").run(
    "evt-1",
    "冬の湿地観察会",
    "2026-12-05T09:00:00Z"
  );
  const db = sqliteObsDb(sqlite);

  const missing = await handleEventAlbumOrShareRoute("missing", "gallery", "https://ikimon.life", "ja", null, db);
  assert.equal(missing.status, 404);

  const f9 = await handleEventAlbumOrShareRoute("evt-1", "gallery", "https://ikimon.life", "ja", null, db);
  assert.equal(f9.status, 200);
  const f9Html = await f9.text();
  assert.match(f9Html, /class="zt-shell"/);
  assert.match(f9Html, /data-event-view="f9"/);
  assert.match(f9Html, /冬の湿地観察会/);
  assert.match(f9Html, /href="\/ja\/events\/evt-1\/share"/);

  const f10 = await handleEventAlbumOrShareRoute("evt-1", "share", "https://ikimon.life", "ja", null, db);
  assert.equal(f10.status, 200);
  const f10Html = await f10.text();
  assert.match(f10Html, /data-event-view="f10"/);
  assert.match(f10Html, /data-event-share-sheet="1"/);
  assert.match(f10Html, /https:\/\/ikimon\.life\/ja\/events\/evt-1\/preview/);
});
