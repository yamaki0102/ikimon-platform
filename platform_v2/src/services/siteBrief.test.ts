import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { composeSiteBrief, type SiteSignals } from "./siteBrief.js";

const emptySignals: SiteSignals = {
  landcover: [],
  nearbyLandcover: [],
  waterDistanceM: null,
  elevationM: null,
};

test("site brief fallback gives a field-check task instead of a generic non-answer", () => {
  const brief = composeSiteBrief(emptySignals, "ja");

  assert.equal(brief.hypothesis.id, "generic");
  assert.equal(brief.hypothesis.label, "現地確認が必要な空白地点");
  assert.ok(brief.hypothesis.confidence < 0.25);
  assert.ok(!brief.reasons.includes("手がかりが少ない"));
  assert.ok(!brief.hypothesis.label.includes("一般的な観察ポイント"));
  assert.ok(brief.reasons.some((reason) => reason.includes("最初の記録")));
  assert.ok(brief.checks.some((check) => check.includes("地表")));
  assert.ok(brief.captureHints.some((hint) => hint.includes("10秒動画")));
});

test("site brief fallback uses partial water and elevation signals when rules do not match", () => {
  const brief = composeSiteBrief({
    landcover: [],
    nearbyLandcover: [],
    waterDistanceM: 90,
    elevationM: 24,
  }, "ja");

  assert.equal(brief.hypothesis.id, "generic");
  assert.equal(brief.hypothesis.label, "水辺近くの現地確認地点");
  assert.ok(brief.hypothesis.confidence > 0.25);
  assert.ok(brief.reasons.some((reason) => reason.includes("水域まで約 90 m")));
  assert.ok(brief.reasons.some((reason) => reason.includes("標高は約 24 m")));
  assert.ok(brief.checks.some((check) => check.includes("水際")));
});

test("site brief fallback uses landcover clues even without a rule hit", () => {
  const brief = composeSiteBrief({
    landcover: [],
    nearbyLandcover: ["bare"],
    waterDistanceM: null,
    elevationM: null,
  }, "ja");

  assert.equal(brief.hypothesis.id, "generic");
  assert.equal(brief.hypothesis.label, "部分的な手がかりの確認地点");
  assert.ok(brief.reasons.some((reason) => reason.includes("裸地")));
  assert.ok(brief.checks.some((check) => check.includes("地表")));
});

test("Japanese map explorer copy does not expose the internal mixed role label", () => {
  const source = readFileSync(new URL("../ui/mapExplorer.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /props\.lang === "ja"\s*\?\s*"[^"]*Mixed/);
  assert.doesNotMatch(source, /label: "Mixed"/);
  assert.doesNotMatch(source, /今日は Mixed/);
});
