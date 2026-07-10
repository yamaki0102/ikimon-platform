import assert from "node:assert/strict";
import test from "node:test";
import { buildAreaCivicReportReadinessV0, buildMunicipalReadinessV0 } from "./municipalReadiness.js";
import type { MonitoringReadiness } from "./monitoringReadiness.js";
import type { RecordSafetyProfileV0 } from "./recordSafetyProfile.js";

const readyGate = { ready: true, reasons: ["ok"], blockers: [] };

function monitoringReadiness(overrides: Partial<MonitoringReadiness> = {}): MonitoringReadiness {
  return {
    schemaVersion: "monitoring_readiness/v1.1",
    reviewReady: readyGate,
    monitoringReady: readyGate,
    reportReady: readyGate,
    exportReady: readyGate,
    ...overrides,
  };
}

function safetyProfile(overrides: Partial<RecordSafetyProfileV0> = {}): RecordSafetyProfileV0 {
  return {
    schemaVersion: "record_safety_profile/v0",
    publicPlacePolicy: "allowlisted_public_place",
    publicPrecisionPolicy: "site",
    mediaPublicPolicy: "cleared_public_media",
    homeAreaRisk: "none",
    sensitiveSubjectRisk: "none",
    publicSummaryGate: readyGate,
    municipalUseGate: readyGate,
    auditEvents: ["public_place_policy:allowlisted_public_place"],
    ...overrides,
  };
}

test("municipal readiness exposes markdown/json/csv lane when monitoring and safety are ready", () => {
  const readiness = buildMunicipalReadinessV0({
    monitoringReadiness: monitoringReadiness(),
    safetyProfile: safetyProfile(),
  });

  assert.equal(readiness.municipalReady.ready, true);
  assert.equal(readiness.publicStoryReady.ready, true);
  assert.equal(readiness.recommendedLane, "municipal_report_candidate");
  assert.deepEqual(readiness.exportFormats, ["markdown", "json", "csv"]);
});

test("municipal readiness keeps unsafe public records in private memory lane", () => {
  const readiness = buildMunicipalReadinessV0({
    monitoringReadiness: monitoringReadiness({
      exportReady: { ready: false, reasons: [], blockers: ["review_required_for_export"] },
    }),
    safetyProfile: safetyProfile({
      publicPlacePolicy: "unknown_hold",
      mediaPublicPolicy: "held_for_face_privacy_review",
      publicSummaryGate: { ready: false, reasons: [], blockers: ["public_place_unknown_hold", "face_privacy_review_required"] },
      municipalUseGate: { ready: false, reasons: [], blockers: ["public_place_unknown_hold", "face_privacy_review_required"] },
      auditEvents: ["public_place_policy:unknown_hold", "media_public_policy:held_for_face_privacy_review"],
    }),
  });

  assert.equal(readiness.municipalReady.ready, false);
  assert.equal(readiness.publicStoryReady.ready, false);
  assert.equal(readiness.recommendedLane, "local_review");
  assert.match(readiness.municipalReady.blockers.join(","), /face_privacy_review_required/);
  assert.match(readiness.municipalReady.blockers.join(","), /export_review_required_for_export/);
});

test("area civic report readiness promotes thick public areas into local report candidates", () => {
  const readiness = buildAreaCivicReportReadinessV0({
    totalObservations: 12,
    totalVisits: 4,
    uniqueTaxa: 6,
    seasonsCovered: 3,
    observerCount: 3,
    areaWatchScore: 62,
    maskedSpecies: 0,
    hasRepresentativePhoto: true,
    galleryCount: 5,
  });

  assert.equal(readiness.status, "report_candidate");
  assert.equal(readiness.publicStoryReady.ready, true);
  assert.equal(readiness.municipalReportReady.ready, true);
  assert.deepEqual(readiness.exportFormats, ["markdown", "json", "csv"]);
  assert.match(readiness.surfaceLine, /散策資料/);
});

test("area civic report readiness keeps thin or sensitive areas in growth and review lanes", () => {
  const readiness = buildAreaCivicReportReadinessV0({
    totalObservations: 2,
    totalVisits: 1,
    uniqueTaxa: 1,
    seasonsCovered: 1,
    observerCount: 1,
    areaWatchScore: 24,
    maskedSpecies: 1,
    hasRepresentativePhoto: true,
    galleryCount: 1,
  });

  assert.equal(readiness.status, "local_review");
  assert.equal(readiness.publicStoryReady.ready, true);
  assert.equal(readiness.municipalReportReady.ready, false);
  assert.match(readiness.municipalReportReady.blockers.join(","), /sensitive_masking_review_required/);
  assert.match(readiness.nextActions.join(","), /季節|複数人|希少種/);
});
