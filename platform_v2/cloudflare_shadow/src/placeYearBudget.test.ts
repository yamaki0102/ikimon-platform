import assert from "node:assert/strict";
import test from "node:test";
import {
  PLACE_YEAR_CARD_LIMIT,
  PLACE_YEAR_INDEX_LIMIT,
  loadPlaceYearCards,
  loadPlaceYearIndex,
  resolveDefaultPublicPlace,
  type PlaceYearDatabase,
} from "./placeYearRead";

const BASELINE = { statementsPerRead: 1, guestHomeStatements: 3, cardLimit: 12, yearLimit: 200 };

function counting(rows: unknown[] = []) {
  const queries: string[] = [];
  const db: PlaceYearDatabase = {
    prepare(query: string) {
      queries.push(query);
      const statement = { bind: () => statement, all: async () => ({ results: rows as never[] }) };
      return statement;
    },
  };
  return { db, queries };
}

test("each place-year read costs one D1 statement and a guest home stays within four", async () => {
  const c = counting();
  await resolveDefaultPublicPlace(c.db);
  await loadPlaceYearIndex(c.db, "place-a");
  await loadPlaceYearCards(c.db, "place-a", { untilYear: 2008 });
  assert.equal(c.queries.length, BASELINE.guestHomeStatements);
  assert.ok(c.queries.length <= 4);
  for (const query of c.queries) assert.ok(/LIMIT/i.test(query));
});

test("read bounds are fixed and the heavy public map read is not used", async () => {
  assert.equal(PLACE_YEAR_CARD_LIMIT, BASELINE.cardLimit);
  assert.equal(PLACE_YEAR_INDEX_LIMIT, BASELINE.yearLimit);
  const c = counting();
  await loadPlaceYearCards(c.db, "place-a", { limit: 500 });
  assert.equal(c.queries.length, BASELINE.statementsPerRead);
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./placeYearRead.ts", import.meta.url), "utf8");
  assert.ok(!/queryPublicMapRows/.test(source));
});
