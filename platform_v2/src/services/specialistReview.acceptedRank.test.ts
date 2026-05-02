import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAcceptedRank } from "./specialistReview.js";

test("non-approve decisions never accept a rank", () => {
  assert.equal(
    decideAcceptedRank({
      decision: "reject",
      proposedName: "Pieris rapae",
      proposedRank: "species",
      reviewClass: "authority_backed",
      ceilingRank: "genus",
    }),
    null,
  );
  assert.equal(
    decideAcceptedRank({
      decision: "note",
      proposedName: "Pieris rapae",
      proposedRank: "species",
      reviewClass: "authority_backed",
      ceilingRank: "genus",
    }),
    null,
  );
});

test("authority-backed approve uses the proposed rank verbatim", () => {
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris rapae",
      proposedRank: "species",
      reviewClass: "authority_backed",
      ceilingRank: "genus",
    }),
    "species",
  );
});

test("admin-override approve uses the proposed rank verbatim", () => {
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris",
      proposedRank: "genus",
      reviewClass: "admin_override",
      ceilingRank: "family",
    }),
    "genus",
  );
});

test("plain-review approve accepts proposal at or coarser than ceiling", () => {
  // Genus proposal under genus ceiling — accepted
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris",
      proposedRank: "genus",
      reviewClass: "plain_review",
      ceilingRank: "genus",
    }),
    "genus",
  );
  // Family proposal under genus ceiling — accepted (coarser)
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieridae",
      proposedRank: "family",
      reviewClass: "plain_review",
      ceilingRank: "genus",
    }),
    "family",
  );
});

test("plain-review approve refuses proposal finer than ceiling", () => {
  // Species proposal under genus ceiling — rejected
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris rapae",
      proposedRank: "species",
      reviewClass: "plain_review",
      ceilingRank: "genus",
    }),
    null,
  );
});

test("plain-review approve accepts species when ceiling is species (bird-like exception)", () => {
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Anas platyrhynchos",
      proposedRank: "species",
      reviewClass: "plain_review",
      ceilingRank: "species",
    }),
    "species",
  );
});

test("missing proposed rank or name blocks accepted_rank", () => {
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: null,
      proposedRank: "species",
      reviewClass: "authority_backed",
      ceilingRank: "species",
    }),
    null,
  );
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris rapae",
      proposedRank: null,
      reviewClass: "authority_backed",
      ceilingRank: "species",
    }),
    null,
  );
  assert.equal(
    decideAcceptedRank({
      decision: "approve",
      proposedName: "Pieris rapae",
      proposedRank: "not-a-rank",
      reviewClass: "authority_backed",
      ceilingRank: "species",
    }),
    null,
  );
});
