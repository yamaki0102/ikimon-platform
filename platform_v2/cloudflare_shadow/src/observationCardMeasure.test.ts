import assert from "node:assert/strict";
import test from "node:test";
import { CARD_WRITER_MODEL, runObservationCardPipeline, type CardDeps } from "./observationCardMode";
import { FAMILY_JA, KEY_FAMILIES, callDecisionQuestions, readScene, sceneQuestions, subjectQuestions, type DecisionAnswer, type DecisionQuestion } from "./observationCardMeasure";
import { publicObservationAiCandidateInsights } from "./publicObservationAiPresentation";
import { deriveObservationProcessingStatus } from "../../src/services/observationProcessingStatus";

type Json = Record<string, unknown>;
const image = { assetId: "a0", mimeType: "image/webp", base64Data: "AAAA" };
const crow = { name: "ハシボソガラス", scientific_name: "Corvus corone", role: "main", group: "bird", rank: "species", confidence_band: "low", view: "close", asset_indexes: [0], features_seen: ["黒い羽"], missing_evidence: [] };
const grass = { name: "イネ科草本", scientific_name: "Poaceae", role: "background", group: "plant", rank: "family", confidence_band: "medium", view: "far", asset_indexes: [0], features_seen: ["細い葉"], missing_evidence: [] };
const look = { group: { ja: "カラス属", sci: "Corvus", rank: "genus" }, candidates: [
  { ja: "ハシボソガラス", sci: "Corvus corone", how_ja: "嘴が細い", features: [{ part_ja: "嘴", ja: "細め", q: "Is the bill slender?" }, { part_ja: "額", ja: "平ら", q: "Is the forehead flat?" }] },
  { ja: "ハシブトガラス", sci: "Corvus macrorhynchos", how_ja: "嘴が太く額が出る", features: [{ part_ja: "嘴", ja: "太い", q: "Is the bill thick?" }, { part_ja: "額", ja: "盛り上がる", q: "Is the forehead domed?" }] },
] };
const corvidFam = `f${KEY_FAMILIES.bird!.split("|").findIndex((x) => x.startsWith("Corvidae"))}`;
const sceneAnswers = (kind = "single", kindP = 0.97): Record<string, DecisionAnswer> => ({ kind: { choice: kind, confidence: kindP }, group: { choice: "bird", confidence: 1 }, quality: { score: 3.7 }, fam_bird: { choice: corvidFam, confidence: 0.99, probabilities: { [corvidFam]: 0.99, zz_other: 0.005, zz_cant: 0.005 } } });

const deps = (over: Partial<CardDeps> = {}): { deps: CardDeps; asked: Array<Record<string, DecisionQuestion>>; saved: string[]; scenes: unknown[] } => {
  const asked: Array<Record<string, DecisionQuestion>> = [];
  const saved: string[] = [];
  const scenes: unknown[] = [];
  return {
    asked, saved, scenes,
    deps: {
      gemini: async (model, parts) => {
        const text = parts.map((p) => String(p.text ?? "")).join("\n");
        if (text.includes("record_class")) return JSON.stringify({ record_class: "organism", main_theme: "organism", habitat_type: "都市公園", subjects: [crow, grass], narrative: "草地のカラス", observer_boost: "全身が写っている。" });
        if (text.includes("lookalike card")) return JSON.stringify(look);
        if (model === CARD_WRITER_MODEL) return JSON.stringify({ overview: "A crow." });
        return JSON.stringify({ overview: "カラス" });
      },
      measure: async (_images, questions) => {
        asked.push(questions);
        if (questions.kind) return sceneAnswers();
        return { s0: { noul: 0.23 }, s1: { noul: 0.86 }, pick: { choice: "c1", probabilities: { c0: 0.05, c1: 0.93, zz_other: 0.02 } }, f0_0: { noul: 0.15 }, f0_1: { noul: 0.44 }, f1_0: { noul: 0.84 }, f1_1: { noul: 0.48 } };
      },
      onScene: async (scene) => { scenes.push(scene); },
      loadCard: async () => null,
      saveCard: async (key) => { saved.push(key); },
      ...over,
    },
  };
};

