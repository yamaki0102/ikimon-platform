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
const priorBundle = hex64("1");
const priorVp = `original-ui/versions/${priorBundle}`;
const newBundle = hex64("2");
const newVp = `original-ui/versions/${newBundle}`;

const priorManifest = (overrides = {}) => JSON.stringify({
  schemaVersion: "original-ui-materialize/v1",
  sourceSha: "d".repeat(40),
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

const currentItems = (bIdentity = "id-b") => [
  { key: "original-ui/html/a.html", identitySha256: "id-a", sha256: "raw-a-new", bytes: 11, contentType: "text/html", filePath: "/mem/a" },
  { key: "original-ui/html/b.html", identitySha256: bIdentity, sha256: "raw-b-new", bytes: 21, contentType: "text/html", filePath: "/mem/b" },
];

function fakeIo(objects = {}) {
  const puts = [];
  const files = new Map();
  const io = {
    puts,
    async put(key, filePath, contentType) {
      puts.push({ key, contentType, body: files.get(filePath) ?? null });
    },
    async get(key, name) {
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
  return io;
}

const newSummary = () => ({ updated: 0, uploaded: 0, reused: 0, skipped: 0, uiR2PutCount: 0 });

const syncArgs = (io, overrides = {}) => ({
  allItems: currentItems("id-b-new"),
  selection: { mode: "FULL", reason: "NO_RECEIPT", items: currentItems("id-b-new"), uiR2PutCount: 2, skippedCount: 0 },
  skipIfUnchanged: true,
  targetEnv: staging,
  scope,
  manifestKey,
  pointerKey,
  bundleHash: newBundle,
  sourceSha,
  concurrency: 4,
  noPointer: false,
  io,
  summary: newSummary(),
  ...overrides,
});

test("identity-equal items reuse prior version_prefix and only changed items upload", () => {
  const prior = parsePriorManifest(priorManifest(), { targetEnv: staging, scope });
  const plan = planReuse(currentItems("id-b-new"), prior, newVp);
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

test("missing prior manifest falls back to a full upload", async () => {
  const io = fakeIo({});
  const summary = newSummary();
  const result = await runDirectR2Sync(syncArgs(io, { summary }));
  assert.equal(result.status, "WRITTEN");
  assert.equal(result.selectionMode, "FULL");
  assert.match(result.selectionReason, /^prior_manifest_unavailable/u);
  assert.equal(summary.uploaded, 2);
  assert.equal(summary.reused, 0);
  const objectPuts = io.puts.filter((put) => put.key.startsWith(`${newVp}/`) && !put.key.endsWith("/manifest.json"));
  assert.equal(objectPuts.length, 2);
});

test("unchanged identities with current pointer skip manifest and pointer writes", async () => {
  const pointer = pointerText(pointerBody({ bundleHash: priorBundle, versionPrefix: priorVp, sourceSha }));
  const io = fakeIo({ [manifestKey]: priorManifest(), [pointerKey]: pointer });
  const summary = newSummary();
  const allSame = currentItems("id-b");
  const result = await runDirectR2Sync(syncArgs(io, { allItems: allSame, summary, selection: { mode: "FULL", reason: "NO_RECEIPT", items: allSame, skippedCount: 0 } }));
  assert.equal(result.status, "SKIPPED_UNCHANGED");
  assert.equal(result.skipped, true);
  assert.equal(io.puts.length, 0);
  assert.equal(summary.reused, 2);
  assert.equal(summary.uploaded, 0);
});

test("unchanged identities with a stale pointer rewrite only manifests and pointer", async () => {
  const staleBody = pointerText(pointerBody({ bundleHash: hex64("9"), versionPrefix: `original-ui/versions/${hex64("9")}`, sourceSha }));
  const io = fakeIo({ [manifestKey]: priorManifest(), [pointerKey]: staleBody });
  const allSame = currentItems("id-b");
  const result = await runDirectR2Sync(syncArgs(io, { allItems: allSame, selection: { mode: "FULL", reason: "NO_RECEIPT", items: allSame, skippedCount: 0 } }));
  assert.equal(result.status, "WRITTEN");
  assert.deepEqual(io.puts.map((put) => put.key), [`${newVp}/manifest.json`, manifestKey, pointerKey]);
});

test("changed item uploads only that object and then the pointer", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest() });
  const result = await runDirectR2Sync(syncArgs(io));
  assert.equal(result.status, "WRITTEN");
  assert.equal(result.uploaded, 1);
  const objectKeys = io.puts.map((put) => put.key);
  assert.deepEqual(objectKeys, [`${newVp}/html/b.html`, `${newVp}/manifest.json`, manifestKey, pointerKey]);
});

test("no-pointer uploads objects and manifests but emits the exact pending pointer", async () => {
  const io = fakeIo({ [manifestKey]: priorManifest() });
  const result = await runDirectR2Sync(syncArgs(io, { noPointer: true }));
  assert.equal(result.status, "NO_POINTER_WRITTEN");
  assert.equal(io.puts.some((put) => put.key === pointerKey), false);
  assert.deepEqual(result.pending_pointer.body, { manifest_hash: newBundle, version_prefix: newVp, source_sha: sourceSha });
  assert.equal(result.pending_pointer.text, pointerText(result.pending_pointer.body));
  assert.equal(result.pending_pointer.manifest_key, `${newVp}/manifest.json`);
});

test("pointer-only refuses when the versioned manifest is missing", async () => {
  const evidence = {
    schema: noPointerEvidenceSchema, targetEnv: staging,
    pending_pointer: (() => {
      const body = pointerBody({ bundleHash: newBundle, versionPrefix: newVp, sourceSha });
      return { key: pointerKey, body, text: pointerText(body), manifest_key: `${newVp}/manifest.json`, manifest_sha256: null };
    })(),
  };
  const io = fakeIo({});
  await assert.rejects(
    () => runPointerOnly({ evidence, targetEnv: staging, pointerKey, sourceSha, execute: true, io }),
    /pointer_only_refused:versioned_manifest_missing/u,
  );
  assert.equal(io.puts.length, 0);
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
  assert.deepEqual(io.puts.map((put) => put.key), [pointerKey]);
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
  assert.equal(io.puts.length, 0);
});
