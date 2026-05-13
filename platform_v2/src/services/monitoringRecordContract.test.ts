import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonitoringRecordContract,
  summarizeMonitoringRecordContractForPrompt,
  type MonitoringRecordContractV0,
} from "./monitoringRecordContract.js";
import type { MonitoringReadiness } from "./monitoringReadiness.js";
import type { ObservationPackage } from "./observationPackage.js";

function gate(ready: boolean, blockers: string[] = []) {
  return { ready, reasons: ready ? ["fixture_ready"] : [], blockers };
}

function readiness(overrides: Partial<MonitoringReadiness> = {}): MonitoringReadiness {
  return {
    schemaVersion: "monitoring_readiness/v1.1",
    reviewReady: gate(true),
    monitoringReady: gate(true),
    reportReady: gate(true),
    exportReady: gate(false, ["review_required_for_export"]),
    ...overrides,
  };
}

function basePackage(overrides: Partial<ObservationPackage> = {}): ObservationPackage {
  const pkg: ObservationPackage = {
    packageVersion: "observation_package/v1.4",
    packageId: "pkg:test",
    generatedAt: "2026-05-14T00:00:00.000Z",
    visit: {
      visitId: "visit-1",
      legacyObservationId: null,
      observedAt: "2026-05-14T00:00:00.000Z",
      placeId: "place-1",
      locationPrecision: "point_medium",
      observedPrefecture: "Tokyo",
      observedMunicipality: "Hachioji",
      completeChecklistFlag: false,
      effortMinutes: null,
      distanceMeters: null,
      targetTaxaScope: null,
      visitMode: null,
      sourceKind: "citizen_post",
    },
    occurrences: [{
      occurrenceId: "occ-1",
      visitId: "visit-1",
      scientificName: null,
      vernacularName: "unknown plant",
      taxonRank: null,
      confidenceScore: null,
      evidenceTier: 0,
      qualityGrade: null,
      occurrenceStatus: "present",
      riskLane: "normal",
      safePublicRank: "unknown",
      sourcePayload: {},
    }],
    evidenceAssets: [{
      assetId: "asset-1",
      blobId: "blob-1",
      occurrenceId: "occ-1",
      visitId: "visit-1",
      mediaType: "image",
      mimeType: "image/jpeg",
      assetRole: "primary",
      mediaRole: "primary_subject",
      capturedAt: "2026-05-14T00:00:00.000Z",
      sha256: "abc",
      publicUrl: "https://example.invalid/photo.jpg",
    }],
    identifications: [],
    aiRuns: [],
    feedbackPayload: null,
    claimRefs: [],
    reviewState: {
      currentEvidenceTier: 0,
      tierLabel: "tier0",
      reviewStatus: "unreviewed",
      reviewPriority: "normal",
      requiredReviewerScope: null,
      blockingIssues: [],
      publicClaimLimit: "assistive_feedback_only",
    },
    reportOutputs: [],
    actionMode: "image_post",
    methodContext: {
      methodKind: "casual_photo",
      samplingProtocol: null,
      fixedSurveyTemplate: null,
      effortMinutes: null,
      targetTaxaScope: null,
      completeChecklistFlag: false,
      captureOutcome: null,
      siteTimeMethodEffortQuality: {
        hasSite: true,
        hasTime: true,
        hasMethod: false,
        hasEffort: false,
        hasQualityEvidence: true,
      },
      modelReadyBasis: ["site", "time", "quality"],
    },
    fieldScanContext: null,
    governanceContext: null,
    dataProductChain: {
      schemaVersion: "data_product_chain/v1",
      latestStage: "raw_observation",
      stages: [],
      events: [],
    },
    aiBoundary: {
      schemaVersion: "ai_boundary/v1",
      aiRoles: [],
      humanAuthorityRequiredFor: ["final_identification", "external_export"],
      humanDecisions: [],
      publicClaimLimit: "assistive_feedback_only",
    },
    trendAbundancePolicy: {
      claimAllowed: false,
      defaultClaimLimit: "presence_only",
      reasons: [],
      blockers: ["casual_record_presence_only"],
    },
    monitoringPackage: {
      packageId: "casual_observation",
      label: "Casual observation",
      primaryOutput: "public_learning",
      claimLimit: "presence_or_learning_only",
      pillars: ["new_technology_and_citizen_science"],
      readiness: { ready: true, present: ["site", "time", "quality"], missing: [] },
    },
    civicContext: {
      contextId: "civic-1",
      visitId: "visit-1",
      occurrenceId: "occ-1",
      contextKind: "ordinary",
      activityLabel: null,
      activityIntent: "discover",
      participantRole: "finder",
      audienceScope: "private",
      publicPrecision: "municipality",
      riskLane: "normal",
      reportConsent: "none",
      revisitOfVisitId: null,
      fieldId: null,
      routeId: null,
      plotId: null,
      sourcePayload: {},
    },
    dataRights: null,
    readiness: readiness(),
    extensions: { waterRecord: null },
    runtimeVersion: {
      gitSha: "abc123",
      builtAt: "2026-05-14T00:00:00.000Z",
      migrationHead: null,
      schemaVersion: "monitoring_package/v1.2",
      featureFlags: {},
      runtimeEnv: "test",
    },
  };
  return { ...pkg, ...overrides };
}

function contract(overrides: Partial<ObservationPackage> = {}): MonitoringRecordContractV0 {
  return buildMonitoringRecordContract(basePackage(overrides));
}

