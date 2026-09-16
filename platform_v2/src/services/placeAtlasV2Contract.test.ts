import assert from "node:assert/strict";
import test from "node:test";
import { buildPlaceAtlasProfile } from "./placeAtlasContract.js";
import { buildPlaceAtlasProfileV2 } from "./placeAtlasV2Contract.js";
import { defaultPlacePolicy } from "./placeDomain.js";

test("v2 preserves the v1 Record semantics while adding canonical identity and policy", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: {
      kind: "osm_area",
      entityKey: "osm:way:1281984233",
      osmType: "way",
      osmId: 1281984233,
    },
    place: {
      name: "JUNGLIA OKINAWA",
      type: "theme_park",
      aliases: ["ジャングリア", "ジャングリア沖縄"],
      multilingualNames: { ja: "ジャングリア沖縄", en: "JUNGLIA OKINAWA" },
    },
    records: [
      {
        recordId: "record-1",
        observedAt: "2026-07-01T00:00:00Z",
        mediaKind: "photo",
        themes: ["activity"],
      },
      {
        recordId: "record-1",
        observedAt: "2026-07-01T00:00:00Z",
        mediaKind: "photo",
        themes: ["nature"],
      },
      {
        recordId: "record-2",
        observedAt: "2026-07-02T00:00:00Z",
        themes: ["scenery"],
      },
      {
        recordId: "record-3",
        observedAt: "2026-07-03T00:00:00Z",
        themes: ["facility"],
      },
    ],
    recordSetComplete: true,
    locationMode: "osm_area",
    sources: ["OpenStreetMap", "public_map_snapshot_records_v1"],
  });
  const v2 = buildPlaceAtlasProfileV2(v1, {
    boundary: {
      available: true,
      geometryKind: "Polygon",
      precision: "exact",
      confidence: 0.8,
      validationState: "source_validated",
    },
    sourceReferences: [{
      sourceType: "osm_way",
      sourceId: "1281984233",
      sourceUrl: "https://www.openstreetmap.org/way/1281984233",
      confidence: 0.8,
      verificationStatus: "source_verified",
      lastCheckedAt: "2026-07-23T00:00:00Z",
    }],
  });

  assert.equal(v2.version, 2);
  assert.equal(v2.place.placeKind, "theme_park");
  assert.equal(v2.recordSummary.recordCount, 3);
  assert.deepEqual(v2.place.aliases, ["ジャングリア", "ジャングリア沖縄"]);
  assert.equal(v2.policy.recordingPolicy, "check_rules");
  assert.equal(v2.policy.contributionCtaMode, "check_rules");
  assert.equal(v2.provenance.sourceReferences[0]?.sourceType, "osm_way");
  assert.doesNotMatch(JSON.stringify(v2), /exact_lat|exact_lng|latitude|longitude/);
});

test("public-cell v2 remains a privacy-safe fallback and distinguishes empty from zero", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "public_cell", cellId: "cell:34.97,138.38" },
    place: { name: "このあたりの地域図鑑", type: "public_cell" },
    records: [],
    recordSetComplete: true,
    locationMode: "public_cell",
    sources: ["public_map_snapshot_records_v1"],
  });
  const v2 = buildPlaceAtlasProfileV2(v1);
  assert.equal(v2.recordSummary.recordCount, 0);
  assert.equal(v2.publication.responseState, "empty");
  assert.equal(v2.place.boundary.precision, "public_cell");
  assert.equal(v2.place.boundary.available, false);
});

