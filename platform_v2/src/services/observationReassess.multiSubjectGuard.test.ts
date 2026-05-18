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

test("multi-subject guard drops unhelpful unidentified labels without a scientific name", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "植栽低木",
    primaryScientificName: "",
    coexistingTaxa: [
      { name: "他の植栽（未同定）", scientific_name: "", rank: "lifeform", confidence: 0.6 },
      { name: "アメリカシャクナゲ", scientific_name: "Kalmia latifolia", rank: "species", confidence: 0.52 },
    ],
    candidateReadings: [
      { name: "構成種：複数の低木（未同定）", scientific_name: "", rank: "lifeform", role: "背景の木本" },
      { name: "ツツジ類", scientific_name: "Rhododendron", rank: "genus", role: "比較候補" },
    ],
  });

  assert.equal(result.promoted, 1);
  assert.deepEqual(result.candidates.map((candidate) => candidate.name), ["アメリカシャクナゲ", "ツツジ類"]);
});

test("multi-subject guard enriches known Japanese taxon names before materialization", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "植栽低木",
    primaryScientificName: "",
    coexistingTaxa: [
      { name: "トウネズミモチ", scientific_name: "", rank: "lifeform", confidence: 0.45 },
    ],
    candidateReadings: [
      { name: "トベラ", scientific_name: "", rank: "lifeform", role: "比較候補" },
    ],
  });

  assert.equal(result.promoted, 1);
  assert.deepEqual(result.candidates.map((candidate) => [candidate.name, candidate.scientific_name, candidate.rank]), [
    ["トウネズミモチ", "Ligustrum lucidum", "species"],
    ["トベラ", "Pittosporum tobira", "species"],
  ]);
});

test("multi-subject guard enriches berry record candidates before materialization", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "果実",
    primaryScientificName: "",
    candidateReadings: [
      { name: "ナワシロイチゴ", scientific_name: "", rank: "lifeform", role: "赤い集合果" },
      { name: "アカメガシワ", scientific_name: "", rank: "lifeform", role: "周囲の木本" },
      { name: "カタバミ属", scientific_name: "", rank: "lifeform", role: "足元の草本" },
    ],
  });

  assert.equal(result.promoted, 3);
  assert.deepEqual(result.candidates.map((candidate) => [candidate.name, candidate.scientific_name, candidate.rank]), [
    ["ナワシロイチゴ", "Rubus parvifolius", "species"],
    ["アカメガシワ", "Mallotus japonicus", "species"],
    ["カタバミ属", "Oxalis", "genus"],
  ]);
});
