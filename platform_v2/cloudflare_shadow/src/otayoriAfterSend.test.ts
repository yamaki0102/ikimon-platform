import assert from "node:assert/strict";
import test from "node:test";
import { worker } from "./index";

test("otayori form post redirects with sent flag, JSON post keeps JSON, page shows thanks inside shell", async (t) => {
  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec("CREATE TABLE users (user_id TEXT PRIMARY KEY)");
  sqlite.exec("CREATE TABLE auth_sessions (token_hash TEXT, user_id TEXT, display_name TEXT, role_name TEXT, rank_label TEXT, banned INTEGER, expires_at TEXT, ip_address TEXT, user_agent TEXT, last_used_at TEXT)");
  const core = {
    async batch(stmts: Array<{ run(): Promise<unknown> }>) { return Promise.all(stmts.map((s) => s.run())); },
    prepare(query: string) {
      let values: unknown[] = [];
      const isOtayori = /\b(zukan_otayori_letters|auth_sessions|users)\b/u.test(query);
      const stmt = {
        bind(...input: unknown[]) { values = input; return stmt; },
        async run() {
          if (!isOtayori) return { meta: { changes: 0 } };
          if (query.trim().startsWith("CREATE TABLE")) { sqlite.exec(query); return { meta: { changes: 0 } }; }
          return { meta: { changes: Number(sqlite.prepare(query).run(...values as never[]).changes) } };
        },
        async first<T>() { return isOtayori ? ((sqlite.prepare(query).get(...values as never[]) as T | undefined) ?? null) : null; },
        async all<T>() { return { results: isOtayori ? (sqlite.prepare(query).all(...values as never[]) as T[]) : [] }; },
      };
      return stmt;
    },
  };
  const env = { CORE_DB: core, OBS_DB: core, ENVIRONMENT: "shadow", INTERNAL_AUTH_TOKEN: "t" } as never;

  const issue = await worker.fetch(new Request("https://ikimon.life/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ikimon.life" },
    body: JSON.stringify({ userId: "otayori-after-send", displayName: "送信者", ttlHours: 1 }),
  }), env);
  const cookie = issue.headers.get("set-cookie") ?? "";
  assert.ok(cookie);

  const formRes = await worker.fetch(new Request("https://ikimon.life/api/v1/otayori", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://ikimon.life", cookie },
    body: new URLSearchParams({ body: "ご要望です", pagePath: "/ja/" }).toString(),
  }), env);
  assert.equal(formRes.status, 303);
  assert.equal(formRes.headers.get("location"), "/ja/otayori?sent=1");

  const emptyRes = await worker.fetch(new Request("https://ikimon.life/api/v1/otayori", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://ikimon.life", cookie },
    body: new URLSearchParams({ body: "  ", pagePath: "/ja/" }).toString(),
  }), env);
  assert.equal(emptyRes.status, 303);
  assert.equal(emptyRes.headers.get("location"), "/ja/otayori?error=empty");

  const jsonRes = await worker.fetch(new Request("https://ikimon.life/api/v1/otayori", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://ikimon.life", cookie },
    body: JSON.stringify({ body: "JSONの要望" }),
  }), env);
  assert.equal(jsonRes.status, 201);
  assert.equal((await jsonRes.json() as { ok: boolean }).ok, true);

  const anonForm = await worker.fetch(new Request("https://ikimon.life/api/v1/otayori", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://ikimon.life" },
    body: "body=x",
  }), env);
  assert.equal(anonForm.status, 303);
  assert.equal(anonForm.headers.get("location"), "/ja/login?redirect=%2Fja%2Fotayori");

  const page = await worker.fetch(new Request("https://ikimon.life/ja/otayori?sent=1", { headers: { cookie } }), env);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /ご要望を受け取りました。お返事があるときだけお知らせします。/u);
  assert.match(html, /zt-shell/u);
  assert.match(html, /zt-bottom-nav/u);
});
