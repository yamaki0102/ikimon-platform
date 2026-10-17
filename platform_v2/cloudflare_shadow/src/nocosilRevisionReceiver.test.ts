import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  NOCOSIL_REVISION_PATH, NOCOSIL_REVISION_SCHEMA, canonicalJson,
  handleNocosilRevisionReceiverApi, parseNocosilRevision, storeNocosilRevision,
  type NocosilRevisionEnv, type ReceiverDatabase,
} from "./nocosilRevisionReceiver";

const nowMs = Date.parse("2026-10-18T00:00:00.000Z");
const timestamp = String(nowMs / 1000);
const secret = "fixture-hmac-secret";
const url = new URL(NOCOSIL_REVISION_PATH, "https://zukan.earth");
const revision = {
  schema: NOCOSIL_REVISION_SCHEMA, linkGeneration: "link_1", sourceAccountRef: "account_1",
  relationshipId: "relationship_1", revision: 1, action: "saved", sourceState: "current",
  occurredAt: "2026-10-17T23:59:00.000Z",
  object: { kind: "record", objectId: "r1", path: "/records/regional-r1", title: "地域の記録" },
};
function fixture(t: TestContext) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/core/0022_nocosil_revision_receipts.sql", import.meta.url), "utf8"));
  t.after(() => sqlite.close());
  const db: ReceiverDatabase = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      const query = (values: SQLInputValue[] = []): ReturnType<ReceiverDatabase["prepare"]> => ({
        bind: (...bound) => query(bound),
        first: async <T>() => (statement.get(...values) ?? null) as T | null,
        run: async () => ({ meta: { changes: Number(statement.run(...values).changes) } }),
      });
      return query();
    },
  };
  const env: NocosilRevisionEnv = { CORE_DB: db, NOCOSIL_REVISION_RECEIVER_ENABLED: "true", NOCOSIL_INTEGRATION_HMAC_SECRET: secret };
  return { sqlite, db, env };
}
function signedRequest(body = JSON.stringify(revision), ts = timestamp, signingSecret = secret, overrides: Record<string, string> = {}) {
  const signature = createHmac("sha256", signingSecret).update(ts + ".").update(body).digest("hex");
  return new Request(url, { method: "POST", body, headers: {
    "x-nocosil-timestamp": ts, "x-nocosil-signature": "v1=" + signature, ...overrides,
  } });
}
async function receive(request: Request, env: NocosilRevisionEnv, at = nowMs) {
  const response = await handleNocosilRevisionReceiverApi(request, new URL(request.url), env, at);
  assert.ok(response);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response;
}
async function errorResponse(request: Request, env: NocosilRevisionEnv, status: number, code: string) {
  const response = await receive(request, env);
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: code });
}

test("valid HMAC creates a private receipt with deterministic identity", async t => {
  const { env, sqlite } = fixture(t);
  const response = await receive(signedRequest(), env);
  assert.equal(response.status, 201);
  const id = "nrv_" + createHash("sha256").update(canonicalJson(["nocosil", "account_1", "relationship_1", 1])).digest("hex").slice(0, 40);
  assert.match(id, /^nrv_[a-f0-9]{40}$/);
  assert.deepEqual(await response.json(), { ok: true, receipt: {
    id, url: "https://zukan.earth/integrations/nocosil/revisions/" + id,
    source: "nocosil", revision: 1, action: "saved", objectKind: "record", objectId: "r1",
    occurredAt: revision.occurredAt, receivedAt: new Date(nowMs).toISOString(),
  } });
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_revision_receipts").get()?.count, 1);
});

test("wrong secret, malformed signature and tampered raw bytes fail before JSON parsing", async t => {
  const { env } = fixture(t);
  await errorResponse(signedRequest(undefined, timestamp, "wrong-secret"), env, 401, "signature_invalid");
  const signed = signedRequest();
  await errorResponse(new Request(url, { method: "POST", headers: signed.headers, body: JSON.stringify(revision) + " " }), env, 401, "signature_invalid");
  for (const signature of ["v1=bad", "v2=" + "a".repeat(64), "v1=" + "g".repeat(64)]) {
    await errorResponse(signedRequest("{", timestamp, secret, { "x-nocosil-signature": signature }), env, 401, "signature_invalid");
  }
});

test("timestamp window rejects old/future 301 seconds and accepts either 300-second boundary", async t => {
  const { env } = fixture(t);
  for (const delta of [-301, 301]) await errorResponse(signedRequest(undefined, String(nowMs / 1000 + delta)), env, 401, "timestamp_out_of_window");
  assert.equal((await receive(signedRequest(undefined, String(nowMs / 1000 - 300)), env)).status, 201);
  assert.equal((await receive(signedRequest(undefined, String(nowMs / 1000 + 300)), env)).status, 200);
});

