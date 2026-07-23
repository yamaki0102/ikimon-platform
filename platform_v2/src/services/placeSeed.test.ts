import assert from "node:assert/strict";
import test from "node:test";
import {
  buildD1PlaceSeedSql,
  materializePlaceSeed,
  osmFullJsonToBoundary,
  parsePlaceSeedDocument,
  type PlaceSeedDocument,
} from "./placeSeed.js";

const document: PlaceSeedDocument = {
  schemaVersion: "universal_place_atlas_seed/v1",
  verifiedAt: "2026-07-23",
  places: [{
    placeId: "plc_1234567890abcdef",
    canonicalName: "テストモール",
    canonicalNameNormalized: "テストモール",
    aliases: [{
      value: "TEST MALL",
      language: "en",
      kind: "multilingual",
      sourceType: "official",
      confidence: 1,
    }],
    placeKind: "shopping_mall",
    localityLabel: "静岡県",
    verificationStatus: "verified",
    publicProfileStatus: "published",
    officialStatus: "official",
    publicSummary: null,
    sources: [{
      sourceReferenceId: "src_test_osm",
      sourceType: "osm",
      sourceId: "way:123",
      sourceUrl: "https://www.openstreetmap.org/way/123",
      confidence: 0.9,
      verificationStatus: "source_verified",
      precedenceRank: 40,
    }],
    boundarySourceReferenceId: "src_test_osm",
    policy: {
      recordingPolicy: "check_rules",
      photographyRuleStatus: "unknown",
      publicLocationMode: "place",
      contributionCtaMode: "check_rules",
      officialRuleUrl: null,
      verificationStatus: "unverified",
    },
  }],
};

test("seed requires a verified dynamic OSM boundary reference", () => {
  const parsed = parsePlaceSeedDocument(document);
  assert.equal(parsed.places[0]?.boundarySourceReferenceId, "src_test_osm");
  assert.throws(() => parsePlaceSeedDocument({
    ...document,
    places: [{ ...document.places[0]!, canonicalNameNormalized: "wrong" }],
  }), /canonical_name_normalization_mismatch/);
});

test("D1 seed SQL is idempotent and keeps source separate from kind", async () => {
  const materialized = await materializePlaceSeed({
    document,
    async resolveBoundary(osmType, osmId) {
      return {
        geometry: {
          type: "Polygon",
          coordinates: [[[137, 34], [138, 34], [138, 35], [137, 34]]],
        },
        actualName: "テストモール",
        actualPlaceKind: "shopping_mall",
        osmType,
        osmId,
      };
    },
  });
  assert.equal(materialized.failed.length, 0);
  const sql = buildD1PlaceSeedSql(materialized.places);
  assert.match(sql, /ON CONFLICT\(place_id\) DO UPDATE/);
  assert.match(sql, /source_type, source_id/);
  assert.match(sql, /place_kind/);
  assert.match(sql, /recording_policy/);
  assert.doesNotMatch(sql, /access=yes/);
  assert.doesNotMatch(sql, /\b(?:BEGIN|COMMIT)\b/, "Wrangler D1 execute rejects explicit transaction wrappers");
});

test("OSM full relation assembles outer and inner rings without filling a hole", () => {
  const payload = {
    elements: [
      { type: "node", id: 1, lon: 0, lat: 0 },
      { type: "node", id: 2, lon: 4, lat: 0 },
      { type: "node", id: 3, lon: 4, lat: 4 },
      { type: "node", id: 4, lon: 0, lat: 4 },
      { type: "node", id: 5, lon: 1, lat: 1 },
      { type: "node", id: 6, lon: 2, lat: 1 },
      { type: "node", id: 7, lon: 2, lat: 2 },
      { type: "node", id: 8, lon: 1, lat: 2 },
      { type: "way", id: 10, nodes: [1, 2, 3] },
      { type: "way", id: 11, nodes: [3, 4, 1] },
      { type: "way", id: 12, nodes: [5, 6, 7, 8, 5] },
      {
        type: "relation",
        id: 99,
        tags: { type: "multipolygon", tourism: "theme_park", name: "Test Park" },
        members: [
          { type: "way", ref: 10, role: "outer" },
          { type: "way", ref: 11, role: "outer" },
          { type: "way", ref: 12, role: "inner" },
        ],
      },
    ],
  };
  const resolved = osmFullJsonToBoundary({ payload, osmType: "relation", osmId: 99 });
  assert.equal(resolved?.geometry.type, "Polygon");
  assert.equal((resolved?.geometry.coordinates as unknown[]).length, 2);
});
