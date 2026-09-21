import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Mocked protocol tests only: never launches Playwright, fetches a provider or reads credentials.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = process.env.CLOUDFLARE_NATIVE_TEST_SOURCE_ROOT
  || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(path.join(tmpdir(), "zukan-recording-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
const helperPath = path.join(root, "e2e/support/browser-run-recording.ts");
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
writeFileSync(path.join(scratch, "browser-run-recording.js"), transpile(readFileSync(helperPath, "utf8")));
const { recordingTargetIds, minimizeRecordingHar } = require(path.join(scratch, "browser-run-recording.js"));
const localRequire = createRequire(path.join(scratch, "browser-run.js"));
const fakePlaywright = { test: { extend: () => ({}) }, chromium: {}, expect: {} };
const source = readFileSync(path.join(root, "e2e/support/browser-run.ts"), "utf8");
const mod = { exports: {} };
vm.runInThisContext("(function(require,module,exports){" + transpile(source) + "\n})")(
  (name) => name === "@playwright/test" ? fakePlaywright : localRequire(name), mod, mod.exports,
);
const { finalizeBrowserRun, createBrowserRunEvidence } = mod.exports;
const recording = (events = { "target-final": [] }) => ({ success: true, result: { sessionId: "session-fixture", events } });
function har() {
  return { log: { version: "1.2", creator: { name: "PRIVATE_CREATOR" }, entries: [{
    startedDateTime: "2026-09-21T00:00:00.000Z", time: 19,
    request: { method: "POST", url: "https://alice:pwd@example.invalid/reset/SHORT_TOKEN?q=PRIVATE_QUERY#PRIVATE_HASH", httpVersion: "HTTP/2",
      headers: [{ name: "Authorization", value: "Bearer abc" }, { name: "Cookie", value: "sid=abc" }],
      cookies: [{ name: "sid", value: "PRIVATE_COOKIE" }], queryString: [{ name: "q", value: "PRIVATE_QUERY" }],
      postData: { mimeType: "application/json", text: "PRIVATE_BODY" }, headersSize: 120, bodySize: 12 },
    response: { status: 200, statusText: "PRIVATE_STATUS", httpVersion: "HTTP/2",
      headers: [{ name: "Set-Cookie", value: "sid=PRIVATE_COOKIE" }], cookies: [], redirectURL: "https://example.invalid/?token=PRIVATE_REDIRECT",
      content: { size: 42, mimeType: "application/json; secret=PRIVATE_MIME", text: "PRIVATE_RESPONSE" }, headersSize: 50, bodySize: 42 },
    timings: { blocked: 1, dns: 2, connect: 3, send: 2, wait: 9, receive: 2, ssl: -1, comment: "PRIVATE_TIMING" },
    _privateExtension: "PRIVATE_EXTENSION", serverIPAddress: "PRIVATE_IP", cache: { comment: "PRIVATE_CACHE" },
  }] } };
}

describe("Finalized Browser Run recording contract", () => {
  it("extracts actual recorded tab IDs", () => {
    assert.deepEqual(recordingTargetIds(recording({ "target-a": [], "target-b": [{}] }), "session-fixture"), ["target-a", "target-b"]);
  });
  for (const [name, payload] of [
    ["HTTP-200 error envelope", { success: false, result: recording().result }],
    ["missing explicit success", { result: recording().result }],
    ["wrong session", { success: true, result: { ...recording().result, sessionId: "other" } }],
    ["empty targets", recording({})], ["events array", recording([])],
    ["unsafe target", recording({ "../target": [] })], ["malformed events", recording({ "target-a": "bad" })],
    ["null", null],
  ]) {
    it("rejects " + name, () => assert.equal(recordingTargetIds(payload, "session-fixture"), null));
  }
  it("does not treat an absent expected session as a match", () => {
    assert.equal(recordingTargetIds(recording(), ""), null);
  });
});

describe("Metadata-only network output", () => {
  it("removes short credentials, private paths, bodies and arbitrary extension fields", () => {
    const before = har();
    const snapshot = JSON.stringify(before);
    const minimized = minimizeRecordingHar(before);
    assert.ok(minimized);
    const text = JSON.stringify(minimized);
    assert.doesNotMatch(text, /PRIVATE_|SHORT_TOKEN|Bearer abc|sid=abc|alice|pwd/u);
    assert.equal(JSON.stringify(before), snapshot);
    const entry = minimized.log.entries[0];
    assert.equal(entry.request.url, "https://example.invalid/[redacted-path]");
    assert.deepEqual(entry.request.headers, []);
    assert.equal(entry.response.status, 200);
    assert.equal(entry.timings.wait, 9);
    assert.equal(entry.response.content.mimeType, "application/json");
  });
  it("allows a valid HAR with no requests", () => {
    assert.deepEqual(minimizeRecordingHar({ log: { version: "1.2", entries: [] } }).log.entries, []);
  });
  for (const [name, mutate] of [
    ["error wrapper", (x) => { x.success = false; }],
    ["wrong HAR version", (x) => { x.log.version = "1.1"; }],
    ["missing request", (x) => { delete x.log.entries[0].request; }],
    ["bad status", (x) => { x.log.entries[0].response.status = "200"; }],
    ["invalid date", (x) => { x.log.entries[0].startedDateTime = "invalid"; }],
    ["missing timings", (x) => { x.log.entries[0].timings = null; }],
  ]) {
    it("rejects " + name, () => { const x = har(); mutate(x); assert.equal(minimizeRecordingHar(x), null); });
  }
  it("minimizes malformed or injected optional metadata instead of echoing it", () => {
    const x = har();
    x.log.entries[0].request.url = "javascript:PRIVATE_URL";
    x.log.entries[0].request.method = "PRIVATE_METHOD";
    x.log.entries[0].response.content.mimeType = "PRIVATE_MIME";
    x.log.entries[0].timings.wait = NaN;
    const entry = minimizeRecordingHar(x).log.entries[0];
    assert.equal(entry.request.url, "about:blank");
    assert.equal(entry.request.method, "OTHER");
    assert.equal(entry.response.content.mimeType, "application/octet-stream");
    assert.equal(entry.timings.wait, -1);
  });
});

async function finalize(t, responses, recordingEnabled = true) {
  const out = await mkdtemp(path.join(tmpdir(), "zukan-finalize-test-"));
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || "GET" });
    const response = responses.shift();
    if (!response) throw new Error("unexpected mock call");
    return response();
  };
  t.after(async () => { globalThis.fetch = originalFetch; await rm(out, { recursive: true, force: true }); });
  const evidence = createBrowserRunEvidence();
  const session = { accountId: "account-fixture", apiToken: "fixture-not-real", sessionId: "session-fixture",
    webSocketDebuggerUrl: "", targetIds: ["target-before-navigation"], recording: recordingEnabled };
  await finalizeBrowserRun(session, evidence, out);
  return { evidence, calls, files: await readdir(out), out };
}
const json = (x, status = 200) => () => Response.json(x, { status });
const closed = () => new Response(null, { status: 204 });

