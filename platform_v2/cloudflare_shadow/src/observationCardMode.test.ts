import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import {
  CARD_ID_MODEL,
  CARD_PUBLIC_EVIDENCE_MAX,
  CARD_PUBLIC_TEXT_MAX,
  CARD_TILE_GRID,
  CARD_TILE_MAX_IMAGES,
  CARD_WRITER_MODEL,
  applySecondCheck,
  buildCardMergedObservation,
  callCardGemini,
  cardContext,
  normalizeCardSubjects,
  runObservationCardPipeline,
  type CardDeps,
} from "./observationCardMode";

type Json = Record<string, unknown>;
const image = { assetId: "a0", mimeType: "image/webp", base64Data: "AAAA" };
const subject = (over: Json = {}): Json => ({ name: "オオカマキリ", scientific_name: "Tenodera sinensis", role: "main", group: "insect", rank: "species", confidence_band: "high", view: "close", asset_indexes: [0], features_seen: ["緑色の体", "大きな前脚", "長い胸"], missing_evidence: ["後翅の色", "腹面", "卵のう"], ...over });
const long = (n: number) => "あ".repeat(n);

test("subjects drop people and non-living things, merge duplicates and coarsen far species", () => {
  const out = normalizeCardSubjects([
    subject(),
    { name: "ヒト", scientific_name: "Homo sapiens", rank: "species" },
    { name: "撮影者", scientific_name: "Homo sapiens", rank: "species" },
    { name: "雲", rank: "class" },
    { name: "チョウセンカマキリ", scientific_name: "Tenodera angustipennis", rank: "species", asset_indexes: [1] },
    { name: "植物", rank: "class" },
    subject({ name: "ハシブトガラス", scientific_name: "Corvus macrorhynchos", group: "bird", view: "far" }),
    subject({ name: "コイ", scientific_name: "Cyprinus carpio", group: "fish", view: "mid" }),
    { name: "ススキ", asset_indexes: [9], confidence_band: "certain" },
  ], 2);
  assert.deepEqual(out.map((x) => x.name), ["オオカマキリ", "ハシブトガラスの仲間", "コイ", "ススキ"]);
  assert.deepEqual(out[0]!.asset_indexes, [0, 1]);
  assert.deepEqual([out[1]!.rank, out[1]!.scientific_name, out[1]!.confidence_band], ["genus", "Corvus", "low"]);
  assert.equal(out[2]!.confidence_band, "medium");
  assert.deepEqual([out[3]!.asset_indexes, out[3]!.confidence_band], [[0], "low"]);
  assert.deepEqual(normalizeCardSubjects([{ name: "植物" }], 1).map((x) => x.name), ["植物"]);
});

test("second identification only lowers confidence and keeps the other reading as an alternative", () => {
  const agree = subject();
  assert.equal(applySecondCheck(agree, { name: "別名", scientific_name: "tenodera sinensis", rank: "species" }), "agree");
  assert.equal(agree.confidence_band, "high");
  const conflict = subject();
  assert.equal(applySecondCheck(conflict, { name: "チョウセンカマキリ", scientific_name: "Tenodera angustipennis", rank: "species" }), "conflict");
  assert.deepEqual([conflict.confidence_band, conflict.alt_candidate, conflict.name], ["low", "チョウセンカマキリ", "オオカマキリ"]);
  const coarser = subject();
  assert.equal(applySecondCheck(coarser, { name: "カマキリ科", rank: "family" }), "coarser");
  assert.equal(coarser.confidence_band, "medium");
  assert.equal(applySecondCheck(subject(), null), "skipped");
});

