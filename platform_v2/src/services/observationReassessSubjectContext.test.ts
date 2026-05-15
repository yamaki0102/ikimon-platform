import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { summarizeObservationPackageForPrompt, type ObservationPackage } from "./observationPackage.js";

test("observation package summary carries existing subject candidates into reassess prompts", () => {
  const pkg = {
    packageId: "pkg-1",
    visit: {
      visitId: "record-1",
      observedPrefecture: "静岡県",
      observedMunicipality: "浜松市",
    },
    occurrences: [
      {
        occurrenceId: "occ-1",
        visitId: "record-1",
        scientificName: null,
        vernacularName: null,
        priorAiName: "ヒメイワダレソウ",
        priorAiRank: "species",
        taxonRank: null,
        confidenceScore: null,
        evidenceTier: null,
        qualityGrade: null,
        riskLane: "normal",
        safePublicRank: "species",
        sourcePayload: {},
      },
      {
        occurrenceId: "occ-2",
        visitId: "record-1",
        scientificName: "Apis mellifera",
        vernacularName: "セイヨウミツバチ",
        taxonRank: "species",
        confidenceScore: 0.9,
        evidenceTier: null,
        qualityGrade: null,
        riskLane: "normal",
        safePublicRank: "species",
        sourcePayload: {},
      },
    ],
    evidenceAssets: [],
    feedbackPayload: null,
    reviewState: { reviewStatus: "machine_only" },
  } as unknown as ObservationPackage;

  const summary = summarizeObservationPackageForPrompt(pkg);

  assert.match(summary, /observed_subjects=/);
  assert.match(summary, /1:ヒメイワダレソウ \(species\)/);
  assert.match(summary, /2:セイヨウミツバチ \(species confidence=0\.9\)/);
});

test("reassess prompt treats observed subjects as candidate reading targets", () => {
  const prompt = readFileSync(new URL("../prompts/observation_reassess.md", import.meta.url), "utf8");
  const service = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");

  assert.match(prompt, /observed_subjects/);
  assert.match(prompt, /candidate_readings.*observed_subjects/s);
  assert.match(prompt, /`observed_subjects` に 4 件あれば原則 4 件/);
  assert.match(prompt, /候補ごとに\*\*その分類群でなければ意味が薄い特徴\*\*/);
  assert.match(prompt, /ツルニチニチソウなら/);
  assert.match(service, /observation_reassess\.md\/v5\.3/);
});
