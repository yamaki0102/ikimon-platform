import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { worker } from "./index.js";

class SqlD1 {
  readonly sqlite = new DatabaseSync(":memory:");
  constructor(files: string[]) {
    for (const file of files) this.sqlite.exec(readFileSync(new URL(file, import.meta.url), "utf8"));
  }
  prepare(sql: string) {
    let values: (string | number | null)[] = [];
    const thisDb = this;
    return {
      bind(...bound: (string | number | null)[]) { values = bound; return this; },
      async first<T>() { return (thisDb.sqlite.prepare(sql).get(...values) as T | undefined) ?? null; },
      async all<T>() { return { results: thisDb.sqlite.prepare(sql).all(...values) as T[] }; },
      async run() { return { meta: { changes: Number(thisDb.sqlite.prepare(sql).run(...values).changes) } }; },
    };
  }
  async batch(statements: Array<{ run(): Promise<unknown> }>) { return Promise.all(statements.map((statement) => statement.run())); }
}

function coreDb() {
  return new SqlD1([
    "../migrations/core/0001_core.sql",
    "../migrations/core/0002_auth_session_contract.sql",
    "../migrations/core/0003_auth_user_accounts.sql",
    "../migrations/core/0024_durable_rate_limits.sql",
  ]);
}

function env(core: SqlD1, obs = new SqlD1([])) {
  return {
    CORE_DB: core,
    OBS_DB: obs,
    ASSET_BUCKET: { async put() { throw new Error("unexpected media write"); }, async get() { return null; }, async head() { return null; }, async delete() {} },
    MEDIA_QUEUE: { async send() {} },
    ENVIRONMENT: "shadow",
    PUBLIC_LOCATION_CELL_PRECISION: "geohash6",
  } as any;
}

test("Worker login enforces durable IP and IP+email limits", async () => {
  const core = coreDb();
  const runtime = env(core);
  const attempt = (ip: string, email: string) => worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://shadow.test", "cf-connecting-ip": ip },
    body: JSON.stringify({ email, password: "wrong" }),
  }), runtime);
  for (let i = 0; i < 8; i += 1) assert.equal((await attempt("203.0.113.9", "VICTIM@example.test")).status, 401);
  const limited = await attempt("203.0.113.9", "victim@example.test");
  assert.equal(limited.status, 429);
  assert.equal((await attempt("203.0.113.10", "victim@example.test")).status, 401);
});

test("Worker registration and record draft routes consume durable scoped counters", async () => {
  const core = coreDb();
  const runtime = env(core, new SqlD1([]));
  for (let i = 0; i < 5; i += 1) {
    const response = await worker.fetch(new Request("https://shadow.test/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shadow.test", "cf-connecting-ip": "203.0.113.11" },
      body: JSON.stringify({ displayName: "", email: "target@example.test", password: "short" }),
    }), runtime);
    assert.equal(response.status, 400);
  }
  const deniedRegistration = await worker.fetch(new Request("https://shadow.test/api/v1/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://shadow.test", "cf-connecting-ip": "203.0.113.11" },
    body: JSON.stringify({ displayName: "", email: "target@example.test", password: "short" }),
  }), runtime);
  assert.equal(deniedRegistration.status, 429);

  const obs = new SqlD1([]);
  obs.sqlite.exec(`CREATE TABLE draft_observations (
    draft_id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, observed_at TEXT,
    exact_lat REAL, exact_lng REAL, location_accuracy_m REAL, public_cell TEXT NOT NULL,
    visibility TEXT NOT NULL, partition_month TEXT
  ); CREATE TABLE asset_ledger (asset_id TEXT PRIMARY KEY, draft_id TEXT, owner_user_id TEXT, object_key TEXT,
    sha256 TEXT, mime TEXT, bytes INTEGER, width INTEGER, height INTEGER, duration_ms INTEGER, visibility TEXT, partition_month TEXT);`);
  const postRuntime = env(coreDb(), obs);
  const issued = await worker.fetch(new Request("https://shadow.test/api/v1/auth/session/issue", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: "post-user" }),
  }), postRuntime);
  assert.equal(issued.status, 200);
  const cookie = issued.headers.get("set-cookie")!.split(";", 1)[0]!;
  const draft = (ip: string) => worker.fetch(new Request("https://shadow.test/api/v0/draft-observations", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://shadow.test", cookie },
    body: JSON.stringify({ userId: "post-user" }),
  }), postRuntime);
  for (let i = 1; i <= 30; i += 1) assert.equal((await draft(`198.51.100.${i}`)).status, 200);
  assert.equal((await draft("198.51.100.31")).status, 429);
  assert.equal(Number(obs.sqlite.prepare("SELECT COUNT(*) AS count FROM draft_observations").get()?.count), 30);
});

test("Worker auth fails closed without the counter store or trusted edge identity", async () => {
  const core = coreDb();
  core.sqlite.exec("DROP TABLE durable_rate_limits");
  const unavailable = await worker.fetch(new Request("https://shadow.test/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.25" },
    body: JSON.stringify({ email: "user@example.test", password: "wrong" }),
  }), env(core));
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { ok: false, error: "rate_limit_unavailable" });

  const untrusted = await worker.fetch(new Request("https://zukan.earth/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.25" },
    body: JSON.stringify({ email: "user@example.test", password: "wrong" }),
  }), { ...env(coreDb()), ENVIRONMENT: "production" });
  assert.equal(untrusted.status, 503);
  assert.deepEqual(await untrusted.json(), { ok: false, error: "rate_limit_unavailable" });
});
