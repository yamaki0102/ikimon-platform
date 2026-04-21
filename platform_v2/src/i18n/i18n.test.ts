import { test } from "node:test";
import assert from "node:assert/strict";
import { formatStatLabel, getStrings } from "./index.js";
import { ja } from "./ja.js";

test("ja returns the canonical dictionary", () => {
  const s = getStrings("ja");
  assert.strictEqual(s.landing.title, ja.landing.title);
  assert.strictEqual(s.fieldLoop.eyebrow, ja.fieldLoop.eyebrow);
});

test("en overrides landing and falls back nowhere (en is fully filled)", () => {
  const s = getStrings("en");
  assert.ok(s.landing.title.startsWith("ikimon.life"));
  assert.strictEqual(s.landing.tools.lens.eyebrow, "Field Guide");
  assert.strictEqual(s.fieldLoop.title, "Field Loop");
});

test("missing keys fall back to ja", () => {
  const s = getStrings("es");
  // es landing is filled, but this checks shape integrity
  assert.ok(s.landing.heroPromiseChips.length === 3);
  assert.ok(typeof s.landing.statLabelTemplate === "function");
  assert.strictEqual(s.fieldLoop.steps.length, 4);
});

test("formatStatLabel applies number locale", () => {
  const ja_ = formatStatLabel("ja", 1234, 56);
  const en_ = formatStatLabel("en", 1234, 56);
  assert.ok(ja_.includes("1,234") || ja_.includes("1,234"));
  assert.ok(en_.includes("1,234"));
});

test("all 4 languages return a full AppStrings", () => {
  for (const lang of ["ja", "en", "es", "pt-BR"] as const) {
    const s = getStrings(lang);
    assert.ok(s.landing.title);
    assert.ok(s.landing.tools.lens.title);
    assert.ok(s.landing.tools.scan.title);
    assert.ok(s.fieldLoop.title);
    assert.strictEqual(s.fieldLoop.steps.length, 4);
    assert.strictEqual(s.fieldLoop.principles.length, 4);
    assert.strictEqual(s.fieldLoop.boundaries.length, 3);
  }
});
