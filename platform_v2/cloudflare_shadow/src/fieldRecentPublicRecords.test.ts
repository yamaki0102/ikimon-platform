import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { filterFieldRecentPublicRecords } from "./index";

const indexSource = readFileSync(fileURLToPath(new URL("./index.ts", import.meta.url)), "utf8");
const fieldId = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
const geometry = {
  type: "Polygon",
  coordinates: [[[137.839, 34.668], [137.841, 34.668], [137.841, 34.672], [137.839, 34.672], [137.839, 34.668]]],
};

test("field recent query scopes by resolved field or bbox before recency limit", () => {
  const scopeStart = indexSource.indexOf("json_each(COALESCE(o.resolved_field_ids_json, '[]'))");
  const orderStart = indexSource.indexOf("ORDER BY r.observed_at DESC, r.observation_id ASC LIMIT 48");
  assert.ok(scopeStart >= 0);
  assert.ok(orderStart > scopeStart);
  assert.match(indexSource.slice(scopeStart, orderStart), /o\.exact_lat BETWEEN \? AND \?/);
  assert.match(indexSource.slice(scopeStart, orderStart), /o\.exact_lng BETWEEN \? AND \?/);
});

test("field-scoped recency keeps an inside record despite unrelated outside volume", () => {
  const outside = Array.from({ length: 80 }, (_, index) => ({
    observation_id: `outside-${index}`,
    observed_at: `2026-09-02T${String(23 - Math.floor(index / 4)).padStart(2, "0")}:00:00.000Z`,
    taxon_label: "域外記録",
    public_area_label: null,
    asset_count: 1,
    exact_lat: 34.7000,
    exact_lng: 137.8500,
    resolved_field_ids_json: JSON.stringify(index === 0 ? [fieldId] : []),
  }));
  const inside = {
    observation_id: "inside-ryuyo-1",
    observed_at: "2026-09-01T10:00:00.000Z",
    taxon_label: "園内記録",
    public_area_label: "竜洋昆虫自然観察公園",
    asset_count: 1,
    exact_lat: 34.6695,
    exact_lng: 137.8400,
    resolved_field_ids_json: JSON.stringify([fieldId]),
  };
  const result = filterFieldRecentPublicRecords([...outside, inside], fieldId, geometry);
  assert.deepEqual(result.map((row) => row.observation_id), ["inside-ryuyo-1"]);
});
