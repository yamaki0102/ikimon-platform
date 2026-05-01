import assert from "node:assert/strict";
import test from "node:test";
import { detectLocationAnomalies, type LocationAuditRow } from "./auditObservationLocations.js";

function row(overrides: Partial<LocationAuditRow>): LocationAuditRow {
  return {
    visit_id: "record-ok",
    observed_at: "2026-05-02 10:00:00+09",
    latitude: 34.8142588,
    longitude: 137.7330983,
    point_latitude: 34.8142588,
    point_longitude: 137.7330983,
    prefecture: "静岡県",
    municipality: "浜松市",
    place_name: "浜松市",
    public_visibility: "public",
    quality_review_status: "accepted",
    source_kind: "v2_observation",
    source_payload: {},
    ...overrides,
  };
}

test("detectLocationAnomalies catches zero-zero coordinates", () => {
  const anomalies = detectLocationAnomalies([
    row({
      visit_id: "record-zero",
      latitude: 0,
      longitude: 0,
      point_latitude: 0,
      point_longitude: 0,
      place_name: "Shizuoka",
      municipality: "",
    }),
  ]);

  assert.equal(anomalies.length, 1);
  assert.ok(anomalies[0]?.reasons.includes("zero_zero_coordinates"));
  assert.ok(anomalies[0]?.reasons.includes("coordinates_outside_japan"));
});

test("detectLocationAnomalies catches English labels on Hamamatsu coordinates", () => {
  const anomalies = detectLocationAnomalies([
    row({
      place_name: "Shizuoka",
      municipality: "",
    }),
  ]);

  assert.equal(anomalies.length, 1);
  assert.ok(anomalies[0]?.reasons.includes("english_locality_label"));
  assert.ok(anomalies[0]?.reasons.includes("hamamatsu_coordinate_label_mismatch"));
});

