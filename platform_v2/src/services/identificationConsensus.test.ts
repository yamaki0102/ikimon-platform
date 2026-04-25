import assert from "node:assert/strict";
import test from "node:test";
import { computeIdentificationConsensus } from "./identificationConsensus.js";
import type { GbifMatch } from "./gbifBackboneMatch.js";

function match(overrides: Partial<GbifMatch>): GbifMatch {
  return {
    usageKey: 1,
    acceptedUsageKey: 1,
    canonicalName: "Pieris rapae",
    rank: "SPECIES",
    status: "ACCEPTED",
    matchType: "EXACT",
    confidence: 99,
    kingdom: "Animalia",
    phylum: "Arthropoda",
    className: "Insecta",
    orderName: "Lepidoptera",
    family: "Pieridae",
    genus: "Pieris",
    species: "Pieris rapae",
    fromCache: true,
    ...overrides,
  };
}

const rapae = match({ canonicalName: "Pieris rapae", species: "Pieris rapae" });
const napi = match({ usageKey: 2, acceptedUsageKey: 2, canonicalName: "Pieris napi", species: "Pieris napi" });

test("same user re-identification keeps only the latest vote", () => {
  const result = computeIdentificationConsensus({
    identifications: [
      { actorUserId: "u1", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-01", gbifMatch: rapae },
      { actorUserId: "u1", proposedName: "Pieris napi", proposedRank: "species", createdAt: "2026-04-03", gbifMatch: napi },
      { actorUserId: "u2", proposedName: "Pieris napi", proposedRank: "species", createdAt: "2026-04-02", gbifMatch: napi },
    ],
    hasMedia: true,
    precisionCeilingRank: "species",
  });

  assert.equal(result.activeIdentificationCount, 2);
  assert.equal(result.communityTaxon?.name, "Pieris napi");
  assert.equal(result.communityTaxon?.rank, "species");
});

test("two independent same-species IDs with media can become a Tier 3 candidate when policy allows species", () => {
  const result = computeIdentificationConsensus({
    identifications: [
      { actorUserId: "u1", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-01", gbifMatch: rapae },
      { actorUserId: "u2", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-02", gbifMatch: rapae },
    ],
    hasMedia: true,
    precisionCeilingRank: "species",
  });

  assert.equal(result.communityTaxon?.rank, "species");
  assert.equal(result.canPromoteToTier3, true);
  assert.equal(result.identificationVerificationStatus, "community_consensus");
});

test("near-species split rolls consensus up to genus instead of species", () => {
  const result = computeIdentificationConsensus({
    identifications: [
      { actorUserId: "u1", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-01", gbifMatch: rapae },
      { actorUserId: "u2", proposedName: "Pieris napi", proposedRank: "species", createdAt: "2026-04-02", gbifMatch: napi },
    ],
    hasMedia: true,
    precisionCeilingRank: "genus",
  });

  assert.equal(result.communityTaxon?.name, "Pieris");
  assert.equal(result.communityTaxon?.rank, "genus");
  assert.notEqual(result.communityTaxon?.rank, "species");
});

test("open dispute blocks Tier 3 promotion", () => {
  const result = computeIdentificationConsensus({
    identifications: [
      { actorUserId: "u1", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-01", gbifMatch: rapae },
      { actorUserId: "u2", proposedName: "Pieris rapae", proposedRank: "species", createdAt: "2026-04-02", gbifMatch: rapae },
    ],
    disputes: [{ kind: "alternative_id", proposedName: "Pieris napi", status: "open" }],
    hasMedia: true,
    precisionCeilingRank: "species",
  });

  assert.equal(result.hasOpenDispute, true);
  assert.equal(result.canPromoteToTier3, false);
  assert.equal(result.consensusStatus, "open_dispute");
});

test("authority-backed public claim can promote with one reviewer when media and taxonomy are valid", () => {
  const result = computeIdentificationConsensus({
    identifications: [
      {
        actorUserId: "expert1",
        proposedName: "Pieris rapae",
        proposedRank: "species",
        createdAt: "2026-04-01",
        gbifMatch: rapae,
        sourcePayload: { lane: "public-claim", reviewClass: "authority_backed" },
      },
    ],
    hasMedia: true,
  });

  assert.equal(result.hasAuthorityBackedPublicClaim, true);
  assert.equal(result.canPromoteToTier3, true);
  assert.equal(result.identificationVerificationStatus, "authority_reviewed");
});

test("GBIF match failure blocks Tier 3 promotion", () => {
  const failed = match({
    usageKey: null,
    acceptedUsageKey: null,
    canonicalName: null,
    matchType: "NONE",
    confidence: null,
    kingdom: null,
    phylum: null,
    className: null,
    orderName: null,
    family: null,
    genus: null,
    species: null,
  });
  const result = computeIdentificationConsensus({
    identifications: [
      { actorUserId: "u1", proposedName: "Unknownus invalidus", proposedRank: "species", createdAt: "2026-04-01", gbifMatch: failed },
      { actorUserId: "u2", proposedName: "Unknownus invalidus", proposedRank: "species", createdAt: "2026-04-02", gbifMatch: failed },
    ],
    hasMedia: true,
    precisionCeilingRank: "species",
  });

  assert.equal(result.hasGbifMatchFailure, true);
  assert.equal(result.canPromoteToTier3, false);
  assert.equal(result.identificationVerificationStatus, "blocked_taxonomy_match");
});

