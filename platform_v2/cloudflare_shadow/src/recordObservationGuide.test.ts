import assert from "node:assert/strict";
import test from "node:test";
import { buildObservationGuideMaterial, generateAndStoreObservationGuide, observationGuideFailures } from "./recordObservationGuide";
import { renderRecordReaderModesHtml } from "./recordReaderModes";

test("gate accepts a plain guide", () => {
  assert.deepEqual(observationGuideFailures("葉の形と、葉や茎にある細かい毛を見てみてください。"), []);
});

test("gate rejects exclamation, emoji, praise, technique, length, tone", () => {
  for (const bad of ["葉の形を見てみてください！", "葉の形を見てみてください!", "葉の形を見てください🌿", "すごい葉の形です。", "素晴らしい色です。", "上手な写真です。", "ピントが合っています。", "構図がよいです。", "撮り方が良いです。", "葉がきれいですね。", "あ".repeat(81)]) {
    assert.notEqual(observationGuideFailures(bad).length, 0, bad);
  }
});

test("renderer shows guide with AI note, falls back otherwise", () => {
  const base = { enabled: true, group: "plant" as const, speciesHeading: null };
  const withGuide = renderRecordReaderModesHtml({ ...base, guideText: "葉の形を見てみてください。", aiNote: "この文章はAIが作成しました" });
  assert.match(withGuide, /data-observation-guide/);
  assert.match(withGuide, /葉の形を見てみてください。/);
  assert.match(withGuide, /この文章はAIが作成しました/);
  assert.doesNotMatch(withGuide, /data-reader-mode-panel/);
  assert.equal(renderRecordReaderModesHtml(base), "");
  assert.equal(renderRecordReaderModesHtml({ ...base, guideText: "すごい！" }), "");
  assert.equal(renderRecordReaderModesHtml({ ...base, enabled: false, guideText: "葉。" }), "");
});

test("gate v2: ending, particles, senses, shooting words, empty ok", () => {
  assert.deepEqual(observationGuideFailures(""), []);
  assert.deepEqual(observationGuideFailures("穂の毛が見えています。根元を確かめてみてください。"), []);
  for (const bad of ["葉の縁を見てみてね。", "葉の縁を見てみてください よ", "かわいい葉です。", "きれいな色です。", "美しい形です。", "接写で見えます。", "クローズアップです。", "葉を撮ります。", "葉の縁を見てみて。", "葉の縁を見る。", "葉の縁です。続きは見てみる"]) {
    assert.notEqual(observationGuideFailures(bad).length, 0, bad);
  }
});

const rationale = JSON.stringify({ visualEvidence: ["円柱状の穂"], needsMoreEvidence: ["穂の根元の毛"] });

function fakeDb(opts: { human?: boolean; cues?: unknown[]; existingHash?: string }) {
  const writes: unknown[][] = [];
  const name = opts.human ? "ヒト" : "エノコログサ属";
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              if (sql.includes("observation_ai_suggestions")) return { results: [{ proposed_name: name, proposed_scientific_name: null, confidence_score: 0.9, rationale_json: rationale }] };
              if (sql.includes("observation_identification_claims")) return { results: [{ proposed_name: "エノコログサ", accepted_name: null, claim_status: "candidate", actor_kind: "owner" }] };
              return { results: [] };
            },
            async first() {
              if (sql.includes("environment_assessments")) return { value_json: JSON.stringify({ cues: opts.cues ?? [] }) };
              if (sql.includes("quality_gate_json FROM")) return opts.existingHash ? { quality_gate_json: JSON.stringify({ materialHash: opts.existingHash }) } : null;
              return null;
            },
            async run() { writes.push(args); return {}; },
          };
        },
      };
    },
    batch: async () => [],
  };
  return { db: db as never, writes };
}

test("material: names, evidence, cues filtered by confidence", () => {
  const m = buildObservationGuideMaterial({
    suggestions: [{ proposed_name: "エノコログサ属", proposed_scientific_name: null, confidence_score: 0.9, rationale_json: rationale }],
    claims: [{ proposed_name: "エノコログサ", accepted_name: null, claim_status: "candidate", actor_kind: "owner" }],
    cues: [{ label: "草地", evidence: "杭がある", confidence: 0.8 }, { label: "低い", confidence: 0.3 }],
  });
  assert.equal(m.human, false);
  assert.deepEqual(m.labels, [
    "本人が付けた名前: エノコログサ",
    "生きもの（AIの推定）: エノコログサ属",
    "写真に見えた特徴: 円柱状の穂",
    "次に確かめるとよい点: 穂の根元の毛",
    "場所の手がかり: 草地（杭がある）",
  ]);
});

test("stores guide, skips unchanged material, skips human, empty is not stored", async () => {
  let calls = 0;
  const gen = (text: string) => async () => { calls += 1; return JSON.stringify({ guide: text }); };
  const base = { recordId: "r1", ownerUserId: "u1", model: "m" };
  const a = fakeDb({});
  const r1 = await generateAndStoreObservationGuide({ ...base, db: a.db, generate: gen("穂が見えています。根元の毛を確かめてみてください。") });
  assert.deepEqual([r1.stored, r1.called], [true, true]);
  const hash = JSON.parse(String(a.writes[0][4])).materialHash as string;
  const b = fakeDb({ existingHash: hash });
  const before = calls;
  const r2 = await generateAndStoreObservationGuide({ ...base, db: b.db, generate: gen("x") });
  assert.deepEqual([r2.stored, r2.called, calls], [false, false, before]);
  const c = fakeDb({ human: true });
  const r3 = await generateAndStoreObservationGuide({ ...base, db: c.db, generate: gen("x") });
  assert.equal(r3.called, false);
  const d = fakeDb({});
  const r4 = await generateAndStoreObservationGuide({ ...base, db: d.db, generate: gen("") });
  assert.deepEqual([r4.stored, r4.called, r4.failures.length, d.writes.length], [false, true, 0, 0]);
});
