import assert from "node:assert/strict";
import test from "node:test";
import {
  MONITORING_PACKAGE_BLUEPRINTS,
  inferMonitoringPackageId,
  selectMonitoringPackage,
} from "./monitoringPackageStandard.js";

test("monitoring package blueprints cover BioMonWeek/Biodiversa monitoring lanes", () => {
  const ids = MONITORING_PACKAGE_BLUEPRINTS.map((blueprint) => blueprint.packageId);
  assert.ok(ids.includes("passive_audio_station"));
  assert.ok(ids.includes("waterbody_survey"));
  assert.ok(ids.includes("forest_habitat_snapshot"));
  assert.ok(ids.includes("insect_monitoring"));
  assert.ok(ids.includes("ias_route_camera"));
  assert.ok(MONITORING_PACKAGE_BLUEPRINTS.every((blueprint) => blueprint.requiredBasis.includes("method")));
});

test("inferMonitoringPackageId routes methods without making AI claims authoritative", () => {
  assert.equal(inferMonitoringPackageId({ observationMethod: "passive_audio" }), "passive_audio_station");
  assert.equal(inferMonitoringPackageId({ captureOutcome: "no_catch", targetTaxaScope: "fish" }), "waterbody_survey");
  assert.equal(inferMonitoringPackageId({ fieldScanMode: "route", targetTaxaScope: "ias plants" }), "ias_route_camera");
  assert.equal(inferMonitoringPackageId({ targetTaxaScope: "forest habitat condition" }), "forest_habitat_snapshot");
  assert.equal(inferMonitoringPackageId({ targetTaxaScope: "pollinator insects" }), "insect_monitoring");
});

test("selectMonitoringPackage keeps export readiness blocked until review, rights, and external ids exist", () => {
  const selection = selectMonitoringPackage({
    observationMethod: "ias_route_camera",
    targetTaxaScope: "invasive_plants",
    hasSite: true,
    hasTime: true,
    hasMethod: true,
    hasEffort: true,
    hasQualityEvidence: true,
    hasReview: false,
    hasRights: false,
    hasExternalTaxonId: false,
  });

  assert.equal(selection.packageId, "ias_route_camera");
  assert.equal(selection.readiness.ready, false);
  assert.deepEqual(selection.readiness.missing, ["review", "rights", "external_taxon_id"]);
  assert.equal(selection.claimLimit, "ias_claim_requires_scoped_review_and_external_taxon_id");
});
