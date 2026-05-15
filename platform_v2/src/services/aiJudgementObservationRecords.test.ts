import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { shouldMaterializeAiJudgement } from "./aiJudgementObservationRecords.js";
import { resolveAiJudgementIdentificationName } from "./observationRecordAiReview.js";

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

test("visible AI subject candidate migration backfills occurrence records", async () => {
  const migration = await readFile(path.join(process.cwd(), "db", "migrations", "0106_materialize_visible_ai_subject_candidates.sql"), "utf8");

  assert.match(migration, /observation_ai_subject_candidates/);
  assert.match(migration, /subject_media_regions/);
  assert.match(migration, /normalized_rect \? 'x'/);
  assert.match(migration, /confidence_score IS NULL OR c\.confidence_score >= 0\.5/);
  assert.match(migration, /'ai_judgement_observation_record'/);
  assert.match(migration, /suggested_occurrence_id = t\.occurrence_id/);
  assert.match(migration, /candidate_status = 'matched'/);
});

test("observation reassess records candidate materialization telemetry", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationReassess.ts"), "utf8");

  assert.match(source, /materializedCandidateRecordCount/);
  assert.match(source, /matchedCandidateRecordCount/);
  assert.match(source, /candidateOnlyCount/);
  assert.match(source, /aiSubjectRecordMaterialization/);
  assert.match(source, /proposalUiFallbackRiskCount/);
  assert.match(source, /UPDATE observation_ai_runs/);
});

test("AI judgement review records agree/disagree/later and only agree creates an identification", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "observationRecordAiReview.ts"), "utf8");

  assert.match(source, /review_state/);
  assert.match(source, /value !== "agree" && value !== "disagree" && value !== "later"/);
  assert.match(source, /not_ai_judgement_record/);
  assert.match(source, /observation_ai_assessments/);
  assert.match(source, /ai_recommended_taxon_name/);
  assert.match(source, /identification_method[^]*ai_judgement_agree/);
});

test("AI judgement agree can use the displayed AI assessment candidate name", () => {
  assert.equal(resolveAiJudgementIdentificationName({
    scientificName: "",
    vernacularName: null,
    candidateScientificName: null,
    candidateVernacularName: null,
    aiRecommendedTaxonName: "カワラヒワ",
  }), "カワラヒワ");

  assert.equal(resolveAiJudgementIdentificationName({
    scientificName: "Chloris sinica",
    vernacularName: "カワラヒワ",
    aiRecommendedTaxonName: "カワラヒワ",
  }), "Chloris sinica");
});