test("missing headers and invalid timestamp formats have distinct errors", async t => {
  const { env } = fixture(t);
  for (const name of ["x-nocosil-signature", "x-nocosil-timestamp"]) {
    const request = signedRequest(); request.headers.delete(name);
    await errorResponse(request, env, 401, "signature_required");
  }
  for (const ts of ["not-a-number", "1.5", "-1", "1234567890123"]) await errorResponse(signedRequest(undefined, ts), env, 401, "timestamp_invalid");
});

test("flag defaults OFF for every method and requires the exact true string", async t => {
  const { env } = fixture(t);
  for (const flag of [undefined, "false", "TRUE", " true "]) {
    const disabled = { ...env, NOCOSIL_REVISION_RECEIVER_ENABLED: flag };
    await errorResponse(signedRequest(), disabled, 404, "not_found");
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) await errorResponse(new Request(url, { method }), disabled, 404, "not_found");
  }
});

test("enabled receiver requires a nonblank secret and trims configured secrets", async t => {
  const { env } = fixture(t);
  for (const key of [undefined, "", "  "]) await errorResponse(signedRequest(), { ...env, NOCOSIL_INTEGRATION_HMAC_SECRET: key }, 503, "receiver_not_configured");
  const request = signedRequest();
  request.headers.set("x-nocosil-signature", request.headers.get("x-nocosil-signature")!.toUpperCase().replace("V1=", "v1="));
  assert.equal((await receive(request, { ...env, NOCOSIL_INTEGRATION_HMAC_SECRET: "  " + secret + "  " })).status, 201);
});

test("identical replay keeps byte-identical body, receivedAt and one row", async t => {
  const { env, sqlite } = fixture(t);
  const first = await receive(signedRequest(), env);
  const second = await receive(signedRequest(), env, nowMs + 1000);
  assert.equal(first.status, 201); assert.equal(second.status, 200);
  assert.equal(await first.text(), await second.text());
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_revision_receipts").get()?.count, 1);
});

test("title trimming and recursively reordered keys have the same stored digest", async t => {
  const { env, sqlite } = fixture(t);
  const first = await receive(signedRequest(JSON.stringify({ ...revision, object: { ...revision.object, title: "  " + revision.object.title + "  " } })), env);
  const reordered = Object.fromEntries(Object.entries({ ...revision, object: Object.fromEntries(Object.entries(revision.object).reverse()) }).reverse());
  const replay = await receive(signedRequest(JSON.stringify(reordered)), env);
  assert.equal(first.status, 201); assert.equal(replay.status, 200);
  assert.equal(await first.text(), await replay.text());
  const row = sqlite.prepare("SELECT display_title, payload_digest FROM nocosil_revision_receipts").get();
  assert.equal(row?.display_title, revision.object.title);
  assert.equal(row?.payload_digest, createHash("sha256").update(canonicalJson(parseNocosilRevision(revision))).digest("hex"));
});

test("different payload under a natural key conflicts without changing the row", async t => {
  const { env, sqlite } = fixture(t);
  await receive(signedRequest(), env);
  const before = sqlite.prepare("SELECT * FROM nocosil_revision_receipts").get();
  for (const changed of [{ ...revision, object: { ...revision.object, title: "Changed" } }, { ...revision, linkGeneration: "link_2" }]) {
    await errorResponse(signedRequest(JSON.stringify(changed)), env, 409, "revision_conflict");
    assert.deepEqual(sqlite.prepare("SELECT * FROM nocosil_revision_receipts").get(), before);
  }
});

test("new revisions and different source accounts append independently", async t => {
  const { db, sqlite } = fixture(t);
  for (const input of [revision, { ...revision, revision: 2, action: "removed", sourceState: "withdrawn" }, { ...revision, sourceAccountRef: "account_2" }]) {
    assert.equal((await storeNocosilRevision(db, parseNocosilRevision(input), new Date(nowMs).toISOString())).created, true);
  }
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM nocosil_revision_receipts").get()?.count, 3);
});

test("signed invalid JSON and invalid revision fields return precise errors", async t => {
  const { env } = fixture(t);
  await errorResponse(signedRequest("{"), env, 400, "invalid_json");
  const cases: [unknown, string][] = [
    [{ ...revision, extra: true }, "shape_invalid"],
    [Object.fromEntries(Object.entries(revision).filter(([key]) => key !== "relationshipId")), "shape_invalid"],
    [{ ...revision, object: { ...revision.object, extra: true } }, "shape_invalid"],
    [{ ...revision, schema: "wrong" }, "schema_invalid"],
    [{ ...revision, object: { ...revision.object, path: "/jobs/r1" } }, "path_invalid"],
    [{ ...revision, occurredAt: "2026-10-17" }, "time_invalid"],
    [{ ...revision, occurredAt: "2026-02-30T00:00:00.000Z" }, "time_invalid"],
    [{ ...revision, object: { ...revision.object, title: "bad\u0000title" } }, "title_invalid"],
    [{ ...revision, revision: 0 }, "revision_invalid"],
    [{ ...revision, revision: Number.MAX_SAFE_INTEGER + 1 }, "revision_invalid"],
    [{ ...revision, sourceAccountRef: "bad account" }, "identity_invalid"],
    [{ ...revision, action: "booked" }, "action_invalid"],
    [{ ...revision, sourceState: "unknown" }, "source_state_invalid"],
    [{ ...revision, object: { ...revision.object, kind: "constructor" } }, "kind_invalid"],
  ];
  for (const [input, code] of cases) await errorResponse(signedRequest(JSON.stringify(input)), env, 422, code);
});

