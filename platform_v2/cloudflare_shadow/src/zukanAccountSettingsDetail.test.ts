import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { Env } from "./core/env";
import { handleAccountSettingsDetailRoute, handleSaveAccountSettingsDetail } from "./zukanAccountSettingsDetail";

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
        async run() {
          sqlite.prepare(query).run(...(values as never[]));
          return { success: true };
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
    CREATE TABLE user_account_settings (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      notify_comments INTEGER NOT NULL DEFAULT 1,
      notify_events INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);
  return sqliteObsDb(sqlite);
}

test("POST /api/v1/profile/settings-detail enforces 401 and persists for session userId only", async (t) => {
  const db = setupDb(t);

  const unauth = await handleSaveAccountSettingsDetail(
    new Request("https://ikimon.life/api/v1/profile/settings-detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "notifications", notifyComments: false }),
    }),
    null,
    db
  );
  assert.equal(unauth.status, 401);

  const okRes = await handleSaveAccountSettingsDetail(
    new Request("https://ikimon.life/api/v1/profile/settings-detail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: "notifications", userId: "spoofed", notifyComments: false, notifyEvents: true }),
    }),
    { userId: "user-1", displayName: "ユイ" },
    db
  );
  assert.equal(okRes.status, 200);
  const body = await okRes.json() as { ok: boolean; section: string };
  assert.equal(body.ok, true);
  assert.equal(body.section, "notifications");
});

test("I8-I9-I11 settings pages render edit, notifications, and account views in zukanShell", async (t) => {
  const db = setupDb(t);
  for (const section of ["edit", "notifications", "account"] as const) {
    const res = await handleAccountSettingsDetailRoute(
      section,
      "ja",
      { userId: "user-1", displayName: "ユイ" },
      db
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /class="zt-shell"/);
    assert.match(html, /data-profile-view="i8-i9-i11"/);
    assert.match(html, new RegExp(`data-settings-section="${section}"`));
  }
});