test("v2 preserves trusted hierarchy relations and adds next_to and route_to", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "field", fieldId: "field-1" },
    place: { name: "River park", type: "park" },
    records: [], recordSetComplete: true, locationMode: "field", sources: ["fixture"],
  });
  const v2 = buildPlaceAtlasProfileV2(v1, {
    canonicalPlaceId: "place-main",
    canonicalPlaceIds: ["place-near", "place-route", "place-other"],
    relationships: [
      { relationshipType: "next_to", placeId: "place-near", name: "Near park", placeKind: "park", verificationStatus: "source_verified" },
      { relationshipType: "route_to", placeId: "place-route", name: "Route point", placeKind: "museum", verificationStatus: "administrator_verified" },
      { relationshipType: "route_to", placeId: "place-main", name: "Self", placeKind: "park", verificationStatus: "source_verified" },
      { relationshipType: "next_to", placeId: "place-unknown", name: "Untrusted", placeKind: "park", verificationStatus: "unverified" },
      { relationshipType: "same_as_candidate", placeId: "place-other", name: "Wrong relation", placeKind: "park", verificationStatus: "source_verified" },
      { relationshipType: "next_to", placeId: "field-17", name: "Field identifier", placeKind: "park", verificationStatus: "source_verified" },
    ],
  });

  assert.deepEqual(v2.hierarchy.relationships.map(({ relationshipType, placeId }) => [relationshipType, placeId]), [
    ["next_to", "place-near"], ["route_to", "place-route"], ["same_as_candidate", "place-other"],
  ]);
});

test("only fresh public current-season source becomes the current surface", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "field", fieldId: "field-1" },
    place: { name: "River park", type: "park" },
    records: [], recordSetComplete: true, locationMode: "field", sources: ["fixture"],
  });
  const item = { recordId: "record-1", observedAt: "2026-09-10T00:00:00Z", displayLabel: "秋の記録", publicMediaUrl: null, href: "/ja/observations/record-1", verificationState: "candidate" as const };
  const historical = { ...item, recordId: "record-spring", observedAt: "2026-04-10T00:00:00Z" };
  const priorYear = { ...item, recordId: "record-prior-year", observedAt: "2025-09-10T00:00:00Z" };
  const currentSeason = { season: "autumn" as const, effectiveFrom: "2026-09-01T00:00:00Z", effectiveTo: "2026-12-01T00:00:00Z", sourceStatus: "fresh" as const, publicationStatus: "public" as const };
  const current = buildPlaceAtlasProfileV2(v1, { currentSeason: { ...currentSeason, items: [item, historical, priorYear] } });
  const stale = buildPlaceAtlasProfileV2(v1, { currentSeason: { ...currentSeason, sourceStatus: "stale", items: [item] } });
  const privateSource = buildPlaceAtlasProfileV2(v1, { currentSeason: { ...currentSeason, publicationStatus: "private", items: [item] } });

  assert.equal(current.currentSeason?.state, "current");
  assert.deepEqual(current.currentSeason?.items.map((entry) => entry.recordId), ["record-1"]);
  assert.equal(stale.currentSeason?.state, "suppressed");
  assert.equal(privateSource.currentSeason?.state, "suppressed");
  assert.equal(buildPlaceAtlasProfileV2(v1).currentSeason, null);
});

test("current-season data stays suppressed when the parent publication or sensitive-location policy is suppressed", () => {
  const v1 = buildPlaceAtlasProfile({
    placeRef: { kind: "field", fieldId: "field-1" },
    place: { name: "River park", type: "park" },
    records: [], recordSetComplete: true, locationMode: "field", sources: ["fixture"],
  });
  const currentSeason = {
    season: "autumn" as const,
    effectiveFrom: "2026-09-01T00:00:00Z",
    effectiveTo: "2026-12-01T00:00:00Z",
    sourceStatus: "fresh" as const,
    publicationStatus: "public" as const,
    items: [{ recordId: "record-1", observedAt: "2026-09-10T00:00:00Z", displayLabel: null, publicMediaUrl: null, href: null, verificationState: "verified" as const }],
  };
  const suppressedParent = buildPlaceAtlasProfileV2({
    ...v1,
    publication: { ...v1.publication, status: "suppressed" },
  }, { currentSeason });
  const sensitiveParent = buildPlaceAtlasProfileV2(v1, {
    policy: defaultPlacePolicy({ placeKind: "park", sensitiveLocation: true }),
    currentSeason,
  });

  assert.equal(suppressedParent.currentSeason?.state, "suppressed");
  assert.deepEqual(suppressedParent.currentSeason?.items, []);
  assert.equal(sensitiveParent.currentSeason?.state, "suppressed");
  assert.deepEqual(sensitiveParent.currentSeason?.items, []);
});
