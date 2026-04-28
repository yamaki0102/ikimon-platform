import assert from "node:assert/strict";
import test from "node:test";
import {
  hasSubjectInvasiveFact,
  pickSubjectInvasiveFact,
  type InvasiveStatusFact,
} from "./invasiveLookupHelpers.js";

function fact(overrides: Partial<InvasiveStatusFact> = {}): InvasiveStatusFact {
  return {
    versionId: "v1",
    scientificName: "Procyon lotor",
    regionScope: "JP",
    mhlwCategory: "iaspecified",
    sourceExcerpt: "MoE Japan invasive list snapshot",
    validFrom: "2023-01-01",
    appliesTo: "subject",
    matchedTerm: "Procyon lotor",
    ...overrides,
  };
}

test("hasSubjectInvasiveFact: true only with applies_to=subject and a real category", () => {
  assert.equal(hasSubjectInvasiveFact([]), false);
  assert.equal(hasSubjectInvasiveFact([fact({ appliesTo: "coexisting" })]), false);
  assert.equal(hasSubjectInvasiveFact([fact({ mhlwCategory: "none" })]), false);
  assert.equal(hasSubjectInvasiveFact([fact()]), true);
});

test("pickSubjectInvasiveFact: prefers species (binomial) match", () => {
  const facts = [
    fact({ matchedTerm: "Procyonidae", scientificName: "Procyonidae", versionId: "v-fam" }),
    fact({ matchedTerm: "Procyon lotor", scientificName: "Procyon lotor", versionId: "v-sp" }),
  ];
  const picked = pickSubjectInvasiveFact(facts);
  assert.ok(picked);
  assert.equal(picked!.versionId, "v-sp");
});

test("pickSubjectInvasiveFact: returns null when no subject fact", () => {
  assert.equal(pickSubjectInvasiveFact([]), null);
  assert.equal(pickSubjectInvasiveFact([fact({ appliesTo: "coexisting" })]), null);
});
