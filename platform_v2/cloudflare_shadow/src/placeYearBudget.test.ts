import assert from "node:assert/strict";
import test from "node:test";
import {
  PLACE_YEAR_CARD_LIMIT,
  PLACE_YEAR_DEFAULT_CANDIDATE_LIMIT,
  PLACE_YEAR_INDEX_LIMIT,
  loadPlaceYearCards,
  loadPlaceYearIndex,
  resolveDefaultPublicPlace,
  type PlaceYearDatabase,
} from "./placeYearRead";

// Eligible read = shared place-detail matcher (1) + data statement (1).
const BASELINE = { statementsPerEligibleRead: 2, statementsPerIneligibleRead: 1, defaultCandidates: 5, cardLimit: 12, yearLimit: 200 };

const ELIGIBLE_PLACE = {
  place_id: "place-a",
  canonical_name: "A",
  canonical_name_normalized: "a",
  place_kind: "park",
  locality_label: null,
  verification_status: "verified",
  official_status: "official",
  aliases_json: "",
  matched_alias_normalized: null,
  osm_source_id: "way:1",
};

function counting(eligible: boolean) {
  const queries: string[] = [];
  const db: PlaceYearDatabase = {
    prepare(query: string) {
      queries.push(query);
      const isSearch = /LEFT JOIN place_boundaries pb/.test(query);
      const rows = isSearch && eligible ? [ELIGIBLE_PLACE] : [];
      const statement = { bind: () => statement, all: async () => ({ results: rows as never[] }) };
      return statement;
    },
  };
  return { db, queries };
}

test("ineligible places stop after the shared eligibility statement", async () => {
  const c = counting(false);
  await loadPlaceYearIndex(c.db, "place-a");
  assert.equal(c.queries.length, BASELINE.statementsPerIneligibleRead);
  await loadPlaceYearCards(c.db, "place-a", { untilYear: 2008 });
  assert.equal(c.queries.length, BASELINE.statementsPerIneligibleRead * 2);
  for (const query of c.queries) assert.ok(/LIMIT/i.test(query));
});

test("eligible place-year reads cost two bounded D1 statements", async () => {
  const c = counting(true);
  await loadPlaceYearIndex(c.db, "place-a");
  assert.equal(c.queries.length, BASELINE.statementsPerEligibleRead);
  await loadPlaceYearCards(c.db, "place-a", { untilYear: 2008 });
  assert.equal(c.queries.length, BASELINE.statementsPerEligibleRead * 2);
  for (const query of c.queries) assert.ok(/LIMIT/i.test(query));
});

test("default place resolution is bounded by the candidate cap", async () => {
  assert.equal(PLACE_YEAR_DEFAULT_CANDIDATE_LIMIT, BASELINE.defaultCandidates);
  const c = counting(false);
  await resolveDefaultPublicPlace(c.db);
  assert.ok(c.queries.length <= 1 + BASELINE.defaultCandidates);
});

test("read bounds are fixed and the heavy public map read is not used", async () => {
  assert.equal(PLACE_YEAR_CARD_LIMIT, BASELINE.cardLimit);
  assert.equal(PLACE_YEAR_INDEX_LIMIT, BASELINE.yearLimit);
  const c = counting(true);
  await loadPlaceYearCards(c.db, "place-a", { limit: 500 });
  assert.equal(c.queries.length, BASELINE.statementsPerEligibleRead);
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./placeYearRead.ts", import.meta.url), "utf8");
  assert.ok(!/queryPublicMapRows|loadCloudflarePlaceAtlasProfile/.test(source));
});
