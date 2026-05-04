import assert from "node:assert/strict";
import test from "node:test";
import { circleToPolygon } from "./observationEventAreaGeometry.js";
import {
  fallbackAreaPlanSuggestions,
  __test__,
} from "./observationEventAreaPlanner.js";

const input = {
  center: { lat: 34.6984, lng: 137.7043 },
  radiusM: 300,
  drawnPolygon: circleToPolygon(34.6984, 137.7043, 300),
  placeLabel: "そよら浜松西伊場",
};

test("fallback area planner always returns the three required variants", () => {
  const suggestions = fallbackAreaPlanSuggestions(input);
  assert.deepEqual(suggestions.map((s) => s.id), ["facility", "safe_walk", "nature_rich"]);
  assert.equal(suggestions.every((s) => s.geometry.type === "Polygon"), true);
});

test("LLM normalization preserves required variants and falls back per invalid item", () => {
  const raw = {
    suggestions: [
      {
        id: "facility",
        label: "そよら敷地寄せ",
        reason: "集合場所を中心にする",
        geometry: circleToPolygon(34.6984, 137.7043, 180),
        warnings: [],
      },
      { id: "safe_walk", label: "bad", reason: "bad", geometry: { type: "Polygon", coordinates: [] } },
      { id: "nature_rich", label: "自然観察寄せ", reason: "緑地側も見る", geometry: circleToPolygon(34.699, 137.705, 420) },
    ],
  };
  const suggestions = __test__.normalizeAreaPlanSuggestions(raw, input);
  assert.deepEqual(suggestions.map((s) => s.id), ["facility", "safe_walk", "nature_rich"]);
  assert.equal(suggestions[0]?.source, "gemini");
  assert.equal(suggestions[1]?.source, "fallback");
  assert.equal(suggestions[2]?.source, "gemini");
});

test("LLM normalization parses fenced JSON", () => {
  const parsed = __test__.parseJsonObject("```json\n{\"suggestions\":[]}\n```");
  assert.deepEqual(parsed, { suggestions: [] });
});

test("fallback area planner uses local OSM signals before LLM", () => {
  const suggestions = fallbackAreaPlanSuggestions({
    ...input,
    localSignals: {
      parks: [
        {
          name: "西伊場第一公園",
          lat: 34.6969,
          lng: 137.7044,
          distanceM: 170,
          source: "osm_park",
        },
      ],
      footwayCount: 2,
      majorRoads: [{ name: "県道", kind: "primary", distanceM: 120 }],
      greenHints: ["公園", "grass"],
      warnings: ["太い道路の横断が必要なら範囲を分けてください。"],
    },
  });

  const safeWalk = suggestions.find((s) => s.id === "safe_walk");
  const natureRich = suggestions.find((s) => s.id === "nature_rich");
  assert.ok(safeWalk);
  assert.ok(natureRich);
  assert.equal(safeWalk.reason.includes("歩道"), true);
  assert.equal(safeWalk.warnings.includes("太い道路の横断が必要なら範囲を分けてください。"), true);
  assert.equal(natureRich.reason.includes("西伊場第一公園"), true);
  assert.ok(natureRich.radiusM > safeWalk.radiusM);
});
