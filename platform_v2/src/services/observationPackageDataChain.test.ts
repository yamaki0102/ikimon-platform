import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDataProductChain,
  buildObservationMethodContext,
  buildTrendAbundancePolicy,
  inferObservationActionMode,
} from "./observationPackageDataChain.js";

test("field scan mode is first-class and produces model-ready method basis", () => {
  const fieldScanContext = {
    fieldScanContextId: "field_scan:visit-1",
    visitId: "visit-1",
    occurrenceId: "occ-1",
    scanMode: "fixed_point" as const,
    fixedPointId: "fp-1",
    routeId: null,
    areaId: null,
    footprintGeometry: {},
    calibrationEvidence: { target: "color_card" },
    methodPayload: { protocol: "monthly_fixed_point" },
    qualityPayload: { repeatable: true },
    sourcePayload: {},
  };
  const actionMode = inferObservationActionMode({
    visit: { visitMode: "survey" },
    evidenceAssets: [{ mediaType: "image", mimeType: "image/jpeg", mediaRole: "site_context" }],
    identifications: [],
    civicContext: null,
    fieldScanContext,
  });
  const methodContext = buildObservationMethodContext({
    actionMode,
    visit: {
      observedAt: "2026-05-06T00:00:00.000Z",
      placeId: "place-1",
      effortMinutes: 20,
      targetTaxaScope: "plants",
      completeChecklistFlag: true,
      visitMode: "survey",
    },
    evidenceAssets: [{}],
    civicContext: null,
    waterRecord: null,
    fieldScanContext,
  });

  assert.equal(actionMode, "field_scan");
  assert.equal(methodContext.methodKind, "field_scan");
  assert.deepEqual(methodContext.modelReadyBasis, ["site", "time", "method", "effort", "quality"]);
});

test("casual posts suppress trend and abundance claims", () => {
  const methodContext = buildObservationMethodContext({
    actionMode: "image_post",
    visit: {
      observedAt: "2026-05-06T00:00:00.000Z",
      placeId: "place-1",
      effortMinutes: null,
      targetTaxaScope: null,
      completeChecklistFlag: false,
      visitMode: "manual",
    },
    evidenceAssets: [{}],
    civicContext: null,
    waterRecord: null,
    fieldScanContext: null,
  });
  const policy = buildTrendAbundancePolicy({
    actionMode: "image_post",
    methodContext,
    fieldScanContext: null,
    reviewStatus: "reviewable",
  });

  assert.equal(policy.claimAllowed, false);
  assert.equal(policy.defaultClaimLimit, "presence_only");
  assert.ok(policy.blockers.includes("casual_record_presence_only"));
});

test("data product chain defaults raw observation when no events are stored", () => {
  const chain = buildDataProductChain({
    visitId: "visit-1",
    occurrenceId: "occ-1",
    generatedAt: "2026-05-06T00:00:00.000Z",
    reviewStatus: "reviewable",
    events: [],
  });

  assert.equal(chain.latestStage, "raw_observation");
  assert.equal(chain.stages.find((stage) => stage.stage === "raw_observation")?.status, "human_review_required");
  assert.equal(chain.events[0]?.eventKind, "package_generated_from_raw_observation");
});