test("merged result keeps every public text inside the page limits and exposes all subjects", () => {
  const lead = subject({ alt_candidate: "チョウセンカマキリ", alt_scientific_name: "Tenodera angustipennis" });
  const bird = subject({ name: "鳥類", scientific_name: "Aves", rank: "class", group: "bird", confidence_band: "low", tentative: "ヒヨドリ", found_by: "tile", features_seen: ["枝の間の灰色の鳥"], missing_evidence: [] });
  const card = { overview: long(70), distinguishing_tips: [long(50), long(50), long(50), long(50)], confusable_groups: [{ japanese_name: "ハラビロカマキリ", distinction_point: long(60) }, { japanese_name: "コカマキリ", distinction_point: long(60) }, { japanese_name: "ウスバカマキリ", distinction_point: long(60) }], confirm_more: [long(70), long(70), long(70)] };
  const merged = buildCardMergedObservation(
    { record_class: "organism", main_theme: "organism", habitat_type: "草地", narrative: long(300), simple_summary: "草地", observer_boost: long(120), area_inference: { vegetation_structure_candidates: [{ label: "高茎草地", confidence: 0.7, why: "ススキが密" }] } },
    [lead, bird], [card, null], { overview: "Grassland", what_to_look_for: ["ススキ"], confirm_more: [long(90), long(90)] },
  );
  const all = [merged.candidate, ...merged.candidate.coexistingSubjects];
  assert.deepEqual(all.map((c) => c.vernacularName), ["オオカマキリ", "鳥類"]);
  for (const c of all) {
    assert.ok(c.visualEvidence.length <= 4 && c.needsMoreEvidence.length <= 4);
    for (const text of [...c.visualEvidence, ...c.needsMoreEvidence]) assert.ok(text.length <= CARD_PUBLIC_EVIDENCE_MAX, text);
  }
  assert.equal(merged.candidate.visualEvidence.length, 4);
  assert.match(merged.candidate.visualEvidence[2]!, /見分け方: /);
  assert.match(merged.candidate.visualEvidence[3]!, /チョウセンカマキリの可能性/);
  assert.equal(merged.candidate.needsMoreEvidence.length, 3);
  assert.match(merged.candidate.coexistingSubjects[0]!.visualEvidence.join(" "), /候補はヒヨドリですが未確認/);
  for (const e of merged.summary!.subject_explanations) for (const text of [e.explanation, e.uncertainty, e.next_photo]) assert.ok(text.length <= CARD_PUBLIC_EVIDENCE_MAX);
  assert.ok(merged.summary!.observer_feedback.length > 0 && merged.summary!.observer_feedback.length <= CARD_PUBLIC_TEXT_MAX);
  assert.deepEqual(merged.topCandidates.map((c) => c.name), ["オオカマキリ", "チョウセンカマキリ"]);
  assert.ok(merged.topCandidates.every((c) => c.supportingFeatures.length + c.missingFeatures.length > 0));
  assert.deepEqual([merged.recordClass, merged.detectionState, merged.needsReview, merged.environment.fields.place_type], ["organism", "detected", true, "grassland_urban_edge"]);
  assert.equal(merged.candidate.coexistingSubjects[0]!.sourceModel, "@cf/google/gemma-4-26b-a4b-it");
});

test("landscape record without subjects still returns habitat text and a next-photo hint", () => {
  const merged = buildCardMergedObservation({ main_theme: "environment", habitat_type: "河川敷", narrative: "増水した川", observer_boost: "川幅全体が写っている。", area_inference: {} }, [], [], { overview: "Riverbank", confirm_more: ["水際の植生を近くから"] });
  assert.deepEqual([merged.recordClass, merged.detectionState, merged.candidate.nonBiological, merged.topCandidates.length], ["environment", "not_detected", true, 0]);
  assert.match(merged.summary!.observer_feedback, /次に撮るなら: 水際の植生を近くから/);
  assert.equal(merged.environment.fields.place_type, "water_edge");
});

const fakeDeps = (idJson: Json, over: Partial<CardDeps> = {}): { deps: CardDeps; calls: Array<{ model: string; text: string }>; saved: string[] } => {
  const calls: Array<{ model: string; text: string }> = [];
  const saved: string[] = [];
  const deps: CardDeps = {
    gemini: async (model, parts) => {
      const text = parts.map((p) => String(p.text ?? "")).join("\n");
      calls.push({ model, text });
      if (text.includes("record_class")) return JSON.stringify(idJson);
      if (text.includes("いちばん大きくはっきり写る")) return JSON.stringify({ name: "オオカマキリ", scientific_name: "Tenodera sinensis", rank: "species" });
      if (text.startsWith("Translate this field-guide card")) return JSON.stringify({ overview: "概要", distinguishing_tips: ["前脚"], confirm_more: ["腹面"] });
      if (model === CARD_WRITER_MODEL) return JSON.stringify({ overview: "A mantis.", distinguishing_tips: ["forelegs"], confirm_more: ["underside"] });
      return JSON.stringify({ none: true });
    },
    loadCard: async () => null,
    saveCard: async (key) => { saved.push(key); },
    ...over,
  };
  return { deps, calls, saved };
};