describe("Existing finalizer with mocked Cloudflare HTTP", { concurrency: false }, () => {
  it("uses finalized targets and persists only minimized network data", async (t) => {
    const f = await finalize(t, [closed, json(recording()), json(har())]);
    assert.equal(f.evidence.recordingReadback.available, true);
    assert.deepEqual(f.evidence.recordingReadback.targetIds, ["target-final"]);
    assert.match(f.calls[2].url, /target=target-final&format=har$/u);
    assert.doesNotMatch(f.calls[2].url, /target-before-navigation/u);
    assert.equal(f.files.length, 1);
    assert.doesNotMatch(await readFile(path.join(f.out, f.files[0]), "utf8"), /PRIVATE_|SHORT_TOKEN|Bearer abc/u);
  });
  it("handles a transient finalization 404 with bounded existing retry", async (t) => {
    const f = await finalize(t, [closed, json({}, 404), json(recording()), json(har())]);
    assert.equal(f.evidence.recordingReadback.attempts, 2);
    assert.equal(f.evidence.recordingReadback.available, true);
  });
  it("does not call network endpoint after an HTTP-200 error envelope", async (t) => {
    const f = await finalize(t, [closed, json({ success: false, result: recording().result })]);
    assert.equal(f.evidence.recordingReadback.available, false);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(f.files, []);
  });
  it("does not adopt another session's recording", async (t) => {
    const x = recording(); x.result.sessionId = "other";
    const f = await finalize(t, [closed, json(x)]);
    assert.equal(f.evidence.recordingReadback.available, false);
    assert.equal(f.calls.length, 2);
  });
  it("reports partial network evidence rather than claiming complete diagnostics", async (t) => {
    const f = await finalize(t, [closed, json(recording({ "target-a": [], "target-b": [] })), json(har()), json({}, 404)]);
    assert.equal(f.evidence.networkReadback.length, 1);
    assert.equal(f.evidence.finalizationError, "browser_run_network_recording_incomplete");
  });
  it("does not persist a malformed network payload", async (t) => {
    const f = await finalize(t, [closed, json(recording()), json({ success: false })]);
    assert.equal(f.evidence.finalizationError, "browser_run_network_recording_incomplete");
    assert.deepEqual(f.files, []);
  });
  it("leaves ordinary nonrecorded sessions on the close-only path", async (t) => {
    const f = await finalize(t, [closed], false);
    assert.equal(f.calls.length, 1);
    assert.equal(f.evidence.recordingReadback, undefined);
    assert.deepEqual(f.files, []);
  });
});

// Evaluate the existing CLI's actual rejection condition without executing account or browser setup.
const runnerSource = readFileSync(path.join(root, "scripts/runBrowserRun.mjs"), "utf8");
const ast = ts.createSourceFile("runBrowserRun.mjs", runnerSource, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const predicates = [];
function collect(node) {
  if (ts.isIfStatement(node) && node.expression.getText(ast).includes("!evidence.recordingEnabled")) {
    predicates.push(node.expression.getText(ast));
  }
  ts.forEachChild(node, collect);
}
collect(ast);
assert.equal(predicates.length, 1);
const rejectsDiagnostic = vm.runInThisContext("(evidence) => (" + predicates[0] + ")");
const complete = () => ({ recordingEnabled: true, sessionId: "session-fixture",
  recordingReadback: { available: true, targetIds: ["target-a"] }, networkReadback: ["network-target-a.json"] });

describe("Existing diagnostic CLI acceptance boundary", () => {
  it("accepts complete recording and network metadata", () => assert.equal(Boolean(rejectsDiagnostic(complete())), false));
  for (const [name, mutate] of [
    ["recording missing", (x) => { x.recordingReadback.available = false; }],
    ["finalization error", (x) => { x.finalizationError = "browser_run_network_recording_incomplete"; }],
    ["missing network", (x) => { delete x.networkReadback; }],
    ["partial network", (x) => { x.networkReadback = []; }],
    ["no recorded targets", (x) => { x.recordingReadback.targetIds = []; x.networkReadback = []; }],
  ]) {
    it("rejects " + name, () => { const x = complete(); mutate(x); assert.equal(Boolean(rejectsDiagnostic(x)), true); });
  }
});
