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

test("renderObservationCard shows public registered area subline only for safe area fields", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    fieldRefs: [{
      fieldId: "field-1",
      name: "浜松城公園",
      source: "user_defined",
      adminLevel: "osm_park",
    }],
  }, { locationMode: "public" });

  assert.match(html, /obs-card-area/);
  assert.match(html, /浜松市 · 浜松城公園/);
  assert.doesNotMatch(html, /浜松城公園 共生エリア/);
});

test("renderObservationCard shows boundary park candidates without declaring one area", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    municipality: "静岡市葵区",
    publicLocation: {
      ...observation.publicLocation,
      label: "静岡市葵区",
    },
    fieldRefs: [
      {
        fieldId: "field-aoba",
        name: "青葉緑地",
        source: "user_defined",
        adminLevel: "osm_park",
      },
      {
        fieldId: "field-tokiwa",
        name: "常磐公園",
        source: "user_defined",
        adminLevel: "osm_park",
      },
    ],
  }, { locationMode: "public" });

  assert.match(html, /静岡市葵区 · 常磐公園 \/ 青葉緑地 付近/);
  assert.doesNotMatch(html, /静岡市葵区 · 青葉緑地<\/div>/);
});

test("renderObservationCard does not show admin boundary fields as area sublines", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    fieldRefs: [{
      fieldId: "field-2",
      name: "静岡県 浜松市",
      source: "user_defined",
      adminLevel: "admin_municipality",
    }],
  }, { locationMode: "public" });

  assert.doesNotMatch(html, /obs-card-area/);
  assert.doesNotMatch(html, /浜松市 · 静岡県 浜松市/);
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

test("renderObservationCard shows video thumbnail as a video card", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    photoUrl: null,
    mediaUrl: "https://customer.example/video-thumbnail.jpg",
    hasVideo: true,
  }, { locationMode: "public" });

  assert.match(html, /obs-card-video-mark/);
  assert.match(html, /customer\.example\/video-thumbnail\.jpg/);
  assert.match(html, /aria-label="動画"/);
});

test("renderObservationCard does not show non-taxon scene labels as species", () => {
  const html = renderObservationCard("", "ja", {
    ...observation,
    displayName: "芝生",
    vernacularName: null,
    scientificName: null,
    aiCandidateName: "芝生",
    isAiCandidate: true,
  }, { locationMode: "public" });

  assert.match(html, /同定待ち/);
  assert.doesNotMatch(html, /芝生/);
});
