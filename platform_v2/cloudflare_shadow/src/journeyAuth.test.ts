import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createHmac, randomBytes, createHash } from "node:crypto";
import { hashSync } from "bcryptjs";
import { worker } from "./index";
import { handleJourneySession, journeyReadOnlyGuard, JOURNEY_EMAIL, JOURNEY_IDENTITY, JOURNEY_PATH, JOURNEY_USER_ID, type JourneyDatabase } from "./journeyAuth";

const secret = randomBytes(32).toString("base64url");
type WorkerEnv = Parameters<typeof worker.fetch>[1];
function database(migration = true) {
  const sqlite = new DatabaseSync(":memory:");
  for (const name of ["0001_core.sql", "0002_auth_session_contract.sql", "0003_auth_user_accounts.sql"])
    sqlite.exec(readFileSync(new URL(`../migrations/core/${name}`, import.meta.url), "utf8"));
  if (migration) sqlite.exec(readFileSync(new URL("../migrations/core/0020_journey_sessions.sql", import.meta.url), "utf8"));
  const prepare = (sql: string) => {
    let values: (string | number | null)[] = [];
    const statement = {
      bind(...args: (string | number | null)[]) { values = args; return statement; },
      async first<T>() { return (sqlite.prepare(sql).get(...values) ?? null) as T | null; },
      async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
      execute() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      async run() { return statement.execute(); },
    };
    return statement;
  };
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.execute()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  } };
  const env = { CORE_DB: db, ENVIRONMENT: "production", JOURNEY_SESSION_HMAC_SECRET: secret } as unknown as WorkerEnv;
  return { sqlite, db: db as JourneyDatabase, env };
}

function signed(options: { timestamp?: string; nonce?: string; identity?: string; workId?: string; signature?: string; key?: string; method?: string; query?: string; body?: string | ReadableStream<Uint8Array> } = {}) {
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const nonce = options.nonce ?? randomBytes(18).toString("base64url");
  const identity = options.identity ?? JOURNEY_IDENTITY;
  const workId = options.workId ?? "ZUKAN-AUTH-QA";
  const signature = options.signature ?? createHmac("sha256", Buffer.from(options.key ?? secret, "base64url"))
    .update(`POST\n${JOURNEY_PATH}\n${timestamp}\n${nonce}\n${identity}\n${workId}`).digest("base64url");
  return new Request(`https://zukan.earth${JOURNEY_PATH}${options.query ?? ""}`, {
    method: options.method ?? "POST",
    headers: { "X-Zukan-Journey-Timestamp": timestamp, "X-Zukan-Journey-Nonce": nonce,
      "X-Zukan-Journey-Identity": identity, "X-Zukan-Journey-Work-Id": workId, "X-Zukan-Journey-Signature": signature },
    ...(options.body === undefined ? {} : { body: options.body }),
    ...(options.body instanceof ReadableStream ? { duplex: "half" } : {}),
  });
}
function privacy(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
}
function audits(sqlite: DatabaseSync) {
  return sqlite.prepare("SELECT target_id, payload_json FROM operation_audit WHERE operation_type = 'journey.session'").all();
}

