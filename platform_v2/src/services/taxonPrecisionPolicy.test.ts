import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COARSE_CEILING,
  buildAncestryChain,
  getCoarseCeilingForAncestry,
  isProposalWithinCommunityCeiling,
  listPrecisionPolicyEntries,
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

test("static precision policy keeps seeded exceptions without PostgreSQL", async () => {
  assert.equal(await getCoarseCeilingForAncestry(["Animalia", "Aves"]), "species");
  assert.equal(await getCoarseCeilingForAncestry(["Fungi", "Amanita"]), "family");
  assert.equal(await getCoarseCeilingForAncestry(["Plantae", "Trifolium"]), DEFAULT_COARSE_CEILING);

  const entries = await listPrecisionPolicyEntries();
  assert.equal(entries.some((entry) => entry.taxonKey === "Aves" && entry.coarseCeilingRank === "species"), true);
  assert.equal(entries.some((entry) => entry.taxonKey === "Fungi" && entry.coarseCeilingRank === "family"), true);
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
