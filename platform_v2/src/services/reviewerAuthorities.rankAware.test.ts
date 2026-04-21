import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesAuthorityScope } from "./reviewerAuthorities.js";
import type { ReviewerAuthoritySnapshot } from "./reviewerAuthorities.js";

function snapshot(overrides: Partial<ReviewerAuthoritySnapshot> = {}): ReviewerAuthoritySnapshot {
  return {
    authorityId: "auth-1",
    authorityKind: "taxon_identification",
    scopeTaxonName: "Pieris",
    scopeTaxonRank: "genus",
    scopeTaxonKey: null,
    scopeJson: {},
    grantedAt: new Date().toISOString(),
    expiresAt: null,
    reason: null,
    evidence: [],
    ...overrides,
  };
}

test("rank-aware: genus-scoped authority matches species within genus", () => {
  const authority = snapshot();
  assert.equal(matchesAuthorityScope(authority, ["Pieris rapae"], "species"), true);
});

test("rank-aware: genus-scoped authority matches the genus itself", () => {
  const authority = snapshot();
  assert.equal(matchesAuthorityScope(authority, ["Pieris"], "genus"), true);
});

test("rank-aware: genus-scoped authority refuses family-level proposal", () => {
  const authority = snapshot();
  assert.equal(matchesAuthorityScope(authority, ["Pieridae"], "family"), false);
});

test("rank-aware: species-scoped authority refuses different species", () => {
  const authority = snapshot({
    scopeTaxonName: "Anas platyrhynchos",
    scopeTaxonRank: "species",
  });
  assert.equal(
    matchesAuthorityScope(authority, ["Anas zonorhyncha"], "species"),
    false,
  );
});

test("rank-aware: species-scoped authority matches its own subspecies", () => {
  const authority = snapshot({
    scopeTaxonName: "Anas platyrhynchos",
    scopeTaxonRank: "species",
  });
  assert.equal(
    matchesAuthorityScope(authority, ["Anas platyrhynchos platyrhynchos"], "subspecies"),
    true,
  );
});

test("compat: authority without scope_taxon_rank falls back to name-only match", () => {
  const authority = snapshot({ scopeTaxonRank: null });
  // Old behaviour: the name-based match still succeeds even at family rank.
  assert.equal(matchesAuthorityScope(authority, ["Pieris rapae"], "species"), true);
  assert.equal(matchesAuthorityScope(authority, ["Pieris"], "family"), true);
});

test("compat: call sites that do not pass proposedRank keep old behaviour", () => {
  const authority = snapshot();
  // No rank argument → falls back to name-only matching like before.
  assert.equal(matchesAuthorityScope(authority, ["Pieris rapae"]), true);
});

test("rank-aware: unknown rank string is treated as finest (species-equivalent) for compat safety", () => {
  const authority = snapshot();
  // "variety" is not in our canonical set; normalizeRank returns null so the
  // rank gate is skipped — behaviour reverts to name-based match.
  assert.equal(matchesAuthorityScope(authority, ["Pieris rapae"], "variety"), true);
});
