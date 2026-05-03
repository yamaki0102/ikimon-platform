import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./environmentSnapshotWriter.js";

const { shaForArtifact } = __test__;

test("shaForArtifact is deterministic for the same artifact", () => {
  const a = shaForArtifact({
    sourceKind: "planetary_computer",
    sourceUrl: "https://x/scene/abc",
    contentBytes: 12345,
    license: "CC-BY",
  });
  const b = shaForArtifact({
    sourceKind: "planetary_computer",
    sourceUrl: "https://x/scene/abc",
    contentBytes: 12345,
    license: "CC-BY",
  });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("shaForArtifact differs when source_url or kind differ", () => {
  const base = {
    sourceKind: "planetary_computer",
    sourceUrl: "https://x/scene/abc",
    contentBytes: 100,
    license: "CC-BY",
  };
  const otherKind = shaForArtifact({ ...base, sourceKind: "mlit_landuse_mesh" });
  const otherUrl = shaForArtifact({ ...base, sourceUrl: "https://x/scene/def" });
  const otherBytes = shaForArtifact({ ...base, contentBytes: 200 });
  const baseHash = shaForArtifact(base);
  assert.notEqual(otherKind, baseHash);
  assert.notEqual(otherUrl, baseHash);
  assert.notEqual(otherBytes, baseHash);
});
