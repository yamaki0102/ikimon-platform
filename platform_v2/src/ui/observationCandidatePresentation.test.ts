import test from "node:test";
import assert from "node:assert/strict";
import {
  candidateHasVisibleRegion,
  countProminentAiCandidates,
  isProminentAiCandidate,
  rankProminentAiCandidates,
  type AiCandidateForPresentation,
} from "./observationCandidatePresentation.js";

function candidate(input: Partial<AiCandidateForPresentation>): AiCandidateForPresentation {
  return {
    suggestedOccurrenceId: null,
    candidateStatus: "proposed",
    confidence: null,
    regions: [],
    ...input,
  };
}

test("prominent candidates include strong coexisting taxa even when media region is missing", () => {
  const bee = candidate({ confidence: 0.9, regions: [] });

  assert.equal(isProminentAiCandidate(bee), true);
});

test("weak candidates need visible region evidence before surfacing in the hero", () => {
  const weakNoRegion = candidate({ confidence: 0.42, regions: [] });
  const weakWithRegion = candidate({
    confidence: 0.42,
    regions: [{ rect: { x: 0.1, y: 0.2, width: 0.2, height: 0.2 }, confidenceScore: 0.55 }],
  });

  assert.equal(isProminentAiCandidate(weakNoRegion), false);
  assert.equal(candidateHasVisibleRegion(weakWithRegion), true);
  assert.equal(isProminentAiCandidate(weakWithRegion), true);
});

test("already adopted candidates do not remain in the prominent action list", () => {
  const adopted = candidate({ suggestedOccurrenceId: "occ:record:1", confidence: 0.96 });

  assert.equal(isProminentAiCandidate(adopted), false);
  assert.equal(countProminentAiCandidates([adopted]), 0);
});

test("prominent candidates are ordered by confidence and visible-region support", () => {
  const insects = [
    candidate({ confidence: 0.73, regions: [] }),
    candidate({ confidence: 0.68, regions: [{ rect: { x: 0, y: 0, width: 0.1, height: 0.1 }, confidenceScore: 0.8 }] }),
    candidate({ confidence: 0.9, regions: [] }),
  ];

  const ranked = rankProminentAiCandidates(insects, 2);

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0]?.confidence, 0.9);
  assert.equal(ranked[1]?.confidence, 0.68);
});
