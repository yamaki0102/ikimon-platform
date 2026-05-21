import assert from "node:assert/strict";
import test from "node:test";
import { chooseAdminLocalityForPoint } from "./adminLocalityResolver.js";

test("chooseAdminLocalityForPoint picks the containing municipality polygon", () => {
  const locality = chooseAdminLocalityForPoint(26.2124, 127.6809, [
    {
      field_id: "naha",
      name: "沖縄県 那覇市",
      prefecture: "沖縄県",
      city: "那覇市",
      area_ha: "3900",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [127.60, 26.15],
          [127.75, 26.15],
          [127.75, 26.28],
          [127.60, 26.28],
          [127.60, 26.15],
        ]],
      },
    },
  ]);

  assert.deepEqual(locality, {
    fieldId: "naha",
    prefecture: "沖縄県",
    municipality: "那覇市",
    name: "沖縄県 那覇市",
  });
});

test("chooseAdminLocalityForPoint prefers the smallest containing area", () => {
  const locality = chooseAdminLocalityForPoint(34.71, 137.72, [
    {
      field_id: "hamamatsu",
      name: "静岡県 浜松市",
      prefecture: "静岡県",
      city: "浜松市",
      area_ha: "155800",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.40, 34.50],
          [138.20, 34.50],
          [138.20, 35.30],
          [137.40, 35.30],
          [137.40, 34.50],
        ]],
      },
    },
    {
      field_id: "chuo",
      name: "静岡県 浜松市中央区",
      prefecture: "静岡県",
      city: "浜松市中央区",
      area_ha: "27000",
      polygon: {
        type: "Polygon",
        coordinates: [[
          [137.60, 34.60],
          [137.85, 34.60],
          [137.85, 34.82],
          [137.60, 34.82],
          [137.60, 34.60],
        ]],
      },
    },
  ]);

  assert.equal(locality?.fieldId, "chuo");
  assert.equal(locality?.municipality, "浜松市中央区");
});
