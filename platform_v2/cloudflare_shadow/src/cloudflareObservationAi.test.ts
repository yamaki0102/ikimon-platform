import assert from "node:assert/strict";
import test from "node:test";
import { observationAiQuestion, parseObservationAiCandidate } from "./cloudflareObservationAi.js";

test("AI prompt requires candidate language and coarse ranks when evidence is weak", () => {
  const prompt = observationAiQuestion();
  assert.match(prompt, /candidate for human review, not a confirmed identification/);
  assert.match(prompt, /stay at genus or family/);
  assert.match(prompt, /Return JSON only/);
});

test("AI candidate parser accepts a fenced response but returns bounded data", () => {
  const candidate = parseObservationAiCandidate(`回答:\n\`\`\`json\n{
    "vernacularName":" ヒサカキ ",
    "scientificName":"Eurya japonica",
    "rank":"species",
    "confidence":1.7,
    "visualEvidence":["葉縁の鋸歯", "光沢のある葉"],
    "needsMoreEvidence":["花または果実"],
    "nonBiological":false
  }\n\`\`\``);
  assert.equal(candidate.vernacularName, "ヒサカキ");
  assert.equal(candidate.rank, "species");
  assert.equal(candidate.confidence, 1);
  assert.deepEqual(candidate.needsMoreEvidence, ["花または果実"]);
});

test("AI candidate parser rejects an unnamed biological guess", () => {
  assert.throws(() => parseObservationAiCandidate('{"rank":"unknown","confidence":0.2,"nonBiological":false}'), /ai_candidate_name_missing/);
});

test("AI candidate parser keeps an identified organism biological when provider flags conflict", () => {
  const candidate = parseObservationAiCandidate(JSON.stringify({
    vernacularName: "ツバキ属",
    scientificName: "Camellia",
    rank: "genus",
    confidence: 0.62,
    visualEvidence: "鋸歯のある光沢葉",
    needsMoreEvidence: "花または果実の接写",
    nonBiological: true,
  }));

  assert.equal(candidate.nonBiological, false);
  assert.deepEqual(candidate.visualEvidence, ["鋸歯のある光沢葉"]);
  assert.deepEqual(candidate.needsMoreEvidence, ["花または果実の接写"]);
});
