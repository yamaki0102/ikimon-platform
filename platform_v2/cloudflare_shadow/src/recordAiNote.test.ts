import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAiNoteEvidence,
  buildAiNotePrompt,
  checkAiNoteSlot,
  checkAiNoteSlotWithRefs,
  evidenceMap,
  evidenceRefs,
  finalizeVisibleAiNoteSlots,
  numbersInText,
  parseAiNoteOutput,
  visibleAiNoteSlots,
  type AiNoteEvidence,
  type AiNoteSlotDraft,
  type StoredAiNoteSlot,
  type TaxonNote,
} from "./recordAiNote.js";
import type { ReadingFoundItem, ReadingPlaceFields, RecordReading } from "./recordReading.js";

const place = (over: Partial<ReadingPlaceFields> = {}): ReadingPlaceFields => ({ place_type: null, contact_surface: null, surrounding_cover: null, environment_condition: null, human_change: null, ...over });
const full = { kind: "full" as const };
const organism = (itemId: string, name: string, state: ReadingFoundItem["state"] = "ai_read"): ReadingFoundItem => ({
  itemId, kind: "organism", state, code: null, labelJa: null, observationId: `obs-${itemId}`, name: { vernacular: name, scientific: null, rank: "species" }, locator: full,
});
const feature = (itemId: string, code: string, labelJa: string): ReadingFoundItem => ({ itemId, kind: "feature", state: "ai_read", code, labelJa, observationId: null, name: null, locator: full });
const reading = (over: Partial<RecordReading["recordLevel"]> = {}, photos = 1): RecordReading => ({
  recordId: "rec-1",
  analyzed: true,
  media: Array.from({ length: photos }, (_, index) => ({ assetId: `a${index}`, mediaKind: "photo" as const, position: index, durationMs: null, found: [], place: place(), placeRead: false })),
  recordLevel: { found: [], place: place(), placeRead: false, ...over },
});
const note: TaxonNote = { key: "ardea-cinerea", names: ["アオサギ"], text: "浅い水辺でじっと待って、魚をとる。", source: "fixture" };
const countFact = (count: number) => ({ id: "count:place-season", label: "この場所とこの季節の確認済み記録", count });

const HERON = "11111111-1111-1111-1111-111111111111";
const WATER = "22222222-2222-2222-2222-222222222222";
const SURFACE = "33333333-3333-3333-3333-333333333333";
const base = reading({
  found: [organism(HERON, "アオサギ"), feature(WATER, "water_surface", "水面")],
  place: place({ contact_surface: { itemId: SURFACE, code: "water", labelJa: "水", state: "ai_read", actorKind: "ai", locator: full } }),
});
const ev = (opts: Parameters<typeof buildAiNoteEvidence>[1] = {}, r: RecordReading = base): AiNoteEvidence[] => buildAiNoteEvidence(r, opts);
const ids = { heron: `item:${HERON}`, water: `item:${WATER}`, surface: `item:${SURFACE}`, note: `note:${HERON}:ardea-cinerea` };
const draft = (slot: 1 | 2 | 3, text: string, evidence: string[], invite: string | null = null): AiNoteSlotDraft => ({ slot, text, evidence, invite });
const failures = (d: AiNoteSlotDraft, opts: Parameters<typeof buildAiNoteEvidence>[1] = {}) => checkAiNoteSlot(d, evidenceMap(ev(opts)));

const GOOD1 = "水面が写っているので、アオサギらしい鳥が待つ場所のようすが分かります。";
const GOOD2 = "アオサギは浅い水辺でじっと待って魚をとります。";
const GOOD3 = "次は少し離れて、土手全体も一緒に入れると、場所の変化も残せます。";

test("evidence ids are stable item ids with capture facts and optional stored notes and counts", () => {
  const evidence = ev({ taxonNotes: [note], counts: [countFact(6)] });
  const byId = evidenceMap(evidence);
  assert.equal(byId.get(ids.heron)?.kind, "organism");
  assert.equal(byId.get(ids.heron)?.capture, false);
  assert.equal(byId.get(ids.water)?.capture, true);
  assert.equal(byId.get(ids.surface)?.kind, "place");
  assert.equal(byId.get(ids.note)?.kind, "taxon_note");
  assert.equal(byId.get("count:place-season")?.number, 6);
  assert.equal(ev({}, reading({}, 3)).find((item) => item.id === "fact:photo_count")?.number, 3);
  assert.equal(ev({}, reading({}, 1)).some((item) => item.id === "fact:photo_count"), false);
});

test("a clean slot 1, 2 and 3 pass every check", () => {
  assert.deepEqual(failures(draft(1, GOOD1, [ids.water, ids.heron])), []);
  assert.deepEqual(failures(draft(2, GOOD2, [ids.heron, ids.note]), { taxonNotes: [note] }), []);
  assert.deepEqual(failures(draft(3, GOOD3, [ids.water], "step_back_whole")), []);
});

