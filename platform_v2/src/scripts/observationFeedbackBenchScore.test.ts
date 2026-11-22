import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { recommend, scoreItem, spearman, quantile, type ConfigAggregate } from "./observationFeedbackBenchScore.js";

const area = { vegetation_structure_candidates: [{ label: "棚田の畦と斜面", why: "", confidence: 0.6 }] };

test("format failure scores zero", () => {
  assert.equal(scoreItem(null, {}).score, 0);
  assert.deepEqual(scoreItem({}, {}).flags, ["empty"]);
});

test("coverage and must_not", () => {
  const out = { recommended_taxon_name: "メジロ", recommended_rank: "species", confidence_band: "high", narrative: "梅にメジロ" };
  assert.equal(scoreItem(out, { must_any: [["メジロ"]], must_not: ["ウグイス"] }).score, 100);
  assert.equal(scoreItem({ ...out, narrative: "ウグイスです", recommended_taxon_name: "ウグイス" }, { must_any: [["メジロ"]], must_not: ["ウグイス"] }).score, 20);
});

test("overconfidence on hard items", () => {
  const out = { recommended_taxon_name: "スズメ", recommended_rank: "species", confidence_band: "high", narrative: "鳥" };
  const s = scoreItem(out, { must_any: [["鳥"]], max_band: "medium", max_rank: "genus" });
  assert.deepEqual(s.flags, ["overconfident_band", "overconfident_rank"]);
  assert.equal(s.score, 60);
});

test("non-organism items penalize forced species talk and missing environment", () => {
  const forced = { recommended_taxon_name: "イネ", recommended_rank: "species", confidence_band: "high", narrative: "田んぼ" };
  assert.deepEqual(scoreItem(forced, { must_any: [["田"]], organism: false }).flags, ["forced_organism", "no_environment"]);
  const good = { recommended_taxon_name: "植物", recommended_rank: "lifeform", confidence_band: "low", narrative: "棚田の景観", area_inference: area };
  assert.equal(scoreItem(good, { must_any: [["棚田"], ["斜面"]], organism: false }).score, 100);
});

test("hidden subject must be found on the right photo", () => {
  const exp = { must_any: [["鳥"]], subjects: [{ asset_index: 0, label: "鳥", box_2d: [245, 495, 290, 595] as [number, number, number, number] }] };
  const hit = { recommended_taxon_name: "鳥類", narrative: "枝の奥に鳥", recommended_media_regions: [{ asset_index: 0, rect: { x: 0.5, y: 0.24, width: 0.08, height: 0.04 } }] };
  assert.deepEqual(scoreItem(hit, exp).flags, []);
  const wrongPhoto = { ...hit, recommended_media_regions: [{ asset_index: 1, rect: { x: 0.5, y: 0.24, width: 0.08, height: 0.04 } }] };
  assert.ok(scoreItem(wrongPhoto, exp).flags.includes("missed_subject:鳥@0"));
  const plantsOnly = { recommended_taxon_name: "樹木", narrative: "鳥はいない林", coexisting_taxa: [{ name: "樹木・低木", media_regions: [] }] };
  assert.ok(scoreItem(plantsOnly, exp).flags.includes("missed_subject:鳥@0"));
});

test("recommend picks cheapest without large quality drop", () => {
  const row = (id: string, quality: number, cost: number, win: number | null = 0.5, fail = 0): ConfigAggregate => ({ id, n: 10, quality, p50ms: 1000, p95ms: 2000, costPer1000Usd: cost, failureRate: fail, winRateVsBaseline: win, byCategory: {} });
  assert.equal(recommend([row("prod", 80, 40, null), row("cheap", 78, 5), row("bad", 60, 1)], "prod"), "cheap");
  assert.equal(recommend([row("prod", 80, 40, null), row("cheap", 78, 5, 0.2)], "prod"), "prod");
  assert.equal(recommend([row("prod", 80, 40, null), row("flaky", 85, 5, 0.6, 0.3)], "prod"), "prod");
  assert.equal(recommend([row("prod", 80, 40, null), { ...row("slow", 80, 1), p95ms: 200_000 }], "prod"), "slow");
  assert.equal(recommend([row("prod", 80, 40, null), { ...row("tooslow", 80, 1), p95ms: 400_000 }], "prod"), "prod");
});

test("rank correlation and quantile", () => {
  assert.equal(spearman(["a", "b", "c"], ["a", "b", "c"]), 1);
  assert.equal(spearman(["a", "b", "c"], ["c", "b", "a"]), -1);
  assert.equal(quantile([5, 1, 3], 0.5), 3);
});

test("bench spec items carry conditions and adding a model is two config lines", () => {
  const spec = JSON.parse(readFileSync(new URL("../../tools/obs-feedback-bench/v1/spec.json", import.meta.url), "utf8"));
  assert.ok(spec.items.length >= 30 && spec.items.length <= 60);
  for (const it of spec.items) assert.ok(it.expect?.must_any?.length, it.id);
  const cats = new Set(spec.items.map((i: { category: string }) => i.category));
  for (const c of ["organism", "landscape", "environment", "built", "hard"]) assert.ok(cats.has(c), c);
  const cfg = JSON.parse(readFileSync(new URL("../../tools/obs-feedback-bench/configs.json", import.meta.url), "utf8"));
  for (const c of cfg.configs) for (const m of [c.extract, c.summary, c.sweep, c.card, c.translate, c.verify].filter(Boolean)) assert.ok(cfg.prices[m], m);
});
