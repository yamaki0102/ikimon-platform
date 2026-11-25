import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import type { Env } from "./core/env";
import { checkFieldNameAvailability, getWaitlistStatusForEmail, renderZukanEntryScreen } from "./zukanEntryScreens";

function sqliteD1(sqlite: DatabaseSync): Env["CORE_DB"] {
  return {
    prepare(query: string) {
      let values: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          values = args;
          return stmt;
        },
        async run() {
          if (query.trim().startsWith("CREATE TABLE")) {
            sqlite.exec(query);
            return { meta: { changes: 0 } };
          }
          return { meta: { changes: Number(sqlite.prepare(query).run(...(values as never[])).changes) } };
        },
        async first<T>() {
          return (sqlite.prepare(query).get(...(values as never[])) as T | undefined) ?? null;
        },
      };
      return stmt as unknown as ReturnType<Env["CORE_DB"]["prepare"]>;
    },
  } as unknown as Env["CORE_DB"];
}

test("entry screens render login, field-name register without real-name input, and waitlist", () => {
  const login = renderZukanEntryScreen({ mode: "login", lang: "ja" });
  const register = renderZukanEntryScreen({ mode: "register", lang: "ja" });
  const waitlist = renderZukanEntryScreen({ mode: "waitlist", lang: "ja" });

  assert.match(login, /data-entry-login-form/);
  assert.match(register, /data-entry-register-form/);
  assert.match(register, /name="fieldName"/);
  assert.doesNotMatch(register, /本名|fullName|realName/i);
  assert.match(waitlist, /data-entry-waitlist-form/);
});

test("field name duplicate check and waitlist status retrieval enforce validation and lookup", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE users (user_id TEXT PRIMARY KEY, display_name TEXT)");
  sqlite.prepare("INSERT INTO users (user_id, display_name) VALUES (?, ?)").run("u-1", "アオサギ太郎");
  const db = sqliteD1(sqlite);

  const invalid = await checkFieldNameAvailability(db, "   ");
  assert.equal(invalid.ok, false);

  const taken = await checkFieldNameAvailability(db, " アオサギ太郎 ");
  assert.deepEqual(taken, { ok: true, available: false, normalizedName: "アオサギ太郎" });

  const free = await checkFieldNameAvailability(db, "カワセミ花子");
  assert.deepEqual(free, { ok: true, available: true, normalizedName: "カワセミ花子" });

  const badEmail = await getWaitlistStatusForEmail(db, "not-an-email");
  assert.equal(badEmail.ok, false);

  const missing = await getWaitlistStatusForEmail(db, "new@example.com");
  assert.deepEqual(missing, { ok: true, registered: false, status: "not_registered", registeredAt: null });

  sqlite.prepare("INSERT INTO zukan_waitlist (id, email, locale, source_path, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "wl_1",
    "waiting@example.com",
    "ja",
    "/ja/waitlist",
    1700000000000
  );
  const waiting = await getWaitlistStatusForEmail(db, "waiting@example.com");
  assert.deepEqual(waiting, { ok: true, registered: true, status: "waiting", registeredAt: 1700000000000 });
});
