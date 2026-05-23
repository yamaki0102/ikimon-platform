import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMonitoringWorkspaceReadModel,
  type MonitoringWorkspaceRecordInput,
} from "./monitoringWorkspaceReadModel.js";
import type {
  MonitoringRecordContractV0,
  MonitoringVerificationState,
} from "./monitoringRecordContract.js";

function contract(options: {
  state?: MonitoringVerificationState;
  exportReady?: boolean;
  publicPrecision?: string;
  riskLane?: string;
  effortMinutes?: number;
  blockers?: string[];
} = {}): MonitoringRecordContractV0 {
  const state = options.state ?? "ai_suggested";
  return {
    schemaVersion: "monitoring_record_contract/v0",
    recordCore: {
      occurrenceId: "occ-1",
      visitId: "visit-1",
      observedAt: "2026-04-10T00:00:00.000Z",
      taxon: {
        scientificName: state === "unverified" ? null : "Taraxacum officinale",
        vernacularName: state === "unverified" ? null : "セイヨウタンポポ",
        taxonRank: state === "unverified" ? null : "species",
        safePublicRank: "species",
      },
      place: {
        placeId: "place-1",
        prefecture: "静岡県",
        municipality: "浜松市",
        locationPrecision: "point_medium",
        publicPrecision: options.publicPrecision ?? "municipality",
        riskLane: options.riskLane ?? "normal",
      },
      source: {
        sourceKind: "citizen_post",
        dataProviderType: "citizen",
        dataUseContext: "site_management",
      },
    },
    methodExtension: {
      observationMethod: "guided_survey",
      actionMode: "guide_survey",
      methodKind: "guided_survey",
      samplingProtocol: "guide_walk_effort_v1",
      fixedSurveyTemplateId: null,
      methodMetadata: {},
    },
    effortDenominator: {
      durationSeconds: Math.round((options.effortMinutes ?? 0) * 60),
      distanceMeters: null,
      observerCount: null,
      targetTaxaScope: "plants",
      completeChecklistFlag: false,
      noDetection: false,
      noCatch: false,
      repeatVisit: false,
      dataGapReasons: [],
    },
    verificationState: {
      state,
      label: state,
      evidenceTier: state === "expert_verified" ? 3 : 1,
      reviewStatus: state === "expert_verified" ? "verified" : "needs_review",
      communityAgreement: {
        humanIdentificationCount: state === "community_reviewed" ? 1 : 0,
        currentHumanIdentificationCount: state === "community_reviewed" ? 1 : 0,
        hasOpenConflict: false,
      },
      expertReview: {
        requiredReviewerScope: null,
        verifiedByEvidenceTier: state === "expert_verified",
        verifiedByReviewState: state === "expert_verified",
      },
    },
    aiProvenance: {
      status: state === "ai_suggested" ? "ai_suggested" : "human_reviewed",
      runs: [],
      candidate: null,
      evidenceAssetIds: [],
      humanOverride: false,
    },
    protocolCampaign: {
      activityLabel: null,
      contextKind: "site_summary",
      campaignId: null,
      monitoringPackageId: "guided_survey",
      monitoringPackageName: "Guided survey",
    },
    aggregationExport: {
      latestStage: "indicator_candidate",
      trendClaimLevel: "presence_only",
      trendOrAbundanceClaimAllowed: false,
      exportReady: options.exportReady ?? false,
      externalExportAllowed: options.exportReady ?? false,
      dataRightsReady: options.exportReady ?? false,
      readinessBlockers: options.blockers ?? (options.exportReady ? [] : ["review_required_for_export"]),
      runtimeVersion: "test",
    },
  };
}

function record(
  recordId: string,
  overrides: Partial<MonitoringWorkspaceRecordInput> & {
    lat?: number;
    lng?: number;
    state?: MonitoringVerificationState;
    exportReady?: boolean;
    publicPrecision?: string;
    riskLane?: string;
    effortMinutes?: number;
    blockers?: string[];
  } = {},
): MonitoringWorkspaceRecordInput {
  const point = Object.hasOwn(overrides, "point")
    ? overrides.point!
    : {
        lat: overrides.lat ?? 34.71,
        lng: overrides.lng ?? 137.72,
        publicPrecision: overrides.publicPrecision ?? "municipality",
      };
  return {
    recordId,
    observedAt: overrides.observedAt ?? "2026-04-10T09:00:00.000Z",
    point,
    tags: overrides.tags ?? ["plants"],
    fieldIds: overrides.fieldIds ?? [],
    contract: overrides.contract ?? contract({
      state: overrides.state,
      exportReady: overrides.exportReady,
      publicPrecision: overrides.publicPrecision,
      riskLane: overrides.riskLane,
      effortMinutes: overrides.effortMinutes,
      blockers: overrides.blockers,
    }),
  };
}