test("Worker mint reuses real session hashing/cookie attributes, 600s TTL and one dedicated principal", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const before = Date.now();
  const response = await worker.fetch(signed(), env);
  assert.equal(response.status, 200); privacy(response);
  assert.deepEqual(await response.json(), { identity: JOURNEY_IDENTITY, expires_in: 600, schema: "zukan.journey-session/v1" });
  const cookie = response.headers.get("set-cookie")!;
  for (const attribute of ["Path=/", "HttpOnly", "SameSite=Lax", "Secure", "Max-Age=600", "Expires="]) assert.ok(cookie.includes(attribute), attribute);
  assert.deepEqual(cookie.match(/\bMax-Age=[^;]+/g), ["Max-Age=600"]);
  const token = decodeURIComponent(cookie.split(";", 1)[0]!.split("=")[1]!);
  const session = sqlite.prepare("SELECT * FROM auth_sessions").get()!;
  assert.equal(session.token_hash, createHash("sha256").update(token).digest("hex"));
  assert.equal(session.user_id, JOURNEY_USER_ID);
  assert.ok(Date.parse(String(session.expires_at)) >= before + 600_000);
  assert.ok(Date.parse(String(session.expires_at)) <= Date.now() + 600_000);
  const user = sqlite.prepare("SELECT * FROM auth_users").get()!;
  assert.equal(user.email, JOURNEY_EMAIL); assert.equal(user.password_hash, null);
  assert.equal(user.role_name, "Observer"); assert.equal(user.banned, 0); assert.equal(user.display_name, "Journey Synthetic");
  assert.equal((await worker.fetch(signed(), env)).status, 200);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM users").get()!.n, 1);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_users").get()!.n, 1);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM oauth_accounts").get()!.n, 0);
  const audit = audits(sqlite)[0]!;
  assert.match(String(audit.target_id), /^[a-f0-9]{64}$/);
  assert.equal(JSON.parse(String(audit.payload_json)).outcome, "accepted");
  assert.ok(!JSON.stringify(audits(sqlite)).includes(token));
  assert.ok(!JSON.stringify(audits(sqlite)).includes(secret));
});

for (const [name, options, error] of [
  ["wrong signature", { signature: "A".repeat(43) }, "journey_signature_invalid"],
  ["wrong key", { key: randomBytes(32).toString("base64url") }, "journey_signature_invalid"],
  ["padded signature", { signature: "A".repeat(43) + "=" }, "journey_signature_invalid"],
  ["old timestamp", { timestamp: String(Math.floor(Date.now() / 1000) - 301) }, "journey_timestamp_invalid"],
  ["future timestamp", { timestamp: String(Math.floor(Date.now() / 1000) + 302) }, "journey_timestamp_invalid"],
  ["noninteger timestamp", { timestamp: "1.5" }, "journey_timestamp_invalid"],
  ["owner identity", { identity: "owner" }, "journey_identity_invalid"],
  ["short nonce", { nonce: "short" }, "journey_headers_invalid"],
  ["wrong Work prefix", { workId: "NOCOSIL-AUTH-QA" }, "journey_headers_invalid"],
] as const) test(`mint denies ${name} and audits without creating a principal/session`, async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const response = await worker.fetch(signed(options), env);
  assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error }); privacy(response);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get()!.n, 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_users").get()!.n, 0);
  assert.equal(JSON.parse(String(audits(sqlite)[0]!.payload_json)).outcome, "denied");
});

test("disabled for missing, malformed or noncanonical secret, with audited 404", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  for (const key of [undefined, "", "bad", "A".repeat(42) + "B"]) {
    env.JOURNEY_SESSION_HMAC_SECRET = key;
    const response = await worker.fetch(signed(), env);
    assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: "disabled" }); privacy(response);
  }
  assert.equal(audits(sqlite).length, 4);
});

test("nonempty body, query and other methods are rejected", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  for (const options of [{ query: "?ignored=1" }, { query: "?" }, { body: "{}" }, { method: "GET" }, { method: "HEAD" }]) {
    assert.equal((await worker.fetch(signed(options), env)).status, 400);
  }
});

test("nonce replay is 409 and concurrent sliding-minute quota admits exactly 30", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const request = signed();
  assert.equal((await worker.fetch(request.clone(), env)).status, 200);
  assert.equal((await worker.fetch(request.clone(), env)).status, 409);
  // Use the real SQL claim concurrently; the deterministic issuer avoids an unrelated SQLite batch overlap.
  const responses = await Promise.all(Array.from({ length: 30 }, () => handleJourneySession(signed(), env, async () => ({ cookie: "test" }))));
  assert.equal(responses.filter(r => r?.status === 200).length, 29);
  assert.equal(responses.filter(r => r?.status === 429).length, 1);
  assert.equal((await worker.fetch(request.clone(), env)).status, 409);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM journey_session_nonces").get()!.n, 30);
});