test("contract separates casual observations from protocol-ready records", () => {
  const result = contract();

  assert.equal(result.methodExtension.observationMethod, "casual_photo");
  assert.equal(result.effortDenominator.durationSeconds, null);
  assert.equal(result.verificationState.state, "unverified");
  assert.equal(result.aggregationExport.trendClaimLevel, "presence_only");
});

test("contract keeps guided survey effort and denominator fields explicit", () => {
  const result = contract({
    actionMode: "guide_survey",
    visit: {
      ...basePackage().visit,
      effortMinutes: 12,
      distanceMeters: 440,
      targetTaxaScope: "plants",
      visitMode: "survey",
      completeChecklistFlag: true,
    },
    methodContext: {
      ...basePackage().methodContext!,
      methodKind: "guided_survey",
      samplingProtocol: "guide_walk_effort_v1",
      effortMinutes: 12,
      targetTaxaScope: "plants",
      completeChecklistFlag: true,
      siteTimeMethodEffortQuality: {
        hasSite: true,
        hasTime: true,
        hasMethod: true,
        hasEffort: true,
        hasQualityEvidence: true,
      },
    },
  });

  assert.equal(result.methodExtension.observationMethod, "guided_survey");
  assert.equal(result.effortDenominator.durationSeconds, 720);
  assert.equal(result.effortDenominator.distanceMeters, 440);
  assert.equal(result.effortDenominator.targetTaxaScope, "plants");
  assert.equal(result.effortDenominator.completeChecklistFlag, true);
});

test("contract does not mix water no-catch with absence records", () => {
  const waterRecord = {
    visitId: "visit-1",
    occurrenceId: "occ-1",
    waterbodyId: "pond-1",
    waterbody: null,
    catchOutcome: "no_catch" as const,
    captureMethod: "net",
    participantCount: 2,
    effortMinutes: 30,
    targetTaxaScope: "fish",
    releasedCount: null,
    keptCount: null,
    publicWaterbodyLabel: "test pond",
    environmentSnapshot: {},
    sourcePayload: {},
  };
  const result = contract({
    actionMode: "guide_survey",
    methodContext: {
      ...basePackage().methodContext!,
      methodKind: "water_capture",
      samplingProtocol: "net",
      effortMinutes: 30,
      targetTaxaScope: "fish",
      captureOutcome: "no_catch",
    },
    extensions: { waterRecord },
  });

  assert.equal(result.methodExtension.observationMethod, "fishing");
  assert.equal(result.effortDenominator.noCatch, true);
  assert.equal(result.effortDenominator.noDetection, false);
  assert.equal(result.effortDenominator.observerCount, 2);
});

test("contract labels AI-only candidates without upgrading verification", () => {
  const result = contract({
    occurrences: [{
      ...basePackage().occurrences[0]!,
      scientificName: "Taraxacum officinale",
      taxonRank: "species",
      confidenceScore: 0.73,
      sourcePayload: { aiAssessmentStatus: "ai_judgement" },
    }],
    aiRuns: [{
      aiRunId: "run-1",
      visitId: "visit-1",
      triggerOccurrenceId: "occ-1",
      modelProvider: "openai",
      modelName: "test-model",
      promptVersion: "observation_reassess/v1",
      pipelineVersion: "test-pipeline",
      taxonomyVersion: "test-taxonomy",
      knowledgeVersionSet: {},
      inputAssetFingerprint: "asset-hash",
      runStatus: "succeeded",
    }],
  });

  assert.equal(result.verificationState.state, "ai_suggested");
  assert.equal(result.verificationState.label, "AI推定");
  assert.equal(result.aiProvenance.status, "ai_suggested");
  assert.equal(result.aiProvenance.runs[0]?.promptVersion, "observation_reassess/v1");
});

test("contract gives expert verified records authority but still preserves AI provenance", () => {
  const result = contract({
    occurrences: [{
      ...basePackage().occurrences[0]!,
      scientificName: "Taraxacum officinale",
      taxonRank: "species",
      evidenceTier: 3,
      safePublicRank: "species",
      confidenceScore: 0.8,
      sourcePayload: { aiAssessmentStatus: "ai_judgement" },
    }],
    identifications: [{
      identificationId: "id-1",
      occurrenceId: "occ-1",
      actorKind: "human",
      actorUserId: "reviewer-1",
      proposedName: "Taraxacum officinale",
      proposedRank: "species",
      confidenceScore: 0.9,
      isCurrent: true,
      rationale: "reviewed fixture",
      similarTaxaRuledOut: [],
      reviewScope: "expert",
    }],
    reviewState: {
      ...basePackage().reviewState,
      currentEvidenceTier: 3,
      reviewStatus: "verified",
      requiredReviewerScope: "expert",
    },
    aiRuns: [{
      aiRunId: "run-1",
      visitId: "visit-1",
      triggerOccurrenceId: "occ-1",
      modelProvider: "openai",
      modelName: "test-model",
      promptVersion: "observation_reassess/v1",
      pipelineVersion: "test-pipeline",
      taxonomyVersion: "test-taxonomy",
      knowledgeVersionSet: {},
      inputAssetFingerprint: "asset-hash",
      runStatus: "succeeded",
    }],
  });

  assert.equal(result.verificationState.state, "expert_verified");
  assert.equal(result.verificationState.label, "専門家確認");
  assert.equal(result.aiProvenance.status, "human_reviewed");
  assert.match(summarizeMonitoringRecordContractForPrompt(result), /verification=expert_verified\/専門家確認/);
});
