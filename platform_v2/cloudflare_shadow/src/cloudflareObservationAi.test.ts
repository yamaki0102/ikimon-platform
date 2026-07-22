import assert from "node:assert/strict";
import test from "node:test";
import {
  observationAiQuestion,
  observationAiSubjects,
  parseObservationAiCandidate,
} from "./cloudflareObservationAi.js";

test("AI prompt requires candidate language and coarse ranks when evidence is weak", () => {
  const prompt = observationAiQuestion();
  assert.match(prompt, /candidate for human review, not a confirmed identification/);
  assert.match(prompt, /stay at genus or family/);
  assert.match(prompt, /Return JSON only/);
  assert.match(prompt, /coexistingSubjects/);
  assert.match(prompt, /separate organism or plant/u);
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
  assert.deepEqual(candidate.coexistingSubjects, []);
});

test("AI parser preserves multiple visual subjects and stable subject locators", () => {
  const candidate = parseObservationAiCandidate(JSON.stringify({
    vernacularName: "モンシロチョウ",
    scientificName: "Pieris rapae",
    rank: "species",
    confidence: 0.91,
    visualEvidence: ["白い翅"],
    needsMoreEvidence: [],
    nonBiological: false,
    subjectLocator: { rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } },
    coexistingSubjects: [
      {
        candidateKey: "flower-left",
        vernacularName: "アブラナ科",
        scientificName: "Brassicaceae",
        rank: "family",
        confidence: 0.72,
        visualEvidence: ["黄色い花"],
        needsMoreEvidence: ["葉の接写"],
        subjectLocator: { rect: { x: 0.02, y: 0.45, width: 0.58, height: 0.5 } },
      },
    ],
  }));

  const subjects = observationAiSubjects(candidate);
  assert.equal(subjects.length, 2);
  assert.equal(subjects[0]?.subjectKey, "primary");
  assert.equal(subjects[1]?.subjectKey, "flower-left");
  assert.equal(subjects[1]?.candidate.vernacularName, "アブラナ科");
  assert.deepEqual(subjects[1]?.candidate.subjectLocator, {
    rect: { x: 0.02, y: 0.45, width: 0.58, height: 0.5 },
  });
});

test("AI subject keys are deterministic when a provider omits candidateKey", () => {
  const response = JSON.stringify({
    vernacularName: "主対象",
    scientificName: null,
    rank: "unknown",
    confidence: 0.5,
    visualEvidence: [],
    needsMoreEvidence: [],
    nonBiological: false,
    coexisting_taxa: [{
      vernacularName: "背景植物",
      scientificName: null,
      rank: "unknown",
      confidence: 0.4,
      subject_locator: { rect: { x: 0.6, y: 0.1, width: 0.3, height: 0.7 } },
    }],
  });
  const first = observationAiSubjects(parseObservationAiCandidate(response));
  const replay = observationAiSubjects(parseObservationAiCandidate(response));
  assert.equal(first[1]?.subjectKey, replay[1]?.subjectKey);
  assert.match(first[1]?.subjectKey ?? "", /^subject:/u);
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
