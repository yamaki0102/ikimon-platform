import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  noPointerEvidenceSchema,
  parsePriorManifest,
  planReuse,
  pointerBody,
  pointerText,
  runDirectR2Sync,
  runPointerOnly,
} from "./materialize-direct-r2-reuse.mjs";

const hex64 = (char) => char.repeat(64);
const sha = (text) => createHash("sha256").update(text).digest("hex");
const staging = "staging";
const scope = "core";
const manifestKey = "original-ui/materialize-manifest/staging/core.json";
const pointerKey = "original-ui/current/staging.json";
const sourceSha = "e".repeat(40);
const oldSourceSha = "d".repeat(40);
const priorBundle = hex64("1");
const priorVp = `original-ui/versions/${priorBundle}`;
const newBundle = hex64("2");
const newVp = `original-ui/versions/${newBundle}`;

const priorManifest = (overrides = {}) => JSON.stringify({
  schemaVersion: "original-ui-materialize/v1",
  sourceSha: oldSourceSha,
  targetEnv: staging,
  scope,
  bundleHash: priorBundle,
  versionPrefix: priorVp,
  items: [
    { key: "html/a.html", identitySha256: "id-a", sha256: "raw-a-old", bytes: 10, contentType: "text/html", version_prefix: priorVp },
    { key: "html/b.html", identitySha256: "id-b", sha256: "raw-b-old", bytes: 20, contentType: "text/html", version_prefix: priorVp },
  ],
  ...overrides,
});

// bIdentity "id-b-new" makes b changed; "id-b" keeps everything identical to the prior manifest.
const currentItems = (bIdentity = "id-b-new") => [
  { key: "original-ui/html/a.html", identitySha256: "id-a", sha256: "raw-a-new", bytes: 11, contentType: "text/html", filePath: "/mem/a" },
  { key: "original-ui/html/b.html", identitySha256: bIdentity, sha256: "raw-b-new", bytes: 21, contentType: "text/html", filePath: "/mem/b" },
];

// Each io call is one wrangler spawn in production; `calls` records them in order.
function fakeIo(objects = {}, { failBulkContentType = null } = {}) {
  const calls = [];
  const files = new Map();
  const puts = [];
  return {
    calls,
    puts,
    async put(key, filePath, contentType) {
      calls.push({ op: "put", key });
      puts.push({ key, contentType, body: files.get(filePath) ?? null });
    },
    async bulkPut(entries, { contentType }) {
      calls.push({ op: "bulk", contentType, keys: entries.map((entry) => entry.key) });
      if (contentType === failBulkContentType) throw new Error("bulk_failed");
      for (const entry of entries) puts.push({ key: entry.key, contentType, body: files.get(entry.filePath) ?? null, bulk: true });
    },
    async get(key, name) {
      calls.push({ op: "get", key });
      if (!(key in objects)) throw new Error(`missing ${key}`);
      const filePath = `/mem/${name}`;
      files.set(filePath, objects[key]);
      return filePath;
    },
    async readText(filePath) {
      return files.get(filePath);
    },
    async writeText(name, text) {
      const filePath = `/mem/${name}`;
      files.set(filePath, text);
      return filePath;
    },
  };
}

const newSummary = () => ({ updated: 0, uploaded: 0, reused: 0, skipped: 0, uiR2PutCount: 0, bulkFallbacks: 0 });
const writesOf = (io) => io.calls.filter((call) => call.op !== "get");

const syncArgs = (io, overrides = {}) => {
  const items = currentItems();
  return {
    allItems: items,
    selection: { mode: "FULL", reason: "NO_RECEIPT", items, uiR2PutCount: items.length, skippedCount: 0 },
    skipIfUnchanged: true,
    targetEnv: staging,
    scope,
    manifestKey,
    pointerKey,
    bundleHash: newBundle,
    sourceSha,
    concurrency: 16,
    noPointer: false,
    io,
    summary: newSummary(),
    ...overrides,
  };
};

const sameItems = () => {
  const items = currentItems("id-b");
  return { allItems: items, selection: { mode: "FULL", reason: "NO_RECEIPT", items, skippedCount: 0 } };
};

