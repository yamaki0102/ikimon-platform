import assert from "node:assert/strict";
import test from "node:test";
import {
  __test__,
  buildPlaceAtlasProfile,
  dedupePlaceAtlasRecords,
  normalizePlaceAtlasRef,
  type PlaceAtlasBuildInput,
  type PlaceAtlasSourceRecord,
} from "./placeAtlasContract.js";

const fieldRef = { kind: "field", fieldId: "d50678d0-ba57-4d3d-a713-2fe441d646ab" } as const;

function buildInput(records: PlaceAtlasSourceRecord[] | null): PlaceAtlasBuildInput {
  return {
    placeRef: fieldRef,
    place: {
      name: "常磐公園",
      type: "park",
      localityLabel: "静岡市",
      description: "公開情報と地域の記録を束ねた場所図鑑です。",
    },
    records,
    recordSetComplete: true,
    locationMode: "public_cell_derived",
    contributorCountAllowed: true,
    suppressedSections: ["field_exact_aggregation", "confirmed_life"],
    sources: ["field_registry", "public_map_snapshot"],
    generatedAt: "2026-07-23T00:00:00.000Z",
    now: "2026-07-23T00:00:00.000Z",
  };
}

test("normalizes stable field, OSM area, and public cell references", () => {
  assert.deepEqual(normalizePlaceAtlasRef({ kind: "field", field_id: fieldRef.fieldId }), fieldRef);
  assert.deepEqual(normalizePlaceAtlasRef({
    kind: "osm_area",
    entity_key: "osm:way:125727939",
    osm_type: "way",
    osm_id: "125727939",
  }), {
    kind: "osm_area",
    entityKey: "osm:way:125727939",
    osmType: "way",
    osmId: 125727939,
  });
  assert.deepEqual(normalizePlaceAtlasRef({ kind: "public_cell", cell_id: "1000:15396:4160" }), {
    kind: "public_cell",
    cellId: "1000:15396:4160",
  });
  assert.deepEqual(normalizePlaceAtlasRef({ kind: "public_cell", cell_id: "cell:34.97,138.38" }), {
    kind: "public_cell",
    cellId: "cell:34.97,138.38",
  });
});

test("rejects mismatched OSM identity, raw coordinates, and invalid cell IDs", () => {
  assert.equal(normalizePlaceAtlasRef({
    kind: "osm_area",
    entity_key: "osm:way:999",
    osm_type: "way",
    osm_id: 125727939,
  }), null);
  assert.equal(normalizePlaceAtlasRef({ kind: "point", lat: 34.9702, lng: 138.3805 }), null);
  assert.equal(normalizePlaceAtlasRef({ kind: "public_cell", cell_id: "cell:91,138.38" }), null);
});

test("deduplicates multiple Occurrence-like rows by Record and keeps the richer media row", () => {
  const records = dedupePlaceAtlasRecords([
    {
      recordId: "record-1",
      observedAt: "2026-05-01T00:00:00Z",
      displayName: "AI候補",
      identificationStatus: "ai_candidate",
      mediaUrl: null,
      taxonGroup: "bird",
    },
    {
      recordId: "record-1",
      observedAt: "2026-05-02T00:00:00Z",
      displayName: "同定待ち",
      identificationStatus: "awaiting_identification",
      mediaUrl: "/derived/record-1/display.webp",
      mediaKind: "photo",
      taxonGroup: "bird",
    },
  ]);

  assert.equal(records.length, 1);
  assert.equal(records[0]?.recordId, "record-1");
  assert.equal(records[0]?.mediaUrl, "/derived/record-1/display.webp");
  assert.equal(records[0]?.observedAt, "2026-05-02T00:00:00Z");
});

test("deduplicates representative media URLs across distinct Records", () => {
  const profile = buildPlaceAtlasProfile(buildInput([
    {
      recordId: "record-1",
      observedAt: "2026-07-20T00:00:00Z",
      mediaUrl: "/derived/shared/display.webp",
      mediaKind: "photo",
      taxonGroup: "bird",
      contributorKey: "user-1",
    },
    {
      recordId: "record-2",
      observedAt: "2026-07-19T00:00:00Z",
      mediaUrl: "/derived/shared/display.webp",
      mediaKind: "photo",
      taxonGroup: "bird",
      contributorKey: "user-2",
    },
    {
      recordId: "record-3",
      observedAt: "2026-07-18T00:00:00Z",
      mediaUrl: "/derived/third/display.webp",
      mediaKind: "photo",
      taxonGroup: "bird",
      contributorKey: "user-3",
    },
  ]));

  assert.equal(profile.summary.recordCount, 3);
  assert.equal(profile.place.representativeMedia.length, 2);
  assert.deepEqual(profile.place.representativeMedia.map((media) => media.url), [
    "/derived/shared/display.webp",
    "/derived/third/display.webp",
  ]);
});

test("builds deterministic facets and highlights without treating AI candidates as confirmed species", () => {
  const profile = buildPlaceAtlasProfile(buildInput([
    {
      recordId: "record-1",
      observedAt: "2026-04-20T00:00:00Z",
      displayName: "AI候補の鳥",
      taxonGroup: "bird",
      identificationStatus: "ai_candidate",
      contributorKey: "user-1",
    },
    {
      recordId: "record-2",
      observedAt: "2026-04-21T00:00:00Z",
      displayName: "同定待ち",
      taxonGroup: "bird",
      identificationStatus: "awaiting_identification",
      contributorKey: "user-2",
    },
    {
      recordId: "record-3",
      observedAt: "2026-04-22T00:00:00Z",
      displayName: "人が確認した鳥",
      taxonGroup: "bird",
      identificationStatus: "confirmed",
      contributorKey: "user-3",
    },
  ]));

  assert.deepEqual(profile.facets.map((facet) => [facet.key, facet.count]), [["nature", 3]]);
  assert.ok(profile.highlights.some((highlight) => highlight.kind === "seasonal_pattern"));
  assert.ok(profile.highlights.some((highlight) => highlight.kind === "dominant_theme"));
  assert.ok(!JSON.stringify(profile).includes("確認種数"));
  assert.ok(profile.recentRecords.some((record) => record.identificationStatus === "ai_candidate"));
});

