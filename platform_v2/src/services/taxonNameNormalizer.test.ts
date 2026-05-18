import assert from "node:assert/strict";
import test from "node:test";
import { lookupLocalTaxonName } from "./taxonNameNormalizer.js";

test("local taxon dictionary fills scientific names for current AI candidate gaps", () => {
  assert.deepEqual(lookupLocalTaxonName("トウネズミモチ"), {
    vernacularName: "トウネズミモチ",
    scientificName: "Ligustrum lucidum",
    rank: "species",
    source: "local_dictionary",
  });
  assert.equal(lookupLocalTaxonName("トベラ")?.scientificName, "Pittosporum tobira");
  assert.equal(lookupLocalTaxonName("カワラヒワ")?.scientificName, "Chloris sinica");
  assert.equal(lookupLocalTaxonName("ナワシロイチゴ")?.scientificName, "Rubus parvifolius");
  assert.equal(lookupLocalTaxonName("アカメガシワ")?.scientificName, "Mallotus japonicus");
  assert.deepEqual(lookupLocalTaxonName("カタバミ属"), {
    vernacularName: "カタバミ属",
    scientificName: "Oxalis",
    rank: "genus",
    source: "local_dictionary",
  });
  assert.equal(lookupLocalTaxonName("イネ科")?.rank, "family");
});

test("local taxon dictionary ignores non-taxon generic labels", () => {
  assert.equal(lookupLocalTaxonName("未同定の植栽低木"), null);
  assert.equal(lookupLocalTaxonName("構成種：複数の低木（未同定）"), null);
});
