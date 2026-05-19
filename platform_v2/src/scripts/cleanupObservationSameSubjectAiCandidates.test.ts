import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteAiOnlyOccurrence,
  isSameSubjectAlternativeCandidate,
} from "./cleanupObservationSameSubjectAiCandidates.js";

test("same-subject millipede order alternatives without regions are cleanup targets", () => {
  assert.equal(isSameSubjectAlternativeCandidate({
    vernacularName: "オビヤスデ目の一種",
    taxonRank: "order",
    confidence: 0.45,
    note: "分類候補として残す",
    regionCount: 0,
    sourcePayload: {
      candidateReading: {
        role: "比較候補",
        note: "同じヤスデっぽい対象の候補",
      },
    },
  }), true);
});

test("separate visual subjects are not cleaned up as identification alternatives", () => {
  assert.equal(isSameSubjectAlternativeCandidate({
    vernacularName: "セイヨウミツバチ",
    taxonRank: "species",
    confidence: 0.72,
    note: "花に来た虫として一緒に写る別個体",
    regionCount: 1,
  }), false);
});

test("only untouched AI-only occurrences are deletable during cleanup", () => {
  assert.equal(canDeleteAiOnlyOccurrence({
    subjectIndex: 2,
    dataQuality: "ai_only_unreviewed",
    qualityGrade: "ai_judgement",
    aiAssessmentStatus: "ai_judgement",
    sourcePayload: { source: "ai_judgement_observation_record" },
    identificationCount: 0,
    reviewCount: 0,
    reactionCount: 0,
    evidenceAssetCount: 0,
  }), true);

  assert.equal(canDeleteAiOnlyOccurrence({
    subjectIndex: 2,
    dataQuality: "ai_only_unreviewed",
    qualityGrade: "ai_judgement",
    aiAssessmentStatus: "ai_judgement",
    sourcePayload: { source: "ai_judgement_observation_record" },
    identificationCount: 1,
    reviewCount: 0,
    reactionCount: 0,
    evidenceAssetCount: 0,
  }), false);
});
