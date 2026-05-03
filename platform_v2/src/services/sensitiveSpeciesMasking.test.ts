import assert from "node:assert/strict";
import test from "node:test";
import {
  decidePublicCoord,
  isSensitive,
  viewerCanSeeExact,
  coarsenLatLng,
} from "./sensitiveSpeciesMasking.js";

const SAMPLE_INDEX = new Set(["glirulus japonicus", "asio flammeus"]);

test("isSensitive normalizes case + whitespace", () => {
  assert.equal(isSensitive("Glirulus japonicus", SAMPLE_INDEX), true);
  assert.equal(isSensitive("  asio flammeus ", SAMPLE_INDEX), true);
  assert.equal(isSensitive("Passer montanus", SAMPLE_INDEX), false);
  assert.equal(isSensitive("", SAMPLE_INDEX), false);
  assert.equal(isSensitive(null, SAMPLE_INDEX), false);
});

test("viewerCanSeeExact recognizes admin and field steward roles", () => {
  assert.equal(viewerCanSeeExact({ isAdminOrAnalyst: true, fieldRole: null }), true);
  assert.equal(viewerCanSeeExact({ isAdminOrAnalyst: false, fieldRole: "owner" }), true);
  assert.equal(viewerCanSeeExact({ isAdminOrAnalyst: false, fieldRole: "steward" }), true);
  assert.equal(viewerCanSeeExact({ isAdminOrAnalyst: false, fieldRole: "viewer_exact" }), true);
  assert.equal(viewerCanSeeExact({ isAdminOrAnalyst: false, fieldRole: null }), false);
});

test("decidePublicCoord respects per-occurrence overrides over species rules", () => {
  const viewer = { isAdminOrAnalyst: false, fieldRole: null } as const;
  assert.equal(
    decidePublicCoord(
      { scientificName: "Passer montanus", vernacularName: null, contextPrecision: "exact_private" },
      viewer,
      SAMPLE_INDEX,
    ).mode,
    "hidden",
  );
  assert.equal(
    decidePublicCoord(
      { scientificName: "Passer montanus", vernacularName: null, contextPrecision: "mesh" },
      viewer,
      SAMPLE_INDEX,
    ).mode,
    "mesh_1km",
  );
});

test("decidePublicCoord coarsens sensitive species for unauthenticated viewers", () => {
  const decision = decidePublicCoord(
    { scientificName: "Glirulus japonicus", vernacularName: "ヤマネ", contextPrecision: null },
    { isAdminOrAnalyst: false, fieldRole: null },
    SAMPLE_INDEX,
  );
  assert.equal(decision.mode, "mesh_1km");
  assert.equal(decision.reason, "rare_redlist");
});

test("decidePublicCoord exposes exact coords to admins for sensitive species", () => {
  const decision = decidePublicCoord(
    { scientificName: "Glirulus japonicus", vernacularName: null, contextPrecision: null },
    { isAdminOrAnalyst: true, fieldRole: null },
    SAMPLE_INDEX,
  );
  assert.equal(decision.mode, "exact");
  assert.equal(decision.reason, "viewer_authorized");
});

test("decidePublicCoord defaults non-sensitive species to exact public", () => {
  const decision = decidePublicCoord(
    { scientificName: "Passer montanus", vernacularName: "スズメ", contextPrecision: null },
    { isAdminOrAnalyst: false, fieldRole: null },
    SAMPLE_INDEX,
  );
  assert.equal(decision.mode, "exact");
  assert.equal(decision.reason, "default_public");
});

test("decidePublicCoord enforces hidden when risk_lane is rare_sensitive", () => {
  const viewer = { isAdminOrAnalyst: false, fieldRole: null } as const;
  const decision = decidePublicCoord(
    { scientificName: "anything", vernacularName: null, contextPrecision: null, riskLane: "rare_sensitive" },
    viewer,
    SAMPLE_INDEX,
  );
  assert.equal(decision.mode, "hidden");
});

test("coarsenLatLng rounds to ~1km mesh for mesh_1km", () => {
  const out = coarsenLatLng(34.69870, 137.70241, "mesh_1km");
  assert.equal(out.lat, 34.7);
  assert.equal(out.lng, 137.7);
});

test("coarsenLatLng nulls out hidden / municipality coords", () => {
  assert.deepEqual(coarsenLatLng(34.5, 137.5, "hidden"), { lat: null, lng: null });
  assert.deepEqual(coarsenLatLng(34.5, 137.5, "municipality"), { lat: null, lng: null });
});

test("coarsenLatLng passes through exact unchanged", () => {
  assert.deepEqual(coarsenLatLng(34.6987, 137.7024, "exact"), { lat: 34.6987, lng: 137.7024 });
});
