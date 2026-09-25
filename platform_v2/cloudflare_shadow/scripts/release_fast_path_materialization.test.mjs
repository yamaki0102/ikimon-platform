import test from "node:test";
import assert from "node:assert/strict";
import { selectMaterializationItems, validateMaterializationImpactReceipt } from "./release_fast_path_materialization.mjs";

const sha = "a".repeat(40);
const digest = "sha256:" + "b".repeat(64);
const base = { release_source_sha: sha, environment: "staging", reuse_decision: "REUSE_EXACT", artifact_identity_digest: digest, prior_artifact_provenance: { bundle_hash: "c".repeat(64), version_prefix: "original-ui/versions/" + "c".repeat(64), manifest_key: "manifest.json", pointer_key: "current.json" } };
const items = [{ key: "original-ui/routes/a.html", pathname: "/a" }, { key: "original-ui/routes/b.html", pathname: "/b" }, { key: "original-ui/app.js", pathname: "/app.js" }];

test("backend-only exact reuse selects zero UI R2 objects", () => {
  const result = selectMaterializationItems(items, base);
  assert.equal(result.mode, "REUSE_EXACT");
  assert.equal(result.uiR2PutCount, 0);
  assert.equal(result.items.length, 0);
});

test("single-route selective rebuild selects only affected object", () => {
  const result = selectMaterializationItems(items, { ...base, reuse_decision: "SELECTIVE_REBUILD", materialization: { affected_objects: ["original-ui/routes/a.html"] } });
  assert.equal(result.mode, "SELECTIVE_REBUILD");
  assert.equal(result.uiR2PutCount, 1);
  assert.deepEqual(result.items.map((item) => item.pathname), ["/a"]);
  assert.equal(result.skippedCount, 2);
});

test("unknown selective closure fails closed to full selection", () => {
  const result = selectMaterializationItems(items, { ...base, reuse_decision: "SELECTIVE_REBUILD", materialization: { affected_objects: ["missing"] } });
  assert.equal(result.mode, "FULL");
  assert.equal(result.reason, "SELECTIVE_OBJECT_CLOSURE_NO_MATCH");
  assert.equal(result.uiR2PutCount, 3);
});

test("receipt validation binds exact source and staging and requires provenance", () => {
  assert.deepEqual(validateMaterializationImpactReceipt(base, { sourceSha: sha, targetEnv: "staging" }), []);
  assert.ok(validateMaterializationImpactReceipt({ ...base, release_source_sha: "d".repeat(40) }, { sourceSha: sha, targetEnv: "staging" }).includes("source_sha_mismatch"));
  assert.ok(validateMaterializationImpactReceipt({ ...base, prior_artifact_provenance: {} }, { sourceSha: sha, targetEnv: "staging" }).includes("prior_bundle_hash_missing"));
});