const area = {
  areaId: "contract-area-1",
  label: "テスト緑地",
  bbox: [137.7, 34.7, 137.8, 34.8] as [number, number, number, number],
  polygon: {
    type: "Polygon",
    coordinates: [[
      [137.7, 34.7],
      [137.8, 34.7],
      [137.8, 34.8],
      [137.7, 34.8],
      [137.7, 34.7],
    ]],
  },
};

test("workspace read model dynamically scopes records by contract area and term", () => {
  const model = buildMonitoringWorkspaceReadModel({
    workspaceId: "workspace-1",
    label: "P0 workspace",
    area,
    term: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-30T23:59:59.999Z" },
    gridStepDegrees: 0.05,
    records: [
      record("inside-confirmed", { state: "expert_verified", exportReady: true, effortMinutes: 30 }),
      record("outside-area", { lng: 138.0 }),
      record("outside-term", { observedAt: "2026-05-01T00:00:00.000Z" }),
      record("missing-point", { point: null }),
    ],
  });

  assert.equal(model.summary.scopedRecordCount, 1);
  assert.equal(model.summary.excludedRecordCount, 3);
  assert.deepEqual(model.excludedRecords.map((item) => item.reason).sort(), [
    "missing_point",
    "outside_area",
    "outside_term",
  ]);
  assert.equal(model.summary.confirmedCount, 1);
  assert.equal(model.summary.exportReadyCount, 1);
  assert.equal(model.operationQueues.export_request.length, 1);
});

test("workspace read model separates area aggregation from formal export readiness", () => {
  const model = buildMonitoringWorkspaceReadModel({
    workspaceId: "workspace-1",
    label: "P0 workspace",
    area,
    term: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-30T23:59:59.999Z" },
    gridStepDegrees: 0.05,
    records: [
      record("ai-candidate", { state: "ai_suggested", exportReady: false, blockers: ["review_required_for_export"] }),
    ],
  });

  assert.equal(model.summary.scopedRecordCount, 1);
  assert.equal(model.summary.candidateCount, 1);
  assert.equal(model.summary.exportReadyCount, 0);
  assert.equal(model.reportReadiness.ready, false);
  assert.ok(model.reportReadiness.checklist.some((item) => item.blockers.includes("export_ready_record_missing")));
  assert.equal(model.operationQueues.identification_waiting[0]?.targetId, "ai-candidate");
});

test("workspace read model keeps mesh coverage and season coverage as operation KPIs", () => {
  const model = buildMonitoringWorkspaceReadModel({
    workspaceId: "workspace-1",
    label: "P0 workspace",
    area,
    term: { start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T23:59:59.999Z" },
    gridStepDegrees: 0.05,
    records: [
      record("spring", { observedAt: "2026-04-10T09:00:00.000Z", state: "expert_verified", effortMinutes: 20 }),
      record("summer", { observedAt: "2026-07-10T09:00:00.000Z", state: "expert_verified", lat: 34.76, lng: 137.76, effortMinutes: 20 }),
    ],
    reportPurpose: "area_strengthening",
  });

  assert.equal(model.grid.length, 4);
  assert.equal(model.summary.meshCoverageRate, 0.5);
  assert.equal(model.summary.seasonCoverageRate, 0.167);
  assert.equal(model.reportReadiness.ready, true);
  assert.ok(model.operationQueues.area_coverage_attention.some((item) => item.reasons.includes("cell_has_no_records")));
});

test("workspace read model flags sensitive or unset public precision for location review", () => {
  const model = buildMonitoringWorkspaceReadModel({
    workspaceId: "workspace-1",
    label: "P0 workspace",
    area,
    term: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-30T23:59:59.999Z" },
    gridStepDegrees: 0.05,
    records: [
      record("rare-sensitive", {
        state: "expert_verified",
        exportReady: true,
        publicPrecision: "hidden",
        riskLane: "rare_sensitive",
      }),
    ],
  });

  assert.equal(model.operationQueues.location_privacy_review.length, 1);
  assert.equal(model.operationQueues.location_privacy_review[0]?.targetId, "rare-sensitive");
  assert.equal(model.reportReadiness.ready, false);
  assert.ok(model.reportReadiness.checklist.some((item) => item.blockers.includes("location_privacy_review_pending")));
});

test("identification strengthening report becomes ready when candidate records exist", () => {
  const model = buildMonitoringWorkspaceReadModel({
    workspaceId: "workspace-1",
    label: "P0 workspace",
    area,
    term: { start: "2026-04-01T00:00:00.000Z", end: "2026-04-30T23:59:59.999Z" },
    gridStepDegrees: 0.05,
    reportPurpose: "identification_strengthening",
    records: [
      record("candidate", { state: "ai_suggested", exportReady: false }),
    ],
  });

  assert.equal(model.reportReadiness.ready, true);
  assert.equal(model.operationQueues.export_request[0]?.targetId, "identification_strengthening");
});