test("pipeline sends no place, protects person records and writes each card once", async () => {
  const input = { observedAt: "2026-10-03T01:00:00Z", images: [image] };
  assert.equal(cardContext(input), "観察文脈: 国=日本 / 日時=2026-10-03T01:00:00Z / 季節=秋 / 写真1枚");
  const organism = fakeDeps({ record_class: "organism", main_theme: "organism", habitat_type: "草地", subjects: [subject()], narrative: "草の上のカマキリ", observer_boost: "全身が写っている。" });
  const out = await runObservationCardPipeline(input, organism.deps);
  assert.deepEqual([out.stats.subjects, out.stats.secondCheck, out.stats.cardsCreated, out.stats.tileCalls], [1, "agree", 2, 0]);
  assert.deepEqual(organism.saved.sort(), ["habitat-草地", "tenodera-sinensis"]);
  assert.ok(organism.calls.filter((c) => c.text.includes("観察文脈")).every((c) => c.text.includes(cardContext(input)) && c.text.split("観察文脈").length === 2));
  assert.deepEqual([...new Set(organism.calls.map((c) => c.model))].sort(), [CARD_ID_MODEL, CARD_WRITER_MODEL].sort());

  let tileSourceCalls = 0;
  const person = fakeDeps({ record_class: "person", main_theme: "organism", habitat_type: "都市公園", subjects: [subject()], narrative: "公園" }, { tileModel: async () => "{}", tileSource: async () => { tileSourceCalls++; return null; } });
  const guarded = await runObservationCardPipeline(input, person.deps);
  assert.deepEqual([guarded.merged.recordClass, guarded.stats.subjects, guarded.merged.candidate.vernacularName, tileSourceCalls], ["person", 0, null, 0]);
  for (const record_class of ["document", "food"]) {
    const skipped = await runObservationCardPipeline(input, fakeDeps({ record_class, main_theme: "environment", habitat_type: "その他", subjects: [], narrative: "紙面" }, { tileModel: async () => "{}", tileSource: async () => { tileSourceCalls++; return null; } }).deps);
    assert.deepEqual([skipped.merged.recordClass, skipped.stats.tileCalls, tileSourceCalls], [record_class, 0, 0]);
  }
  await assert.rejects(runObservationCardPipeline(input, fakeDeps({}, { gemini: async () => "not json" }).deps), /card_identification_invalid_json/);
});