test("identity-equal items reuse prior version_prefix and only changed items upload", () => {
  const prior = parsePriorManifest(priorManifest(), { targetEnv: staging, scope });
  const plan = planReuse(currentItems(), prior, newVp);
  assert.deepEqual(plan.uploadItems.map((item) => item.key), ["original-ui/html/b.html"]);
  assert.equal(plan.reusedCount, 1);
  assert.equal(plan.unchanged, false);
  const a = plan.manifestItems.find((item) => item.key === "html/a.html");
  const b = plan.manifestItems.find((item) => item.key === "html/b.html");
  assert.equal(a.version_prefix, priorVp);
  assert.equal(a.sha256, "raw-a-old");
  assert.equal(b.version_prefix, newVp);
});

test("removed prior keys make the plan changed", () => {
  const prior = parsePriorManifest(priorManifest(), { targetEnv: staging, scope });
  const plan = planReuse(currentItems().slice(0, 1), prior, newVp);
  assert.deepEqual(plan.removedKeys, ["html/b.html"]);
  assert.equal(plan.unchanged, false);
});

test("prior manifest for another environment or scope is rejected", () => {
  assert.throws(() => parsePriorManifest(priorManifest(), { targetEnv: "production", scope }), /provenance_mismatch/u);
  assert.throws(() => parsePriorManifest(priorManifest(), { targetEnv: staging, scope: "all" }), /provenance_mismatch/u);
});

test("missing prior manifest falls back to a full upload with one bulk call per content type", async () => {
  const io = fakeIo({});
  const summary = newSummary();
  const result = await runDirectR2Sync(syncArgs(io, { summary }));
  assert.equal(result.status, "WRITTEN");
  assert.equal(result.selectionMode, "FULL");
  assert.match(result.selectionReason, /^prior_manifest_unavailable/u);
  assert.equal(summary.uploaded, 2);
  assert.equal(summary.reused, 0);
  const objectBulk = io.calls.find((call) => call.op === "bulk" && call.contentType === "text/html");
  assert.deepEqual(objectBulk.keys, [`${newVp}/html/a.html`, `${newVp}/html/b.html`]);
});

test("bulk failure falls back to per-object puts for that group only", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest() }, { failBulkContentType: "text/html" });
  const summary = newSummary();
  const result = await runDirectR2Sync(syncArgs(io, { summary }));
  assert.equal(result.status, "WRITTEN");
  assert.equal(summary.bulkFallbacks, 1);
  assert.ok(io.calls.some((call) => call.op === "put" && call.key === `${newVp}/html/b.html`));
  assert.ok(io.calls.some((call) => call.op === "bulk" && call.contentType === "application/json"));
});

test("unchanged items from the same source with --no-pointer cost exactly one spawn and no writes", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest({ sourceSha }) });
  const summary = newSummary();
  const result = await runDirectR2Sync(syncArgs(io, { ...sameItems(), summary, noPointer: true }));
  assert.equal(result.status, "SKIPPED_UNCHANGED");
  assert.equal(io.calls.length, 1);
  assert.equal(io.calls[0].op, "get");
  assert.equal(writesOf(io).length, 0);
  assert.equal(summary.reused, 2);
  assert.equal(summary.uploaded, 0);
  assert.deepEqual(result.pending_pointer.body, { manifest_hash: priorBundle, version_prefix: priorVp, source_sha: sourceSha });
});

test("unchanged items with the pointer already current skip every write", async () => {
  const pointer = pointerText(pointerBody({ bundleHash: priorBundle, versionPrefix: priorVp, sourceSha }));
  const io = fakeIo({ [manifestKey]: priorManifest({ sourceSha }), [pointerKey]: pointer });
  const result = await runDirectR2Sync(syncArgs(io, sameItems()));
  assert.equal(result.status, "SKIPPED_UNCHANGED");
  assert.equal(writesOf(io).length, 0);
});

test("unchanged items with a stale pointer rewrite only the pointer, never the objects", async () => {
  const stale = pointerText(pointerBody({ bundleHash: hex64("9"), versionPrefix: `original-ui/versions/${hex64("9")}`, sourceSha }));
  const io = fakeIo({ [manifestKey]: priorManifest({ sourceSha }), [pointerKey]: stale });
  const result = await runDirectR2Sync(syncArgs(io, sameItems()));
  assert.equal(result.status, "POINTER_ONLY_WRITTEN");
  assert.deepEqual(writesOf(io), [{ op: "put", key: pointerKey }]);
});

