import test from "node:test";
import assert from "node:assert/strict";
import { selectMaterializationItems, stableHtmlSha256, validateMaterializationImpactReceipt } from "./release_fast_path_materialization.mjs";

const sha = "a".repeat(40);
const bundleHash = "c".repeat(64);
const base = { release_source_sha: sha, environment: "staging", reuse_decision: "REUSE_EXACT",
  artifact_identity_digest: `sha256:${"b".repeat(64)}`, prior_artifact_provenance: {
    bundle_hash: bundleHash, version_prefix: `original-ui/versions/${bundleHash}`,
    manifest_key: "manifest.json", pointer_key: "current.json",
  } };
const items = [{ key: "original-ui/routes/a.html", pathname: "/a" }, { key: "original-ui/routes/b.html", pathname: "/b" }, { key: "original-ui/app.js", pathname: "/app.js" }];

test("backend-only exact reuse selects zero UI R2 objects", () => {
  const result = selectMaterializationItems(items, base);
  assert.equal(result.mode, "REUSE_EXACT"); assert.equal(result.uiR2PutCount, 0); assert.equal(result.items.length, 0);
});
test("single-route selective rebuild selects only affected object", () => {
  const result = selectMaterializationItems(items, { ...base, reuse_decision: "SELECTIVE_REBUILD", materialization: { affected_objects: ["original-ui/routes/a.html"] } });
  assert.equal(result.mode, "SELECTIVE_REBUILD"); assert.deepEqual(result.items.map((item) => item.pathname), ["/a"]); assert.equal(result.skippedCount, 2);
});
test("unknown selective closure fails closed to full selection", () => {
  const result = selectMaterializationItems(items, { ...base, reuse_decision: "SELECTIVE_REBUILD", materialization: { affected_objects: ["missing"] } });
  assert.equal(result.mode, "FULL"); assert.equal(result.reason, "SELECTIVE_OBJECT_CLOSURE_NO_MATCH");
});
test("receipt validation binds source, environment, and provenance", () => {
  assert.deepEqual(validateMaterializationImpactReceipt(base, { sourceSha: sha, targetEnv: "staging" }), []);
  assert.ok(validateMaterializationImpactReceipt({ ...base, release_source_sha: "d".repeat(40) }, { sourceSha: sha, targetEnv: "staging" }).includes("source_sha_mismatch"));
});
test("stable HTML identity ignores fresh CSP nonces but not content", () => {
  const first = '<script nonce="first">x</script><meta content="script-src \'nonce-first\'">';
  const second = '<script nonce="second">x</script><meta content="script-src \'nonce-second\'">';
  assert.equal(stableHtmlSha256(first), stableHtmlSha256(second));
  assert.notEqual(stableHtmlSha256(first), stableHtmlSha256(first.replace(">x<", ">y<")));
});