test("nonce retention outlasts the future-dated signature window and expired rate slots are reclaimed", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare("INSERT INTO journey_session_nonces VALUES (?, ?)").run("obsolete", now - 602);
  sqlite.prepare("INSERT INTO journey_session_nonces VALUES (?, ?)").run("still-replay-protected", now - 600);
  assert.equal((await worker.fetch(signed({ timestamp: String(now + 300) }), env)).status, 200);
  assert.equal(sqlite.prepare("SELECT nonce_hash FROM journey_session_nonces WHERE nonce_hash='obsolete'").get(), undefined);
  assert.ok(sqlite.prepare("SELECT nonce_hash FROM journey_session_nonces WHERE nonce_hash='still-replay-protected'").get());
});

test("synthetic guard fences every write verb and exempts only exact POST logout; normal sessions unaffected", () => {
  const synthetic = { userId: JOURNEY_USER_ID };
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const request = new Request("https://zukan.earth/api/v1/auth/session/issue", { method });
    assert.equal(journeyReadOnlyGuard(request, synthetic)?.status, 403);
    assert.equal(journeyReadOnlyGuard(request, { userId: "ordinary-user" }), null);
    assert.equal(journeyReadOnlyGuard(request, null), null);
  }
  for (const method of ["GET", "HEAD"]) assert.equal(journeyReadOnlyGuard(new Request("https://zukan.earth/", { method }), synthetic), null);
  assert.equal(journeyReadOnlyGuard(new Request("https://zukan.earth/api/v1/auth/session/logout", { method: "POST" }), synthetic), null);
  assert.equal(journeyReadOnlyGuard(new Request("https://zukan.earth/api/v1/auth/session/logout/", { method: "POST" }), synthetic)?.status, 403);
});

test("real-cookie Worker guard precedes write routing and logout retains privacy headers", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const mint = await worker.fetch(signed(), env);
  const cookie = mint.headers.get("set-cookie")!.split(";", 1)[0]!;
  for (const path of ["/api/v1/auth/session/issue", "/internal/anything", "/ja/api/v1/me/saved"]) {
    const response = await worker.fetch(new Request(`https://zukan.earth${path}`, { method: "POST", headers: { cookie } }), env);
    assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: "journey_read_only" }); privacy(response);
  }
  for (const method of ["GET", "HEAD"]) {
    const response = await worker.fetch(new Request("https://zukan.earth/healthz", { method, headers: { cookie } }), env);
    assert.equal(response.status, 200);
    assert.notEqual(response.headers.get("cache-control"), "private, no-store");
  }
  const missing = await worker.fetch(new Request("https://zukan.earth/api/nonexistent", { headers: { cookie } }), env);
  assert.equal(missing.status, 404);
  const logout = await worker.fetch(new Request("https://zukan.earth/api/v1/auth/session/logout", {
    method: "POST", headers: { cookie, origin: "https://zukan.earth" },
  }), env);
  assert.equal(logout.status, 200); privacy(logout);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get()!.n, 0);
});

test("expired synthetic cookie never authenticates; ordinary cookie retains existing route behavior", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const mint = await worker.fetch(signed(), env);
  const cookie = mint.headers.get("set-cookie")!.split(";", 1)[0]!;
  sqlite.exec("UPDATE auth_sessions SET expires_at='2000-01-01T00:00:00.000Z'");
  const expired = await worker.fetch(new Request("https://zukan.earth/health", { headers: { cookie } }), env);
  assert.equal(expired.status, 200); assert.notEqual(expired.headers.get("cache-control"), "private, no-store");
  sqlite.exec("UPDATE auth_sessions SET user_id='ordinary-user', expires_at='2099-01-01T00:00:00.000Z'");
  const normal = await worker.fetch(new Request("https://zukan.earth/api/v1/auth/session/logout", { method: "POST", headers: { cookie, origin: "https://zukan.earth" } }), env);
  assert.equal(normal.status, 200); assert.notEqual(normal.headers.get("cache-control"), "private, no-store");
});

