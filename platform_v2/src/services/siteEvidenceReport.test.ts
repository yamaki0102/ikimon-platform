import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationField, FieldStats } from "./observationFieldRegistry.js";
import { composePlaceSnapshot } from "./placeSnapshot.js";
import { buildSiteEvidenceReport, monthPeriod } from "./siteEvidenceReport.js";

function field(): ObservationField {
  return {
    fieldId: "11111111-1111-4111-8111-111111111111",
    source: "nature_symbiosis_site",
    adminLevel: null,
    name: "Aikan pilot site",
    nameKana: "",
    summary: "",
    prefecture: "静岡県",
    city: "浜松市",
    lat: 34.814,
    lng: 137.732,
    radiusM: 300,
    polygon: null,
    areaHa: 1.3,
    certificationId: "",
    certifiedAt: null,
    officialUrl: "",
    ownerUrl: "",
    storyUrl: "",
    certificationUrl: "",
    sourceConfidence: 0.75,
    verificationLevel: "unverified",
    verificationMethod: "",
    verificationLabel: "",
    verificationUpdatedAt: null,
    ownerUserId: null,
    payload: {},
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

function stats(): FieldStats {
  return {
    fieldId: "11111111-1111-4111-8111-111111111111",
    totalSessions: 1,
    liveSessions: 0,
    totalObservations: 4,
    uniqueSpeciesCount: 2,
    totalAbsences: 0,
    totalParticipants: 2,
    topTaxa: [],
    recentSessions: [],
  };
}

test("monthPeriod normalizes YYYY-MM to UTC month bounds", () => {
  assert.deepEqual(monthPeriod("2026-05"), {
    label: "2026-05",
    start: "2026-05-01T00:00:00.000Z",
    end: "2026-06-01T00:00:00.000Z",
  });
});

test("site evidence report keeps machine AI candidates out of proof language", () => {
  const snapshot = composePlaceSnapshot({
    field: field(),
    stats: stats(),
    canonical: {
      totalObservations: 4,
      totalVisits: 2,
      uniqueTaxa: 2,
      taxonRankCount: 1,
      months: [5],
      effortFilled: 1,
      effortTotal: 2,
      acceptedCount: 1,
      reviewTotal: 2,
      nativeCount: 1,
      exoticCount: 0,
      unknownOriginCount: 3,
      stewardshipActionCount: 1,
    },
    machineObservationSummary: {
      totalMachineObservations: 6,
      aiCandidateCount: 4,
      reviewerVerifiedCount: 1,
      rejectedCount: 1,
      passiveAudioCount: 6,
      effortMetadataCount: 1,
      uniqueMachineTaxa: 3,
      latestObservedAt: "2026-05-08T10:30:00.000Z",
      topMachineTaxa: [{ name: "Hypsipetes amaurotis", count: 3, reviewStatus: "ai_candidate" }],
      methodCounts: [{ method: "passive_audio", count: 6 }],
      calibrationDecisions: [{ source: "default", threshold: 0.9, regionKey: "jp:shizuoka", taxonName: "Hypsipetes amaurotis", count: 6 }],
    },
    now: new Date("2026-05-09T00:00:00.000Z"),
  });

  const report = buildSiteEvidenceReport(snapshot, monthPeriod("2026-05"));
  assert.equal(report.schemaVersion, "site_evidence_report/v0");
  assert.equal(report.reportUse, "site_monitoring_supplementary_material");
  assert.equal(report.reportUrl, "/admin/site-evidence?field_id=11111111-1111-4111-8111-111111111111&month=2026-05");
  assert.equal(report.printUrl, "/admin/site-evidence/print?field_id=11111111-1111-4111-8111-111111111111&month=2026-05");
  assert.equal(report.fieldSnapshotUrl, "/api/v1/fields/11111111-1111-4111-8111-111111111111/place-snapshot");
  assert.equal(report.evidenceLayers.machineObservations.aiCandidates, 4);
  assert.equal(report.evidenceLayers.machineObservations.reviewerVerified, 1);
  assert.equal(report.evidenceLayers.machineObservations.effortMetadata, 1);
  assert.equal(report.monitoringPackageAlignment.schemaVersion, "monitoring_package_alignment/v1");
  assert.equal(report.monitoringPackageAlignment.packages[0]?.packageId, "passive_audio_station");
  assert.ok(report.monitoringPackageAlignment.pillars.some((pillar) => pillar.covered && pillar.pillar === "new_technology_and_citizen_science"));
  assert.ok(report.monitoringPackageAlignment.interoperabilityChecklist.some((item) => item.key === "human_review" && item.status === "present"));
  assert.deepEqual(report.evidenceLayers.machineObservations.calibrationAudit, [
    { source: "default", threshold: 0.9, regionKey: "jp:shizuoka", taxonName: "Hypsipetes amaurotis", count: 6 },
  ]);
  assert.equal(report.readiness.exportReadyMachineRecordsRequireReviewerVerification, true);
  assert.deepEqual(report.readiness.blockers, []);
  assert.ok(report.claimPolicy.prohibitedUse.includes("automatic_species_confirmation_from_ai_candidates"));
  assert.ok(report.claimBoundary.cannotSayYet.some((claim) => claim.includes("AI候補")));

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /TNFD準拠を証明|自然共生サイト認定を証明|生物多様性改善を証明|AIが確定/);
});

test("site evidence report exposes readiness blockers for missing monthly evidence", () => {
  const snapshot = composePlaceSnapshot({
    field: field(),
    stats: { ...stats(), totalSessions: 0, totalObservations: 0, uniqueSpeciesCount: 0 },
    canonical: {
      totalObservations: 0,
      totalVisits: 0,
      uniqueTaxa: 0,
      taxonRankCount: 0,
      months: [],
      effortFilled: 0,
      effortTotal: 0,
      acceptedCount: 0,
      reviewTotal: 0,
      nativeCount: 0,
      exoticCount: 0,
      unknownOriginCount: 0,
      stewardshipActionCount: 0,
    },
    machineObservationSummary: {
      totalMachineObservations: 0,
      aiCandidateCount: 0,
      reviewerVerifiedCount: 0,
      rejectedCount: 0,
      passiveAudioCount: 0,
      effortMetadataCount: 0,
      uniqueMachineTaxa: 0,
      latestObservedAt: null,
      topMachineTaxa: [],
      methodCounts: [],
      calibrationDecisions: [],
    },
    now: new Date("2026-05-09T00:00:00.000Z"),
  });

  const report = buildSiteEvidenceReport(snapshot, monthPeriod("2026-05"));
  assert.deepEqual(report.readiness.blockers, [
    "missing_human_evidence",
    "missing_machine_evidence",
    "missing_reviewer_verified_machine_evidence",
    "missing_effort_metadata",
    "missing_method_package_coverage",
  ]);
  assert.equal(report.evidenceLayers.machineObservations.aiCandidates, 0);
  assert.equal(report.evidenceLayers.machineObservations.reviewerVerified, 0);
});
