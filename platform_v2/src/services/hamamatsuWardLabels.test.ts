import assert from "node:assert/strict";
import test from "node:test";
import {
  isCoarseHamamatsuLabel,
  resolveHamamatsuWardLabel,
  wardLabelFromField,
  type HamamatsuWardField,
} from "./hamamatsuWardLabels.js";

const hamanaWard: HamamatsuWardField = {
  fieldId: "ward-hamana",
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

test("ward labels compose designated-city ward names", () => {
  assert.equal(wardLabelFromField({ city: "浜名区", name: "静岡県 浜名区" }), "浜松市浜名区");
  assert.equal(wardLabelFromField({ city: "浜松市中央区", name: "静岡県 浜松市中央区" }), "浜松市中央区");
  assert.equal(wardLabelFromField({ city: "", name: "静岡県 浜松市天竜区" }), "浜松市天竜区");
});

test("coarse Hamamatsu labels resolve to a ward when a public coordinate falls inside a ward polygon", () => {
  assert.equal(isCoarseHamamatsuLabel("浜松市"), true);
  assert.equal(isCoarseHamamatsuLabel("浜松市浜名区"), false);
  assert.equal(
    resolveHamamatsuWardLabel({ municipality: "浜松市", latitude: 34.8, longitude: 137.8 }, [hamanaWard]),
    "浜松市浜名区",
  );
  assert.equal(
    resolveHamamatsuWardLabel({ municipality: "浜松市浜名区", latitude: 34.8, longitude: 137.8 }, [hamanaWard]),
    "浜松市浜名区",
  );
});
