import assert from "node:assert/strict";
import test from "node:test";
import {
  computePublicLocationView,
  isNearDynamicHomeArea,
  stripJpegExifAndGpsMetadata
} from "./locationPrivacy";

test("computePublicLocationView enforces home masking, 24h delay, 3-author 10km widening, child/rare 10km, and public place snapping", () => {
  const nowMs = Date.parse("2026-11-23T12:00:00.000Z");

  // 1. Dynamic home area (<300m from >=2 night points) hides location and shows ownerNotice
  const nearHome = computePublicLocationView({
    lat: 34.7005,
    lng: 137.7005,
    observedAt: "2026-11-20T12:00:00.000Z",
    nowMs,
    locationShareMode: "public_place",
    nearbyPublicPlace: { placeId: "plc_1", name: "常盤公園", distanceM: 50 },
    ownerNightPoints: [
      { lat: 34.7004, lng: 137.7004 },
      { lat: 34.7006, lng: 137.7006 }
    ]
  });
  assert.equal(nearHome.mode, "hidden");
  assert.equal(nearHome.publicCell, null);
  assert.match(nearHome.ownerNotice, /家のまわりなので位置を伏せました/);
  assert.equal(nearHome.exactLocationExposed, false);

  // 2. Within 24 hours: delayed on public surfaces (unless public event / fixed point)
  const delayed = computePublicLocationView({
    lat: 34.75,
    lng: 137.75,
    observedAt: "2026-11-23T06:00:00.000Z",
    nowMs,
    locationShareMode: "grid",
    distinctAuthorsIn1kmCell: 5
  });
  assert.equal(delayed.mode, "delayed");
  assert.equal(delayed.publicCell, null);
  assert.equal(delayed.publicDate, "2026-11-23");

  // 3. <3 distinct authors in 1km cell widens to ~10km grid
  const sparse = computePublicLocationView({
    lat: 34.752,
    lng: 137.752,
    observedAt: "2026-11-20T12:00:00.000Z",
    nowMs,
    locationShareMode: "grid",
    distinctAuthorsIn1kmCell: 2
  });
  assert.equal(sparse.mode, "grid_10km");
  assert.equal(sparse.gridMeters, 10000);
  assert.equal(sparse.publicCell, "cell:34.8,137.8");

  // 4. Child or rare species always uses ~10km grid even if public place is nearby
  const rare = computePublicLocationView({
    lat: 34.752,
    lng: 137.752,
    observedAt: "2026-11-20T12:00:00.000Z",
    nowMs,
    locationShareMode: "public_place",
    nearbyPublicPlace: { placeId: "plc_1", name: "常盤公園", distanceM: 20 },
    isChildOrRareSpecies: true,
    distinctAuthorsIn1kmCell: 10
  });
  assert.equal(rare.mode, "grid_10km");
  assert.equal(rare.placeId, null);

  // 5. Public place snap when mode === "public_place" and >=24h
  const snapped = computePublicLocationView({
    lat: 34.752,
    lng: 137.752,
    observedAt: "2026-11-20T12:00:00.000Z",
    nowMs,
    locationShareMode: "public_place",
    nearbyPublicPlace: { placeId: "plc_1", name: "常盤公園", distanceM: 20 },
    distinctAuthorsIn1kmCell: 10
  });
  assert.equal(snapped.mode, "public_place");
  assert.equal(snapped.publicLabel, "常盤公園で");
  assert.equal(snapped.placeId, "plc_1");
});

test("stripJpegExifAndGpsMetadata removes APP1 EXIF/GPS segment while preserving JPEG image markers", () => {
  const fakeExif = new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // APP1 Exif
    0xff, 0xdb, 0x00, 0x04, 0x01, 0x02, // DQT
    0xff, 0xda, 0x00, 0x03, 0x01, 0x11, 0x22, // SOS + data
    0xff, 0xd9 // EOI
  ]);
  const stripped = stripJpegExifAndGpsMetadata(fakeExif);
  assert.equal(stripped[0], 0xff);
  assert.equal(stripped[1], 0xd8);
  assert.equal(stripped[2], 0xff);
  assert.equal(stripped[3], 0xdb);
  assert.equal(stripped.includes(0xe1), false);
  assert.equal(isNearDynamicHomeArea(34.7, 137.7, [{ lat: 34.7, lng: 137.7 }, { lat: 34.7001, lng: 137.7001 }]), true);
});