test("all kind namespaces and objectId suffixes match the sender contract", () => {
  const cases: Record<string, string[]> = { record: ["observations", "records"], place: ["sites", "places"], event: ["events", "community/events"], job: ["jobs"], offer: ["offers"], article: ["articles", "read"], organization: ["organizations"], experience: ["experiences"], stay: ["stays"], learning: ["learning"], service: ["services"] };
  for (const [kind, paths] of Object.entries(cases)) for (const ns of paths) for (const tail of ["r1", "some-title-r1"]) {
    assert.equal(parseNocosilRevision({ ...revision, object: { ...revision.object, kind, path: "/" + ns + "/" + tail } }).object.kind, kind);
  }
  for (const path of ["//records/r1", "/records/r1?q=1", "/records/r1#hash", "/records/%72r1", "/records/../r1", "/records/other", "/records/r1/child", "/records/a r1", "/records/a\\r1", "/records/r1\u007f"]) {
    assert.throws(() => parseNocosilRevision({ ...revision, object: { ...revision.object, path } }), /path_invalid/);
  }
  for (const title of [" ", "x".repeat(241), "bad\u007ftitle"]) assert.throws(() => parseNocosilRevision({ ...revision, object: { ...revision.object, title } }), /title_invalid/);
});

test("oversized content-length and streamed bytes are bounded at 8192", async t => {
  const { env } = fixture(t);
  const body = JSON.stringify(revision).padEnd(8193, " ");
  await errorResponse(signedRequest(body, timestamp, secret, { "content-length": "8193" }), env, 413, "payload_too_large");
  await errorResponse(signedRequest(body), env, 413, "payload_too_large");
  await errorResponse(signedRequest(body, timestamp, secret, { "content-length": "1" }), env, 413, "payload_too_large");
  const signed = signedRequest(body);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(new TextEncoder().encode(body.slice(0, 4000)));
    controller.enqueue(new TextEncoder().encode(body.slice(4000)));
  }, cancel() { cancelled = true; } });
  await errorResponse(new Request(url, Object.assign({ method: "POST", headers: signed.headers, body: stream }, { duplex: "half" })), env, 413, "payload_too_large");
  assert.equal(cancelled, true);
  assert.equal((await receive(signedRequest(JSON.stringify(revision).padEnd(8192 - (Buffer.byteLength(JSON.stringify(revision)) - JSON.stringify(revision).length), " ")), env)).status, 201);
  const unicodeBody = JSON.stringify(revision).padEnd(8192, " ");
  assert.ok(unicodeBody.length <= 8192 && Buffer.byteLength(unicodeBody) > 8192);
  await errorResponse(signedRequest(unicodeBody), env, 413, "payload_too_large");
});

test("enabled path only accepts POST and unrelated paths return null", async t => {
  const { env } = fixture(t);
  await errorResponse(new Request(url), env, 405, "method_not_allowed");
  const other = new URL("/api/v1/programs/receive", url);
  assert.equal(await handleNocosilRevisionReceiverApi(new Request(other), other, env, nowMs), null);
  const locator = new URL("/integrations/nocosil/revisions/nrv_fixture", url);
  assert.equal(await handleNocosilRevisionReceiverApi(new Request(locator), locator, env, nowMs), null);
});

test("database errors and missing insert read-back return storage_unavailable", async t => {
  const { env } = fixture(t);
  const failing: ReceiverDatabase = { prepare() { throw new Error("fixture store unavailable"); } };
  await errorResponse(signedRequest(), { ...env, CORE_DB: failing }, 503, "storage_unavailable");
  const missing: ReceiverDatabase = { prepare() { return { bind() { return this; }, first: async () => null, run: async () => ({ meta: { changes: 1 } }) }; } };
  await errorResponse(signedRequest(), { ...env, CORE_DB: missing }, 503, "storage_unavailable");
});

test("canonicalJson recursively sorts keys and preserves array order", () => {
  assert.equal(canonicalJson({ z: 1, a: { z: 2, a: 3 } }), '{"a":{"a":3,"z":2},"z":1}');
  assert.equal(canonicalJson({ a: [3, { z: 2, a: 1 }], b: null }), canonicalJson({ b: null, a: [3, { a: 1, z: 2 }] }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});
