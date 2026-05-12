import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { shouldMaterializeAiJudgement } from "./aiJudgementObservationRecords.js";

test("AI judgement materialization keeps biological record candidates only", () => {
  assert.equal(shouldMaterializeAiJudgement({
    vernacularName: "ヒメイワダレソウ",
    taxonRank: "species",
    confidence: 0.82,
  }), true);
  assert.equal(shouldMaterializeAiJudgement({
    vernacularName: "草地の植生",
    taxonRank: "lifeform",
    confidence: 0.55,
  }), true);
  assert.equal(shouldMaterializeAiJudgement({
    vernacularName: "草刈り跡",
    taxonRank: "management",
    confidence: 0.9,
  }), false);
  assert.equal(shouldMaterializeAiJudgement({
    vernacularName: "低信頼の候補",
    taxonRank: "species",
    confidence: 0.31,
  }), false);
});

test("AI judgement materialization writes the lowest trust occurrence state", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "aiJudgementObservationRecords.ts"), "utf8");

  assert.match(source, /ai_assessment_status[^]*'ai_judgement'/);
  assert.match(source, /data_quality[^]*'ai_only_unreviewed'/);
  assert.match(source, /quality_grade[^]*'ai_judgement'/);
  assert.match(source, /evidence_tier[^]*0\.5/);
  assert.match(source, /HumanObservation/);
  assert.match(source, /ai_judgement_candidate_key/);
});

test("AI judgement review records agree/disagree/later and only agree creates an identification", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationRecordAiReview.ts"), "utf8");

  assert.match(source, /review_state/);
  assert.match(source, /value !== "agree" && value !== "disagree" && value !== "later"/);
  assert.match(source, /not_ai_judgement_record/);
  assert.match(source, /identification_method[^]*ai_judgement_agree/);
});
