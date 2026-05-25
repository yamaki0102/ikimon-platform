import assert from "node:assert/strict";
import test from "node:test";
import { applyTaxonomicRankGuardrail, promoteCandidateReadingsToCoexistingTaxa } from "./observationReassess.js";

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

test("multi-subject guard drops unhelpful unidentified labels and same-subject comparisons", () => {
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

  assert.equal(result.promoted, 0);
  assert.deepEqual(result.candidates.map((candidate) => candidate.name), ["アメリカシャクナゲ"]);
});

test("multi-subject guard keeps scene descriptions out of persisted subject candidates", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "ガジュマル",
    primaryScientificName: "Ficus microcarpa",
    coexistingTaxa: [
      { name: "城壁と周辺植生", scientific_name: "", rank: "lifeform", confidence: 0.7 },
      { name: "石垣・城壁の植生", scientific_name: "", rank: "lifeform", confidence: 0.7 },
      { name: "カタバミ属", scientific_name: "Oxalis", rank: "genus", confidence: 0.52 },
    ],
    candidateReadings: [
      { name: "人工構造物と植栽景観", scientific_name: "", rank: "lifeform", role: "背景の植生" },
      { name: "シロツメクサ", scientific_name: "Trifolium repens", rank: "species", role: "足元の草本" },
    ],
  });

  assert.equal(result.promoted, 1);
  assert.deepEqual(result.candidates.map((candidate) => candidate.name), ["カタバミ属", "シロツメクサ"]);
});

test("multi-subject guard enriches known Japanese taxon names only for separate subjects", () => {
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

  assert.equal(result.promoted, 0);
  assert.deepEqual(result.candidates.map((candidate) => [candidate.name, candidate.scientific_name, candidate.rank]), [
    ["トウネズミモチ", "Ligustrum lucidum", "species"],
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

  assert.equal(result.promoted, 2);
  assert.deepEqual(result.candidates.map((candidate) => [candidate.name, candidate.scientific_name, candidate.rank]), [
    ["アカメガシワ", "Mallotus japonicus", "species"],
    ["カタバミ属", "Oxalis", "genus"],
  ]);
});

test("multi-subject guard does not turn same-subject millipede alternatives into extra records", () => {
  const result = promoteCandidateReadingsToCoexistingTaxa({
    primaryVernacularName: "倍脚綱 (ヤスデ綱)",
    primaryScientificName: "Diplopoda",
    candidateReadings: [
      { name: "倍脚綱 (ヤスデ綱)", scientific_name: "Diplopoda", rank: "class", role: "代表候補" },
      { name: "オビヤスデ目の一種", scientific_name: "Polydesmida", rank: "order", role: "比較候補" },
      { name: "クシヤスデ目などの細長いヤスデ", scientific_name: "", rank: "order", role: "分類候補" },
    ],
  });

  assert.equal(result.promoted, 0);
  assert.deepEqual(result.candidates, []);
});

test("taxonomic rank guard downgrades close species candidates to genus", () => {
  const result = applyTaxonomicRankGuardrail({
    recommendedName: "ユウマダラエダシャク",
    recommendedScientificName: "Abraxas miranda",
    rank: "species",
    confidenceBand: "medium",
    parsed: {
      taxonomic_candidates: [
        { taxon_name: "ユウマダラエダシャク", scientific_name: "Abraxas miranda", rank: "species", probability: 0.45 },
        { taxon_name: "ウメエダシャク", scientific_name: "Abraxas grossulariata", rank: "species", probability: 0.35 },
        { taxon_name: "キハラゴマダラヒトリ", scientific_name: "Spilosoma lubricipeda", rank: "species", probability: 0.05 },
      ],
      diagnostic_features_missing: ["前翅基部の斑紋境界"],
      confusable_groups: [{ group_name: "ヒトリガ亜科", distinction_point: "静止姿勢と胸部毛束" }],
    },
  });

  assert.equal(result.downgraded, true);
  assert.equal(result.rank, "genus");
  assert.equal(result.recommendedScientificName, "Abraxas");
  assert.equal(result.recommendedName, "Abraxas属の一種");
});

test("taxonomic rank guard downgrades close cross-genus candidates to order", () => {
  const result = applyTaxonomicRankGuardrail({
    recommendedName: "ユウマダラエダシャク",
    recommendedScientificName: "Abraxas miranda",
    rank: "species",
    confidenceBand: "medium",
    parsed: {
      taxonomic_candidates: [
        { taxon_name: "ユウマダラエダシャク", scientific_name: "Abraxas miranda", rank: "species", probability: 0.45 },
        { taxon_name: "キハラゴマダラヒトリ", scientific_name: "Spilosoma lubricipeda", rank: "species", probability: 0.39 },
      ],
      diagnostic_features_missing: ["胸部の毛束と静止姿勢の確認が不足"],
      confusable_groups: [{ group_name: "ヒトリガ亜科", distinction_point: "静止姿勢と胸部毛束" }],
    },
  });

  assert.equal(result.downgraded, true);
  assert.equal(result.rank, "order");
  assert.equal(result.recommendedScientificName, "Lepidoptera");
  assert.equal(result.recommendedName, "チョウ目の一種");
});

test("taxonomic rank guard keeps species when decisive features are present", () => {
  const result = applyTaxonomicRankGuardrail({
    recommendedName: "ナワシロイチゴ",
    recommendedScientificName: "Rubus parvifolius",
    rank: "species",
    confidenceBand: "high",
    parsed: {
      taxonomic_candidates: [
        { taxon_name: "ナワシロイチゴ", scientific_name: "Rubus parvifolius", rank: "species", probability: 0.89 },
        { taxon_name: "キイチゴ属", scientific_name: "Rubus", rank: "genus", probability: 0.12 },
      ],
      diagnostic_features_observed: ["赤い集合果", "低く這う枝"],
      diagnostic_features_missing: [],
      visual_contradictions: [],
    },
  });

  assert.equal(result.downgraded, false);
  assert.equal(result.rank, "species");
  assert.equal(result.recommendedScientificName, "Rubus parvifolius");
});