test("tile sweep adds a small animal as a coarse unconfirmed subject and stops at its budget", async () => {
  const png = new Uint8Array(await sharp({ create: { width: 200, height: 150, channels: 3, background: { r: 40, g: 120, b: 60 } } }).png({ palette: false }).toBuffer());
  const id = { record_class: "organism", main_theme: "organism", habitat_type: "その他", subjects: [subject({ rank: "genus" })], narrative: "", observer_boost: "" };
  let tiles = 0;
  const found = fakeDeps(id, {
    tileSource: async () => png,
    tileModel: async () => (++tiles === 7 ? JSON.stringify({ animals: [{ name: "小鳥", group: "bird", confidence_band: "medium", where: "枝の間" }, { name: "ワニ", group: "reptile", confidence_band: "high", where: "水面" }] }) : JSON.stringify({ animals: [] })),
    gemini: async (model, parts) => (parts.some((p) => String(p.text ?? "").includes("拡大に写る"))
      ? JSON.stringify({ name: "ヒヨドリ", scientific_name: "Hypsipetes amaurotis", rank: "species", confidence_band: "medium", features_seen: ["灰色の体"] })
      : JSON.stringify(parts.some((p) => String(p.text ?? "").includes("record_class")) ? id : { overview: "x", distinguishing_tips: ["y"] })),
  });
  const out = await runObservationCardPipeline({ observedAt: null, images: [image, image, image] }, found.deps);
  assert.equal(out.stats.tileCalls, CARD_TILE_GRID * CARD_TILE_GRID * CARD_TILE_MAX_IMAGES);
  assert.deepEqual(out.subjects.map((s) => [s.name, s.tentative ?? null, s.confidence_band, s.found_by ?? null]), [["オオカマキリ", null, "high", null], ["鳥類", "ヒヨドリ", "low", "tile"]]);
  assert.match(out.merged.reviewReasons.join(" "), /小さな写り込み/);

  let clock = 0;
  const slow = fakeDeps(id, { tileSource: async () => png, tileModel: async () => { clock += 10_000; return JSON.stringify({ animals: [] }); }, now: () => clock, tileBudgetMs: 25_000, tileConcurrency: 1 });
  const limited = await runObservationCardPipeline({ observedAt: null, images: [image] }, slow.deps);
  assert.deepEqual([limited.stats.tileCalls, limited.stats.tileError], [3, "tile_budget_exceeded"]);
  const broken = await runObservationCardPipeline({ observedAt: null, images: [image] }, fakeDeps(id, { tileSource: async () => new Uint8Array(64), tileModel: async () => "{}" }).deps);
  assert.deepEqual([broken.stats.subjects, broken.stats.tileError], [1, "png_signature_invalid"]);
});

test("card model calls are limited to the two card models and never retry client errors", async () => {
  await assert.rejects(callCardGemini("k", "gemini-3.5-flash", [], { temperature: 0 }), /card_model_not_allowed/);
  let n = 0;
  const bad = (async () => { n++; return new Response("{}", { status: 400 }); }) as unknown as typeof fetch;
  await assert.rejects(callCardGemini("k", CARD_ID_MODEL, [{ text: "x" }], { temperature: 0 }, bad), /card_gemini_api_failed:400/);
  assert.equal(n, 1);
  const ok = (async (_url: unknown, init?: RequestInit) => {
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "k");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text: "{\"a\":1}" }] } }] }), { status: 200 });
  }) as unknown as typeof fetch;
  assert.equal(await callCardGemini("k", CARD_WRITER_MODEL, [{ text: "x" }], { temperature: 0, thinkingLevel: "low" }, ok), "{\"a\":1}");
});

test("worker routes interactive requests to card mode only behind the staging switch", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(source, /env\.OBSERVATION_AI_MODE === "card_v1"/);
  assert.match(source, /observationCardModeEnabled\(env\) && reassessmentAttemptCount\(request\.source_payload_json\) < 2/);
  assert.match(source, /if \(!observationCardModeEnabled\(env\)\) await requeuePublicPhotoAiQualityBacklog\(env\)/);
  assert.match(source, /mode: "card_v1", source: "observation_card_v1_reassessment"/);
  assert.match(source, /providerMode: "card_v1"/);
  assert.match(source, /const OBSERVATION_CARD_MAX_PER_INVOCATION = 20;/);
  assert.equal(source.match(/\.slice\(0, OBSERVATION_CARD_MAX_PER_INVOCATION\)/g)?.length, 2);
  assert.equal(source.match(/await submitDirectGeminiObservationReassessment\(/g)?.length, 1);
  assert.equal(config.match(/"OBSERVATION_AI_MODE": "card_v1"/g)?.length, 2);
  const staging = config.indexOf("\"name\": \"ikimon-life-cloudflare-staging\"");
  const production = config.indexOf("\"name\": \"ikimon-life-cloudflare-prod\"");
  const flag = config.indexOf("\"OBSERVATION_AI_MODE\": \"card_v1\"");
  assert.ok(staging > 0 && flag > staging && flag < production && config.lastIndexOf("\"OBSERVATION_AI_MODE\": \"card_v1\"") > production);
  const parsed = JSON.parse(config) as { env?: { production?: { vars?: Record<string, string> } } };
  assert.equal(parsed.env?.production?.vars?.OBSERVATION_AI_MODE, "card_v1");
});