test("unchanged items from a new source rewrite manifests with one bulk call, then the pointer last", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest(), [pointerKey]: "{}" });
  const result = await runDirectR2Sync(syncArgs(io, sameItems()));
  assert.equal(result.status, "WRITTEN");
  assert.deepEqual(writesOf(io).map((call) => call.op === "bulk" ? `bulk:${call.contentType}` : call.key), [
    "bulk:application/json",
    "original-ui/current/staging.json",
  ]);
  assert.deepEqual(io.calls.find((call) => call.op === "bulk").keys, [`${newVp}/manifest.json`, manifestKey]);
});

test("changed item uploads only that object, manifests after objects, pointer last", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest() });
  const result = await runDirectR2Sync(syncArgs(io));
  assert.equal(result.status, "WRITTEN");
  assert.equal(result.uploaded, 1);
  assert.deepEqual(writesOf(io).map((call) => call.op === "bulk" ? call.keys : call.key), [
    [`${newVp}/html/b.html`],
    [`${newVp}/manifest.json`, manifestKey],
    pointerKey,
  ]);
});

test("no-pointer writes objects and manifests but emits the exact pending pointer", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest() });
  const result = await runDirectR2Sync(syncArgs(io, { noPointer: true }));
  assert.equal(result.status, "NO_POINTER_WRITTEN");
  assert.equal(io.calls.some((call) => call.key === pointerKey && call.op !== "get"), false);
  assert.deepEqual(result.pending_pointer.body, { manifest_hash: newBundle, version_prefix: newVp, source_sha: sourceSha });
  assert.equal(result.pending_pointer.text, pointerText(result.pending_pointer.body));
  assert.equal(result.pending_pointer.manifest_key, `${newVp}/manifest.json`);
});

test("pointer-only refuses when the versioned manifest is missing", async () => {
  const body = pointerBody({ bundleHash: newBundle, versionPrefix: newVp, sourceSha });
  const evidence = {
    schema: noPointerEvidenceSchema, targetEnv: staging,
    pending_pointer: { key: pointerKey, body, text: pointerText(body), manifest_key: `${newVp}/manifest.json`, manifest_sha256: null },
  };
  const io = fakeIo({});
  await assert.rejects(
    () => runPointerOnly({ evidence, targetEnv: staging, pointerKey, sourceSha, execute: true, io }),
    /pointer_only_refused:versioned_manifest_missing/u,
  );
  assert.equal(writesOf(io).length, 0);
});

test("pointer-only writes the pointer only after the versioned manifest verifies", async () => {
  const body = pointerBody({ bundleHash: newBundle, versionPrefix: newVp, sourceSha });
  const manifestText = JSON.stringify({
    schemaVersion: "original-ui-materialize/v1", sourceSha, targetEnv: staging, scope,
    bundleHash: newBundle, versionPrefix: newVp, items: [],
  });
  const evidence = {
    schema: noPointerEvidenceSchema, targetEnv: staging,
    pending_pointer: { key: pointerKey, body, text: pointerText(body), manifest_key: `${newVp}/manifest.json`, manifest_sha256: sha(manifestText) },
  };
  const io = fakeIo({ [`${newVp}/manifest.json`]: manifestText });
  const result = await runPointerOnly({ evidence, targetEnv: staging, pointerKey, sourceSha, execute: true, io });
  assert.equal(result.status, "POINTER_WRITTEN");
  assert.deepEqual(writesOf(io).map((call) => call.key), [pointerKey]);
  assert.equal(io.puts[0].body, pointerText(body));
});

test("pointer-only dry run verifies without writing", async () => {
  const body = pointerBody({ bundleHash: newBundle, versionPrefix: newVp, sourceSha });
  const manifestText = JSON.stringify({ bundleHash: newBundle, versionPrefix: newVp, targetEnv: staging, sourceSha, items: [] });
  const evidence = {
    schema: noPointerEvidenceSchema, targetEnv: staging,
    pending_pointer: { key: pointerKey, body, text: pointerText(body), manifest_key: `${newVp}/manifest.json`, manifest_sha256: null },
  };
  const io = fakeIo({ [`${newVp}/manifest.json`]: manifestText });
  const result = await runPointerOnly({ evidence, targetEnv: staging, pointerKey, sourceSha, execute: false, io });
  assert.equal(result.status, "DRY_RUN_VERIFIED");
  assert.equal(writesOf(io).length, 0);
});
