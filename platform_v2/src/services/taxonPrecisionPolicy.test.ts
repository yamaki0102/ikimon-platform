import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COARSE_CEILING,
  buildAncestryChain,
  isProposalWithinCommunityCeiling,
} from "./taxonPrecisionPolicy.js";

test("default coarse ceiling is genus", () => {
  assert.equal(DEFAULT_COARSE_CEILING, "genus");
});

test("buildAncestryChain skips blanks in order", () => {
  const chain = buildAncestryChain({
    kingdom: "Animalia",
    phylum: null,
    className: "Aves",
    orderName: "",
    family: "Anatidae",
    genus: "Anas",
    species: "Anas platyrhynchos",
  });
  assert.deepEqual(chain, ["Animalia", "Aves", "Anatidae", "Anas", "Anas platyrhynchos"]);
});

test("buildAncestryChain returns empty when nothing is provided", () => {
  assert.deepEqual(
    buildAncestryChain({ kingdom: null, phylum: null, className: null }),
    [],
  );
});

test("isProposalWithinCommunityCeiling allows coarser and equal proposals", () => {
  assert.equal(isProposalWithinCommunityCeiling("genus", "genus"), true);
  assert.equal(isProposalWithinCommunityCeiling("family", "genus"), true);
  assert.equal(isProposalWithinCommunityCeiling("kingdom", "species"), true);
});

test("isProposalWithinCommunityCeiling refuses proposals finer than the ceiling", () => {
  assert.equal(isProposalWithinCommunityCeiling("species", "genus"), false);
  assert.equal(isProposalWithinCommunityCeiling("subspecies", "species"), false);
});
