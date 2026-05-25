import assert from "node:assert/strict";
import test from "node:test";
import { publicRegisteredAreaLine } from "./publicAreaLabel.js";

test("publicRegisteredAreaLine shows a single safe registered area", () => {
  assert.equal(publicRegisteredAreaLine({
    municipality: "静岡市葵区",
    fieldRefs: [{
      fieldId: "field-1",
      name: "常磐公園",
      source: "user_defined",
      adminLevel: "osm_park",
    }],
  }), "静岡市葵区 · 常磐公園");
});

test("publicRegisteredAreaLine avoids declaring one park at a boundary", () => {
  assert.equal(publicRegisteredAreaLine({
    municipality: "静岡市葵区",
    fieldRefs: [
      {
        fieldId: "field-a",
        name: "青葉緑地",
        source: "user_defined",
        adminLevel: "osm_park",
      },
      {
        fieldId: "field-t",
        name: "常磐公園",
        source: "user_defined",
        adminLevel: "osm_park",
      },
      {
        fieldId: "field-admin",
        name: "静岡県 静岡市葵区",
        source: "user_defined",
        adminLevel: "admin_municipality",
      },
    ],
  }), "静岡市葵区 · 常磐公園 / 青葉緑地 付近");
});

test("publicRegisteredAreaLine deduplicates duplicate imports before ambiguity copy", () => {
  assert.equal(publicRegisteredAreaLine({
    municipality: "静岡市葵区",
    fieldRefs: [
      {
        fieldId: "field-t1",
        name: "常磐公園",
        source: "user_defined",
        adminLevel: "osm_park",
      },
      {
        fieldId: "field-t2",
        name: "常磐公園",
        source: "user_defined",
        adminLevel: "osm_park",
      },
    ],
  }), "静岡市葵区 · 常磐公園");
});