test("check 1: evidence ids must exist, be present, and slot 1 must cite a capture fact", () => {
  assert.ok(failures(draft(1, GOOD1, [])).includes("evidence_missing"));
  assert.ok(failures(draft(1, GOOD1, ["item:does-not-exist", ids.water])).includes("evidence_unknown"));
  assert.ok(failures(draft(1, "アオサギらしい鳥が写っているのが分かります。", [ids.heron])).includes("capture_fact_missing"));
  assert.ok(failures(draft(1, "水面が写っているので、アオサギらしい鳥が分かります。", [ids.water])).includes("evidence_missing"));
});

test("check 2: praise, evaluation, commands and decorations are never accepted", () => {
  for (const text of [
    "よく撮れています。", "上手ですね。", "素晴らしい一枚です。", "すごい写真です。", "水面が写っているので、よく撮れています。",
    "正解の名前です。", "撮り直してください。", "水面が写っているのは確実に水辺です。", "あなたは水辺をよく見ています。", "水面が写っています！",
    "水面が写っていて🙂分かります。", "水面とHeronが写っています。", "水面が写っているのでレベルが高いです。",
  ]) assert.ok(failures(draft(1, text, [ids.water])).includes("banned"), text);
});

test("check 2b: a hedge phrase glued into the middle of a sentence is rejected", () => {
  assert.ok(failures(draft(1, "3枚の写真にアオサギの仲間のようですと岩が写っています。", [ids.water, ids.heron])).includes("fluency"));
  assert.ok(!failures(draft(1, GOOD1, [ids.water, ids.heron])).includes("fluency"));
});

test("check 3: length is one sentence within 45/45/50 characters", () => {
  assert.ok(failures(draft(1, `水面が写っているので、${"広い".repeat(30)}が分かります。`, [ids.water])).includes("length"));
  assert.ok(failures(draft(1, "水面が写っています。水辺のようすが分かります。", [ids.water])).includes("length"));
  assert.ok(failures(draft(1, "水面が写っているので水辺が分かります", [ids.water])).includes("length"));
  assert.ok(failures(draft(3, `次は少し離れて、${"土手の".repeat(20)}全体も入れると、場所の変化も残せます。`, [ids.water], "step_back_whole")).includes("length"));
});

test("check 4: numbers need a stored count; frequency claims need a count of 5 or more", () => {
  assert.ok(failures(draft(1, "水面が写っているので、12件の記録の中の一枚と分かります。", [ids.water])).includes("number"));
  assert.ok(failures(draft(1, "水面が写っているので、三枚の写真から水辺が分かります。", [ids.water])).includes("number"));
  const multi = evidenceMap(buildAiNoteEvidence(reading({ found: [feature(WATER, "water_surface", "水面")] }, 2)));
  assert.deepEqual(checkAiNoteSlot(draft(1, "水面が写っているので、2枚の写真から水辺が分かります。", ["fact:photo_count", ids.water]), multi), []);
  assert.deepEqual(numbersInText("一瞬で一緒に二枚と3件と十二羽"), [3, 2, 12]);
  const freq = "この土手では秋によく見られます。";
  assert.ok(failures(draft(2, freq, [ids.surface])).includes("frequency"));
  assert.ok(failures(draft(2, freq, [ids.surface, "count:place-season"]), { counts: [countFact(4)] }).includes("frequency"));
  assert.ok(!failures(draft(2, freq, [ids.surface, "count:place-season"]), { counts: [countFact(5)] }).includes("frequency"));
});

test("check 5: learning only for taxa with a stored explanation", () => {
  assert.ok(failures(draft(2, GOOD2, [ids.heron])).includes("learning_basis"));
  assert.ok(failures(draft(2, GOOD2, [ids.heron]), { taxonNotes: [note] }).includes("learning_basis"));
  assert.ok(failures(draft(2, "水は流れるものです。", [ids.water])).includes("learning_basis"));
  assert.ok(!failures(draft(2, "足もとの面は水と読み取れます。", [ids.surface])).includes("learning_basis"));
});

test("check 5b: a name still only read by AI must be phrased as a hedge", () => {
  assert.ok(failures(draft(1, "水面が写っているので、アオサギが待つ場所が分かります。", [ids.water, ids.heron])).includes("hedge"));
  const confirmed = buildAiNoteEvidence(reading({ found: [organism(HERON, "アオサギ", "confirmed"), feature(WATER, "water_surface", "水面")] }));
  assert.deepEqual(checkAiNoteSlot(draft(1, "水面が写っているので、アオサギが待つ場所が分かります。", [ids.water, ids.heron]), evidenceMap(confirmed)), []);
});

