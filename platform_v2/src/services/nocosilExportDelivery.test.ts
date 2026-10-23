import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { sendNocosilExport, type NocosilExportDependencies } from "./nocosilExportDelivery.js";

function response(status: number, headers?: HeadersInit): Response {
  return new Response(null, { status, headers });
}
function deps(fetch: typeof globalThis.fetch, overrides: Partial<NocosilExportDependencies> = {}): NocosilExportDependencies {
  return { fetch, now: () => 1_700_000_000_000, sleep: async () => undefined, ...overrides };
}

test("sends exact body with timestamp and idempotency-bound HMAC signature", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const body = '{ "ok": true }\n';
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init: init ?? {} });
    return response(202);
  }) as typeof globalThis.fetch;
  const result = await sendNocosilExport({ exportId: "export-123", body, secret: "test-secret" }, deps(fetch));
  const request = requests[0]!;
  const headers = new Headers(request.init.headers);
  const expected = createHmac("sha256", "test-secret").update(`1700000000.export-123.${body}`, "utf8").digest("hex");
  assert.equal(result.ok, true);
  assert.equal(request.url, "https://nocosil.com/api/exports");
  assert.equal(request.init.body, body);
  assert.equal(request.init.redirect, "manual");
  assert.equal(headers.get("Idempotency-Key"), "export-123");
  assert.equal(headers.get("X-Nocosil-Timestamp"), "1700000000");
  assert.equal(headers.get("X-Nocosil-Signature"), `sha256=${expected}`);
});

test("retries network errors, 429 and 5xx with bounded exponential delays", async () => {
  const delays: number[] = [];
  let calls = 0;
  const fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new Error("network");
    return calls === 2 ? response(429) : calls === 3 ? response(503) : response(200);
  }) as typeof globalThis.fetch;
  const result = await sendNocosilExport({ exportId: "e1", body: "{}", secret: "s" }, deps(fetch, {
    sleep: async (ms) => { delays.push(ms); }, maxAttempts: 4,
  }));
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 4);
  assert.deepEqual(delays, [250, 500, 1000]);
  assert.equal(calls, 4);
});

test("does not retry other 4xx responses", async () => {
  let calls = 0;
  const result = await sendNocosilExport({ exportId: "e2", body: "{}", secret: "s" }, deps((async () => {
    calls += 1;
    return response(403);
  }) as typeof globalThis.fetch));
  assert.deepEqual(result, { ok: false, status: 403, attempts: 1, error: "http_error" });
  assert.equal(calls, 1);
});

test("rejects non-allowlisted, non-HTTPS, and redirecting endpoints without following them", async () => {
  let calls = 0;
  const fetch = (async () => { calls += 1; return response(302, { location: "https://evil.example" }); }) as typeof globalThis.fetch;
  for (const endpoint of ["http://nocosil.com/api/exports", "https://evil.example/api/exports", "https://nocosil.com.evil.example/api/exports"]) {
    await assert.rejects(() => sendNocosilExport({ exportId: "e3", body: "{}", secret: "s", endpoint }, deps(fetch)), /endpoint/);
  }
  const redirected = await sendNocosilExport({ exportId: "e3", body: "{}", secret: "s" }, deps(fetch));
  assert.deepEqual(redirected, { ok: false, status: 302, attempts: 1, error: "redirect_rejected" });
  assert.equal(calls, 1);
});

test("aborts a timed out request and returns a non-retryable timeout result", async () => {
  const fetch = ((_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  })) as typeof globalThis.fetch;
  const result = await sendNocosilExport({ exportId: "e4", body: "{}", secret: "s" }, deps(fetch, { timeoutMs: 5, maxAttempts: 3 }));
  assert.deepEqual(result, { ok: false, attempts: 1, error: "timeout" });
});

test("caps attempts and uses a fresh timestamp/signature for each try", async () => {
  const seen: Array<{ timestamp: string | null; signature: string | null }> = [];
  let now = 1_700_000_000_000;
  const result = await sendNocosilExport({ exportId: "e5", body: "{}", secret: "s" }, deps((async (_input, init) => {
    const headers = new Headers(init?.headers);
    seen.push({ timestamp: headers.get("X-Nocosil-Timestamp"), signature: headers.get("X-Nocosil-Signature") });
    now += 1000;
    return response(500);
  }) as typeof globalThis.fetch, { now: () => now, maxAttempts: 20 }));
  assert.equal(result.attempts, 5);
  assert.equal(seen.length, 5);
  assert.notEqual(seen[0]?.timestamp, seen[1]?.timestamp);
});