test("measure sets confidence from probabilities, ranks lookalikes with features and reports early family and photo quality", async () => {
  const d = deps();
  const out = await runObservationCardPipeline({ observedAt: null, images: [image] }, d.deps);
  assert.equal(d.asked.length, 2);
  assert.ok(Object.keys(d.asked[0]!).length > 10 && d.asked[0]!.quality?.type === "score");
  assert.deepEqual(Object.keys(d.asked[1]!).sort(), ["f0_0", "f0_1", "f1_0", "f1_1", "pick", "s0", "s1"]);
  assert.deepEqual(d.scenes.map((s) => (s as { family: string; accepted: boolean }).family), ["Corvidae"]);
  assert.equal(FAMILY_JA.Corvidae, "カラス科");
  assert.deepEqual(out.subjects.map((s) => s.confidence_band), ["low", "medium"]);
  assert.equal(out.stats.secondCheck, "conflict");
  assert.deepEqual(out.stats.measure!.subjectP, [0.23, 0.86]);
  assert.equal(out.merged.candidate.confidence, 0.23);
  assert.deepEqual(out.merged.topCandidates.map((c) => c.name), ["ハシブトガラス", "ハシボソガラス"]);
  const top = out.merged.topCandidates[0]! as unknown as Json;
  assert.deepEqual([top.measuredProbability, top.howToTell, out.merged.topCandidates[0]!.supportingFeatures], [0.93, "嘴が太く額が出る", ["嘴: 太い"]]);
  assert.deepEqual(out.merged.topCandidates[1]!.contradictions, ["嘴: 細め（写っていない）"]);
  assert.match(out.merged.summary!.observer_feedback, /^写真の情報量: 決め手がはっきり写っている。/);
  assert.ok(d.saved.some((k) => k.startsWith("lookalike-v1-corvus-corone")));
  const insights = publicObservationAiCandidateInsights(JSON.stringify({ topCandidates: out.merged.topCandidates }));
  assert.deepEqual([insights[0]!.probability, insights[0]!.howToTell], [0.93, "嘴が太く額が出る"]);
});

test("measure failures never break the card result and cached lookalike cards are reused", async () => {
  const failing = await runObservationCardPipeline({ observedAt: null, images: [image] }, deps({ measure: async () => { throw new Error("card_measure_api_failed:500"); } }).deps);
  assert.equal(failing.stats.measure!.error, "card_measure_api_failed:500");
  assert.deepEqual([failing.stats.secondCheck, failing.merged.topCandidates[0]!.name], ["skipped", "ハシボソガラス"]);
  let writerCalls = 0;
  const cached = deps({ loadCard: async (key) => (key.startsWith("lookalike-") ? { card: look } : null) });
  const g = cached.deps.gemini;
  cached.deps.gemini = async (model, parts, o) => { if (String(parts.map((p) => p.text).join("")).includes("lookalike card")) writerCalls++; return g(model, parts, o); };
  await runObservationCardPipeline({ observedAt: null, images: [image] }, cached.deps);
  assert.equal(writerCalls, 0);
  const many = await runObservationCardPipeline({ observedAt: null, images: [image] }, deps({ measure: async (_i, q) => (q.kind ? sceneAnswers() : { s0: { noul: 0.9 }, pick: { choice: "zz_other", probabilities: { c0: 0.1, c1: 0.1, zz_other: 0.8 } } }) }).deps);
  assert.equal(many.merged.topCandidates[0]!.name, "ハシボソガラス");
  assert.equal(many.merged.topCandidates.length, 1);
});

test("scene is accepted only for one clear subject with a listed family", () => {
  assert.equal(readScene(sceneAnswers()).accepted, true);
  assert.equal(readScene(sceneAnswers("scene", 0.9)).accepted, false);
  assert.equal(readScene({ ...sceneAnswers(), fam_bird: { choice: "zz_other", confidence: 0.8, probabilities: { zz_other: 0.8 } } }).accepted, false);
  assert.equal(readScene({ ...sceneAnswers(), quality: {} }).quality, null);
  assert.equal(Object.keys(sceneQuestions()).length, 3 + Object.keys(KEY_FAMILIES).length);
  for (const g of Object.keys(KEY_FAMILIES)) for (const f of KEY_FAMILIES[g]!.split("|")) assert.ok(FAMILY_JA[f.split(":")[0]!], f);
  assert.deepEqual(Object.keys(subjectQuestions([crow], null)), ["s0"]);
});

test("decision questions call sends images once and never retries client errors", async () => {
  const bodies: Json[] = [];
  const ok = await callDecisionQuestions("k", "gemini-decision-1", [image, image], { a: { type: "noul", instructions: "q" } }, (async (_u: unknown, init: RequestInit) => { bodies.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ answers: { a: { noul: 0.7 } } })); }) as typeof fetch);
  assert.equal(ok.a!.noul, 0.7);
  assert.equal((bodies[0]!.input as unknown[]).length, 2);
  let n = 0;
  await assert.rejects(callDecisionQuestions("k", "gemini-decision-1", [image], {}, (async () => { n++; return new Response("{}", { status: 400 }); }) as typeof fetch), /card_measure_api_failed:400/);
  assert.equal(n, 1);
});

test("processing panel shows the early family only while the AI is still processing", () => {
  const base = { occurrenceId: "occ:o:0", visitId: "o", originalPhotoCount: 1, displayPhotoCount: 1, latestMediaJobStatus: null, latestMediaJobError: null, aiAssessmentStatus: null, candidateCount: 0, identificationCount: 0, providerAvailable: true, updatedAt: null };
  assert.match(deriveObservationProcessingStatus({ ...base, aiRequestStatus: "processing", earlyFamilyName: "カラス科" }).message, /まず、カラス科のなかまのようです/);
  assert.doesNotMatch(deriveObservationProcessingStatus({ ...base, aiRequestStatus: "pending", earlyFamilyName: "カラス科" }).message, /カラス科/);
  assert.doesNotMatch(deriveObservationProcessingStatus({ ...base, aiRequestStatus: "processing" }).message, /なかま/);
});
