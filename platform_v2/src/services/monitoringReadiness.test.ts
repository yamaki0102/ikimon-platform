import assert from "node:assert/strict";
import test from "node:test";
import { buildMonitoringReadiness } from "./monitoringReadiness.js";

test("monitoring readiness keeps no_catch separate from species absence", () => {
  const readiness = buildMonitoringReadiness({
    visit: {
      locationPrecision: "point_medium",
      visitMode: "survey",
      effortMinutes: 45,
      targetTaxaScope: "freshwater fish",
      completeChecklistFlag: false,
      placeId: "place-1",
    },
    occurrences: [{
      scientificName: "Cyprinus carpio",
      taxonRank: "species",
      evidenceTier: 1,
      occurrenceStatus: "present",
      riskLane: "normal",
      safePublicRank: "species",
    }],
    evidenceAssets: [{}],
    reviewState: {
      reviewStatus: "reviewable",
      blockingIssues: [],
    },
    civicContext: null,
    dataRights: null,
    waterRecord: {
      visitId: "visit-1",
      occurrenceId: "occ-1",
      waterbodyId: "ikimon_waterbody_1",
      waterbody: null,
      catchOutcome: "no_catch",
      captureMethod: "lure",
      participantCount: 1,
      effortMinutes: 45,
      targetTaxaScope: "freshwater fish",
      releasedCount: null,
      keptCount: null,
      publicWaterbodyLabel: "市内の河川",
      environmentSnapshot: {},
      sourcePayload: {},
    },
  });

  assert.equal(readiness.monitoringReady.ready, true);
  assert.ok(readiness.monitoringReady.reasons.includes("no_catch_kept_as_capture_attempt"));
});

test("export readiness requires consent, licenses, generalization, and review", () => {
  const base = {
    visit: {
      locationPrecision: "point_medium",
      visitMode: "manual",
      effortMinutes: null,
      targetTaxaScope: null,
      completeChecklistFlag: false,
      placeId: "place-1",
    },
    occurrences: [{
      scientificName: "Taraxacum officinale",
      taxonRank: "species",
      evidenceTier: 3,
      occurrenceStatus: "present",
      riskLane: "normal",
      safePublicRank: "species",
    }],
    evidenceAssets: [{}],
    reviewState: {
      reviewStatus: "verified",
      blockingIssues: [],
    },
    waterRecord: null,
  };
  const blocked = buildMonitoringReadiness({
    ...base,
    civicContext: null,
    dataRights: null,
  });
  assert.equal(blocked.exportReady.ready, false);
  assert.ok(blocked.exportReady.blockers.includes("external_export_not_allowed"));

  const ready = buildMonitoringReadiness({
    ...base,
    civicContext: {
      contextId: "civic-1",
      visitId: "visit-1",
      occurrenceId: "occ-1",
      contextKind: "ordinary",
      activityLabel: null,
      activityIntent: "discover",
      participantRole: "finder",
      audienceScope: "public",
      publicPrecision: "municipality",
      riskLane: "normal",
      reportConsent: "research_export",
      revisitOfVisitId: null,
      fieldId: null,
      routeId: null,
      plotId: null,
      sourcePayload: {},
    },
    dataRights: {
      visitId: "visit-1",
      occurrenceId: "occ-1",
      recordConsent: "external_export",
      researchUseConsent: "public_export",
      enterpriseReportConsent: "none",
      datasetLicense: "CC-BY-4.0",
      mediaLicense: "CC-BY-4.0",
      externalExportAllowed: true,
      withdrawalStatus: "active",
      sourcePayload: {},
    },
  });
  assert.equal(ready.exportReady.ready, true);
});
