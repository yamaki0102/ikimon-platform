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
      uniqueMachineTaxa: 3,
      latestObservedAt: "2026-05-08T10:30:00.000Z",
      topMachineTaxa: [{ name: "Hypsipetes amaurotis", count: 3, reviewStatus: "ai_candidate" }],
      methodCounts: [{ method: "passive_audio", count: 6 }],
    },
    now: new Date("2026-05-09T00:00:00.000Z"),
  });

  const report = buildSiteEvidenceReport(snapshot, monthPeriod("2026-05"));
  assert.equal(report.schemaVersion, "site_evidence_report/v0");
  assert.equal(report.reportUse, "site_monitoring_supplementary_material");
  assert.equal(report.evidenceLayers.machineObservations.aiCandidates, 4);
  assert.equal(report.evidenceLayers.machineObservations.reviewerVerified, 1);
  assert.equal(report.readiness.exportReadyMachineRecordsRequireReviewerVerification, true);
  assert.ok(report.claimPolicy.prohibitedUse.includes("automatic_species_confirmation_from_ai_candidates"));
  assert.ok(report.claimBoundary.cannotSayYet.some((claim) => claim.includes("AI候補")));

  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /TNFD準拠を証明|自然共生サイト認定を証明|生物多様性改善を証明|AIが確定/);
});