test("check 6: slot 3 is an invitation, never an order, and carries a known kind", () => {
  for (const text of [
    "次は少し離れて撮ってください。", "次は少し離れて撮りましょう。", "もっと離れて撮ること。", "全体が写っていないので、次は離れると、場所が分かります。",
    "次は近づいて、鳥の目も入れると、様子が分かります。", "次は巣を入れると、暮らしが分かります。",
  ]) assert.ok(failures(draft(3, text, [ids.water], "step_back_whole")).some((code) => code === "invite_form" || code === "banned"), text);
  assert.ok(failures(draft(3, GOOD3, [ids.water], "approach_closely")).includes("invite_kind"));
  assert.ok(failures(draft(3, GOOD3, [ids.water], null)).includes("invite_kind"));
});

test("model output is parsed with aliases mapped to stored ids and unknown refs kept for rejection", () => {
  const { prompt, aliases } = buildAiNotePrompt({ evidence: ev(), allowInvite: true, avoidInviteKinds: ["sound"] });
  assert.match(prompt, /e1: /);
  assert.doesNotMatch(prompt, /sound=/);
  const out = JSON.stringify({ slots: [
    { slot: 3, text: GOOD3, evidence: ["e2"], invite_kind: "step_back_whole" },
    { slot: 1, text: GOOD1, evidence: ["e2", "e9", "e1"], invite_kind: "none" },
    { slot: 1, text: "重複", evidence: [], invite_kind: "none" },
  ] });
  const drafts = parseAiNoteOutput(out, aliases);
  assert.deepEqual(drafts.map((d) => d.slot), [1, 3]);
  assert.ok(drafts[0]!.evidence.includes("e9"));
  assert.equal(drafts[0]!.invite, null);
  assert.deepEqual(parseAiNoteOutput("not json", aliases), []);
});

const stored = (slot: 1 | 2 | 3, text: string, evidenceIds: string[], invite: string | null = null, status = "ready"): StoredAiNoteSlot => ({
  slot, text, invite, status, evidence: evidenceRefs(evidenceIds, evidenceMap(ev({ taxonNotes: [note] }))),
});

test("only passing slots show; a corrected evidence item hides exactly the slots that cite it", () => {
  const rows = [stored(1, GOOD1, [ids.water, ids.heron]), stored(2, "足もとの面は水と読み取れます。", [ids.surface]), stored(3, GOOD3, [ids.water], "step_back_whole")];
  const now = ev({ taxonNotes: [note] });
  assert.deepEqual(visibleAiNoteSlots(rows, now, { owner: true }).visible.map((s) => s.slot), [1, 2, 3]);
  const corrected = buildAiNoteEvidence(reading({
    found: [organism(HERON, "ダイサギ", "confirmed"), feature(WATER, "water_surface", "水面")],
    place: base.recordLevel.place,
  }), { taxonNotes: [note] });
  const after = visibleAiNoteSlots(rows, corrected, { owner: true });
  assert.deepEqual(after.visible.map((s) => s.slot), [2, 3]);
  assert.deepEqual(after.staleSlots, [1]);
  const removed = visibleAiNoteSlots(rows, ev({ taxonNotes: [note] }, reading()), { owner: true });
  assert.deepEqual(removed.visible, []);
  assert.deepEqual([...removed.staleSlots].sort(), [1, 2, 3]);
});

test("slot 3 is never visible to a viewer who is not the owner, even if stored and valid", () => {
  const rows = [stored(1, GOOD1, [ids.water, ids.heron]), stored(3, GOOD3, [ids.water], "step_back_whole")];
  const other = visibleAiNoteSlots(rows, ev(), { owner: false });
  assert.deepEqual(other.visible.map((s) => s.slot), [1]);
  assert.deepEqual(finalizeVisibleAiNoteSlots([{ slot: 3, text: GOOD3 }], false), []);
});

test("stale-status rows, rule-breaking stored text and over-long totals are never rendered", () => {
  assert.deepEqual(visibleAiNoteSlots([stored(1, GOOD1, [ids.water, ids.heron], null, "stale")], ev(), { owner: true }).visible, []);
  assert.deepEqual(visibleAiNoteSlots([stored(1, "水面が写っているので、よく撮れています。", [ids.water])], ev(), { owner: true }).visible, []);
  assert.deepEqual(finalizeVisibleAiNoteSlots([{ slot: 1, text: "上手ですね。" }, { slot: 2, text: "水面があります。" }], true).map((s) => s.slot), [2]);
  assert.ok(checkAiNoteSlotWithRefs(draft(1, GOOD1, []), [{ id: ids.water, fp: "x" }, { id: ids.heron, fp: "y" }], evidenceMap(ev())).includes("evidence_stale"));
});
