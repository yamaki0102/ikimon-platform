import assert from "node:assert/strict";
import test from "node:test";
import { renderObservationCard } from "./observationCard.js";

const observation = {
  occurrenceId: "occ-1",
  visitId: "visit-1",
  displayName: "モンシロチョウ",
  observedAt: "2026-04-08T09:00:00.000Z",
  observerName: "テスト観察者",
  placeName: "浜松城公園 共生エリア",
  municipality: "浜松市",
  publicLocation: {
    label: "浜松市",
    scope: "municipality" as const,
    cellId: "3000:1:2",
    gridM: 3000,
    radiusM: 2121,
    centroidLat: 34.71,
    centroidLng: 137.72,
    displayMode: "area" as const,
  },
  photoUrl: "/uploads/sample.jpg",
  identificationCount: 2,
  latitude: 34.7116,
  longitude: 137.7274,
  observerUserId: "user-1",
  observerAvatarUrl: null,
  entryType: "observation" as const,
};

test("renderObservationCard hides exact place name in public mode", () => {
  const html = renderObservationCard("", "ja", observation, { locationMode: "public" });
  assert.match(html, /浜松市/);
  assert.doesNotMatch(html, /浜松城公園 共生エリア/);
});

test("renderObservationCard keeps canonical place line in owner mode", () => {
  const html = renderObservationCard("", "ja", observation, { locationMode: "owner" });
  assert.match(html, /浜松城公園 共生エリア/);
  assert.match(html, /浜松市/);
});

test("renderObservationCard links guest observers to notebook view", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    observerUserId: "guest_abc123",
    observerName: "Guest",
  }, { locationMode: "public" });

  assert.match(html, /href="\/ja\/guest\/guest_abc123"/);
  assert.doesNotMatch(html, /\/profile\/guest_abc123/);
  assert.match(html, /ゲスト/);
});

test("renderObservationCard marks scientific-only Japanese labels", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    displayName: "Pieris rapae",
    scientificName: "Pieris rapae",
    vernacularName: null,
  }, { locationMode: "public" });

  assert.match(html, /学名/);
  assert.match(html, /Pieris rapae/);
  assert.doesNotMatch(html, /Awaiting ID/);
});

test("renderObservationCard normalizes unknown public place fallback", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    placeName: "Unknown place",
    municipality: null,
    publicLocation: {
      ...observation.publicLocation,
      label: "位置をぼかしています",
    },
  }, { locationMode: "owner" });

  assert.match(html, /位置をぼかしています/);
  assert.doesNotMatch(html, /Unknown place/);
});
