import assert from "node:assert/strict";
import test from "node:test";
import { promoteCandidateReadingsToCoexistingTaxa } from "./observationReassess.js";

test("multi-subject guard promotes non-primary candidate_readings into coexisting taxa", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "キイチゴ属",
    primaryScientificName: "Rubus",
    candidateReadings: [
      {
        name: "キイチゴ属",
        scientific_name: "Rubus",
        rank: "genus",
        role: "代表候補",
        visible_features: ["赤い集合果"],
      },
      {
        name: "常緑つる植物",
        scientific_name: "",
        rank: "lifeform",
        role: "背景の植生",
        visible_features: ["光沢のある常緑葉"],
        weak_points: ["花や果実が見えない"],
      },
      {
        name: "カタバミ類",
        scientific_name: "Oxalis",
        rank: "genus",
        role: "地表の草本",
        visible_features: ["三小葉の低い草"],
      },
    ],
  });

  assert.equal(result.promoted, 2);
  assert.deepEqual(result.candidates.map((candidate) => candidate.name), ["常緑つる植物", "カタバミ類"]);
});

test("multi-subject guard deduplicates existing coexisting taxa", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "キイチゴ属",
    primaryScientificName: "Rubus",
    coexistingTaxa: [
      { name: "カタバミ類", scientific_name: "Oxalis", rank: "genus", confidence: 0.5 },
    ],
    candidateReadings: [
      { name: "カタバミ類", scientific_name: "Oxalis", rank: "genus", role: "地表の草本" },
      { name: "常緑低木", scientific_name: "", rank: "lifeform", role: "背景の木本" },
    ],
  });

  assert.equal(result.promoted, 1);
  assert.deepEqual(result.candidates.map((candidate) => candidate.name), ["カタバミ類", "常緑低木"]);
});
