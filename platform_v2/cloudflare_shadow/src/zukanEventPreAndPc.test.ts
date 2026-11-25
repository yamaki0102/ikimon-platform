import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleEventPreAndPcRoute } from "./zukanEventPreAndPc";

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

test("F1-F2 event pre-start and PC 2-column layout renders in zukanShell with confirm CTA", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE observation_event_sessions (
      session_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      organizer_user_id TEXT NOT NULL,
      place_id TEXT,
      started_at TEXT NOT NULL
    );
  `);
  sqlite.prepare("INSERT INTO observation_event_sessions (session_id, title, organizer_user_id, place_id, started_at) VALUES (?, ?, ?, ?, ?)").run(
    "evt-1",
    "春の干潟観察会",
    "org-1",
    "place-sanaru",
    "2026-12-01T09:00:00Z"
  );

  const db = sqliteObsDb(sqlite);
  const missing = await handleEventPreAndPcRoute("missing", "ja", null, db);
  assert.equal(missing.status, 404);

  const res = await handleEventPreAndPcRoute("evt-1", "ja", null, db);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /class="zt-shell"/);
  assert.match(html, /data-event-view="f1-f2"/);
  assert.match(html, /春の干潟観察会/);
  assert.match(html, /href="\/ja\/events\/evt-1\/confirm"/);
  assert.match(html, /href="\/ja\/places\/place-sanaru"/);
});
