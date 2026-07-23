import assert from "node:assert/strict";
import test from "node:test";
import {
  listD1PublicPlaceChildren,
  searchD1PublicPlaces,
  type PlaceRegistryD1Database,
} from "./placeRegistryD1";

function databaseWithRows(rows: Array<Record<string, unknown>>): PlaceRegistryD1Database {
  return {
    prepare(sql: string) {
      let values: Array<string | number | null> = [];
      return {
        bind(...bound) {
          values = bound;
          return this;
        },
        async all<T>() {
          assert.match(sql, /public_profile_status = 'published'/);
          assert.ok(values.length >= 3);
          return { results: rows as T[] };
        },
      };
    },
  };
}

const tokiwa = {
  place_id: "place_tokiwa",
  canonical_name: "常磐公園",
  canonical_name_normalized: "常磐公園",
  place_kind: "park",
  locality_label: "静岡市葵区",
  verification_status: "verified",
  official_status: "official",
  aliases_json: "常盤公園\u001fTokiwa Park",
  matched_alias_normalized: "常盤公園",
  bbox_west: 138.38,
  bbox_south: 34.97,
  bbox_east: 138.39,
  bbox_north: 34.98,
  boundary_precision: "exact",
  boundary_confidence: 0.97,
  source_type: "municipality_official",
  source_id: "shizuoka:s0000240",
  source_url: "https://www.city.shizuoka.lg.jp/shisetsu/s0000240.html",
  source_confidence: 1,
  source_verification_status: "verified",
  source_last_checked_at: "2026-07-23T00:00:00Z",
};

test("D1 place search preserves canonical identity for orthographic alias", async () => {
  const response = await searchD1PublicPlaces({
    db: databaseWithRows([tokiwa]),
    query: "常盤公園",
  });
  assert.equal(response.results[0]?.canonicalName, "常磐公園");
  assert.equal(response.results[0]?.matchKind, "alias");
  assert.equal(response.privacy, "boundary_bbox_only");
  assert.equal(JSON.stringify(response).includes("center_latitude"), false);
});

test("D1 place children query is recursive-ready and boundary-only", async () => {
  const results = await listD1PublicPlaceChildren({
    db: databaseWithRows([{ ...tokiwa, place_id: "place_tokiwa_zone" }]),
    parentPlaceId: "place_tokiwa",
  });
  assert.equal(results.length, 1);
  assert.deepEqual(results[0]?.boundary.bbox, [138.38, 34.97, 138.39, 34.98]);
});
