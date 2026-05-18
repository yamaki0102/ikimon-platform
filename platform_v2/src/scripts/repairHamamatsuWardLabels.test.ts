import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./repairHamamatsuWardLabels.js";

const hamanaWard = {
  field_id: "ward-hamana",
  city: "浜名区",
  name: "静岡県 浜名区",
  label: "浜松市浜名区",
  polygon: {
    type: "Polygon",
    coordinates: [[
      [137.70, 34.75],
      [137.90, 34.75],
      [137.90, 34.90],
      [137.70, 34.90],
      [137.70, 34.75],
    ]],
  },
};

test("wardLabelFromField composes designated-city ward labels", () => {
  assert.equal(__test__.wardLabelFromField({ city: "浜名区", name: "静岡県 浜名区" }), "浜松市浜名区");
  assert.equal(__test__.wardLabelFromField({ city: "浜松市中央区", name: "静岡県 浜松市中央区" }), "浜松市中央区");
  assert.equal(__test__.wardLabelFromField({ city: "", name: "静岡県 浜松市天竜区" }), "浜松市天竜区");
});

test("buildPlans only repairs coarse Hamamatsu labels inside ward polygons", () => {
  const plans = __test__.buildPlans([
    { id: "visit-1", lat: 34.8, lng: 137.8, current: "浜松市" },
    { id: "visit-2", lat: 34.8, lng: 137.8, current: "浜松市浜名区" },
    { id: "visit-3", lat: 34.4, lng: 137.8, current: "浜松市" },
  ], [hamanaWard]);

  assert.deepEqual(plans, [
    { id: "visit-1", current: "浜松市", next: "浜松市浜名区", lat: 34.8, lng: 137.8 },
  ]);
});

test("isCoarseHamamatsuLabel recognizes legacy coarse labels", () => {
  assert.equal(__test__.isCoarseHamamatsuLabel("浜松市"), true);
  assert.equal(__test__.isCoarseHamamatsuLabel("hamamatsu city"), true);
  assert.equal(__test__.isCoarseHamamatsuLabel("浜松市浜名区"), false);
});
