import assert from "node:assert/strict";
import test from "node:test";
import type { LandingObservation, LandingSnapshot } from "../services/readModels.js";
import { renderFieldNoteMain } from "./fieldNoteMain.js";

const publicLocation = {
  label: "浜松市",
  scope: "municipality" as const,
  cellId: "3000:1:2",
  gridM: 3000,
  radiusM: 2121,
  centroidLat: 34.71,
  centroidLng: 137.72,
  displayMode: "area" as const,
};

const observation: LandingObservation = {
  occurrenceId: "occ-1",
  visitId: "visit-1",
  displayName: "モンシロチョウ",
  observedAt: "2026-04-08T09:00:00.000Z",
  observerName: "テスト観察者",
  placeName: "浜松城公園 共生エリア",
  municipality: "浜松市",
  publicLocation,
  photoUrl: "/uploads/real.jpg",
  identificationCount: 2,
  latitude: 34.7116,
  longitude: 137.7274,
  observerUserId: "user-1",
  observerAvatarUrl: null,
};

const snapshot: LandingSnapshot = {
  viewerUserId: null,
  stats: { observationCount: 1, speciesCount: 1, placeCount: 1 },
  feed: [observation],
  myFeed: [],
  myPlaces: [],
  mapPreviewCells: [],
  ambient: [{
    userId: "guest_abc123",
    displayName: "Guest",
    avatarUrl: null,
    latestPhotoUrl: "/uploads/guest-latest.jpg",
    latestObservedAt: "2026-04-08T09:00:00.000Z",
    latestDisplayName: "タンポポ属",
  }],
  habit: null,
};

test("field note guest ambient links open the guest notebook instead of a missing profile", () => {
  const html = renderFieldNoteMain("", "ja", snapshot);

  assert.match(html, /href="\/guest\/guest_abc123\?lang=ja"/);
  assert.match(html, /\/uploads\/guest-latest\.jpg/);
  assert.doesNotMatch(html, /\/profile\/guest_abc123/);
});
