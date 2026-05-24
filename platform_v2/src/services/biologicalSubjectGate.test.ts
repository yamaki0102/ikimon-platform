import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBiologicalSubjectCandidate } from "./biologicalSubjectGate.js";

test("normalizeBiologicalSubjectCandidate rejects scene and built-structure labels", () => {
  assert.equal(
    normalizeBiologicalSubjectCandidate({
      vernacularName: "城壁と周辺植生",
      scientificName: "石垣・城壁の植生",
    }),
    null,
  );
  assert.equal(
    normalizeBiologicalSubjectCandidate({
      vernacularName: "人工構造物と植栽景観",
      scientificName: "",
    }),
    null,
  );
});

test("normalizeBiologicalSubjectCandidate preserves taxon labels", () => {
  assert.deepEqual(
    normalizeBiologicalSubjectCandidate({
      vernacularName: "シロツメクサ",
      scientificName: "Trifolium repens",
    }),
    { vernacularName: "シロツメクサ", scientificName: "Trifolium repens" },
  );
  assert.deepEqual(
    normalizeBiologicalSubjectCandidate({
      vernacularName: "イネ科植物",
      scientificName: "",
    }),
    { vernacularName: "イネ科植物", scientificName: null },
  );
});

