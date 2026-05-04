import assert from "node:assert/strict";
import test from "node:test";
import { __test__ } from "./observationEventAreaSignals.js";
import type { ObservationField } from "./observationFieldRegistry.js";

const center = { lat: 34.6984, lng: 137.7043 };

test("area local signals classify parks, footways, and major roads", () => {
  const signals = __test__.summarizeAreaLocalSignals({
    center,
    elements: [
      {
        tags: { leisure: "park", name: "西伊場第一公園" },
        center: { lat: 34.6969, lon: 137.7044 },
      },
      {
        tags: { highway: "footway" },
        center: { lat: 34.6985, lon: 137.7044 },
      },
      {
        tags: { highway: "primary", name: "県道" },
        center: { lat: 34.6986, lon: 137.705 },
      },
      {
        tags: { landuse: "grass" },
        center: { lat: 34.6988, lon: 137.7046 },
      },
    ],
  });

  assert.equal(signals.parks[0]?.name, "西伊場第一公園");
  assert.equal(signals.footwayCount, 1);
  assert.equal(signals.majorRoads[0]?.kind, "primary");
  assert.equal(signals.greenHints.includes("公園"), true);
  assert.equal(signals.greenHints.includes("grass"), true);
  assert.equal(signals.warnings.includes("太い道路の横断が必要なら範囲を分けてください。"), true);
});

test("area local signals also reuse imported OSM park fields", () => {
  const field = {
    fieldId: "00000000-0000-0000-0000-000000000001",
    source: "user_defined",
    adminLevel: "osm_park",
    name: "西伊場一条公園",
    nameKana: "",
    summary: "",
    prefecture: "",
    city: "",
    lat: 34.695,
    lng: 137.706,
    radiusM: 100,
    polygon: null,
    areaHa: null,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUserId: null,
    payload: {},
    createdAt: "",
    updatedAt: "",
  } satisfies ObservationField;

  const signals = __test__.summarizeAreaLocalSignals({ center, nearbyFields: [field] });
  assert.equal(signals.parks[0]?.name, "西伊場一条公園");
  assert.equal(signals.parks[0]?.source, "field_osm_park");
});
