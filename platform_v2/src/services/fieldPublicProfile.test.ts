import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFieldPublicProfileReadiness, normalizeFieldPublicProfileRules } from "./fieldPublicProfileRules.js";
import { buildFieldPublicProfile } from "./fieldPublicProfile.js";

const ready = evaluateFieldPublicProfileReadiness(normalizeFieldPublicProfileRules({}), {
  observationCount: 8,
  observerCount: 4,
  timeSpanDays: 30,
  sourceRecordCount: 8,
  sensitiveContextCount: 0,
});

test("field public profile exposes area value without exact pin coordinates", () => {
  const profile = buildFieldPublicProfile({
    field: {
      fieldId: "field-1",
      name: "牧志公園",
      placeType: "park",
      prefecture: "沖縄県",
      city: "那覇市",
      lat: 26.2179484,
      lng: 127.6918878,
      radiusM: 50,
    },
    readiness: ready,
    confirmedTaxa: [
      { name: "ツバメ", observationCount: 3, seasonLabels: ["春"] },
      { name: "シロツメクサ", observationCount: 5, seasonLabels: ["春", "初夏"] },
    ],
    environmentTypes: ["草地", "樹木", "花壇"],
    observationDensityLabel: "育ち始め",
    nextObservationPrompts: ["夏の訪花昆虫を見たい", "雨上がりの足元を比べたい"],
  });

  assert.equal(profile.placeName, "牧志公園");
  assert.equal(profile.placeType, "park");
  assert.equal(profile.publicLocation.mode, "site");
  assert.equal(profile.publicLocation.exactLat, undefined);
  assert.equal(profile.publicLocation.exactLng, undefined);
  assert.deepEqual(profile.confirmedTaxa.map((taxon) => taxon.name), ["シロツメクサ", "ツバメ"]);
  assert.match(profile.confidence.label, /公開条件を満たした記録/);
  assert.deepEqual(profile.nextObservationPrompts, ["夏の訪花昆虫を見たい", "雨上がりの足元を比べたい"]);
});

test("field public profile suppresses details below aggregation thresholds", () => {
  const suppressedReadiness = evaluateFieldPublicProfileReadiness(normalizeFieldPublicProfileRules({}), {
    observationCount: 2,
    observerCount: 2,
    timeSpanDays: 30,
    sourceRecordCount: 2,
    sensitiveContextCount: 0,
  });
  const profile = buildFieldPublicProfile({
    field: {
      fieldId: "field-1",
      name: "牧志公園",
      placeType: "park",
      prefecture: "沖縄県",
      city: "那覇市",
      lat: 26.2179484,
      lng: 127.6918878,
      radiusM: 50,
    },
    readiness: suppressedReadiness,
    confirmedTaxa: [{ name: "ツバメ", observationCount: 1, seasonLabels: ["春"] }],
    environmentTypes: ["草地"],
    observationDensityLabel: "少数",
    nextObservationPrompts: [],
  });

  assert.deepEqual(profile.confirmedTaxa, []);
  assert.equal(profile.limitations[0]?.reason, "min_observation_count");
  assert.match(profile.limitations[0]?.label ?? "", /確認記録が少ない/);
});
