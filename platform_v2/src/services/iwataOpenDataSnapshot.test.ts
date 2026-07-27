import assert from "node:assert/strict";
import test from "node:test";
import {
  IWATA_DATASETS,
  IWATA_OPEN_DATA_ITEMS,
  buildIwataOpenDataSummary,
  filterIwataOpenDataItems,
} from "./iwataOpenDataSnapshot.js";

test("Iwata snapshot carries unique stable source IDs and provenance", () => {
  assert.ok(IWATA_OPEN_DATA_ITEMS.length >= 50);
  assert.equal(new Set(IWATA_OPEN_DATA_ITEMS.map((item) => item.id)).size, IWATA_OPEN_DATA_ITEMS.length);
  assert.ok(IWATA_OPEN_DATA_ITEMS.every((item) => item.id.startsWith("iwata:")));
  assert.ok(IWATA_OPEN_DATA_ITEMS.every((item) => item.sourceUrl.startsWith("https://")));
  assert.ok(IWATA_OPEN_DATA_ITEMS.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.sourceUpdatedAt)));
  assert.deepEqual(new Set(IWATA_OPEN_DATA_ITEMS.map((item) => item.dataset)), new Set(IWATA_DATASETS.map((item) => item.key)));
});

test("Iwata snapshot exposes mapped places and honest data gaps", () => {
  const summary = buildIwataOpenDataSummary();
  assert.equal(summary.totalCount, IWATA_OPEN_DATA_ITEMS.length);
  assert.ok(summary.mappedCount > 40);
  assert.ok(summary.missingLocationCount > 0);
  assert.equal(summary.mappedCount + summary.missingLocationCount, summary.totalCount);
  assert.ok(summary.byDataset.cultural > 0);
  assert.ok(summary.byDataset.tourism > 0);
});

test("Iwata snapshot preserves known cross-dataset Place candidate without auto-merging", () => {
  const tourism = IWATA_OPEN_DATA_ITEMS.find((item) => item.id === "iwata:tourism:9");
  const cultural = IWATA_OPEN_DATA_ITEMS.find((item) => item.id === "iwata:cultural:BB00000003");
  assert.equal(tourism?.name, "旧見付学校");
  assert.equal(cultural?.name, "旧見付学校附磐田文庫");
  assert.equal(cultural?.attributes.samePlaceCandidate, tourism?.id);
  assert.notEqual(cultural?.id, tourism?.id);
});

test("Iwata snapshot filter is bounded and searches name, address and category", () => {
  assert.ok(filterIwataOpenDataItems({ dataset: "park" }).every((item) => item.dataset === "park"));
  assert.ok(filterIwataOpenDataItems({ query: "見付" }).some((item) => item.name === "旧見付学校"));
  assert.ok(filterIwataOpenDataItems({ query: "交流センター" }).every((item) => item.dataset === "community"));
  assert.equal(filterIwataOpenDataItems({ limit: 1 }).length, 1);
  assert.equal(filterIwataOpenDataItems({ limit: 9999 }).length, IWATA_OPEN_DATA_ITEMS.length);
  assert.equal(filterIwataOpenDataItems({ dataset: "not-a-dataset", limit: 3 }).length, 3);
});
