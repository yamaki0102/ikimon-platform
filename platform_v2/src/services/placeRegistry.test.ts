import assert from "node:assert/strict";
import test from "node:test";
import {
  PLACE_SEARCH_CONTRACT_VERSION,
  rankPublicPlaceResults,
  toPublicPlaceSearchResult,
  type PlaceRegistryRow,
} from "./placeRegistryContract.js";
import {
  createPlaceCorrectionProposal,
  searchPublicPlaces,
  type PlaceRegistryQueryable,
} from "./placeRegistry.js";

const baseRow: PlaceRegistryRow = {
  place_id: "place_tokiwa",
  canonical_name: "常磐公園",
  canonical_name_normalized: "常磐公園",
  place_kind: "park",
  locality_label: "静岡県 静岡市葵区",
  verification_status: "verified",
  official_status: "official",
  aliases_json: ["常盤公園", "Tokiwa Park"],
  matched_alias_normalized: "常盤公園",
  boundary_geojson: {
    type: "Polygon",
    coordinates: [[[138.38, 34.97], [138.39, 34.97], [138.39, 34.98], [138.38, 34.97]]],
  },
  boundary_precision: "exact",
  boundary_confidence: 0.97,
  source_type: "municipality_official",
  source_id: "shizuoka:s0000240",
  source_url: "https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html",
  source_confidence: 1,
  source_verification_status: "verified",
  source_last_checked_at: "2026-07-23T00:00:00Z",
};

test("alias query resolves to the same canonical place without coordinates", () => {
  const result = toPublicPlaceSearchResult(baseRow, "常盤公園");
  assert.equal(result.canonicalPlaceId, "place_tokiwa");
  assert.equal(result.canonicalName, "常磐公園");
  assert.equal(result.matchKind, "alias");
  assert.deepEqual(result.boundary.bbox, [138.38, 34.97, 138.39, 34.98]);
  assert.equal("lat" in result, false);
  assert.equal("lng" in result, false);
});

test("multilingual aliases rank one canonical place only once", () => {
  const rows = [
    { ...baseRow, matched_alias_normalized: "tokiwa park" },
    { ...baseRow, source_type: "osm", source_confidence: 0.9 },
  ];
  const results = rankPublicPlaceResults(rows, "Tokiwa Park", 8);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.canonicalPlaceId, "place_tokiwa");
});

test("public search contract distinguishes empty from zero and is boundary-only", async () => {
  const queryable: PlaceRegistryQueryable = {
    async query<T extends Record<string, unknown>>() {
      return { rows: [baseRow as unknown as T] };
    },
  };
  const response = await searchPublicPlaces("常盤公園", 8, queryable);
  assert.equal(response.version, PLACE_SEARCH_CONTRACT_VERSION);
  assert.equal(response.state, "complete");
  assert.equal(response.privacy, "boundary_bbox_only");
  assert.equal(response.results[0]?.canonicalName, "常磐公園");
});

test("correction proposal enters review queue instead of mutating a place", async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const queryable: PlaceRegistryQueryable = {
    async query<T extends Record<string, unknown>>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return { rows: [] as T[] };
    },
  };
  const proposal = await createPlaceCorrectionProposal({
    placeId: "place_tokiwa",
    proposerUserId: "user_1",
    proposalType: "name",
    proposedPayload: { canonicalName: "常磐公園", note: "自治体表記" },
  }, queryable);
  assert.equal(proposal.status, "pending");
  assert.match(calls[0]?.sql ?? "", /INSERT INTO place_correction_proposals/);
  assert.doesNotMatch(calls[0]?.sql ?? "", /UPDATE places/);
});
