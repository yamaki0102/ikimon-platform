import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { getSessionByRawToken, getSessionFromCookie, readSessionTokenFromCookie } from "./authSession.js";

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("malformed percent encoding in an unrelated cookie does not break session token extraction", () => {
  assert.equal(readSessionTokenFromCookie("other=%E0%A4%A; ikimon_v2_session=valid-token"), "valid-token");
});

test("malformed session cookie is treated as absent", async () => {
  assert.equal(await getSessionFromCookie("ikimon_v2_session=%E0%A4%A"), null);
});

test("development dummy admin session is available only outside production", async () => {
  await withEnv({
    NODE_ENV: "development",
    ENABLE_DEV_DUMMY_ADMIN: "1",
    DEV_DUMMY_ADMIN_TOKEN: "local-test-token",
    DATABASE_URL: undefined,
  }, async () => {
    const session = await getSessionByRawToken("local-test-token");
    assert.equal(session?.userId, "dev-dummy-admin");
    assert.equal(session?.roleName, "Admin");
  });

  await withEnv({
    NODE_ENV: "production",
    ENABLE_DEV_DUMMY_ADMIN: "1",
    DEV_DUMMY_ADMIN_TOKEN: "local-test-token",
    DATABASE_URL: undefined,
  }, async () => {
    await assert.rejects(() => getSessionByRawToken("local-test-token"), /DATABASE_URL is required/);
  });
});

test("expired or missing database sessions are rejected by the session lookup", async () => {
  const originalQuery = pg.Pool.prototype.query;
  let receivedSql = "";
  pg.Pool.prototype.query = (async function (this: unknown, sql: string) {
    receivedSql = sql;
    return { rows: [], rowCount: 0 };
  }) as unknown as typeof pg.Pool.prototype.query;
  try {
    await withEnv({
      NODE_ENV: "test",
      ENABLE_DEV_DUMMY_ADMIN: "0",
      DEV_DUMMY_ADMIN_TOKEN: undefined,
      DATABASE_URL: "postgres://local-test:local-test@127.0.0.1:1/session-test",
    }, async () => {
      assert.equal(await getSessionByRawToken("expired-or-revoked-token"), null);
    });
  } finally {
    pg.Pool.prototype.query = originalQuery;
  }
  assert.match(receivedSql, /rt\.expires_at\s*>\s*now\(\)/i);
});