test("distinguishes unknown counts, verified zero, and threshold suppression", () => {
  const unknown = buildPlaceAtlasProfile(buildInput(null));
  assert.equal(unknown.summary.recordCount, null);
  assert.equal(unknown.publication.status, "suppressed");

  const empty = buildPlaceAtlasProfile(buildInput([]));
  assert.equal(empty.summary.recordCount, 0);
  assert.equal(empty.publication.status, "partial");

  const underThreshold = buildPlaceAtlasProfile(buildInput([
    { recordId: "record-1", observedAt: "2026-07-20T00:00:00Z" },
    { recordId: "record-2", observedAt: "2026-07-21T00:00:00Z" },
  ]));
  assert.equal(underThreshold.summary.recordCount, null);
  assert.equal(underThreshold.recentRecords.length, 0);
  assert.ok(underThreshold.publication.suppressedSections.includes("recent_records"));
});

test("an incomplete Record set is explicitly partial and never presents a false total", () => {
  const input = buildInput([
    { recordId: "record-1", observedAt: "2026-07-20T00:00:00Z" },
    { recordId: "record-2", observedAt: "2026-07-21T00:00:00Z" },
    { recordId: "record-3", observedAt: "2026-07-22T00:00:00Z" },
  ]);
  const profile = buildPlaceAtlasProfile({
    ...input,
    recordSetComplete: false,
    locationMode: "field",
    suppressedSections: [],
  });
  assert.equal(profile.publication.status, "partial");
  assert.equal(profile.summary.recordCount, null);
});

test("does not return contributor count when any contributor is unavailable", () => {
  const profile = buildPlaceAtlasProfile(buildInput([
    { recordId: "record-1", observedAt: "2026-07-20T00:00:00Z", contributorKey: "user-1" },
    { recordId: "record-2", observedAt: "2026-07-21T00:00:00Z", contributorKey: null },
    { recordId: "record-3", observedAt: "2026-07-22T00:00:00Z", contributorKey: "user-3" },
  ]));
  assert.equal(profile.summary.contributorCount, null);
  assert.ok(profile.dataGaps.some((gap) => gap.key === "contributors"));
});

test("rejects unsafe media URLs instead of rendering them", () => {
  const profile = buildPlaceAtlasProfile(buildInput([
    { recordId: "record-1", observedAt: "2026-07-20T00:00:00Z", mediaUrl: "javascript:alert(1)" },
    { recordId: "record-2", observedAt: "2026-07-21T00:00:00Z", mediaUrl: "//evil.example/x.jpg" },
    { recordId: "record-3", observedAt: "2026-07-22T00:00:00Z", mediaUrl: "https://cdn.example/x.jpg" },
    { recordId: "record-4", observedAt: "2026-07-23T00:00:00Z", mediaUrl: "https://media.ikimon.life/x.jpg" },
    { recordId: "record-5", observedAt: "2026-07-24T00:00:00Z", mediaUrl: "/api/v1/auth/session" },
    { recordId: "record-6", observedAt: "2026-07-25T00:00:00Z", mediaUrl: "/uploads/../api/v1/auth/session" },
  ]));
  assert.deepEqual(profile.place.representativeMedia.map((media) => media.url), ["https://media.ikimon.life/x.jpg"]);
  assert.equal(profile.recentRecords.find((record) => record.recordId === "record-5")?.mediaUrl, null);
  assert.equal(profile.recentRecords.find((record) => record.recordId === "record-6")?.mediaUrl, null);
});

test("media URL allowlist accepts ZUKAN and legacy hosts but rejects evil suffixes", () => {
  assert.equal(
    __test__.safeMediaUrl("https://zukan.earth/derived/record/display.webp"),
    "https://zukan.earth/derived/record/display.webp",
  );
  assert.equal(
    __test__.safeMediaUrl("https://media.zukan.earth/uploads/record/photo.webp"),
    "https://media.zukan.earth/uploads/record/photo.webp",
  );
  assert.equal(
    __test__.safeMediaUrl("https://media.ikimon.life/derived/record/display.webp"),
    "https://media.ikimon.life/derived/record/display.webp",
  );
  assert.equal(__test__.safeMediaUrl("https://zukan.earth.evil.example/derived/photo.webp"), null);
  assert.equal(__test__.safeMediaUrl("https://ikimon.life.evil.example/derived/photo.webp"), null);
});

test("connects guide, memories, and facilities to place-atlas facets without fake Occurrences", () => {
  const input = buildInput([]);
  input.guide = { id: "guide-1", category: "heritage", title: "場所の歴史" };
  input.memories = [{ entryId: "memory-1", echoNote: "朝の散歩" }];
  input.facilities = [{ kind: "bench", label: "ベンチ" }];
  const profile = buildPlaceAtlasProfile(input);

  assert.deepEqual(profile.facets.map((facet) => facet.key), [
    "daily_life",
    "facility",
    "history",
    "insight",
  ]);
  assert.equal(profile.summary.recordCount, 0);
  assert.equal(profile.recentRecords.length, 0);
});
