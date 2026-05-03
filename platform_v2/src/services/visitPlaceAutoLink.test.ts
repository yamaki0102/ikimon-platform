import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { ensureVisitPlaceLink } from "./visitPlaceAutoLink.js";

function fakeClient(responses: Array<{ rows: unknown[] }>): PoolClient {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      const next = responses.shift();
      if (!next) return { rows: [] };
      return next;
    },
  } as unknown as PoolClient;
}

test("ensureVisitPlaceLink links a visit from explicit place hint before coordinate fallback", async () => {
  const client = fakeClient([
    {
      rows: [{
        visit_id: "visit-1",
        place_id: null,
        user_id: "user-1",
        observed_at: "2026-05-03T10:00:00Z",
        point_latitude: 34.7,
        point_longitude: 137.7,
        coordinate_uncertainty_m: "10",
        observed_country: "JP",
        observed_prefecture: "静岡県",
        observed_municipality: "浜松市",
        locality_note: "水路沿い",
        source_payload: { place_id_hint: "site:sanaruko" },
        context_revisit_of_visit_id: null,
      }],
    },
    { rows: [{ place_id: "site:sanaruko" }] },
    { rows: [] },
  ]);

  const result = await ensureVisitPlaceLink(client, "visit-1");

  assert.deepEqual(result, { placeId: "site:sanaruko", source: "existing" });
  const calls = (client as unknown as { calls: Array<{ sql: string; params: unknown[] }> }).calls;
  assert.match(calls[2]!.sql, /update visits/);
  assert.deepEqual(calls[2]!.params.slice(0, 2), ["visit-1", "site:sanaruko"]);
});
