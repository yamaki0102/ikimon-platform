import assert from "node:assert/strict";
import test from "node:test";
import {
  ingestPlaceEnvironmentRecords,
  normalizePlaceEnvironmentIngestRecord,
  type PlaceEnvironmentIngestRecord,
} from "./placeEnvironmentIngest.js";

test("normalizePlaceEnvironmentIngestRecord maps Sentinel/JAXA/MLIT metrics to canonical place environment rows", () => {
  const sentinel = normalizePlaceEnvironmentIngestRecord({
    placeId: "geo:34.696:137.703",
    provider: "sentinel",
    sourceUrl: "https://example.test/sentinel/item",
    observedOn: "2026-05-01",
    metrics: { ndviMean: 0.42, waterPct: 0.12, imperviousPct: 18 },
  });
  assert.equal(sentinel?.sourceKind, "planetary_computer");
  assert.deepEqual(sentinel?.metrics.map((m) => [m.metricKind, m.metricValue]), [
    ["ndvi_mean", 0.42],
    ["water_pct", 12],
    ["impervious_pct", 18],
  ]);

  const mlit = normalizePlaceEnvironmentIngestRecord({
    placeId: "geo:34.696:137.703",
    provider: "mlit",
    observedOn: "2026-04-01",
    license: "gov-jp-open",
    metrics: { landuseClass: "cropland" },
  });
  assert.equal(mlit?.sourceKind, "mlit_landuse_mesh");
  assert.equal(mlit?.license, "gov-jp-open");
  assert.equal(mlit?.metrics[0]?.metricKind, "landuse_class");
  assert.equal(mlit?.metrics[0]?.metadata.class, "cropland");
});

test("ingestPlaceEnvironmentRecords supports dry-run counts without touching the database", async () => {
  const records: PlaceEnvironmentIngestRecord[] = [
    {
      placeId: "geo:34.696:137.703",
      provider: "jaxa",
      observedOn: "2026-05-01",
      metrics: { forestPct: 0.31, croplandPct: 0.21 },
    },
    {
      placeId: "",
      provider: "mlit",
      observedOn: "bad-date",
      metrics: { landuseClass: "urban" },
    },
  ];
  const result = await ingestPlaceEnvironmentRecords(records, { dryRun: true });
  assert.deepEqual(result, {
    sourceSnapshots: 1,
    metricRows: 2,
    skippedRecords: 1,
    dryRun: true,
  });
});
