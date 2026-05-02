import assert from "node:assert/strict";
import test from "node:test";
import { generateNarrative, type NarrativeGenerator } from "./relationshipScoreNarrative.js";
import { calculateRelationshipScore, type RelationshipScoreInputs } from "./relationshipScore.js";

function inputs(overrides: Partial<RelationshipScoreInputs> = {}): RelationshipScoreInputs {
  return {
    accessStatus: "public",
    safetyNotesPresent: true,
    visitsCount: 6,
    seasonsCovered: 2,
    repeatObserverCount: 1,
    notesCompletionRate: 0.4,
    identificationAttemptRate: 0.4,
    taxonRankDistinctCount: 3,
    reviewReplyCount: 0,
    stewardshipActionCount: 0, // Stewardship low to force focus
    stewardshipActionLinkedRate: 0,
    acceptedReviewRate: 0.2,
    effortCompletionRate: 0.2,
    auditTrailPresent: false,
    centerLatitude: 35.7,
    ...overrides,
  };
}

function generatorWithFixedOutputs(outputs: string[]): NarrativeGenerator {
  let i = 0;
  return async () => {
    const content = outputs[Math.min(i, outputs.length - 1)] ?? "";
    i += 1;
    return { content, inputTokens: 100, outputTokens: 50 };
  };
}

test("generateNarrative passes through valid LLM output", async () => {
  const score = calculateRelationshipScore(inputs());
  const fakeOutput = JSON.stringify({
    nextActionText: "管理作業と観察結果を同じ日誌に記録する",
    summaryCard: "この場所では小さな手入れの積み重ねが、観察計画につながっています。",
    seasonalNote: "春と夏で異なる姿の生きものが記録できています。",
  });
  const result = await generateNarrative(
    score,
    { lang: "ja", industry: "education" },
    { generator: generatorWithFixedOutputs([fakeOutput]) }
  );
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.validation.ok, true);
  assert.match(result.nextActionText, /管理作業/);
});

test("generateNarrative retries once when LLM emits forbidden term, then succeeds", async () => {
  const score = calculateRelationshipScore(inputs());
  const violating = JSON.stringify({
    nextActionText: "TNFD準拠を証明する活動を進める",
    summaryCard: "認証取得を目指しましょう",
    seasonalNote: "",
  });
  const valid = JSON.stringify({
    nextActionText: "管理作業と観察結果を同じ日誌に記録する",
    summaryCard: "観察と手入れの記録が並んでいます。",
    seasonalNote: "季節の移り変わりが見えています。",
  });
  const result = await generateNarrative(
    score,
    { lang: "ja", industry: "education" },
    { generator: generatorWithFixedOutputs([violating, valid]) }
  );
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.validation.ok, true);
  assert.doesNotMatch(result.nextActionText, /TNFD準拠/);
});

test("generateNarrative falls back to template when LLM keeps emitting forbidden terms", async () => {
  const score = calculateRelationshipScore(inputs());
  const violating1 = JSON.stringify({
    nextActionText: "TNFD準拠の認定を取る",
    summaryCard: "",
    seasonalNote: "",
  });
  const violating2 = JSON.stringify({
    nextActionText: "公式認証を目指して、生物多様性が改善した実績を作る",
    summaryCard: "",
    seasonalNote: "",
  });
  const result = await generateNarrative(
    score,
    { lang: "ja", industry: "education" },
    { generator: generatorWithFixedOutputs([violating1, violating2]) }
  );
  assert.equal(result.fallbackUsed, true);
  // Stewardship が最低軸 (0点) なので fallback は stewardship 用の固定文
  assert.match(result.nextActionText, /管理作業と観察結果/);
});

test("generateNarrative falls back when LLM throws", async () => {
  const score = calculateRelationshipScore(inputs());
  const result = await generateNarrative(
    score,
    { lang: "en", industry: "agriculture" },
    {
      generator: async () => {
        throw new Error("network down");
      },
    }
  );
  assert.equal(result.fallbackUsed, true);
  // 英語のフォールバック文
  assert.match(result.nextActionText, /Record management work/);
});

test("generateNarrative falls back when LLM returns malformed JSON", async () => {
  const score = calculateRelationshipScore(inputs());
  const result = await generateNarrative(
    score,
    { lang: "ja" },
    { generator: generatorWithFixedOutputs(["not a json", "still not json"]) }
  );
  assert.equal(result.fallbackUsed, true);
});

test("soft warnings are recorded but pass through", async () => {
  const score = calculateRelationshipScore(inputs());
  // "絶対に" が softWarnings の overstated_assertion にマッチ
  const output = JSON.stringify({
    nextActionText: "絶対に観察を継続する",
    summaryCard: "観察を続けます。",
    seasonalNote: "季節の変化が見えます。",
  });
  const result = await generateNarrative(
    score,
    { lang: "ja" },
    { generator: generatorWithFixedOutputs([output]) }
  );
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.validation.ok, true);
  assert.ok(result.validation.softWarnings.length > 0);
  assert.equal(result.validation.softWarnings[0]?.id, "overstated_assertion");
});