test("real SQL blocks OAuth email-link/upsert on synthetic ID or reserved email; ordinary OAuth works", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  assert.equal((await worker.fetch(signed(), env)).status, 200);
  const linked = sqlite.prepare("SELECT user_id FROM auth_users WHERE lower(email)=lower(?)").get(JOURNEY_EMAIL.toUpperCase())!;
  assert.equal(linked.user_id, JOURNEY_USER_ID);
  const insert = sqlite.prepare("INSERT INTO oauth_accounts(user_id, provider, provider_user_id, provider_email, display_name) VALUES (?, 'google', ?, ?, 'QA')");
  assert.throws(() => insert.run(String(linked.user_id), "synthetic-provider", JOURNEY_EMAIL), /journey_synthetic_oauth_forbidden/);
  assert.throws(() => insert.run("other-user", "reserved-provider", JOURNEY_EMAIL.toUpperCase()), /journey_synthetic_oauth_forbidden/);
  insert.run("normal-user", "normal-provider", "normal@example.com");
  assert.throws(() => sqlite.prepare("UPDATE oauth_accounts SET user_id=?").run(JOURNEY_USER_ID), /journey_synthetic_oauth_forbidden/);
  assert.throws(() => sqlite.prepare("UPDATE oauth_accounts SET provider_email=?").run(JOURNEY_EMAIL), /journey_synthetic_oauth_forbidden/);
  assert.equal(sqlite.prepare("SELECT user_id FROM oauth_accounts").get()!.user_id, "normal-user");
});

test("unapplied migration and issuer failure are audited 503 with no cookie; unknown effect is not retried", async t => {
  const missing = database(false); t.after(() => missing.sqlite.close());
  assert.equal((await worker.fetch(signed(), missing.env)).status, 503);
  assert.equal(JSON.parse(String(audits(missing.sqlite)[0]!.payload_json)).outcome, "failed");
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const request = signed();
  const failed = await handleJourneySession(request.clone(), env, async () => { throw new Error(secret); });
  assert.equal(failed!.status, 503); assert.equal(failed!.headers.get("set-cookie"), null);
  assert.equal((await worker.fetch(request.clone(), env)).status, 409);
  assert.ok(!JSON.stringify(audits(sqlite)).includes(secret));
});

test("migration is additive and idempotent; conflicting principal is never adopted or overwritten", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL("../migrations/core/0020_journey_sessions.sql", import.meta.url), "utf8"));
  sqlite.prepare("INSERT INTO auth_users(user_id,email,password_hash,display_name,role_name,banned) VALUES (?,?,?,'Existing','Admin',0)")
    .run(JOURNEY_USER_ID, "existing@example.com", "existing-hash");
  const response = await worker.fetch(signed(), env);
  assert.equal(response.status, 503); assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(sqlite.prepare("SELECT role_name FROM auth_users").get()!.role_name, "Admin");
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get()!.n, 0);
});

test("signed Work ID is bound to the signature; request target is stored only as a digest", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const request = signed();
  request.headers.set("X-Zukan-Journey-Work-Id", "ZUKAN-TAMPERED");
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "journey_signature_invalid" });
  assert.equal(audits(sqlite)[0]!.target_id, createHash("sha256").update(`POST\n${request.url}`).digest("hex"));
  assert.ok(!JSON.stringify(audits(sqlite)).includes(request.url));
  assert.ok(!JSON.stringify(audits(sqlite)).includes(request.headers.get("X-Zukan-Journey-Signature")!));
});

test("staging mint has Secure cookie and no OBS/content writes", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  env.ENVIRONMENT = "staging";
  env.OBS_DB = { prepare() { throw new Error("content write forbidden"); }, batch() { throw new Error("content write forbidden"); } } as never;
  const response = await worker.fetch(signed(), env);
  assert.equal(response.status, 200); assert.ok(response.headers.get("set-cookie")!.includes("Secure"));
});

test("a preexisting orphan user ID is never turned into a synthetic principal", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  sqlite.prepare("INSERT INTO users(user_id) VALUES (?)").run(JOURNEY_USER_ID);
  assert.equal((await worker.fetch(signed(), env)).status, 503);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_users").get()!.n, 0);
});

