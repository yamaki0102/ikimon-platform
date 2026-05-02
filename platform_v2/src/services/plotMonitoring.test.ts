import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSatelliteContextInput,
  normalizeSitePlotInput,
  normalizeSitePlotVisitInput,
} from "./plotMonitoring.js";

test("normalizeSitePlotInput accepts legacy PHP-style plot payloads", () => {
  const input = normalizeSitePlotInput("legacy-site-1", {
    id: "plot-a",
    plot_name: "北側コドラート",
    area_m2: "25.5",
    lat: "34.71",
    lng: "137.72",
    geometry: { type: "Point", coordinates: [137.72, 34.71] },
    fixed_photo_points: [{ label: "north" }],
  });

  assert.equal(input.plotId, "plot-a");
  assert.equal(input.label, "北側コドラート");
  assert.equal(input.areaSquareMeters, 25.5);
  assert.equal(input.centerLatitude, 34.71);
  assert.equal(input.centerLongitude, 137.72);
  assert.deepEqual(input.fixedPhotoPoints, [{ label: "north" }]);
});

test("normalizeSitePlotVisitInput preserves visit measurements and actor fallback", () => {
  const input = normalizeSitePlotVisitInput("plot-a", {
    visit_id: "visit-a",
    observed_at: "2026-04-24T01:02:03.000Z",
    canopy_cover_percent: "41.2",
    tree_count: "8",
    measurements: { shrubLayer: "dense" },
  }, "admin-user");

  assert.equal(input.plotVisitId, "visit-a");
  assert.equal(input.observedAt, "2026-04-24T01:02:03.000Z");
  assert.equal(input.surveyorUserId, "admin-user");
  assert.equal(input.canopyCoverPercent, 41.2);
  assert.equal(input.treeCount, 8);
  assert.deepEqual(input.measurements, { shrubLayer: "dense" });
});

test("normalizeSatelliteContextInput builds metrics from flat snapshot fields", () => {
  const input = normalizeSatelliteContextInput({
    snapshot_id: "snapshot-a",
    provider: "sentinel",
    ndvi: 0.71,
    evi: "0.43",
    land_cover_class: "forest",
  });

  assert.equal(input.contextId, "snapshot-a");
  assert.equal(input.provider, "sentinel");
  assert.deepEqual(input.metrics, {
    ndvi: 0.71,
    evi: "0.43",
    land_cover_class: "forest",
  });
});
