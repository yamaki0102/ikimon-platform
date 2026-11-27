import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import worker from "./index";
import { SESSION_COOKIE_NAME } from "./core/shared";
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

test("GET /api/v1/waitlist/status rejects unauthenticated/banned requests with 401 and blocks non-admin lookups with 403", async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE users (user_id TEXT PRIMARY KEY, email TEXT, display_name TEXT);
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role_name TEXT NOT NULL,
      rank_label TEXT,
      banned INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE TABLE zukan_waitlist (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, locale TEXT NOT NULL, source_path TEXT NOT NULL, created_at INTEGER NOT NULL);
  `);
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const memberToken = "member-secret-token";
  const adminToken = "admin-secret-token";
  const bannedAdminToken = "banned-admin-token";
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, display_name, role_name, banned, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    sha(memberToken), "u-member", "一般", "member", 0, expiresAt
  );
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, display_name, role_name, banned, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    sha(adminToken), "u-admin", "管理", "admin", 0, expiresAt
  );
  sqlite.prepare("INSERT INTO auth_sessions (token_hash, user_id, display_name, role_name, banned, expires_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    sha(bannedAdminToken), "u-banned", "停止管理", "admin", 1, expiresAt
  );
  sqlite.prepare("INSERT INTO zukan_waitlist (id, email, locale, source_path, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "wl_1",
    "waiting@example.com",
    "ja",
    "/ja/waitlist",
    1700000000000,
  );
  const env = { CORE_DB: sqliteD1(sqlite), ENVIRONMENT: "staging" } as unknown as Env;

  // 1) Unauthenticated -> 401 regardless of whether email exists or not (no enumeration)
  for (const email of ["waiting@example.com", "unknown@example.com", ""]) {
    const res = await worker.fetch(new Request(`https://zukan.earth/api/v1/waitlist/status?email=${encodeURIComponent(email)}`), env);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { ok: boolean; error: string; registered?: unknown; status?: unknown };
    assert.equal(body.ok, false);
    assert.equal(body.registered, undefined);
    assert.equal(body.status, undefined);
  }

  // 2) Logged-in non-admin member (even querying own email) -> 403
  const otherRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/waitlist/status?email=waiting%40example.com", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    }),
    env,
  );
  assert.equal(otherRes.status, 403);

  const selfRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/waitlist/status?email=self%40example.com", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    }),
    env,
  );
  assert.equal(selfRes.status, 403);

  // 3) Banned admin -> 401
  const bannedRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/waitlist/status?email=waiting%40example.com", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${bannedAdminToken}` },
    }),
    env,
  );
  assert.equal(bannedRes.status, 401);

  // 4) Admin -> 200
  const adminRes = await worker.fetch(
    new Request("https://zukan.earth/api/v1/waitlist/status?email=waiting%40example.com", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminToken}` },
    }),
    env,
  );
  assert.equal(adminRes.status, 200);
  assert.equal(((await adminRes.json()) as { status: string }).status, "waiting");
});