test("session guard fails closed on auth-store failure before routing any write", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const response = await worker.fetch(signed(), env);
  const cookie = response.headers.get("set-cookie")!.split(";", 1)[0]!;
  env.CORE_DB = { prepare() { throw new Error("store unavailable"); } } as never;
  const denied = await worker.fetch(new Request("https://zukan.earth/internal/anything", { method: "POST", headers: { cookie } }), env);
  assert.equal(denied.status, 503); assert.deepEqual(await denied.json(), { error: "auth_store_unavailable" }); privacy(denied);
});

test("GET/HEAD with a synthetic or normal cookie never reads the session in the guard", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  const mint = await worker.fetch(signed(), env);
  const cookie = mint.headers.get("set-cookie")!.split(";", 1)[0]!;
  let reads = 0;
  env.CORE_DB = { prepare() { reads++; throw new Error("D1 unavailable"); } } as never;
  for (const userId of [JOURNEY_USER_ID, "ordinary-user"]) {
    sqlite.prepare("UPDATE auth_sessions SET user_id=?").run(userId);
    for (const method of ["GET", "HEAD"]) {
      const response = await worker.fetch(new Request("https://zukan.earth/healthz", { method, headers: { cookie } }), env);
      assert.equal(response.status, 200);
      assert.notEqual(response.headers.get("cache-control"), "private, no-store");
    }
  }
  assert.equal(reads, 0, "GET/HEAD must neither pay an extra D1 read nor turn D1 failure into 503");
});

test("mint bypasses session reads even with a valid synthetic cookie", async t => {
  const { sqlite, db, env } = database(); t.after(() => sqlite.close());
  const mint = await worker.fetch(signed(), env);
  const cookie = mint.headers.get("set-cookie")!.split(";", 1)[0]!;
  let sessionReads = 0;
  env.CORE_DB = { ...db, prepare(sql: string) {
    if (/SELECT[\s\S]*FROM auth_sessions/.test(sql)) { sessionReads++; throw new Error("session read forbidden for mint"); }
    return db.prepare(sql);
  } } as WorkerEnv["CORE_DB"];
  const request = signed(); request.headers.set("cookie", cookie);
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200); privacy(response);
  assert.equal(sessionReads, 0);
});

test("zero-byte Content-Length: 0 and empty streams are accepted; any byte is rejected", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  for (const body of ["", new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(0)); controller.close();
  } })]) {
    const request = signed({ body }); request.headers.set("content-length", "0");
    assert.notEqual(request.body, null);
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200); privacy(response);
    assert.equal(request.bodyUsed, true);
  }
  let canceled = false;
  const request = signed({ body: new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new Uint8Array(0)); controller.enqueue(new Uint8Array([0]));
  }, cancel() { canceled = true; } }) });
  request.headers.set("content-length", "0");
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400); assert.deepEqual(await response.json(), { error: "journey_invalid_request" });
  assert.equal(canceled, true);
  assert.equal(sqlite.prepare("SELECT count(*) AS n FROM auth_sessions").get()!.n, 2);
});

test("ordinary password login keeps its 30-day Expires cookie and session TTL unchanged", async t => {
  const { sqlite, env } = database(); t.after(() => sqlite.close());
  sqlite.prepare("INSERT INTO auth_users(user_id,email,password_hash,display_name) VALUES ('ordinary-user','ordinary@example.com',?,'Ordinary')")
    .run(hashSync("ordinary-qa-password", 4));
  const before = Date.now();
  const response = await worker.fetch(new Request("https://zukan.earth/api/v1/auth/login", {
    method: "POST", headers: { origin: "https://zukan.earth", "content-type": "application/json" },
    body: JSON.stringify({ email: "ordinary@example.com", password: "ordinary-qa-password" }),
  }), env);
  assert.equal(response.status, 200);
  const session = sqlite.prepare("SELECT expires_at FROM auth_sessions").get()!;
  const expiry = Date.parse(String(session.expires_at));
  assert.ok(expiry >= before + 30 * 86_400_000 && expiry <= Date.now() + 30 * 86_400_000);
  const cookie = response.headers.get("set-cookie")!;
  assert.equal(cookie.includes("Max-Age"), false, "ordinary cookies retain their existing Expires-only contract");
  assert.ok(cookie.includes(`Expires=${new Date(expiry).toUTCString()}`));
});
