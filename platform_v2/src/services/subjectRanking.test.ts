import assert from "node:assert/strict";
import test from "node:test";
import { rankVisitSubjects, type SubjectRankInput } from "./subjectRanking.js";

function subject(overrides: Partial<SubjectRankInput>): SubjectRankInput {
  return {
    occurrenceId: "occ-1",
    subjectIndex: 0,
    displayName: "同定待ち",
    scientificName: null,
    rank: null,
    roleHint: "primary",
    confidence: null,
    identificationCount: 0,
    latestAssessmentBand: null,
    isPrimary: true,
    ...overrides,
  };
}

test("rankVisitSubjects prefers named taxa over unresolved primary placeholders", () => {
  const ranked = rankVisitSubjects([
    subject({
      occurrenceId: "primary",
      displayName: "同定待ち",
      latestAssessmentBand: "high",
      isPrimary: true,
    }),
    subject({
      occurrenceId: "named",
      subjectIndex: 1,
      displayName: "シロツメクサ",
      rank: "species",
      roleHint: "coexisting",
      isPrimary: false,
    }),
  ]);

  assert.equal(ranked[0]?.occurrenceId, "named");
});

test("rankVisitSubjects does not feature scene descriptions ahead of taxa", () => {
  const ranked = rankVisitSubjects([
    subject({
      occurrenceId: "scene",
      displayName: "城壁と周辺植生",
      latestAssessmentBand: "medium",
      isPrimary: true,
    }),
    subject({
      occurrenceId: "taxon",
      subjectIndex: 1,
      displayName: "ガジュマル",
      rank: "species",
      roleHint: "coexisting",
      isPrimary: false,
    }),
  ]);

  assert.equal(ranked[0]?.occurrenceId, "taxon");
});
