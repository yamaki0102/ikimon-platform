import type { ObservationPackage } from "./observationPackage.js";

export type MonitoringRecordObservationMethod =
  | "casual_photo"
  | "video"
  | "guided_survey"
  | "field_scan"
  | "fishing"
  | "identification"
  | "sensor"
  | "edna";

export type MonitoringVerificationState =
  | "unverified"
  | "ai_suggested"
  | "community_reviewed"
  | "expert_verified"
  | "needs_more_evidence"
  | "sensitive_hidden"
  | "rejected";

export type MonitoringRecordContractV0 = {
  schemaVersion: "monitoring_record_contract/v0";
  recordCore: {
    occurrenceId: string | null;
    visitId: string;
    observedAt: string;
    taxon: {
      scientificName: string | null;
      vernacularName: string | null;
      taxonRank: string | null;
      safePublicRank: string;
    };
    place: {
      placeId: string | null;
      prefecture: string | null;
      municipality: string | null;
      locationPrecision: string;
      publicPrecision: string;
      riskLane: string;
    };
    source: {
      sourceKind: string;
      dataProviderType: "citizen" | "project" | "sensor" | "legacy" | "system";
      dataUseContext: "personal_learning" | "site_management" | "public_summary" | "research_export";
    };
  };
  methodExtension: {
    observationMethod: MonitoringRecordObservationMethod;
    actionMode: string | null;
    methodKind: string | null;
    samplingProtocol: string | null;
    fixedSurveyTemplateId: string | null;
    methodMetadata: Record<string, unknown>;
  };
  effortDenominator: {
    durationSeconds: number | null;
    distanceMeters: number | null;
    observerCount: number | null;
    targetTaxaScope: string | null;
    completeChecklistFlag: boolean;
    noDetection: boolean;
    noCatch: boolean;
    repeatVisit: boolean;
    dataGapReasons: string[];
  };
  verificationState: {
    state: MonitoringVerificationState;
    label: string;
    evidenceTier: number | null;
    reviewStatus: string;
    communityAgreement: {
      humanIdentificationCount: number;
      currentHumanIdentificationCount: number;
      hasOpenConflict: boolean;
    };
    expertReview: {
      requiredReviewerScope: string | null;
      verifiedByEvidenceTier: boolean;
      verifiedByReviewState: boolean;
    };
  };
  aiProvenance: {
    status: "none" | "ai_suggested" | "human_reviewed" | "human_overridden";
    runs: Array<{
      aiRunId: string;
      modelProvider: string;
      modelName: string;
      promptVersion: string;
      pipelineVersion: string;
      taxonomyVersion: string;
      runStatus: string;
    }>;
    candidate: {
      scientificName: string | null;
      vernacularName: string | null;
      taxonRank: string | null;
      confidenceScore: number | null;
    } | null;
    evidenceAssetIds: string[];
    humanOverride: boolean;
  };
  protocolCampaign: {
    activityLabel: string | null;
    contextKind: string | null;
    campaignId: string | null;
    monitoringPackageId: string | null;
    monitoringPackageName: string | null;
  };
  aggregationExport: {
    latestStage: string | null;
    trendClaimLevel: string;
    trendOrAbundanceClaimAllowed: boolean;
    exportReady: boolean;
    externalExportAllowed: boolean;
    dataRightsReady: boolean;
    readinessBlockers: string[];
    runtimeVersion: string | null;
  };
};

