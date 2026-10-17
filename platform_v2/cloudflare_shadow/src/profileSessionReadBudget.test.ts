import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import test from "node:test";
import worker from "./index";

// Same real SQLite auth_sessions/cookie fixture used by quietHome.test.ts.
// Count executed DB methods, rather than counting prepare() or source matches.
function fixture(headerActions = true) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT,display_name TEXT,role_name TEXT,rank_label TEXT,banned INTEGER,expires_at TEXT,last_used_at TEXT)");
  for (const [user, banned, expires] of [
    ["one", 0, "2099-01-01T00:00:00.000Z"],
    ["two", 0, "2099-01-01T00:00:00.000Z"],
    ["banned", 1, "2099-01-01T00:00:00.000Z"],
    ["expired", 0, "2000-01-01T00:00:00.000Z"],
  ] as const) {
    sqlite.prepare("INSERT INTO auth_sessions VALUES(?,?,?,?,?,?,?,NULL)").run(
      createHash("sha256").update(`fixture-token-${user}`).digest("hex"), user,
      `Fixture ${user}`, "Observer", null, banned, expires,
    );
  }
  const calls: Array<{ sql: string; method: string }> = [];
  const db = {
    prepare(sql: string) {
      const statement = (values: SQLInputValue[] = []) => ({
        bind: (...next: SQLInputValue[]) => statement(next),
        async first() { calls.push({ sql, method: "first" }); return sqlite.prepare(sql).get(...values) ?? null; },
        async all() { calls.push({ sql, method: "all" }); return { results: sqlite.prepare(sql).all(...values) }; },
        async run() { calls.push({ sql, method: "run" }); const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      });
      return statement();
    },
  };
  const shell = `<!doctype html><html><head><title>Profile fixture</title></head><body><header class="site-header"><div${headerActions ? ' class="site-header-actions"' : ""}></div></header><main><h1>Guest fixture</h1></main></body></html>`;
  const env = {
    ENVIRONMENT: "production",
    CORE_DB: db,
    OBS_DB: { prepare() { throw new Error("profile fixture must not read private records or entities"); } },
    ASSET_BUCKET: {
      async get(key: string) {
        if (!/^original-ui\/html\/(?:ja|en|es|pt-br)\/(?:profile(?:\/settings)?|record|about)\.html$/u.test(key)) return null;
        return { body: new Response(shell).body, httpMetadata: { contentType: "text/html; charset=utf-8" } };
      },
    },
  };
  const request = (path: string, user: string, method = "GET") => new Request(`https://zukan.earth${path}`, {
    method, headers: user === "guest" ? {} : { cookie: `ikimon_v2_session=fixture-token-${user}` },
  });
  return {
    sqlite, calls, request,
    fetch: (input: Request) => worker.fetch(input, env as never),
    budget: () => ({
      reads: calls.filter((call) => /FROM auth_sessions/u.test(call.sql)).length,
      touches: calls.filter((call) => /UPDATE auth_sessions/u.test(call.sql)).length,
      total: calls.length,
    }),
  };
}

test("profile and settings resolve each account once and touch once in all four languages", async () => {
  const value = fixture();
  try {
    for (const lang of ["ja", "en", "es", "pt-br"]) for (const page of ["profile", "profile/settings"]) for (const user of ["one", "two"]) for (const method of ["GET", "HEAD"]) {
      value.calls.length = 0;
      const response = await value.fetch(value.request(`/${lang}/${page}`, user, method));
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("x-ikimon-cloudflare-native"), "profile-session");
      assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
      assert.match(response.headers.get("vary") ?? "", /cookie, authorization/u);
      assert.deepEqual(value.budget(), { reads: 1, touches: 1, total: 2 }, `${lang}/${page}/${user}/${method}`);
      if (method === "HEAD") assert.equal(body, "");
      else {
        assert.match(body, /data-cloudflare-profile="signed-in"/u);
        if (page === "profile") assert.ok(body.includes(`Fixture ${user}`));
        assert.ok(!body.includes(`Fixture ${user === "one" ? "two" : "one"}`));
      }
    }
  } finally { value.sqlite.close(); }
});

