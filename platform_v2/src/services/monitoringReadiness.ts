import type { CivicObservationContext } from "./civicNatureContext.js";
import type { ObservationDataRights } from "./observationDataRights.js";
import type {
  FieldScanContext,
  ObservationDataProductChain,
  ObservationGovernanceContext,
  ObservationMethodContext,
  TrendAbundancePolicy,
} from "./observationPackageDataChain.js";
import type { WaterRecordExtension } from "./waterRecordExtension.js";

export type ReadinessGate = {
  ready: boolean;
  reasons: string[];
  blockers: string[];
};

export type MonitoringReadiness = {
  schemaVersion: "monitoring_readiness/v1" | "monitoring_readiness/v1.1";
  reviewReady: ReadinessGate;
  monitoringReady: ReadinessGate;
  reportReady: ReadinessGate;
  exportReady: ReadinessGate;
  fieldScanReady?: ReadinessGate;
  governanceReady?: ReadinessGate;
  modelReady?: ReadinessGate;
  indicatorReady?: ReadinessGate;
};

export type MonitoringReadinessInput = {
  visit: {
    locationPrecision: string;
    visitMode?: string | null;
    effortMinutes?: number | null;
    targetTaxaScope?: string | null;
    completeChecklistFlag?: boolean | null;
    placeId?: string | null;
  };
  occurrences: Array<{
    scientificName?: string | null;
    vernacularName?: string | null;
    taxonRank?: string | null;
    evidenceTier?: number | null;
    basisOfRecord?: string | null;
    dataQuality?: string | null;
    aiAssessmentStatus?: string | null;
    occurrenceStatus?: string | null;
    riskLane?: string | null;
    safePublicRank?: string | null;
  }>;
  evidenceAssets: Array<unknown>;
  reviewState: {
    reviewStatus: string;
    blockingIssues: string[];
  };
  civicContext: CivicObservationContext | null;
  dataRights: ObservationDataRights | null;
  waterRecord: WaterRecordExtension | null;
  methodContext?: ObservationMethodContext | null;
  fieldScanContext?: FieldScanContext | null;
  governanceContext?: ObservationGovernanceContext | null;
  dataProductChain?: ObservationDataProductChain | null;
  trendAbundancePolicy?: TrendAbundancePolicy | null;
};

function gate(reasons: string[], blockers: string[]): ReadinessGate {
  return {
    ready: blockers.length === 0,
    reasons,
    blockers,
  };
}

function hasIdentification(input: MonitoringReadinessInput): boolean {
  return input.occurrences.some((occurrence) =>
    Boolean(
      occurrence.scientificName?.trim()
      || occurrence.vernacularName?.trim()
      || occurrence.taxonRank?.trim(),
    ),
  );
}

function bestEvidenceTier(input: MonitoringReadinessInput): number {
  return Math.max(0, ...input.occurrences.map((occurrence) => occurrence.evidenceTier ?? 0));
}

function hasUnreviewedMachineObservation(input: MonitoringReadinessInput): boolean {
  return input.occurrences.some((occurrence) =>
    occurrence.basisOfRecord === "MachineObservation"
    && occurrence.aiAssessmentStatus !== "reviewer_verified"
    && occurrence.dataQuality !== "reviewer_verified",
  );
}

function hasLocation(input: MonitoringReadinessInput): boolean {
  return input.visit.locationPrecision !== "unknown";
}

function highRisk(input: MonitoringReadinessInput): boolean {
  return input.occurrences.some((occurrence) => {
    const lane = occurrence.riskLane ?? "normal";
    return lane !== "normal" && lane !== "unknown";
  }) || input.civicContext?.riskLane === "rare_sensitive";
}

function hasObject(value: Record<string, unknown> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function buildReviewReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (input.evidenceAssets.length > 0) reasons.push("has_evidence_asset");
  else blockers.push("missing_evidence_asset");
  if (hasLocation(input)) reasons.push("has_location_context");
  else blockers.push("missing_location_context");
  if (hasIdentification(input)) reasons.push("has_identification_candidate");
  else blockers.push("missing_identification_candidate");
  if (highRisk(input) && input.reviewState.reviewStatus !== "verified") {
    blockers.push("scoped_review_required_for_risk_lane");
  }
  if (input.reviewState.blockingIssues.length === 0) reasons.push("no_package_review_blocker");
  else blockers.push(...input.reviewState.blockingIssues.map((issue) => `package_${issue}`));
  if (hasUnreviewedMachineObservation(input)) blockers.push("machine_observation_human_review_required");
  return gate(reasons, [...new Set(blockers)]);
}

function buildMonitoringReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const effortMinutes = input.waterRecord?.effortMinutes ?? input.visit.effortMinutes ?? null;
  const targetTaxaScope = input.waterRecord?.targetTaxaScope ?? input.visit.targetTaxaScope ?? null;
  const hasEffort = typeof effortMinutes === "number" && effortMinutes > 0;
  const hasTarget = Boolean(targetTaxaScope?.trim());
  const hasProtocol = input.visit.visitMode === "survey" || Boolean(input.waterRecord);
  const hasOutcome = Boolean(input.waterRecord?.catchOutcome)
    || input.occurrences.some((occurrence) => Boolean(occurrence.occurrenceStatus));
  const hasSite = Boolean(input.visit.placeId || input.civicContext?.fieldId || input.civicContext?.plotId || input.waterRecord?.waterbodyId || input.waterRecord?.publicWaterbodyLabel);

  if (hasEffort) reasons.push("has_effort");
  else blockers.push("missing_effort");
  if (hasTarget) reasons.push("has_target_scope");
  else blockers.push("missing_target_scope");
  if (hasProtocol) reasons.push("has_sampling_protocol");
  else blockers.push("missing_sampling_protocol");
  if (hasOutcome) reasons.push("has_detection_or_capture_outcome");
  else blockers.push("missing_detection_or_capture_outcome");
  if (hasSite) reasons.push("has_site_or_waterbody");
  else blockers.push("missing_site_or_waterbody");
  if (input.waterRecord?.catchOutcome === "no_catch") reasons.push("no_catch_kept_as_capture_attempt");
  return gate(reasons, [...new Set(blockers)]);
}

function buildReportReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const tier = bestEvidenceTier(input);
  if (input.civicContext) reasons.push("has_civic_context");
  else blockers.push("missing_civic_context");
  if (input.civicContext?.publicPrecision) reasons.push(`public_precision_${input.civicContext.publicPrecision}`);
  else blockers.push("missing_public_precision");
  if (tier >= 1) reasons.push("has_minimum_evidence_tier");
  else blockers.push("missing_evidence_tier");
  if (input.civicContext?.reportConsent && input.civicContext.reportConsent !== "none") {
    reasons.push(`report_consent_${input.civicContext.reportConsent}`);
  } else {
    blockers.push("missing_report_consent");
  }
  if (hasUnreviewedMachineObservation(input)) {
    reasons.push("machine_observation_as_ai_candidate_only");
  }
  return gate(reasons, [...new Set(blockers)]);
}

function buildExportReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const rights = input.dataRights;
  const tier = bestEvidenceTier(input);
  if (rights?.externalExportAllowed) reasons.push("external_export_allowed");
  else blockers.push("external_export_not_allowed");
  if (rights?.datasetLicense) reasons.push(`dataset_license_${rights.datasetLicense}`);
  else blockers.push("missing_dataset_license");
  if (rights?.mediaLicense) reasons.push(`media_license_${rights.mediaLicense}`);
  else blockers.push("missing_media_license");
  if (rights?.withdrawalStatus === "active") reasons.push("rights_active");
  else blockers.push("rights_withdrawn_or_missing");
  if (hasIdentification(input)) reasons.push("has_taxon_for_export");
  else blockers.push("missing_taxon_for_export");
  if (input.civicContext?.publicPrecision && input.civicContext.publicPrecision !== "exact_private") {
    reasons.push(`location_generalized_${input.civicContext.publicPrecision}`);
  } else {
    blockers.push("missing_location_generalization");
  }
  if (tier >= 3 || input.reviewState.reviewStatus === "verified") reasons.push("reviewed_for_export");
  else blockers.push("review_required_for_export");
  if (hasUnreviewedMachineObservation(input)) blockers.push("machine_observation_review_required_for_export");
  return gate(reasons, [...new Set(blockers)]);
}

function buildFieldScanReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const fieldScan = input.fieldScanContext;
  if (!fieldScan) {
    return gate(["not_applicable_non_field_scan_record"], []);
  }
  reasons.push(`field_scan_mode_${fieldScan.scanMode}`);
  const hasAnchor = Boolean(
    fieldScan.fixedPointId
    || fieldScan.routeId
    || fieldScan.areaId
    || hasObject(fieldScan.footprintGeometry),
  );
  if (hasAnchor) reasons.push("has_scan_anchor_or_footprint");
  else blockers.push("missing_scan_anchor_or_footprint");
  if (input.methodContext?.siteTimeMethodEffortQuality.hasMethod || hasObject(fieldScan.methodPayload)) reasons.push("has_scan_method");
  else blockers.push("missing_scan_method");
  if (hasObject(fieldScan.qualityPayload) || input.evidenceAssets.length > 0) reasons.push("has_quality_evidence");
  else blockers.push("missing_quality_evidence");
  if (fieldScan.scanMode === "calibration_evidence") {
    if (hasObject(fieldScan.calibrationEvidence)) reasons.push("has_calibration_evidence");
    else blockers.push("missing_calibration_evidence");
  }
  return gate(reasons, [...new Set(blockers)]);
}

function buildGovernanceReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (input.dataRights) reasons.push("has_consent_record");
  else blockers.push("missing_consent_record");
  if (input.civicContext?.publicPrecision) reasons.push(`public_precision_${input.civicContext.publicPrecision}`);
  else blockers.push("missing_public_precision_policy_output");
  if (input.governanceContext) {
    reasons.push(`public_precision_policy_${input.governanceContext.publicPrecisionPolicy}`);
    if (hasObject(input.governanceContext.sitePolicyContext)) reasons.push("has_site_policy_context");
    else blockers.push("missing_site_policy_context");
    if (hasObject(input.governanceContext.reviewScope)) reasons.push("has_review_scope");
    else blockers.push("missing_review_scope");
    if (hasObject(input.governanceContext.localKnowledgeContext)) reasons.push("has_local_knowledge_context");
  } else {
    blockers.push("missing_governance_context");
  }
  if (highRisk(input) && input.governanceContext?.publicPrecisionPolicy !== "system_risk_cap") {
    blockers.push("system_risk_cap_must_override_for_sensitive_records");
  }
  return gate(reasons, [...new Set(blockers)]);
}

function buildModelReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const keys = input.methodContext?.siteTimeMethodEffortQuality;
  const hasSite = keys?.hasSite ?? Boolean(input.visit.placeId || input.civicContext?.fieldId || input.waterRecord?.waterbodyId);
  const hasTime = keys?.hasTime ?? true;
  const hasMethod = keys?.hasMethod ?? Boolean(input.visit.visitMode === "survey" || input.waterRecord || input.fieldScanContext);
  const hasEffort = keys?.hasEffort ?? Boolean(input.visit.effortMinutes || input.waterRecord?.effortMinutes);
  const hasQuality = keys?.hasQualityEvidence ?? input.evidenceAssets.length > 0;

  if (hasSite) reasons.push("has_site");
  else blockers.push("missing_site");
  if (hasTime) reasons.push("has_time");
  else blockers.push("missing_time");
  if (hasMethod) reasons.push("has_method");
  else blockers.push("missing_method");
  if (hasEffort) reasons.push("has_effort");
  else blockers.push("missing_effort");
  if (hasQuality) reasons.push("has_quality_evidence");
  else blockers.push("missing_quality_evidence");
  if (input.governanceContext || input.civicContext) reasons.push("has_governance_or_civic_context");
  else blockers.push("missing_governance_or_civic_context");
  return gate(reasons, [...new Set(blockers)]);
}

function buildIndicatorReady(input: MonitoringReadinessInput): ReadinessGate {
  const reasons: string[] = [];
  const blockers: string[] = [];
  const policy = input.trendAbundancePolicy;
  if (input.dataProductChain?.latestStage === "indicator_candidate") reasons.push("has_indicator_candidate_event");
  if (policy?.claimAllowed) {
    reasons.push("trend_or_abundance_claim_allowed");
  } else {
    reasons.push(`default_claim_limit_${policy?.defaultClaimLimit ?? "presence_only"}`);
    blockers.push(...(policy?.blockers ?? ["trend_claim_not_allowed_without_repeat_protocol"]));
  }
  if (input.reviewState.reviewStatus === "verified") reasons.push("human_reviewed");
  else blockers.push("human_review_required_for_indicator");
  return gate(reasons, [...new Set(blockers)]);
}

export function buildMonitoringReadiness(input: MonitoringReadinessInput): MonitoringReadiness {
  return {
    schemaVersion: "monitoring_readiness/v1.1",
    reviewReady: buildReviewReady(input),
    monitoringReady: buildMonitoringReady(input),
    reportReady: buildReportReady(input),
    exportReady: buildExportReady(input),
    fieldScanReady: buildFieldScanReady(input),
    governanceReady: buildGovernanceReady(input),
    modelReady: buildModelReady(input),
    indicatorReady: buildIndicatorReady(input),
  };
}
