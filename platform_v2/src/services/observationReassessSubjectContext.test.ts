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
  assert.match(prompt, /全候補を同じ情報モデル/);
  assert.match(prompt, /candidate_readings[\s\S]*size_assessment/);
  assert.match(prompt, /候補ごとの `observed_size_estimate_cm` も null/);
  assert.match(prompt, /候補ごとに\*\*その分類群でなければ意味が薄い特徴\*\*/);
  assert.match(prompt, /ツルニチニチソウなら/);
  assert.match(prompt, /草本|イネ科|植栽|花|樹木/);
  assert.match(prompt, /黄色い腹部だけで `キハラゴマダラヒトリ`/);
  assert.match(prompt, /`ユウマダラエダシャク` \/ `Abraxas miranda`/);
  assert.match(prompt, /前脚付け根の色や細かい点状斑/);
  assert.match(prompt, /coexisting_taxa/);
  assert.match(service, /observation_reassess\.md\/v5\.5/);
  assert.match(service, /candidateReading: primaryCandidateReading \?\? null/);
  assert.match(service, /candidateReading: candidate\.candidateReading \?\? null/);
});

test("visual reassess keeps Lite-first behind an environment-aware escalation gate", () => {
  const service = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");

  assert.match(service, /AI_OBSERVATION_VISUAL_LITE_FIRST/);
  assert.match(service, /runVisualExtractWithOptionalLiteFirst/);
  assert.match(service, /visualExtractEscalationReasons/);
  assert.match(service, /non_biological_in_coexisting_taxa/);
  assert.match(service, /environment_context_sparse/);
  assert.match(service, /visualLiteFirstEscalationReasons/);
});

test("visual extract prompt separates biological coexisting taxa from environment context", () => {
  const service = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");

  assert.match(service, /非生物は coexisting_taxa に入れず/);
  assert.match(service, /area_inference は写真から読める植生構造/);
  assert.match(service, /環境文脈を捨てない/);
  assert.match(service, /area_inference \/ management_action_candidates に環境・場・人為管理/);
});

test("visual reassess can downscale stored photos before Gemini behind an env gate", () => {
  const service = readFileSync(new URL("./observationReassess.ts", import.meta.url), "utf8");

  assert.match(service, /import sharp from "sharp"/);
  assert.match(service, /AI_OBSERVATION_IMAGE_MAX_EDGE/);
  assert.match(service, /preparePhotoBytesForGemini/);
  assert.match(service, /resize\(\{ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true \}\)/);
  assert.match(service, /mime: "image\/jpeg"/);
});

test("reassess JSON schema avoids concrete taxon examples that can leak into output", () => {
  const prompt = readFileSync(new URL("../prompts/observation_reassess.md", import.meta.url), "utf8");
  const schema = prompt.slice(prompt.indexOf("## 出力 JSON スキーマ"));

  assert.match(schema, /形式だけのスキーマ/);
  assert.match(schema, /placeholder/);
  assert.doesNotMatch(schema, /カラスノエンドウ|Vicia sativa/i);
  assert.doesNotMatch(schema, /ヒメイワダレソウ|Phyla nodiflora/i);
  assert.doesNotMatch(schema, /セイヨウミツバチ|Apis mellifera/i);
  assert.doesNotMatch(schema, /ヒメスミレ|Viola inconspicua/i);
});