test("resolved null, banned and missing-cookie results keep the guest boundary without a second lookup", async () => {
  const value = fixture();
  try {
    for (const page of ["profile", "profile/settings"]) for (const user of ["expired", "unknown", "banned", "guest"]) for (const method of ["GET", "HEAD"]) {
      value.calls.length = 0;
      const response = await value.fetch(value.request(`/ja/${page}`, user, method));
      const body = await response.text();
      assert.equal(response.status, 200);
      assert.notEqual(response.headers.get("x-ikimon-cloudflare-native"), "profile-session");
      assert.match(response.headers.get("cache-control") ?? "", /no-store/u);
      assert.doesNotMatch(body, /Fixture one|Fixture two|Fixture banned|data-cloudflare-profile="signed-in"/u);
      assert.deepEqual(value.budget(), {
        reads: user === "guest" ? 0 : 1,
        touches: user === "banned" ? 1 : 0,
        total: user === "guest" ? 0 : user === "banned" ? 2 : 1,
      }, `${page}/${user}/${method}`);
      if (method === "HEAD") assert.equal(body, "");
      else assert.match(body, /Guest fixture/u);
    }
  } finally { value.sqlite.close(); }
});

test("session reuse stays inside one invocation and cannot carry identity across concurrent or later requests", async () => {
  const value = fixture();
  try {
    const sameRequest = value.request("/ja/profile", "one");
    const responses = await Promise.all([value.fetch(sameRequest), value.fetch(value.request("/ja/profile", "two"))]);
    const bodies = await Promise.all(responses.map((response) => response.text()));
    assert.match(bodies[0]!, /Fixture one/u);
    assert.doesNotMatch(bodies[0]!, /Fixture two/u);
    assert.match(bodies[1]!, /Fixture two/u);
    assert.doesNotMatch(bodies[1]!, /Fixture one/u);
    assert.deepEqual(value.budget(), { reads: 2, touches: 2, total: 4 });
    value.sqlite.prepare("UPDATE auth_sessions SET banned = 1 WHERE user_id = 'one'").run();
    value.calls.length = 0;
    // Even reusing the Request object in a separate fetch invocation must see
    // current auth truth. No module-level or Request-keyed cache is permitted.
    const revoked = await value.fetch(sameRequest);
    assert.match(await revoked.text(), /Guest fixture/u);
    assert.deepEqual(value.budget(), { reads: 1, touches: 1, total: 2 });
    sameRequest.headers.set("cookie", "ikimon_v2_session=fixture-token-two");
    value.calls.length = 0;
    const switched = await value.fetch(sameRequest);
    const switchedBody = await switched.text();
    assert.match(switchedBody, /Fixture two/u);
    assert.doesNotMatch(switchedBody, /Fixture one/u);
    assert.deepEqual(value.budget(), { reads: 1, touches: 1, total: 2 });
    value.sqlite.prepare("DELETE FROM auth_sessions WHERE user_id = 'two'").run();
    value.calls.length = 0;
    const loggedOut = await value.fetch(value.request("/ja/profile", "two"));
    assert.match(await loggedOut.text(), /Guest fixture/u);
    assert.deepEqual(value.budget(), { reads: 1, touches: 0, total: 1 });
  } finally { value.sqlite.close(); }
});

test("unresolved callers and the existing header-session gate retain their original read behavior", async () => {
  for (const headerActions of [false, true]) {
    const value = fixture(headerActions);
    try {
      for (const [page, user, reads, touches] of [
        ["about", "one", headerActions ? 1 : 0, headerActions ? 1 : 0],
        ["record", "one", 1, 1],
        ["record", "expired", headerActions ? 2 : 1, 0],
        ["record", "banned", headerActions ? 2 : 1, headerActions ? 2 : 1],
        ["profile", "one", 1, 1],
      ] as const) {
        value.calls.length = 0;
        const response = await value.fetch(value.request(`/ja/${page}`, user));
        assert.equal(response.status, 200);
        assert.deepEqual(value.budget(), { reads, touches, total: reads + touches }, `${headerActions}/${page}/${user}`);
      }
    } finally { value.sqlite.close(); }
  }
});