export const MONITORING_VERIFICATION_LABELS: Record<MonitoringVerificationState, string> = {
  unverified: "未確認",
  ai_suggested: "AI推定",
  community_reviewed: "コミュニティ確認",
  expert_verified: "専門家確認",
  needs_more_evidence: "要追加証拠",
  sensitive_hidden: "秘匿中",
  rejected: "却下",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function payloadString(value: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
}

function providerType(pkg: ObservationPackage): MonitoringRecordContractV0["recordCore"]["source"]["dataProviderType"] {
  const sourceKind = pkg.visit.sourceKind.toLowerCase();
  if (sourceKind.includes("legacy")) return "legacy";
  if (["passive_audio", "camera_trap", "ias_route_camera", "edna_reference"].includes(pkg.actionMode ?? "")) return "sensor";
  if (pkg.civicContext && pkg.civicContext.contextKind !== "ordinary") return "project";
  if (sourceKind.includes("system")) return "system";
  return "citizen";
}

function dataUseContext(pkg: ObservationPackage): MonitoringRecordContractV0["recordCore"]["source"]["dataUseContext"] {
  if (pkg.dataRights?.externalExportAllowed || pkg.civicContext?.reportConsent === "research_export") return "research_export";
  if (pkg.civicContext?.contextKind === "site_summary" || pkg.dataRights?.enterpriseReportConsent === "aggregated" || pkg.dataRights?.enterpriseReportConsent === "identified") {
    return "site_management";
  }
  if (pkg.dataRights?.recordConsent === "public_summary" || pkg.civicContext?.reportConsent === "public_summary") return "public_summary";
  return "personal_learning";
}

function observationMethod(pkg: ObservationPackage): MonitoringRecordObservationMethod {
  switch (pkg.methodContext?.methodKind) {
    case "water_capture":
      return "fishing";
    case "identification_review":
      return "identification";
    case "passive_audio":
    case "camera_trap":
    case "ias_route_camera":
      return "sensor";
    case "edna_reference":
      return "edna";
    case "field_scan":
      return "field_scan";
    case "guided_survey":
      return "guided_survey";
    default:
      return pkg.actionMode === "video_post" ? "video" : "casual_photo";
  }
}

function hasAiSuggestion(pkg: ObservationPackage): boolean {
  return pkg.aiRuns.length > 0
    || pkg.occurrences.some((occurrence) => occurrence.sourcePayload.aiAssessmentStatus === "ai_judgement")
    || pkg.occurrences.some((occurrence) => Boolean(occurrence.confidenceScore));
}

function verificationState(pkg: ObservationPackage): MonitoringVerificationState {
  const target = pkg.occurrences[0] ?? null;
  const payload = asRecord(target?.sourcePayload);
  const quality = String(target?.qualityGrade ?? payload.dataQuality ?? payload.aiAssessmentStatus ?? "").toLowerCase();
  if (quality === "rejected" || quality === "reviewer_rejected") return "rejected";
  if (pkg.civicContext?.riskLane === "rare_sensitive" && pkg.civicContext.publicPrecision === "hidden") return "sensitive_hidden";
  if (pkg.reviewState.reviewStatus === "verified" || (target?.evidenceTier ?? 0) >= 3) return "expert_verified";
  if (pkg.identifications.some((identification) => identification.actorKind === "human" && identification.isCurrent)) return "community_reviewed";
  if (pkg.reviewState.blockingIssues.some((issue) => ["no_evidence", "no_safe_rank"].includes(issue))) return "needs_more_evidence";
  if (hasAiSuggestion(pkg)) return "ai_suggested";
  return "unverified";
}

function runtimeVersionLabel(pkg: ObservationPackage): string | null {
  if (!pkg.runtimeVersion) return null;
  const record = pkg.runtimeVersion as Record<string, unknown>;
  return [
    typeof record.gitSha === "string" ? record.gitSha : null,
    typeof record.migrationHead === "string" ? record.migrationHead : null,
  ].filter(Boolean).join("@") || null;
}

function campaignId(pkg: ObservationPackage): string | null {
  const civicPayload = asRecord(pkg.civicContext?.sourcePayload);
  return payloadString(civicPayload, "campaign_id", "campaignId", "event_code", "eventCode");
}

export function monitoringVerificationLabel(state: MonitoringVerificationState): string {
  return MONITORING_VERIFICATION_LABELS[state];
}

export function buildMonitoringRecordContract(pkg: ObservationPackage): MonitoringRecordContractV0 {
  const target = pkg.occurrences[0] ?? null;
  const waterRecord = pkg.extensions?.waterRecord ?? null;
  const state = verificationState(pkg);
  const humanIdentifications = pkg.identifications.filter((identification) => identification.actorKind === "human");
  const currentHumanIdentifications = humanIdentifications.filter((identification) => identification.isCurrent);
  const readinessBlockers = [
    ...(pkg.readiness?.reviewReady.blockers ?? []),
    ...(pkg.readiness?.monitoringReady.blockers ?? []),
    ...(pkg.readiness?.exportReady.blockers ?? []),
    ...(pkg.trendAbundancePolicy?.blockers ?? []),
  ];
  const evidenceAssetIds = pkg.evidenceAssets
    .filter((asset) => !target || asset.occurrenceId === target.occurrenceId || asset.visitId === pkg.visit.visitId)
    .map((asset) => asset.assetId);
  const humanOverride = currentHumanIdentifications.some((identification) =>
    target?.scientificName
      ? identification.proposedName !== target.scientificName && identification.proposedName !== target.vernacularName
      : true,
  );

  return {
    schemaVersion: "monitoring_record_contract/v0",
    recordCore: {
      occurrenceId: target?.occurrenceId ?? null,
      visitId: pkg.visit.visitId,
      observedAt: pkg.visit.observedAt,
      taxon: {
        scientificName: target?.scientificName ?? null,
        vernacularName: target?.vernacularName ?? null,
        taxonRank: target?.taxonRank ?? null,
        safePublicRank: target?.safePublicRank ?? "unknown",
      },
      place: {
        placeId: pkg.visit.placeId,
        prefecture: pkg.visit.observedPrefecture,
        municipality: pkg.visit.observedMunicipality,
        locationPrecision: pkg.visit.locationPrecision,
        publicPrecision: pkg.civicContext?.publicPrecision ?? "not_set",
        riskLane: pkg.civicContext?.riskLane ?? target?.riskLane ?? "normal",
      },
      source: {
        sourceKind: pkg.visit.sourceKind,
        dataProviderType: providerType(pkg),
        dataUseContext: dataUseContext(pkg),
      },
    },
    methodExtension: {
      observationMethod: observationMethod(pkg),
      actionMode: pkg.actionMode ?? null,
      methodKind: pkg.methodContext?.methodKind ?? null,
      samplingProtocol: pkg.methodContext?.samplingProtocol ?? null,
      fixedSurveyTemplateId: pkg.methodContext?.fixedSurveyTemplate?.templateId ?? null,
      methodMetadata: {
        monitoringPackageLabel: pkg.monitoringPackage?.label ?? null,
        fieldScanMode: pkg.fieldScanContext?.scanMode ?? null,
        captureOutcome: waterRecord?.catchOutcome ?? pkg.methodContext?.captureOutcome ?? null,
        modelReadyBasis: pkg.methodContext?.modelReadyBasis ?? [],
      },
    },
    effortDenominator: {
      durationSeconds: typeof pkg.methodContext?.effortMinutes === "number" ? Math.round(pkg.methodContext.effortMinutes * 60) : null,
      distanceMeters: pkg.visit.distanceMeters ?? null,
      observerCount: waterRecord?.participantCount ?? null,
      targetTaxaScope: pkg.methodContext?.targetTaxaScope ?? pkg.visit.targetTaxaScope,
      completeChecklistFlag: Boolean(pkg.methodContext?.completeChecklistFlag ?? pkg.visit.completeChecklistFlag),
      noDetection: target?.occurrenceStatus === "absent",
      noCatch: waterRecord?.catchOutcome === "no_catch",
      repeatVisit: Boolean(pkg.civicContext?.revisitOfVisitId),
      dataGapReasons: [...new Set([
        ...(pkg.readiness?.monitoringReady.blockers ?? []),
        ...(pkg.readiness?.indicatorReady?.blockers ?? []),
      ])],
    },
    verificationState: {
      state,
      label: monitoringVerificationLabel(state),
      evidenceTier: target?.evidenceTier ?? null,
      reviewStatus: pkg.reviewState.reviewStatus,
      communityAgreement: {
        humanIdentificationCount: humanIdentifications.length,
        currentHumanIdentificationCount: currentHumanIdentifications.length,
        hasOpenConflict: pkg.reviewState.blockingIssues.includes("open_dispute"),
      },
      expertReview: {
        requiredReviewerScope: pkg.reviewState.requiredReviewerScope,
        verifiedByEvidenceTier: (target?.evidenceTier ?? 0) >= 3,
        verifiedByReviewState: pkg.reviewState.reviewStatus === "verified",
      },
    },
    aiProvenance: {
      status: pkg.aiRuns.length === 0 && !hasAiSuggestion(pkg)
        ? "none"
        : humanOverride
          ? "human_overridden"
          : humanIdentifications.length > 0 || pkg.reviewState.reviewStatus === "verified"
            ? "human_reviewed"
            : "ai_suggested",
      runs: pkg.aiRuns.map((run) => ({
        aiRunId: run.aiRunId,
        modelProvider: run.modelProvider,
        modelName: run.modelName,
        promptVersion: run.promptVersion,
        pipelineVersion: run.pipelineVersion,
        taxonomyVersion: run.taxonomyVersion,
        runStatus: run.runStatus,
      })),
      candidate: target
        ? {
            scientificName: target.scientificName,
            vernacularName: target.vernacularName,
            taxonRank: target.taxonRank,
            confidenceScore: target.confidenceScore,
          }
        : null,
      evidenceAssetIds,
      humanOverride,
    },
    protocolCampaign: {
      activityLabel: pkg.civicContext?.activityLabel ?? null,
      contextKind: pkg.civicContext?.contextKind ?? null,
      campaignId: campaignId(pkg),
      monitoringPackageId: pkg.monitoringPackage?.packageId ?? null,
      monitoringPackageName: pkg.monitoringPackage?.label ?? null,
    },
    aggregationExport: {
      latestStage: pkg.dataProductChain?.latestStage ?? null,
      trendClaimLevel: pkg.trendAbundancePolicy?.defaultClaimLimit ?? "presence_only",
      trendOrAbundanceClaimAllowed: Boolean(pkg.trendAbundancePolicy?.claimAllowed),
      exportReady: Boolean(pkg.readiness?.exportReady.ready),
      externalExportAllowed: Boolean(pkg.dataRights?.externalExportAllowed),
      dataRightsReady: Boolean(pkg.dataRights?.externalExportAllowed || pkg.dataRights?.recordConsent === "public_summary"),
      readinessBlockers: [...new Set(readinessBlockers)],
      runtimeVersion: runtimeVersionLabel(pkg),
    },
  };
}

export function summarizeMonitoringRecordContractForPrompt(contract: MonitoringRecordContractV0 | null | undefined): string {
  if (!contract) return "monitoring_contract=unavailable";
  return [
    `monitoring_contract=${contract.schemaVersion}`,
    `record_core=${contract.recordCore.visitId}/${contract.recordCore.occurrenceId ?? "no_occurrence"}`,
    `method=${contract.methodExtension.observationMethod}`,
    `verification=${contract.verificationState.state}/${contract.verificationState.label}`,
    `ai_provenance=${contract.aiProvenance.status}`,
    `trend_claim=${contract.aggregationExport.trendClaimLevel}`,
    `export_ready=${contract.aggregationExport.exportReady ? "true" : "false"}`,
    contract.aggregationExport.readinessBlockers.length > 0
      ? `readiness_blockers=${contract.aggregationExport.readinessBlockers.slice(0, 6).join(",")}`
      : "",
  ].filter(Boolean).join("\n");
}
